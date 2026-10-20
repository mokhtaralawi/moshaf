import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getServerUrl } from '../config/apiConfig';
import { supabase } from '../utils/supabase';

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
  provider: 'supabase', // 'supabase' | 'custom_server'
};

const listeners = new Set();
let autoSyncInterval = null;
let realtimeSubscription = null;

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
 * تطبيق قائمة الحركات على حالة مصفوفات وبيانات النظام
 */
export const applyActionsReducer = (currentState, actions = []) => {
  const state = JSON.parse(JSON.stringify(currentState || {}));
  if (!state.dailyStatuses) state.dailyStatuses = {};
  if (!state.taskSubmissions) state.taskSubmissions = {};
  if (!state.readers) state.readers = [];
  if (!state.tasks) state.tasks = [];
  if (!state.surveys) state.surveys = [];
  if (!state.announcements) state.announcements = [];
  if (!state.admins) state.admins = [];
  if (!state.settings) state.settings = {};

  for (const action of actions) {
    const { type, payload } = action;
    if (!type || !payload) continue;

    switch (type) {
      case 'UPDATE_WIRD_STATUS': {
        const { dateKey, readerId, status, timestamp, note } = payload;
        if (dateKey && readerId) {
          if (!state.dailyStatuses[dateKey]) {
            state.dailyStatuses[dateKey] = {};
          }
          state.dailyStatuses[dateKey][readerId] = {
            status: status || 'pending',
            timestamp: timestamp || new Date().toISOString(),
            note: note || '',
          };
        }
        break;
      }
      case 'SUBMIT_TASK': {
        const { dateKey, taskId, readerId, status, reason, timestamp } = payload;
        const subKey = `${dateKey}_${taskId}_${readerId}`;
        state.taskSubmissions[subKey] = {
          status,
          reason: reason || '',
          timestamp: timestamp || new Date().toISOString(),
        };
        break;
      }
      case 'ADVANCE_WIRD':
      case 'SAVE_READERS': {
        if (Array.isArray(payload.readers)) {
          state.readers = payload.readers;
        }
        break;
      }
      case 'SAVE_SETTINGS': {
        state.settings = { ...state.settings, ...payload };
        break;
      }
      case 'SAVE_TASKS': {
        if (Array.isArray(payload.tasks)) {
          state.tasks = payload.tasks;
        }
        break;
      }
      case 'CREATE_TASK': {
        if (payload.task) {
          const exists = state.tasks.some((t) => t.id === payload.task.id);
          if (!exists) state.tasks.push(payload.task);
        }
        break;
      }
      case 'REGISTER_PUSH_TOKEN': {
        if (!state.pushTokens) state.pushTokens = {};
        if (payload.userId && payload.token) {
          state.pushTokens[payload.userId] = {
            token: payload.token,
            updatedAt: new Date().toISOString(),
          };
        }
        break;
      }
      case 'DELETE_TASK': {
        if (payload.taskId) {
          state.tasks = state.tasks.filter((t) => t.id !== payload.taskId);
        }
        break;
      }
      case 'CREATE_SURVEY': {
        if (payload.survey) {
          state.surveys.unshift(payload.survey);
        }
        break;
      }
      case 'VOTE_SURVEY': {
        const { surveyId, userId, vote } = payload;
        const survey = state.surveys.find((s) => s.id === surveyId);
        if (survey) {
          if (!survey.votes) survey.votes = {};
          survey.votes[userId] = vote;
        }
        break;
      }
      case 'CLOSE_SURVEY': {
        const survey = state.surveys.find((s) => s.id === payload.surveyId);
        if (survey) survey.active = false;
        break;
      }
      case 'ADD_ANNOUNCEMENT': {
        if (payload.announcement) {
          state.announcements.unshift(payload.announcement);
        }
        break;
      }
      case 'SAVE_MOTIVATIONAL_MSG': {
        if (payload.message) {
          state.motivationalMessage = payload.message;
        }
        break;
      }
      case 'CHANGE_PASSWORD': {
        const { userId, role, newPassword } = payload;
        if (role === 'admin') {
          const admin = state.admins.find((a) => a.id === userId || a.username === userId);
          if (admin) admin.password = newPassword;
        } else {
          const reader = state.readers.find((r) => r.id === userId || r.username === userId);
          if (reader) {
            reader.password = newPassword;
            reader.isFirstLogin = false;
          }
        }
        break;
      }
      case 'CREATE_ADMIN': {
        if (payload.id && payload.username) {
          const exists = state.admins.some((a) => a.id === payload.id || a.username === payload.username);
          if (!exists) {
            state.admins.push({
              id: payload.id,
              username: payload.username,
              name: payload.name || 'مدير مساعد',
              password: payload.password || '123',
              role: 'admin',
              isFirstLogin: false,
            });
          }
        }
        break;
      }
      case 'DELETE_ADMIN': {
        if (payload.adminId) {
          state.admins = state.admins.filter((a) => String(a.id) !== String(payload.adminId));
        }
        break;
      }
      case 'UPDATE_ADMIN_PROFILE': {
        const { adminId, name, username, newPassword } = payload;
        const admin = state.admins.find((a) => String(a.id) === String(adminId) || a.username === adminId);
        if (admin) {
          if (name) admin.name = name;
          if (username) admin.username = username;
          if (newPassword) admin.password = newPassword;
        }
        break;
      }
      default:
        break;
    }
  }
  state.lastModified = new Date().toISOString();
  return state;
};

