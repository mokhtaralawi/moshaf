import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { enqueueSyncAction } from './syncService';
import { loadReaders, loadAdminAccounts } from './storageService';
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
  GROUPS: '@quran_wird_chat_groups',
};

export const DEFAULT_MAIN_GROUP = {
  id: 'group_main',
  name: 'ملتقى أهل القرآن (العام)',
  description: 'المجموعة العامة لجميع القراء والمشرفين',
  isDefault: true,
  memberIds: [],
};

// مراقبو تحديثات الرسائل
const chatListeners = new Set();
// مراقبو عداد الرسائل غير المقروءة
const unreadListeners = new Set();
// مراقبو قائمة المجموعات
const groupsListeners = new Set();

let realtimeChannel = null;
let currentActiveUserId = null;
let isChatOpen = false;

const notifyChatListeners = (messages) => {
  chatListeners.forEach((listener) => {
    try {
      listener(messages);
    } catch (_e) {}
  });
};

const notifyUnreadListeners = (count) => {
  unreadListeners.forEach((listener) => {
    try {
      listener(count);
    } catch (_e) {}
  });
};

const notifyGroupsListeners = (groups) => {
  groupsListeners.forEach((listener) => {
    try {
      listener(groups);
    } catch (_e) {}
  });
};

/**
 * 0. استرجاع جميع الأعضاء المتاحين (المدراء + القراء) ليكون المدراء جزءاً من الفريق
 */
export const getAllAvailableMembers = async () => {
  try {
    const [readers, admins] = await Promise.all([
      loadReaders(),
      loadAdminAccounts(),
    ]);

    const map = new Map();

    // 1. إضافة حسابات المدراء
    (admins || []).forEach((a) => {
      const id = String(a.id || a.username);
      map.set(id, {
        id,
        name: a.name || 'مدير النظام',
        username: a.username || 'admin',
        role: 'admin',
      });
    });

    // 2. إضافة القراء
    (readers || []).forEach((r) => {
      const id = String(r.id || r.username);
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: r.name || 'قارئ مبارك',
          username: r.username,
          role: r.role || 'user',
          currentJuz: r.currentJuz || 1,
        });
      }
    });

    return Array.from(map.values());
  } catch (error) {
    console.error('خطأ في استرجاع قائمة الأعضاء:', error);
    return [];
  }
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
        role: currentUser.role || 'user',
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

    // استقبال تحديثات المجموعات
    realtimeChannel.on('broadcast', { event: 'group_updated' }, async ({ payload }) => {
      if (payload && payload.group) {
        await saveLocalGroup(payload.group);
      }
    });

    realtimeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (currentUser) {
          const userId = String(currentUser.id || currentUser.readerId || currentUser.username);
          getOrCreateUserKeyPair(userId).then((kp) => {
            realtimeChannel.send({
              type: 'broadcast',
              event: 'new_member_key',
              payload: {
                userId,
                userName: currentUser.name,
                role: currentUser.role,
                publicKey: kp.publicKeyPem,
              },
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
 * 3. استرجاع قائمة المجموعات المتاحة للمستخدم الحالي
 * - المدير يرى جميع المجموعات
 * - القارئ يرى المجموعة العامة + المجموعات التي هو عضو فيها
 */
export const loadChatGroups = async (currentUser) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    const customGroups = raw ? JSON.parse(raw) : [];

    const allGroups = [DEFAULT_MAIN_GROUP, ...customGroups];

    if (!currentUser) return allGroups;

    const myId = String(currentUser.id || currentUser.readerId || currentUser.username);
    const isAdmin = currentUser.role === 'admin';

    if (isAdmin) {
      return allGroups;
    }

    // المستخدم العادي: يرى المجموعات التي ينتمي إليها
    return allGroups.filter((g) => {
      if (g.isDefault) return true;
      if (!Array.isArray(g.memberIds) || g.memberIds.length === 0) return true;
      return g.memberIds.map(String).includes(myId);
    });
  } catch (e) {
    console.error('خطأ في استرجاع المجموعات:', e);
    return [DEFAULT_MAIN_GROUP];
  }
};

/**
 * 3.1 حفظ مجموعة محلية
 */
const saveLocalGroup = async (group) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    const groups = raw ? JSON.parse(raw) : [];
    const idx = groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      groups[idx] = group;
    } else {
      groups.push(group);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    notifyGroupsListeners([DEFAULT_MAIN_GROUP, ...groups]);
  } catch (_e) {}
};

/**
 * 3.2 إنشاء أو تعديل مجموعة جديدة من قبل المدير
 */
export const createOrUpdateChatGroup = async (groupData, currentUser) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    const groups = raw ? JSON.parse(raw) : [];

    const idx = groups.findIndex((g) => g.id === groupData.id);
    if (idx >= 0) {
      groups[idx] = groupData;
    } else {
      groups.push(groupData);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));

    // بث لحظي
    if (realtimeChannel) {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'group_updated',
        payload: { group: groupData },
      }).catch(() => {});
    }

    // إدراج في طابور المزامنة
    await enqueueSyncAction('CREATE_OR_UPDATE_CHAT_GROUP', { group: groupData });

    notifyGroupsListeners([DEFAULT_MAIN_GROUP, ...groups]);
    return { success: true, group: groupData };
  } catch (error) {
    console.error('خطأ في إنشاء/تعديل المجموعة:', error);
    return { success: false, error: 'تعذر حفظ المجموعة' };
  }
};

