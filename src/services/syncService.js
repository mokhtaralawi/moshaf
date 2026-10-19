import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getServerUrl } from '../config/apiConfig';

const SYNC_KEYS = {
  QUEUE: '@quran_wird_sync_queue',
  LAST_SYNC: '@quran_wird_last_synced',
  LAST_MODIFIED: '@quran_wird_cloud_last_modified',
  STORAGE_KEYS_MAP: {
    READERS: '@quran_wird_readers',
    SETTINGS: '@quran_wird_settings',
    DAILY_STATUSES: '@quran_wird_daily_statuses',
    TASKS: '@quran_wird_tasks',
    TASK_SUBMISSIONS: '@quran_wird_task_submissions',
    SURVEYS: '@quran_wird_surveys',
    ANNOUNCEMENTS: '@quran_wird_announcements',
    MOTIVATIONAL: '@quran_wird_motivational_msg',
    ADMINS: '@quran_wird_admins_list',
  },
};

// حالة المزامنة اللحظية
let syncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
};

const listeners = new Set();
let autoSyncInterval = null;

const notifyListeners = (extraPayload = {}) => {
  listeners.forEach((listener) => {
    try {
      listener({ ...syncState, ...extraPayload });
    } catch (e) {
      console.error('خطأ في إشعار مراقب المزامنة:', e);
    }
  });
};

/**
 * تهيئة مستشعر الشبكة والمزامنة التلقائية اللحظية
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

      // إذا عاد الإنترنت، مزامنة فورية
      if (wasOffline && nowOnline) {
        syncWithCloud();
      }
    });

    // 4. تشغيل المزامنة الدورية في الخلفية كل 15 ثانية لمواكبة تحديثات الفريق
    if (!autoSyncInterval) {
      autoSyncInterval = setInterval(() => {
        if (syncState.isOnline && !syncState.isSyncing) {
          syncWithCloud(false);
        }
      }, 15000);
    }

    // مزامنة أولية عند الإقلاع
    if (syncState.isOnline) {
      syncWithCloud(true);
    }
  } catch (error) {
    console.error('خطأ أثناء تهيئة محرك المزامنة:', error);
  }
};

/**
 * الاشتراك في تحديثات المزامنة وتغييرات البيانات القادمة من السحابة
 */
export const subscribeSyncStatus = (callback) => {
  listeners.add(callback);
  callback({ ...syncState });

  return () => {
    listeners.delete(callback);
  };
};

/**
 * إضافة عملية إلى طابور المزامنة وإرسالها فوراً إن وجد إنترنت
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

    // محاولة الإرسال السحابي فوراً
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
 * إرسال العمليات المتراكمة في الطابور إلى السحابة
 */
export const processSyncQueue = async () => {
  if (syncState.isSyncing) return { success: false, inProgress: true };

  try {
    const rawQueue = await AsyncStorage.getItem(SYNC_KEYS.QUEUE);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];

    if (queue.length === 0) {
      return { success: true, count: 0 };
    }

    syncState.isSyncing = true;
    notifyListeners();

    const baseUrl = await getServerUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ actions: queue }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      const nowIso = new Date().toISOString();

      // إفراغ الطابور بعد نجاح الإرسال
      await AsyncStorage.setItem(SYNC_KEYS.QUEUE, JSON.stringify([]));
      await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);

      if (result.lastModified) {
        await AsyncStorage.setItem(SYNC_KEYS.LAST_MODIFIED, result.lastModified);
      }

      // إذا أرجع السيرفر حالة كاملة محدثة، نقوم بتحديث الذاكرة المحلية
      if (result.state) {
        await applyCloudStateToLocal(result.state);
      }

      syncState.isSyncing = false;
      syncState.pendingCount = 0;
      syncState.lastSyncedAt = nowIso;
      syncState.lastError = null;
      notifyListeners({ hasRemoteUpdates: true });

      return { success: true, count: queue.length };
    } else {
      throw new Error(`خطأ من الخادم: رمز ${response.status}`);
    }
  } catch (error) {
    console.warn('تعذر إرسال طابور المزامنة:', error.message);
    syncState.isSyncing = false;
    syncState.lastError = error.message;
    notifyListeners();
    return { success: false, error: error.message };
  }
};

