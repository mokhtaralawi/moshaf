import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { enqueueSyncAction } from './syncService';
import {
  getOrCreateUserKeyPair,
  saveMemberPublicKeys,
  getMemberPublicKeys,
  encryptGroupMessage,
  decryptGroupMessage,
  calculateFingerprint,
} from './chatCryptoService';

const STORAGE_KEYS = {
  MESSAGES: '@quran_wird_group_messages',
  DECRYPTED_CACHE: '@quran_wird_chat_decrypted_cache',
  LAST_READ_TIMESTAMP: '@quran_wird_chat_last_read_ts',
};

// مراقبو تحديثات الرسائل
const chatListeners = new Set();
// مراقبو عداد الرسائل غير المقروءة
const unreadListeners = new Set();

let realtimeChannel = null;
let currentActiveUserId = null;
let isChatOpen = false;

const notifyChatListeners = (messages) => {
  chatListeners.forEach((listener) => {
    try {
      listener(messages);
    } catch (e) {
      console.error('خطأ في إشعار مراقب الدردشة:', e);
    }
  });
};

const notifyUnreadListeners = (count) => {
  unreadListeners.forEach((listener) => {
    try {
      listener(count);
    } catch (e) {
      console.error('خطأ في إشعار عداد غير المقروء:', e);
    }
  });
};

/**
 * 1. تهيئة خدمة الدردشة للمستخدم الحالي:
 * - توليد/تحميل زوج مفاتيح التشفير RSA
 * - تسجيل المفتاح العام في المجموعة
 * - الاشتراك في قناة Supabase Realtime للرسائل اللحظية
 */
export const initChatService = async (currentUser) => {
  if (!currentUser) return;
  const userId = String(currentUser.id || currentUser.readerId || currentUser.username);
  currentActiveUserId = userId;

  try {
    // 1. التأكد من وجود زوج مفاتيح التشفير
    const keyPair = await getOrCreateUserKeyPair(userId);

    // 2. تسجيل المفتاح العام إذا لم يكن مسجلاً في السحابة
    const localKeys = await getMemberPublicKeys();
    if (!localKeys[userId] || localKeys[userId] !== keyPair.publicKeyPem) {
      localKeys[userId] = keyPair.publicKeyPem;
      await saveMemberPublicKeys(localKeys);

      await enqueueSyncAction('REGISTER_CHAT_PUBLIC_KEY', {
        userId,
        userName: currentUser.name || 'قارئ',
        publicKey: keyPair.publicKeyPem,
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. الاشتراك اللحظي عبر Supabase Realtime Broadcast
    setupRealtimeSubscription(currentUser);

    // 4. تحديث عداد غير المقروء
    await refreshUnreadCount();
  } catch (error) {
    console.error('خطأ أثناء تهيئة خدمة المحادثة المشفرة:', error);
  }
};

/**
 * 2. الاشتراك في قناة Supabase Realtime اللحظية
 */
const setupRealtimeSubscription = (currentUser) => {
  if (!supabase) return;
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch (_e) {}
  }

  try {
    realtimeChannel = supabase.channel('quran_wird_group_chat', {
      config: { broadcast: { self: false } },
    });

    // استقبال الرسائل المشفرة فور إرسالها من أي عضو
    realtimeChannel.on('broadcast', { event: 'new_group_message' }, async ({ payload }) => {
      if (!payload || !payload.id) return;
      await handleIncomingMessage(payload, currentUser);
    });

    // استقبال المفاتيح العامة الجديدة عند انضمام أعضاء
    realtimeChannel.on('broadcast', { event: 'new_member_key' }, async ({ payload }) => {
      if (payload && payload.userId && payload.publicKey) {
        const keys = await getMemberPublicKeys();
        keys[payload.userId] = payload.publicKey;
        await saveMemberPublicKeys(keys);
      }
    });

    realtimeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // إشعار بوجود مفتاح المستخدم الحالي
        if (currentUser) {
          const userId = String(currentUser.id || currentUser.readerId || currentUser.username);
          getOrCreateUserKeyPair(userId).then((kp) => {
            realtimeChannel.send({
              type: 'broadcast',
              event: 'new_member_key',
              payload: { userId, publicKey: kp.publicKeyPem },
            }).catch(() => {});
          });
        }
      }
    });
  } catch (e) {
    console.warn('تنبيه أثناء تهيئة اشتراك Realtime للدردشة:', e);
  }
};

