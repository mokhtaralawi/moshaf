import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const SYNC_KEYS = {
  QUEUE: '@quran_wird_sync_queue',
  LAST_SYNC: '@quran_wird_last_synced',
};

// حالة المزامنة اللحظية
let syncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
};

const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener({ ...syncState });
    } catch (e) {
      console.error('خطأ في إشعار مراقب المزامنة:', e);
    }
  });
};

/**
 * تهيئة مستشعر الشبكة والمزامنة التلقائية عند عودة الإنترنت
 */
export const initSyncEngine = async () => {
  try {
    // 1. استرجاع آخر وقت مزامنة وعدد العمليات المؤجلة
    const [lastSyncVal, queueVal] = await Promise.all([
      AsyncStorage.getItem(SYNC_KEYS.LAST_SYNC),
      AsyncStorage.getItem(SYNC_KEYS.QUEUE),
    ]);

    const queue = queueVal ? JSON.parse(queueVal) : [];
    syncState.lastSyncedAt = lastSyncVal || null;
    syncState.pendingCount = queue.length;

    // 2. فحص حالة الشبكة المبدئية
    const netState = await NetInfo.fetch();
    syncState.isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    notifyListeners();

    // 3. الاستماع التلقائي لأي تغير في اتصال الإنترنت
    NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOffline = !syncState.isOnline;
      syncState.isOnline = nowOnline;
      notifyListeners();

      // إذا عاد الإنترنت وكانت هناك عمليات مؤجلة، نشغل المزامنة التلقائية فوراً
      if (wasOffline && nowOnline) {
        processSyncQueue();
      }
    });

    // إذا كان متصلاً وعنده عمليات مؤجلة من جلسة سابقة
    if (syncState.isOnline && queue.length > 0) {
      processSyncQueue();
    }
  } catch (error) {
    console.error('خطأ أثناء تهيئة محرك المزامنة:', error);
  }
};

/**
 * الاشتراك في تحديثات حالة المزامنة والاتصال
 */
export const subscribeSyncStatus = (callback) => {
  listeners.add(callback);
  // إرجاع الحالة الحالية فوراً
  callback({ ...syncState });

  return () => {
    listeners.delete(callback);
  };
};

/**
 * إضافة عملية إلى طابور المزامنة (Outbox Queue)
 * @param {string} actionType - نوع العملية (مثل: 'SUBMIT_WIRD', 'UPDATE_TASK', 'CHANGE_PASSWORD')
 * @param {object} payload - بيانات العملية
 */
export const enqueueSyncAction = async (actionType, payload) => {
  try {
    const rawQueue = await AsyncStorage.getItem(SYNC_KEYS.QUEUE);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];

    const newAction = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: actionType,
      payload,
      timestamp: new Date().toISOString(),
      attempts: 0,
    };

    queue.push(newAction);
    await AsyncStorage.setItem(SYNC_KEYS.QUEUE, JSON.stringify(queue));

    syncState.pendingCount = queue.length;
    notifyListeners();

    // إذا كان هناك اتصال حالياً، حاول المزامنة فوراً
    if (syncState.isOnline) {
      processSyncQueue();
    }

    return newAction;
  } catch (error) {
    console.error('خطأ أثناء إدراج عملية في طابور المزامنة:', error);
    return null;
  }
};

/**
 * معالجة وإفراغ طابور المزامنة (Push Sync)
 */
export const processSyncQueue = async () => {
  if (syncState.isSyncing) return;

  try {
    const rawQueue = await AsyncStorage.getItem(SYNC_KEYS.QUEUE);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];

    if (queue.length === 0) {
      const nowIso = new Date().toISOString();
      syncState.lastSyncedAt = nowIso;
      await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);
      notifyListeners();
      return { success: true, count: 0 };
    }

    syncState.isSyncing = true;
    notifyListeners();

    // محاكاة تأكيد المزامنة مع الخادم السحابي
    // يمكن ربط هذا برابط API فعلي بسلاسة تامة
    await new Promise((resolve) => setTimeout(resolve, 800));

    // بعد نجاح الرفع السحابي، يتم إفراغ الطابور وتحديث آخر وقت مزامنة
    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(SYNC_KEYS.QUEUE, JSON.stringify([]));
    await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);

    syncState.isSyncing = false;
    syncState.pendingCount = 0;
    syncState.lastSyncedAt = nowIso;
    notifyListeners();

    return { success: true, count: queue.length };
  } catch (error) {
    console.error('خطأ أثناء مزامنة الطابور:', error);
    syncState.isSyncing = false;
    notifyListeners();
    return { success: false, error };
  }
};

/**
 * جلب حالة المزامنة اللحظية
 */
export const getSyncState = () => ({ ...syncState });
