import AsyncStorage from '@react-native-async-storage/async-storage';
import forge from 'node-forge';

const STORAGE_KEYS = {
  PRIVATE_KEY_PREFIX: '@quran_wird_chat_priv_',
  PUBLIC_KEY_PREFIX: '@quran_wird_chat_pub_',
  LOCAL_PUBLIC_KEYS_MAP: '@quran_wird_chat_public_keys_map',
};

// الذاكرة المؤقتة للمفاتيح لتجنب التحليل المتكرر للـ PEM
const keyPairCache = {};

/**
 * 1. استرجاع أو توليد زوج مفاتيح RSA للمستخدم
 * يتم توليد زوج مفاتيح (1024-bit للأداء العالي على الهواتف والأجهزة الضعيفة)
 */
export const getOrCreateUserKeyPair = async (userId) => {
  if (!userId) throw new Error('معرف المستخدم مطلوب لتوليد المفاتيح');
  const cleanId = String(userId);

  if (keyPairCache[cleanId]) {
    return keyPairCache[cleanId];
  }

  try {
    const privKeyKey = `${STORAGE_KEYS.PRIVATE_KEY_PREFIX}${cleanId}`;
    const pubKeyKey = `${STORAGE_KEYS.PUBLIC_KEY_PREFIX}${cleanId}`;

    const [storedPrivPem, storedPubPem] = await Promise.all([
      AsyncStorage.getItem(privKeyKey),
      AsyncStorage.getItem(pubKeyKey),
    ]);

    if (storedPrivPem && storedPubPem) {
      try {
        const privateKey = forge.pki.privateKeyFromPem(storedPrivPem);
        const publicKey = forge.pki.publicKeyFromPem(storedPubPem);
        const result = { privateKey, publicKey, privateKeyPem: storedPrivPem, publicKeyPem: storedPubPem };
        keyPairCache[cleanId] = result;
        return result;
      } catch (parseErr) {
        console.warn('تعذر قراءة المفتاح المخزن، جاري إعادة التوليد:', parseErr);
      }
    }

    // توليد زوج مفاتيح جديد
    const keypair = await new Promise((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({ bits: 1024, workers: -1 }, (err, kp) => {
        if (err) reject(err);
        else resolve(kp);
      });
    });

    const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
    const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);

    await Promise.all([
      AsyncStorage.setItem(privKeyKey, privateKeyPem),
      AsyncStorage.setItem(pubKeyKey, publicKeyPem),
    ]);

    const result = {
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey,
      privateKeyPem,
      publicKeyPem,
    };
    keyPairCache[cleanId] = result;
    return result;
  } catch (error) {
    console.error('خطأ أثناء تهيئة مفاتيح التشفير للمستخدم:', error);
    throw error;
  }
};

/**
 * 2. تخزين المفاتيح العامة لجميع الأعضاء محلياً
 */
export const saveMemberPublicKeys = async (keysMap) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_PUBLIC_KEYS_MAP, JSON.stringify(keysMap || {}));
  } catch (_e) {
    console.error('خطأ حفظ المفاتيح العامة للأعضاء:', _e);
  }
};

/**
 * 3. استرجاع خريطة المفاتيح العامة للأعضاء
 */
export const getMemberPublicKeys = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_PUBLIC_KEYS_MAP);
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
};

/**
 * 4. حساب بصمة الأمان (Fingerprint) لمفتاح عام لمطابقتها والتأكد من الأمان
 */
export const calculateFingerprint = (publicKeyPem) => {
  try {
    if (!publicKeyPem) return '---';
    const md = forge.md.sha256.create();
    md.update(publicKeyPem);
    const hex = md.digest().toHex().toUpperCase();
    // تقطيع إلى كتل من 4 أحرف سهلة القراءة
    return hex.match(/.{1,4}/g)?.slice(0, 6).join(' • ') || hex.slice(0, 24);
  } catch (_e) {
    return 'UNKNOWN-FINGERPRINT';
  }
};

/**
 * 5. تشفير رسالة جماعية بنظام E2EE الهجين (Hybrid RSA-OAEP + AES-CBC)
 * - يتم توليد مفتاح AES-256 فريد لكل رسالة مع IV عشوائي
 * - يتم تشفير نص الرسالة بـ AES-256
 * - يتم تشفير مفتاح الـ AES بمفتاح RSA العام لكل عضو في المجموعة
 * - يتم توقيع الرسالة رقمياً بالمفتاح الخاص للمرسل
 */