/**
 * 3.3 حذف مجموعة
 */
export const deleteChatGroup = async (groupId) => {
  try {
    if (groupId === 'group_main') {
      return { success: false, error: 'لا يمكن حذف المجموعة العامة الرئيسية' };
    }
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    const groups = raw ? JSON.parse(raw) : [];
    const updated = groups.filter((g) => g.id !== groupId);
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updated));

    await enqueueSyncAction('DELETE_CHAT_GROUP', { groupId });
    notifyGroupsListeners([DEFAULT_MAIN_GROUP, ...updated]);
    return { success: true };
  } catch (_error) {
    return { success: false, error: 'تعذر حذف المجموعة' };
  }
};

/**
 * 4. استرجاع قائمة الرسائل لمجموعة محددة وفك تشفيرها للمستخدم الحالي
 */
export const loadChatMessages = async (currentUser, targetGroupId = 'group_main') => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
    const allMessages = raw ? JSON.parse(raw) : [];

    // تصفية الرسائل حسب المجموعة
    const messages = allMessages.filter((m) => {
      const gId = m.groupId || 'group_main';
      return gId === targetGroupId;
    });

    if (!currentUser) return messages;

    const rawCache = await AsyncStorage.getItem(STORAGE_KEYS.DECRYPTED_CACHE);
    const decryptedCache = rawCache ? JSON.parse(rawCache) : {};
    const publicKeys = await getMemberPublicKeys();

    let hasNewDecryptions = false;

    const decryptedList = await Promise.all(
      messages.map(async (msg) => {
        if (decryptedCache[msg.id] && !decryptedCache[msg.id].isUndecryptable) {
          return {
            ...msg,
            decryptedText: decryptedCache[msg.id].text,
            isVerified: decryptedCache[msg.id].isVerified,
            isUndecryptable: false,
          };
        }

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
 * 5. إرسال رسالة جديدة مشفرة E2EE في مجموعة محددة
 */
export const sendGroupMessage = async ({ text, currentUser, group }) => {
  if (!text || !text.trim() || !currentUser) {
    return { success: false, error: 'النص مطلوب' };
  }

  const activeGroup = group || DEFAULT_MAIN_GROUP;
  const groupId = activeGroup.id || 'group_main';

  try {
    const cleanText = text.trim();
    const allMembersKeys = await getMemberPublicKeys();

    // إذا كانت المجموعة مخصصة ولها قائمة أعضاء محددة، نشفر فقط لأعضاء هذه المجموعة + المرسل
    let targetKeysMap = {};
    if (activeGroup.memberIds && Array.isArray(activeGroup.memberIds) && activeGroup.memberIds.length > 0) {
      const allowedSet = new Set(activeGroup.memberIds.map(String));
      const senderId = String(currentUser.id || currentUser.readerId || currentUser.username);
      allowedSet.add(senderId);

      for (const [mid, pubPem] of Object.entries(allMembersKeys)) {
        if (allowedSet.has(String(mid))) {
          targetKeysMap[mid] = pubPem;
        }
      }
    } else {
      // المجموعة العامة تشمل جميع المفاتيح المسجلة
      targetKeysMap = allMembersKeys;
    }

    // 1. تشفير الرسالة بنظام RSA-OAEP / AES-256 مع Group Master Key الموحد
    const encryptedPacket = await encryptGroupMessage({
      text: cleanText,
      senderUser: currentUser,
      membersPublicKeysMap: targetKeysMap,
      groupId,
    });

    encryptedPacket.groupId = groupId;
    encryptedPacket.groupName = activeGroup.name;

    // 2. الحفظ في الذاكرة المحلية
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
    const messages = raw ? JSON.parse(raw) : [];
    messages.push(encryptedPacket);
    await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));

    // 3. تخزين النص الصريح في الكاش المحلي للمرسل
    const rawCache = await AsyncStorage.getItem(STORAGE_KEYS.DECRYPTED_CACHE);
    const cache = rawCache ? JSON.parse(rawCache) : {};
    cache[encryptedPacket.id] = {
      text: cleanText,
      isVerified: true,
      isUndecryptable: false,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.DECRYPTED_CACHE, JSON.stringify(cache));

    // 4. البث اللحظي عبر Supabase Realtime
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

    // إشعار الواجهات برسائل هذه المجموعة
    const groupMsgs = messages
      .filter((m) => (m.groupId || 'group_main') === groupId)
      .map((m) => ({
        ...m,
        decryptedText: cache[m.id]?.text || '🔒 [مشفر]',
        isVerified: cache[m.id]?.isVerified ?? true,
      }));

    notifyChatListeners(groupMsgs);

    return { success: true, message: encryptedPacket };
  } catch (error) {
    console.error('خطأ أثناء تشفير وإرسال الرسالة:', error);
    return { success: false, error: error.message || 'تعذر إرسال الرسالة' };
  }
};

/**
 * 6. معالجة رسالة جديدة قادمة عبر Realtime أو المزامنة
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

    const currentList = await loadChatMessages(currentUser, msgPacket.groupId || 'group_main');
    notifyChatListeners(currentList);
  } catch (error) {
    console.error('خطأ في معالجة الرسالة الواردة:', error);
  }
};

/**
 * 7. تعيين حالة فتح/إغلاق الشات لتصفير عداد الرسائل غير المقروءة
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
 * 8. حساب عدد الرسائل غير المقروءة
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

export const subscribeChatMessages = (callback) => {
  chatListeners.add(callback);
  return () => chatListeners.delete(callback);
};

export const subscribeUnreadCount = (callback) => {
  unreadListeners.add(callback);
  refreshUnreadCount().then((c) => callback(c));
  return () => unreadListeners.delete(callback);
};

export const subscribeGroups = (callback) => {
  groupsListeners.add(callback);
  return () => groupsListeners.delete(callback);
};

/**
 * 9. تفاصيل أمان التشفير للعرض في نافذة الأمان
 */
export const getSecurityDetails = async (currentUser, group = null) => {
  if (!currentUser) return null;
  const userId = String(currentUser.id || currentUser.readerId || currentUser.username);
  const keyPair = await getOrCreateUserKeyPair(userId);
  const fingerprint = calculateFingerprint(keyPair.publicKeyPem);
  const memberKeys = await getMemberPublicKeys();

  const activeGroup = group || DEFAULT_MAIN_GROUP;
  const membersCount =
    activeGroup.memberIds && activeGroup.memberIds.length > 0
      ? activeGroup.memberIds.length
      : Object.keys(memberKeys).length + 1;

  return {
    userId,
    userName: currentUser.name,
    fingerprint,
    publicKeyPem: keyPair.publicKeyPem,
    groupName: activeGroup.name,
    membersCount,
    algorithm: 'RSA-1024-OAEP + AES-256-CBC (E2EE)',
  };
};