/**
 * 3. استرجاع قائمة الرسائل وفك تشفيرها للمستخدم الحالي
 */
export const loadChatMessages = async (currentUser) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
    const messages = raw ? JSON.parse(raw) : [];

    if (!currentUser) return messages;

    const rawCache = await AsyncStorage.getItem(STORAGE_KEYS.DECRYPTED_CACHE);
    const decryptedCache = rawCache ? JSON.parse(rawCache) : {};
    const publicKeys = await getMemberPublicKeys();

    let hasNewDecryptions = false;

    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        // إذا كانت الرسالة محلولة ومخزنة مسبقاً
        if (decryptedCache[msg.id]) {
          return {
            ...msg,
            decryptedText: decryptedCache[msg.id].text,
            isVerified: decryptedCache[msg.id].isVerified,
            isUndecryptable: decryptedCache[msg.id].isUndecryptable,
          };
        }

        // فك تشفير الرسالة
        const senderPubPem = publicKeys[msg.senderId];
        const res = await decryptGroupMessage({
          encryptedMessage: msg,
          currentUser,
          senderPublicPem: senderPubPem,
        });

        decryptedCache[msg.id] = {
          text: res.text,
          isVerified: res.isVerified,
          isUndecryptable: res.isUndecryptable,
        };
        hasNewDecryptions = true;

        return {
          ...msg,
          decryptedText: res.text,
          isVerified: res.isVerified,
          isUndecryptable: res.isUndecryptable,
        };
      })
    );

    if (hasNewDecryptions) {
      await AsyncStorage.setItem(STORAGE_KEYS.DECRYPTED_CACHE, JSON.stringify(decryptedCache));
    }

    return decryptedList;
  } catch (error) {
    console.error('خطأ في استرجاع رسائل المحادثة:', error);
    return [];
  }
};

/**
 * 4. إرسال رسالة جديدة مشفرة E2EE في المجموعة
 */
export const sendGroupMessage = async ({ text, currentUser }) => {
  if (!text || !text.trim() || !currentUser) {
    return { success: false, error: 'النص مطلوب' };
  }

  try {
    const cleanText = text.trim();
    const membersKeys = await getMemberPublicKeys();

    // 1. تشفير الرسالة بنظام RSA-OAEP / AES-256
    const encryptedPacket = await encryptGroupMessage({
      text: cleanText,
      senderUser: currentUser,
      membersPublicKeysMap: membersKeys,
    });

    // 2. الحفظ في الذاكرة المحلية فوراً
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
    const messages = raw ? JSON.parse(raw) : [];
    messages.push(encryptedPacket);
    await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));

    // 3. تخزين النص الصريح في الكاش المحلي للمرسل لتجنب فك تشفير رسالته لاحقاً
    const rawCache = await AsyncStorage.getItem(STORAGE_KEYS.DECRYPTED_CACHE);
    const cache = rawCache ? JSON.parse(rawCache) : {};
    cache[encryptedPacket.id] = {
      text: cleanText,
      isVerified: true,
      isUndecryptable: false,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.DECRYPTED_CACHE, JSON.stringify(cache));

    // 4. البث اللحظي السريع عبر Supabase Realtime لجميع المتصلين
    if (realtimeChannel) {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'new_group_message',
        payload: encryptedPacket,
      }).catch((e) => console.log('Realtime broadcast error:', e));
    }

    // 5. إدراج في طابور المزامنة الدائمة في السحابة
    await enqueueSyncAction('SEND_GROUP_MESSAGE', {
      message: encryptedPacket,
    });

    // إشعار الواجهات
    const fullList = messages.map((m) => ({
      ...m,
      decryptedText: cache[m.id]?.text || '🔒 [مشفر]',
      isVerified: cache[m.id]?.isVerified ?? true,
    }));
    notifyChatListeners(fullList);

    return { success: true, message: encryptedPacket };
  } catch (error) {
    console.error('خطأ أثناء تشفير وإرسال الرسالة:', error);
    return { success: false, error: error.message || 'تعذر إرسال الرسالة' };
  }
};