/**
 * سحب أحدث بيانات الفريق من السحابة (Pull Sync)
 */
export const pullLatestFromCloud = async () => {
  if (syncState.isSyncing) return false;

  try {
    const baseUrl = await getServerUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(`${baseUrl}/api/sync`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const res = await response.json();
      if (res && res.data) {
        const localLastMod = await AsyncStorage.getItem(SYNC_KEYS.LAST_MODIFIED);
        const remoteLastMod = res.lastModified || res.data.lastModified;

        // إذا كانت هناك بيانات أحدث على السحابة، دمجها محلياً
        if (remoteLastMod && remoteLastMod !== localLastMod) {
          await applyCloudStateToLocal(res.data);
          await AsyncStorage.setItem(SYNC_KEYS.LAST_MODIFIED, remoteLastMod);
          const nowIso = new Date().toISOString();
          await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);
          syncState.lastSyncedAt = nowIso;
          notifyListeners({ hasRemoteUpdates: true });
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    // في حالة عدم الوصول للسيرفر يستمر العمل محلياً دون إزعاج
    return false;
  }
};

/**
 * مزامنة كاملة: دفع العمليات المعلقة وسحب التحديثات الجديدة
 */
export const syncWithCloud = async (isManual = false) => {
  if (!syncState.isOnline) {
    return { success: false, message: 'لا يوجد اتصال بالإنترنت' };
  }

  // 1. أولاً إرسال ما لدينا من عمليات معلقة
  const pushRes = await processSyncQueue();

  // 2. ثانياً سحب أحدث بيانات الفريق
  const pulledNew = await pullLatestFromCloud();

  return {
    success: pushRes.success,
    pulledNew,
    message: 'تمت المزامنة بنجاح مع السحابة 🟢',
  };
};

/**
 * تحديث التخزين المحلي ببيانات السحابة المركزية
 */
const applyCloudStateToLocal = async (cloudState) => {
  try {
    const map = SYNC_KEYS.STORAGE_KEYS_MAP;
    const promises = [];

    if (cloudState.readers && Array.isArray(cloudState.readers)) {
      promises.push(AsyncStorage.setItem(map.READERS, JSON.stringify(cloudState.readers)));
    }
    if (cloudState.settings) {
      promises.push(AsyncStorage.setItem(map.SETTINGS, JSON.stringify(cloudState.settings)));
    }
    if (cloudState.dailyStatuses) {
      promises.push(AsyncStorage.setItem(map.DAILY_STATUSES, JSON.stringify(cloudState.dailyStatuses)));
    }
    if (cloudState.tasks && Array.isArray(cloudState.tasks)) {
      promises.push(AsyncStorage.setItem(map.TASKS, JSON.stringify(cloudState.tasks)));
    }
    if (cloudState.taskSubmissions) {
      promises.push(AsyncStorage.setItem(map.TASK_SUBMISSIONS, JSON.stringify(cloudState.taskSubmissions)));
    }
    if (cloudState.surveys && Array.isArray(cloudState.surveys)) {
      promises.push(AsyncStorage.setItem(map.SURVEYS, JSON.stringify(cloudState.surveys)));
    }
    if (cloudState.announcements && Array.isArray(cloudState.announcements)) {
      promises.push(AsyncStorage.setItem(map.ANNOUNCEMENTS, JSON.stringify(cloudState.announcements)));
    }
    if (cloudState.motivationalMessage) {
      promises.push(AsyncStorage.setItem(map.MOTIVATIONAL, cloudState.motivationalMessage));
    }
    if (cloudState.admins && Array.isArray(cloudState.admins)) {
      promises.push(AsyncStorage.setItem(map.ADMINS, JSON.stringify(cloudState.admins)));
    }

    await Promise.all(promises);
  } catch (e) {
    console.error('خطأ أثناء تحديث التخزين المحلي من السحابة:', e);
  }
};

export const getSyncState = () => ({ ...syncState });