/**
 * تهيئة مستشعر الشبكة والمزامنة التلقائية اللحظية مع Supabase
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

    // 4. الاشتراك اللحظي السحابي (Supabase Realtime)
    if (!realtimeSubscription && supabase) {
      try {
        realtimeSubscription = supabase
          .channel('zad_app_state_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'app_state' },
            async (payload) => {
              if (payload.new && payload.new.data) {
                const remoteMod = payload.new.last_modified || payload.new.data.lastModified;
                const localMod = await AsyncStorage.getItem(SYNC_KEYS.LAST_MODIFIED);
                if (remoteMod && remoteMod !== localMod) {
                  await applyCloudStateToLocal(payload.new.data);
                  await AsyncStorage.setItem(SYNC_KEYS.LAST_MODIFIED, remoteMod);
                  const nowIso = new Date().toISOString();
                  await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);
                  syncState.lastSyncedAt = nowIso;
                  notifyListeners({ hasRemoteUpdates: true });
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription info:', err.message);
      }
    }

    // 5. تشغيل المزامنة الدورية الاحتياطية في الخلفية كل 15 ثانية
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
 * إرسال العمليات المتراكمة في الطابور إلى Supabase السحابي (أو السيرفر الاحتياطي)
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

    let handled = false;
    let finalState = null;
    let finalLastMod = null;

    // 1. المحاولة الأولى: الإرسال المباشر إلى Supabase (RPC أو upsert)
    if (supabase) {
      try {
        // تجربة تنفيذ الدالة الذرية apply_sync_actions على Supabase
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('apply_sync_actions', {
          p_actions: queue,
        });

        if (!rpcErr && rpcRes && rpcRes.state) {
          handled = true;
          finalState = rpcRes.state;
          finalLastMod = rpcRes.lastModified || new Date().toISOString();
        } else {
          // إذا لم تكن دالة الـ RPC منشأة بعد، نجري الدمج الذري عبر قراءة وتحديث app_state
          const { data: currentRecord } = await supabase
            .from('app_state')
            .select('data')
            .eq('id', 'zad_main')
            .single();

          if (currentRecord && currentRecord.data) {
            const updatedState = applyActionsReducer(currentRecord.data, queue);
            const nowIso = new Date().toISOString();
            const { error: upsertErr } = await supabase
              .from('app_state')
              .upsert({
                id: 'zad_main',
                data: updatedState,
                last_modified: nowIso,
              });

            if (!upsertErr) {
              handled = true;
              finalState = updatedState;
              finalLastMod = nowIso;
            }
          }
        }
      } catch (sbErr) {
        console.warn('Supabase queue push warning:', sbErr.message);
      }
    }

    // 2. إذا لم تنجح المحاولة مع Supabase، المحاولة الاحتياطية مع خادم الـ REST المخصص
    if (!handled) {
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
        handled = true;
        finalState = result.state;
        finalLastMod = result.lastModified || new Date().toISOString();
      }
    }

    if (handled) {
      const nowIso = new Date().toISOString();

      // إفراغ الطابور بعد نجاح الإرسال
      await AsyncStorage.setItem(SYNC_KEYS.QUEUE, JSON.stringify([]));
      await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);

      if (finalLastMod) {
        await AsyncStorage.setItem(SYNC_KEYS.LAST_MODIFIED, finalLastMod);
      }

      // إذا توافرت حالة محدثة، تحديث الذاكرة المحلية
      if (finalState) {
        await applyCloudStateToLocal(finalState);
      }

      syncState.isSyncing = false;
      syncState.pendingCount = 0;
      syncState.lastSyncedAt = nowIso;
      syncState.lastError = null;
      notifyListeners({ hasRemoteUpdates: true });

      return { success: true, count: queue.length };
    } else {
      throw new Error('تعذر إرسال العمليات إلى السحابة أو الخادم الاحتياطي');
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
 * سحب أحدث بيانات الفريق من Supabase أو السيرفر الاحتياطي (Pull Sync)
 * @param {boolean} force - إجبار تحديث الذاكرة المحلية حتى لو لم يتغير ختم الوقت
 */