export const encryptGroupMessage = async ({ text, senderUser, membersPublicKeysMap = {} }) => {
  const senderId = String(senderUser.id || senderUser.readerId || senderUser.username);
  const senderName = senderUser.name || 'قارئ';
  const senderRole = senderUser.role || 'user';

  // 1. مفاتيح المرسل
  const senderKeyPair = await getOrCreateUserKeyPair(senderId);

  // التأكد من تضمين المفتاح العام للمرسل في الخريطة ليتمكن من قراءة رسائله لاحقاً
  const fullKeysMap = {
    ...membersPublicKeysMap,
    [senderId]: senderKeyPair.publicKeyPem,
  };

  // 2. توليد مفتاح جلسة AES-256 و IV
  const aesKeyBytes = forge.random.getBytesSync(32); // 256 bits
  const ivBytes = forge.random.getBytesSync(16); // 128 bits IV

  // 3. تشفير الرسالة بـ AES-CBC
  const cipher = forge.cipher.createCipher('AES-CBC', aesKeyBytes);
  cipher.start({ iv: ivBytes });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(text)));
  cipher.finish();
  const ciphertext = forge.util.encode64(cipher.output.getBytes());

  // 4. تشفير مفتاح الـ AES لكل عضو بمفتاحه العام RSA
  const encryptedKeys = {};
  for (const [memberId, pubPem] of Object.entries(fullKeysMap)) {
    if (!pubPem) continue;
    try {
      const pubKey = forge.pki.publicKeyFromPem(pubPem);
      const encryptedAesKey = pubKey.encrypt(aesKeyBytes, 'RSA-OAEP');
      encryptedKeys[String(memberId)] = forge.util.encode64(encryptedAesKey);
    } catch (err) {
      console.warn(`تعذر تشفير مفتاح الرسالة للعضو ${memberId}:`, err);
    }
  }

  // 5. التوقيع الرقمي بالمفتاح الخاص للمرسل لضمان عدم التلاعب
  let signature = '';
  try {
    const md = forge.md.sha256.create();
    md.update(ciphertext, 'utf8');
    const sigBytes = senderKeyPair.privateKey.sign(md);
    signature = forge.util.encode64(sigBytes);
  } catch (sigErr) {
    console.warn('تعذر توقيع الرسالة رقمياً:', sigErr);
  }

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    senderId,
    senderName,
    senderRole,
    timestamp: new Date().toISOString(),
    iv: forge.util.encode64(ivBytes),
    ciphertext,
    encryptedKeys,
    signature,
    isEncrypted: true,
  };
};

/**
 * 6. فك تشفير رسالة واردة باستخدام المفتاح الخاص للمستخدم الحالي
 */
export const decryptGroupMessage = async ({ encryptedMessage, currentUser, senderPublicPem }) => {
  if (!encryptedMessage) return { text: '', isEncrypted: false };

  // إذا كانت الرسالة نصية عادية غير مشفرة
  if (!encryptedMessage.isEncrypted || !encryptedMessage.ciphertext) {
    return {
      text: encryptedMessage.text || encryptedMessage.content || '',
      isEncrypted: false,
      isVerified: false,
    };
  }

  const userId = String(currentUser.id || currentUser.readerId || currentUser.username);

  try {
    const userKeyPair = await getOrCreateUserKeyPair(userId);
    const encryptedKeyForUser =
      encryptedMessage.encryptedKeys?.[userId] ||
      (currentUser.username ? encryptedMessage.encryptedKeys?.[currentUser.username] : null) ||
      (currentUser.readerId ? encryptedMessage.encryptedKeys?.[currentUser.readerId] : null);

    if (!encryptedKeyForUser) {
      return {
        text: '🔒 [رسالة مشفرة بمفتاح خاص، غير موجهة لهذا الجهاز]',
        isEncrypted: true,
        isUndecryptable: true,
        isVerified: false,
      };
    }

    // 1. فك تشفير مفتاح الـ AES
    const aesKeyBytes = userKeyPair.privateKey.decrypt(
      forge.util.decode64(encryptedKeyForUser),
      'RSA-OAEP'
    );

    // 2. فك تشفير محتوى الرسالة
    const ivBytes = forge.util.decode64(encryptedMessage.iv);
    const decipher = forge.cipher.createDecipher('AES-CBC', aesKeyBytes);
    decipher.start({ iv: ivBytes });
    decipher.update(forge.util.createBuffer(forge.util.decode64(encryptedMessage.ciphertext)));
    const ok = decipher.finish();

    if (!ok) {
      return {
        text: '⚠️ [تعذر فك تشفير الرسالة - تلف في البيانات]',
        isEncrypted: true,
        isUndecryptable: true,
        isVerified: false,
      };
    }

    const decryptedText = forge.util.decodeUtf8(decipher.output.getBytes());

    // 3. التحقق من التوقيع الرقمي إن وجد المفتاح العام للمرسل
    let isVerified = false;
    if (encryptedMessage.signature && senderPublicPem) {
      try {
        const senderPubKey = forge.pki.publicKeyFromPem(senderPublicPem);
        const mdVerify = forge.md.sha256.create();
        mdVerify.update(encryptedMessage.ciphertext, 'utf8');
        isVerified = senderPubKey.verify(
          mdVerify.digest().bytes(),
          forge.util.decode64(encryptedMessage.signature)
        );
      } catch (_vErr) {
        isVerified = false;
      }
    }

    return {
      text: decryptedText,
      isEncrypted: true,
      isVerified,
      isUndecryptable: false,
    };
  } catch (error) {
    console.warn('خطأ أثناء فك تشفير الرسالة:', error);
    return {
      text: '🔒 [تعذر فك تشفير هذه الرسالة]',
      isEncrypted: true,
      isUndecryptable: true,
      isVerified: false,
    };
  }
};