/**
 * 5. معالجة رسالة جديدة قادمة عبر Realtime أو المزامنة
 */
export const handleIncomingMessage = async (msgPacket, currentUser) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
    const messages = raw ? JSON.parse(raw) : [];

    const exists = messages.some((m) => m.id === msgPacket.id);
    if (exists) return;

    messages.push(msgPacket);
    await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));

    // فك التشفير إذا وُجد مستخدم
    if (currentUser) {
      const publicKeys = await getMemberPublicKeys();
      const senderPubPem = publicKeys[msgPacket.senderId];
      const decRes = await decryptGroupMessage({
        encryptedMessage: msgPacket,
        currentUser,
        senderPublicPem: senderPubPem,
      });

      const rawCache = await AsyncStorage.getItem(STORAGE_KEYS.DECRYPTED_CACHE);
      const cache = rawCache ? JSON.parse(rawCache) : {};
      cache[msgPacket.id] = {
        text: decRes.text,
        isVerified: decRes.isVerified,
        isUndecryptable: decRes.isUndecryptable,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.DECRYPTED_CACHE, JSON.stringify(cache));
    }

    if (!isChatOpen) {
      await refreshUnreadCount();
    }

    const currentList = await loadChatMessages(currentUser);
    notifyChatListeners(currentList);
  } catch (error) {
    console.error('خطأ في معالجة الرسالة الواردة:', error);
  }
};

/**
 * 6. تعيين حالة فتح/إغلاق الشات لتصفير عداد الرسائل غير المقروءة
 */
export const setChatActiveState = async (isOpen) => {
  isChatOpen = isOpen;
  if (isOpen) {
    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_READ_TIMESTAMP, nowIso);
    notifyUnreadListeners(0);
  }
};

/**
 * 7. حساب عدد الرسائل غير المقروءة
 */
export const refreshUnreadCount = async () => {
  try {
    const [rawMsgs, lastReadTs] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
      AsyncStorage.getItem(STORAGE_KEYS.LAST_READ_TIMESTAMP),
    ]);

    const messages = rawMsgs ? JSON.parse(rawMsgs) : [];
    if (!lastReadTs) {
      notifyUnreadListeners(messages.length);
      return messages.length;
    }

    const unread = messages.filter((m) => {
      const isMine = currentActiveUserId && String(m.senderId) === String(currentActiveUserId);
      return !isMine && new Date(m.timestamp) > new Date(lastReadTs);
    });

    const count = unread.length;
    notifyUnreadListeners(count);
    return count;
  } catch (_e) {
    return 0;
  }
};

/**
 * 8. الاشتراك في مراقبة الرسائل
 */
export const subscribeChatMessages = (callback) => {
  chatListeners.add(callback);
  return () => chatListeners.delete(callback);
};

/**
 * 9. الاشتراك في مراقبة عدد الرسائل غير المقروءة
 */
export const subscribeUnreadCount = (callback) => {
  unreadListeners.add(callback);
  refreshUnreadCount().then((c) => callback(c));
  return () => unreadListeners.delete(callback);
};

/**
 * 10. تفاصيل أمان التشفير للعرض في نافذة الأمان
 */
export const getSecurityDetails = async (currentUser) => {
  if (!currentUser) return null;
  const userId = String(currentUser.id || currentUser.readerId || currentUser.username);
  const keyPair = await getOrCreateUserKeyPair(userId);
  const fingerprint = calculateFingerprint(keyPair.publicKeyPem);
  const memberKeys = await getMemberPublicKeys();

  return {
    userId,
    userName: currentUser.name,
    fingerprint,
    publicKeyPem: keyPair.publicKeyPem,
    membersCount: Object.keys(memberKeys).length + 1,
    algorithm: 'RSA-1024-OAEP + AES-256-CBC (E2EE)',
  };
};