export const pullLatestFromCloud = async (force = false) => {
  if (syncState.isSyncing) return false;

  try {
    let remoteState = null;
    let remoteLastMod = null;

    // 1. المحاولة الأولى: سحب أحدث نسخة من Supabase
    if (supabase) {
      try {
        const { data: row, error } = await supabase
          .from('app_state')
          .select('data, last_modified')
          .eq('id', 'zad_main')
          .single();

        if (!error && row && row.data) {
          remoteState = row.data;
          remoteLastMod = row.last_modified || row.data.lastModified;
        }
      } catch (_e) {
        // Fallback to REST server
      }
    }

    // 2. المحاولة الثانية: إذا لم يتوفر Supabase، السحب من خادم REST
    if (!remoteState) {
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
          remoteState = res.data;
          remoteLastMod = res.lastModified || res.data.lastModified;
        }
      }
    }

    // دمج البيانات إذا وجدت وكانت أحدث أو إذا كان التخزين المحلي خالياً
    if (remoteState) {
      const localLastMod = await AsyncStorage.getItem(SYNC_KEYS.LAST_MODIFIED);
      const localReaders = await AsyncStorage.getItem(SYNC_KEYS.STORAGE_KEYS_MAP.READERS);
      const isMissingLocal = !localReaders || !localLastMod;

      if (force || isMissingLocal || (remoteLastMod && remoteLastMod !== localLastMod)) {
        await applyCloudStateToLocal(remoteState);
        if (remoteLastMod) {
          await AsyncStorage.setItem(SYNC_KEYS.LAST_MODIFIED, remoteLastMod);
        }
        const nowIso = new Date().toISOString();
        await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, nowIso);
        syncState.lastSyncedAt = nowIso;
        notifyListeners({ hasRemoteUpdates: true });
        return true;
      }
    }

    return false;
  } catch (_error) {
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

  // 1. التأكد أولاً من سحب بيانات السحابة إذا كانت الذاكرة المحلية فارغة تماماً
  const localReaders = await AsyncStorage.getItem(SYNC_KEYS.STORAGE_KEYS_MAP.READERS);
  if (!localReaders) {
    await pullLatestFromCloud(true);
  }

  // 2. إرسال ما لدينا من عمليات معلقة إن وجدت
  const pushRes = await processSyncQueue();

  // 3. سحب أحدث بيانات الفريق
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
