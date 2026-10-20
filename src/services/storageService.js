import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_READERS } from '../constants/quranData';
import { enqueueSyncAction, initSyncEngine, pullLatestFromCloud } from './syncService';
import { sendInstantNotification } from './notificationService';

// تهيئة محرك المزامنة التلقائية عند إقلاع التطبيق
initSyncEngine().catch((e) => console.log('Sync engine init:', e));

// مفاتيح التخزين الثابتة لمنع الأخطاء الإملائية
const STORAGE_KEYS = {
  READERS_LIST: '@quran_wird_readers',
  WIRD_SETTINGS: '@quran_wird_settings',
  ADMIN_CREDS: '@quran_wird_admin_creds',
  ADMINS_LIST: '@quran_wird_admins_list',
  CURRENT_USER: '@quran_wird_current_user',
  DAILY_STATUSES: '@quran_wird_daily_statuses',
  SURVEYS: '@quran_wird_surveys',
  ANNOUNCEMENTS: '@quran_wird_announcements',
  TASKS: '@quran_wird_tasks',
  TASK_SUBMISSIONS: '@quran_wird_task_submissions',
  MOTIVATIONAL_MSG: '@quran_wird_motivational_msg',
  GROUP_MESSAGES: '@quran_wird_group_messages',
  CHAT_PUBLIC_KEYS: '@quran_wird_chat_public_keys_map',
};

// البيانات الافتراضية لحساب المدير الرئيسي
const DEFAULT_ADMIN_CREDS = {
  id: 'admin_root',
  username: 'admin',
  password: '123',
  name: 'المدير العام',
  role: 'admin',
  isFirstLogin: false,
};

// قائمة التكاليف والمهام اليومية الافتراضية
export const DEFAULT_TASKS = [
  {
    id: 'task_quran',
    title: 'الورد القرآني اليومي',
    category: 'QURAN',
    icon: '📖',
    targetCount: 1,
    unit: 'أجزاء',
    dueTime: '23:59',
    description: 'قراءة الجزء المقرر اليومي من كتاب الله تعالى',
    isActive: true,
  },
  {
    id: 'task_adhkar_morning',
    title: 'أذكار الصباح والمساء',
    category: 'ADHKAR',
    icon: '🌅',
    targetCount: 1,
    unit: 'مرة',
    dueTime: '23:59',
    description: 'قراءة وملازمة أذكار الصباح وأذكار المساء لحفظ العبد',
    isActive: true,
  },
  {
    id: 'task_tasbeeh',
    title: 'الاستغفار والتسبيح',
    category: 'ADHKAR',
    icon: '📿',
    targetCount: 100,
    unit: 'مرة',
    dueTime: '23:59',
    description: 'مائة مرة استغفار وتسبيح يومياً',
    isActive: true,
  },
  {
    id: 'task_salawat',
    title: 'الصلاة على النبي ﷺ',
    category: 'ADHKAR',
    icon: '🕌',
    targetCount: 100,
    unit: 'مرة',
    dueTime: '23:59',
    description: 'مائة صلاة على الحبيب المصطفى ﷺ',
    isActive: true,
  },
];

export const normalizeReader = (r, idx = 0) => ({
  id: String(r.id || `reader_${Date.now()}_${idx}`),
  name: r.name || 'قارئ مبارك',
  username: r.username || r.name?.replace(/\s+/g, '_') || `user_${r.id || idx + 1}`,
  password: r.password || '123456',
  role: r.role || 'user',
  isFirstLogin: typeof r.isFirstLogin === 'boolean' ? r.isFirstLogin : true,
  currentJuz: typeof r.currentJuz === 'number' ? r.currentJuz : 1,
  status: r.status || 'active',
  createdAt: r.createdAt || new Date().toISOString(),
});

/**
 * 1. استرجاع قائمة القراء من ذاكرة الهاتف
 * إذا كانت الذاكرة فارغة (أول تشغيل أو مسح بيانات أو هاتف جديد)،
 * يسحب أحدث بيانات من السحابة أولاً لمنع مسح تقدم القراء المخزن في السحابة.
 */
export const loadReaders = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.READERS_LIST);
    if (jsonValue !== null) {
      const parsed = JSON.parse(jsonValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r, idx) => normalizeReader(r, idx));
      }
    }

    // إذا كانت الذاكرة المحلية فارغة: محاولة السحب العاجل من السحابة أولاً
    try {
      const pulled = await pullLatestFromCloud(true);
      if (pulled) {
        const refreshedJson = await AsyncStorage.getItem(STORAGE_KEYS.READERS_LIST);
        if (refreshedJson !== null) {
          const list = JSON.parse(refreshedJson);
          if (Array.isArray(list) && list.length > 0) {
            return list.map((r, idx) => normalizeReader(r, idx));
          }
        }
      }
    } catch (pullErr) {
      console.warn('تنبيه أثناء سحب القراء من السحابة:', pullErr);
    }

    // في حال تعذر الاتصال بالسحابة ولم تكن هناك بيانات سابقة،
    // نعتمد القائمة الافتراضية محلياً فقط دون إرسال استبدال (enqueueSyncAction) إلى السحابة!
    const defaultList = DEFAULT_READERS.map((r, idx) => normalizeReader(r, idx));
    await AsyncStorage.setItem(STORAGE_KEYS.READERS_LIST, JSON.stringify(defaultList));
    return defaultList;
  } catch (error) {
    console.error('خطأ أثناء قراءة قائمة القراء:', error);
    return DEFAULT_READERS.map((r, idx) => normalizeReader(r, idx));
  }
};

/**
 * 2. حفظ قائمة القراء المحدثة في ذاكرة الهاتف
 * @param {Array} readers - مصفوفة القراء بعد أي تعديل أو إضافة أو ترحيل يومي
 */
export const saveReaders = async (readers) => {
  try {
    const normalized = readers.map((r, idx) => normalizeReader(r, idx));
    const jsonValue = JSON.stringify(normalized);
    await AsyncStorage.setItem(STORAGE_KEYS.READERS_LIST, jsonValue);
    await enqueueSyncAction('SAVE_READERS', { readers: normalized });
    return true;
  } catch (error) {
    console.error('خطأ أثناء حفظ قائمة القراء:', error);
    return false;
  }
};

/**
 * 2.1 التحقق والمصادقة الموحدة (Unified Login Auth)
 * يفحص كلاً من حسابات المدراء وحسابات القراء/المستخدمين
 */
export const authenticateUser = async (identifier, password) => {
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' };
  }

  // 1. فحص حسابات المدراء
  const admins = await loadAdminAccounts();
  const matchedAdmin = admins.find(
    (a) => a.username.toLowerCase() === cleanId && a.password === cleanPass
  );

  if (matchedAdmin) {
    const session = {
      id: matchedAdmin.id,
      username: matchedAdmin.username,
      name: matchedAdmin.name || 'مدير النظام',
      role: 'admin',
      isFirstLogin: false,
      lastLogin: new Date().toISOString(),
    };
    await saveCurrentUser(session);
    return { success: true, user: session };
  }

  // 2. فحص حسابات المستخدمين / القراء
  const readers = await loadReaders();
  const matchedReader = readers.find(
    (r) =>
      (r.username.toLowerCase() === cleanId || r.name.toLowerCase() === cleanId) &&
      r.password === cleanPass
  );

  if (matchedReader) {
    const session = {
      id: matchedReader.id,
      readerId: matchedReader.id,
      username: matchedReader.username,
      name: matchedReader.name,
      role: 'user',
      currentJuz: matchedReader.currentJuz || 1,
      isFirstLogin: Boolean(matchedReader.isFirstLogin),
      lastLogin: new Date().toISOString(),
    };
    await saveCurrentUser(session);
    return { success: true, user: session };
  }

  return {
    success: false,
    error: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  };
};

/**
 * 2.2 تحديث كلمة المرور للمستخدم (القارئ أو المدير)
 */
export const updateUserPassword = async (userId, newPassword) => {
  try {
    const cleanPass = newPassword.trim();
    const readers = await loadReaders();
    let foundReader = false;
    const updatedReaders = readers.map((r) => {
      if (String(r.id) === String(userId)) {
        foundReader = true;
        return {
          ...r,
          password: cleanPass,
          isFirstLogin: false,
        };
      }
      return r;
    });

    if (foundReader) {
      await saveReaders(updatedReaders);
    } else {
      // قد يكون مدير نظام
      const admins = await loadAdminAccounts();
      const updatedAdmins = admins.map((a) => {
        if (String(a.id) === String(userId) || a.username === userId) {
          return { ...a, password: cleanPass };
        }
        return a;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.ADMINS_LIST, JSON.stringify(updatedAdmins));
      // حفظ بيانات اعتماد المدير الرئيسي
      const defaultCreds = await loadAdminCredentials();
      if (defaultCreds.username === userId || defaultCreds.id === userId) {
        await saveAdminCredentials(defaultCreds.username, cleanPass);
      }
    }

    // تحديث الجلسة إذا كان هو المستخدم الحالي
    const currentUser = await loadCurrentUser();
    if (currentUser && (currentUser.id === userId || currentUser.readerId === userId || currentUser.username === userId)) {
      await saveCurrentUser({
        ...currentUser,
        isFirstLogin: false,
      });
    }

    await enqueueSyncAction('UPDATE_PASSWORD', { userId });
    return true;
  } catch (e) {
    console.error('خطأ أثناء تحديث كلمة المرور:', e);
    return false;
  }
};

/**
 * 2.2.1 تحديث بيانات الملف الشخصي للمستخدم العادي (الاسم، اسم الدخول، كلمة المرور)
 */
export const updateUserProfile = async (userId, { name, username, newPassword }) => {
  try {
    const readers = await loadReaders();
    let updatedReader = null;
    const updatedReaders = readers.map((r) => {
      if (String(r.id) === String(userId)) {
        updatedReader = {
          ...r,
          name: name ? name.trim() : r.name,
          username: username ? username.trim() : r.username,
          password: newPassword ? newPassword.trim() : r.password,
          isFirstLogin: false,
        };
        return updatedReader;
      }
      return r;
    });

    if (!updatedReader) {
      return { success: false, error: 'لم يتم العثور على المستخدم.' };
    }

    await saveReaders(updatedReaders);

    // تحديث الجلسة المحفوظة للمستخدم
    const currentUser = await loadCurrentUser();
    if (currentUser && (currentUser.id === userId || currentUser.readerId === userId)) {
      const newSession = {
        ...currentUser,
        name: updatedReader.name,
        readerName: updatedReader.name,
        username: updatedReader.username,
        isFirstLogin: false,
      };
      await saveCurrentUser(newSession);
    }

    await enqueueSyncAction('UPDATE_PROFILE', { userId });
    return { success: true, user: updatedReader };
  } catch (e) {
    console.error('خطأ أثناء تحديث بيانات المستخدم:', e);
    return { success: false, error: 'حدث خطأ أثناء تحديث البيانات.' };
  }
};

/**
 * 2.3 تحديث قرار تسجيل الدخول الأول (الإبقاء على 123456)
 */
export const updateUserFirstLoginDecision = async (userId) => {
  try {
    const readers = await loadReaders();
    const updatedReaders = readers.map((r) => {
      if (r.id === userId) {
        return { ...r, isFirstLogin: false };
      }
      return r;
    });

    await saveReaders(updatedReaders);

    const currentUser = await loadCurrentUser();
    if (currentUser && (currentUser.id === userId || currentUser.readerId === userId)) {
      await saveCurrentUser({
        ...currentUser,
        isFirstLogin: false,
      });
    }

    await enqueueSyncAction('FIRST_LOGIN_DECISION', { userId });
    return true;
  } catch (e) {
    console.error('خطأ أثناء تسجيل قرار الدخول الأول:', e);
    return false;
  }
};

/**
 * 2.4 استرجاع حسابات المدراء
 */
export const loadAdminAccounts = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS_LIST);
    if (jsonValue !== null) {
      const parsed = JSON.parse(jsonValue);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // سحب من السحابة إذا كانت الذاكرة فارغة
    try {
      await pullLatestFromCloud(true);
      const refreshedJson = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS_LIST);
      if (refreshedJson !== null) {
        const list = JSON.parse(refreshedJson);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (_e) {}

    const initialAdmins = [DEFAULT_ADMIN_CREDS];
    await AsyncStorage.setItem(STORAGE_KEYS.ADMINS_LIST, JSON.stringify(initialAdmins));
    return initialAdmins;
  } catch (error) {
    console.error('خطأ أثناء قراءة حسابات الإدارة:', error);
    return [DEFAULT_ADMIN_CREDS];
  }
};

/**
 * 2.5 إنشاء حساب مدير جديد
 */
export const createAdminAccount = async (username, password, name = 'مدير مساعد') => {
  try {
    const admins = await loadAdminAccounts();
    const cleanUsername = username.trim();
    if (admins.some((a) => a.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return { success: false, error: 'اسم المستخدم مسجل مسبقاً لمدير آخر.' };
    }
    const newAdmin = {
      id: `admin_${Date.now()}`,
      username: cleanUsername,
      password: password.trim(),
      name: name.trim(),
      role: 'admin',
      isFirstLogin: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...admins, newAdmin];
    await AsyncStorage.setItem(STORAGE_KEYS.ADMINS_LIST, JSON.stringify(updated));
    await enqueueSyncAction('CREATE_ADMIN', { id: newAdmin.id, username: newAdmin.username });
    return { success: true, admin: newAdmin };
  } catch (error) {
    console.error('خطأ أثناء إنشاء حساب مدير جديد:', error);
    return { success: false, error: 'حدث خطأ أثناء إنشاء حساب المدير.' };
  }
};

/**
 * 2.6 حذف حساب قارئ / مستخدم نهائياً
 */
export const deleteReader = async (readerId) => {
  try {
    const currentReaders = await loadReaders();
    const updated = currentReaders.filter((r) => String(r.id) !== String(readerId));
    await saveReaders(updated);
    await enqueueSyncAction('DELETE_READER', { readerId });
    return { success: true, readers: updated };
  } catch (error) {
    console.error('خطأ أثناء حذف القارئ:', error);
    return { success: false, error: 'تعذر حذف حساب القارئ.' };
  }
};

/**
 * 2.7 حذف حساب مدير مساعد
 */
export const deleteAdminAccount = async (adminId) => {
  try {
    if (adminId === 'admin_root') {
      return { success: false, error: 'لا يمكن حذف حساب المدير العام الرئيسي.' };
    }
    const currentAdmins = await loadAdminAccounts();
    const updated = currentAdmins.filter((a) => String(a.id) !== String(adminId));
    await AsyncStorage.setItem(STORAGE_KEYS.ADMINS_LIST, JSON.stringify(updated));
    await enqueueSyncAction('DELETE_ADMIN', { adminId });
    return { success: true, admins: updated };
  } catch (error) {
    console.error('خطأ أثناء حذف حساب المدير:', error);
    return { success: false, error: 'تعذر حذف حساب المدير.' };
  }
};

/**
 * 2.8 تعديل بيانات حساب المدير (الاسم، اسم المستخدم، كلمة المرور)
 */
export const updateAdminProfile = async (adminId, { name, username, newPassword }) => {
  try {
    const admins = await loadAdminAccounts();
    const cleanUsername = username ? username.trim() : null;
    const cleanName = name ? name.trim() : null;
    const cleanPass = newPassword ? newPassword.trim() : null;

    if (cleanUsername) {
      const conflict = admins.find(
        (a) =>
          String(a.id) !== String(adminId) &&
          (a.username || '').toLowerCase() === cleanUsername.toLowerCase()
      );
      if (conflict) {
        return { success: false, error: 'اسم المستخدم مسجل مسبقاً لمدير آخر.' };
      }
    }

    let updatedAdmin = null;
    const updatedAdmins = admins.map((a) => {
      if (String(a.id) === String(adminId) || a.username === adminId) {
        updatedAdmin = {
          ...a,
          name: cleanName || a.name || 'مدير النظام',
          username: cleanUsername || a.username,
          password: cleanPass || a.password,
        };
        return updatedAdmin;
      }
      return a;
    });

    if (!updatedAdmin) {
      return { success: false, error: 'لم يتم العثور على حساب المدير.' };
    }

    await AsyncStorage.setItem(STORAGE_KEYS.ADMINS_LIST, JSON.stringify(updatedAdmins));

    // إذا كان هذا هو حساب المدير الرئيسي admin_root أو المطابق لـ ADMIN_CREDS
    const creds = await loadAdminCredentials();
    if (String(updatedAdmin.id) === 'admin_root' || creds.username === adminId || creds.id === adminId) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ADMIN_CREDS,
        JSON.stringify({
          ...creds,
          id: updatedAdmin.id,
          username: updatedAdmin.username,
          password: updatedAdmin.password,
          name: updatedAdmin.name,
        })
      );
    }

    // تحديث الجلسة الحالية إذا كان هذا الحساب مسجل دخوله حالياً
    const currentUser = await loadCurrentUser();
    if (
      currentUser &&
      (currentUser.id === adminId ||
        currentUser.id === updatedAdmin.id ||
        currentUser.username === adminId ||
        currentUser.role === 'admin')
    ) {
      const updatedSession = {
        ...currentUser,
        id: updatedAdmin.id,
        name: updatedAdmin.name,
        username: updatedAdmin.username,
      };
      await saveCurrentUser(updatedSession);
    }

    await enqueueSyncAction('UPDATE_ADMIN_PROFILE', {
      adminId: updatedAdmin.id,
      name: updatedAdmin.name,
      username: updatedAdmin.username,
      newPassword: cleanPass || undefined,
    });

    return { success: true, admin: updatedAdmin };
  } catch (e) {
    console.error('خطأ أثناء تحديث بيانات حساب المدير:', e);
    return { success: false, error: 'حدث خطأ أثناء حفظ بيانات المدير.' };
  }
};


/**
 * 3. استرجاع إعدادات الورد والمنبه (مقدار الورد اليومي + وقت التذكير)
 */
export const loadSettings = async () => {
  const defaultSettings = {
    juzCount: 1, // جزء واحد يومياً كافتراضي
    reminderEnabled: false,
    reminderHour: 20, // 8:00 مساءً كافتراضي
    reminderMinute: 0,
  };

  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.WIRD_SETTINGS);
    if (jsonValue !== null) {
      return { ...defaultSettings, ...JSON.parse(jsonValue) };
    }

    try {
      await pullLatestFromCloud(true);
      const refreshedJson = await AsyncStorage.getItem(STORAGE_KEYS.WIRD_SETTINGS);
      if (refreshedJson !== null) {
        return { ...defaultSettings, ...JSON.parse(refreshedJson) };
      }
    } catch (_e) {}

    return defaultSettings;
  } catch (error) {
    console.error('خطأ أثناء قراءة الإعدادات:', error);
    return defaultSettings;
  }
};

/**
 * 4. حفظ إعدادات الورد والمنبه
 * @param {Object} settings - كائن الإعدادات الجديد
 */
export const saveSettings = async (settings) => {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(STORAGE_KEYS.WIRD_SETTINGS, jsonValue);
    await enqueueSyncAction('SAVE_SETTINGS', settings);
    return true;
  } catch (error) {
    console.error('خطأ أثناء حفظ الإعدادات:', error);
    return false;
  }
};

/**
 * 5. إعادة ضبط البيانات إلى الوضع الافتراضي (مفيدة إذا أردتم بدء ختمة جديدة من الصفر)
 */
export const resetToDefaultReaders = async () => {
  try {
    await saveReaders(DEFAULT_READERS);
    return DEFAULT_READERS;
  } catch (error) {
    console.error('خطأ أثناء إعادة الضبط:', error);
    return DEFAULT_READERS;
  }
};

/**
 * 6. استرجاع بيانات اعتماد المدير (اسم المستخدم وكلمة السر)
 */
export const loadAdminCredentials = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_CREDS);
    if (jsonValue !== null) {
      return JSON.parse(jsonValue);
    }
    // حفظ الافتراضي عند أول تشغيل
    await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_CREDS, JSON.stringify(DEFAULT_ADMIN_CREDS));
    return DEFAULT_ADMIN_CREDS;
  } catch (error) {
    console.error('خطأ أثناء قراءة بيانات المدير:', error);
    return DEFAULT_ADMIN_CREDS;
  }
};

/**
 * 7. حفظ وتحديث بيانات اعتماد المدير (تغيير كلمة السر)
 */
export const saveAdminCredentials = async (username, password) => {
  try {
    const creds = { username: username.trim(), password: password.trim() };
    await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_CREDS, JSON.stringify(creds));
    return true;
  } catch (error) {
    console.error('خطأ أثناء حفظ بيانات المدير:', error);
    return false;
  }
};

/**
 * 8. استرجاع المستخدم الحالي المسجل دخوله
 * @returns {Promise<{ role: 'admin'|'user', readerId?: string, readerName?: string } | null>}
 */
export const loadCurrentUser = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return jsonValue !== null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error('خطأ أثناء قراءة المستخدم المسجل:', error);
    return null;
  }
};

/**
 * 9. حفظ المستخدم المسجل دخوله
 */
export const saveCurrentUser = async (userData) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error('خطأ أثناء حفظ تسجيل الدخول:', error);
    return false;
  }
};

/**
 * 10. تسجيل الخروج
 */
export const logoutUser = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    return true;
  } catch (error) {
    console.error('خطأ أثناء تسجيل الخروج:', error);
    return false;
  }
};

/**
 * 11. توليد مفتاح التاريخ لليوم أو الغد (مثال: '2026-10-18')
 */
export const getDateKey = (daysOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 12. استرجاع حالات قراءة الورد ليوم محدد
 * @param {string} dateKey - مفتاح التاريخ (YYYY-MM-DD)
 * @returns {Promise<Object>} كائن بالصيغة: { [readerId]: 'read' | 'pending' | 'excused' }
 */
export const loadDailyStatuses = async (dateKey = getDateKey(0)) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_STATUSES);
    let allStatuses = jsonValue !== null ? JSON.parse(jsonValue) : null;

    if (!allStatuses) {
      try {
        await pullLatestFromCloud(true);
        const refreshedJson = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_STATUSES);
        allStatuses = refreshedJson !== null ? JSON.parse(refreshedJson) : {};
      } catch (_e) {
        allStatuses = {};
      }
    }

    return allStatuses[dateKey] || {};
  } catch (error) {
    console.error('خطأ أثناء قراءة حالات الورد اليومية:', error);
    return {};
  }
};

/**
 * 13. تحديث حالة قراءة ورد لقارئ معين ليوم محدد
 * @param {string} dateKey - مفتاح التاريخ
 * @param {string} readerId - معرف القارئ
 * @param {'read' | 'pending' | 'excused'} status - الحالة الجديدة
 */
export const updateReaderDailyStatus = async (dateKey, readerId, status) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_STATUSES);
    const allStatuses = jsonValue !== null ? JSON.parse(jsonValue) : {};
    if (!allStatuses[dateKey]) {
      allStatuses[dateKey] = {};
    }
    allStatuses[dateKey][readerId] = {
      status,
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_STATUSES, JSON.stringify(allStatuses));
    await enqueueSyncAction('UPDATE_WIRD_STATUS', {
      dateKey,
      readerId,
      status,
      timestamp: new Date().toISOString(),
    });
    return allStatuses[dateKey];
  } catch (error) {
    console.error('خطأ أثناء تحديث حالة القارئ:', error);
    return null;
  }
};

/**
 * 14. استرجاع الاستبيان النشط حالياً
 */
export const loadActiveSurvey = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SURVEYS);
    if (jsonValue !== null) {
      const surveys = JSON.parse(jsonValue);
      // إرجاع أول استبيان نشط أو null
      return surveys.find((s) => s.active) || null;
    }
    return null;
  } catch (error) {
    console.error('خطأ أثناء قراءة الاستبيان:', error);
    return null;
  }
};

/**
 * 15. إنشاء أو حفظ استبيان جديد من قِبل المدير
 * @param {string} question - نص سؤال الاستبيان (نعم / لا)
 */
export const createSurvey = async (question) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SURVEYS);
    const surveys = jsonValue !== null ? JSON.parse(jsonValue) : [];

    // تعطيل أي استبيان سابق نشط
    const updatedSurveys = surveys.map((s) => ({ ...s, active: false }));

    const newSurvey = {
      id: `survey_${Date.now()}`,
      question: question.trim(),
      createdAt: new Date().toISOString(),
      active: true,
      votes: {}, // { [readerId]: { vote: 'yes' | 'no', timestamp: '...' } }
    };

    updatedSurveys.unshift(newSurvey);
    await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(updatedSurveys));
    await enqueueSyncAction('CREATE_SURVEY', { survey: newSurvey });
    return newSurvey;
  } catch (error) {
    console.error('خطأ أثناء إنشاء الاستبيان:', error);
    return null;
  }
};

/**
 * 16. تسجيل إجابة قارئ على الاستبيان النشط (نعم / لا)
 * @param {string} surveyId - معرف الاستبيان
 * @param {string} readerId - معرف القارئ
 * @param {'yes' | 'no'} vote - الإجابة
 */
export const submitSurveyVote = async (surveyId, readerId, vote) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SURVEYS);
    if (!jsonValue) return null;

    const surveys = JSON.parse(jsonValue);
    const surveyIndex = surveys.findIndex((s) => s.id === surveyId);
    if (surveyIndex === -1) return null;

    if (!surveys[surveyIndex].votes) {
      surveys[surveyIndex].votes = {};
    }

    surveys[surveyIndex].votes[readerId] = {
      vote,
      timestamp: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys));
    await enqueueSyncAction('VOTE_SURVEY', { surveyId, userId: readerId, vote });
    return surveys[surveyIndex];
  } catch (error) {
    console.error('خطأ أثناء تسجيل إجابة الاستبيان:', error);
    return null;
  }
};

/**
 * 17. إغلاق أو إنهاء الاستبيان النشط
 */
export const closeSurvey = async (surveyId) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SURVEYS);
    if (!jsonValue) return true;

    const surveys = JSON.parse(jsonValue);
    const updated = surveys.map((s) => (s.id === surveyId ? { ...s, active: false } : s));
    await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(updated));
    await enqueueSyncAction('CLOSE_SURVEY', { surveyId });
    return true;
  } catch (error) {
    console.error('خطأ أثناء إغلاق الاستبيان:', error);
    return false;
  }
};

/**
 * 18. استرجاع الإعلانات والتنبيهات العامة للمجموعة
 */
export const loadAnnouncements = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    return jsonValue !== null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('خطأ أثناء قراءة الإعلانات:', error);
    return [];
  }
};

/**
 * 19. إضافة إعلان / تنبيه عام جديد للأعضاء
 */
export const addAnnouncement = async (title, message) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    const list = jsonValue !== null ? JSON.parse(jsonValue) : [];

    const newAnn = {
      id: `ann_${Date.now()}`,
      title: title.trim(),
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    const updated = [newAnn, ...list].slice(0, 10); // الاحتفاظ بآخر 10 إعلانات
    await AsyncStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(updated));
    await enqueueSyncAction('ADD_ANNOUNCEMENT', { announcement: newAnn });
    return updated;
  } catch (error) {
    console.error('خطأ أثناء إضافة إعلان:', error);
    return [];
  }
};

/**
 * 20. استرجاع قائمة التكاليف والمهام اليومية (القرآن، الأذكار، الأنشطة المخصصة)
 */
export const loadTasks = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
    if (jsonValue !== null) {
      const parsed = JSON.parse(jsonValue);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    try {
      await pullLatestFromCloud(true);
      const refreshedJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      if (refreshedJson !== null) {
        const list = JSON.parse(refreshedJson);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (_e) {}

    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(DEFAULT_TASKS));
    return DEFAULT_TASKS;
  } catch (error) {
    console.error('خطأ أثناء استرجاع قائمة التكاليف:', error);
    return DEFAULT_TASKS;
  }
};

/**
 * 21. حفظ قائمة التكاليف المحدثة
 */
export const saveTasks = async (tasks) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    await enqueueSyncAction('SAVE_TASKS', { tasks });
    return true;
  } catch (error) {
    console.error('خطأ أثناء حفظ التكاليف:', error);
    return false;
  }
};

/**
 * 22. إنشاء تكليف أو نشاط جديد من قِبل المدير
 */
export const createTask = async ({ title, description, category, targetCount, unit, dueTime }) => {
  try {
    const tasks = await loadTasks();
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      description: (description || '').trim(),
      category: category || 'GENERAL', // 'QURAN' | 'ADHKAR' | 'GENERAL'
      icon: category === 'QURAN' ? '📖' : category === 'ADHKAR' ? '📿' : '⭐',
      targetCount: Number(targetCount) || 1,
      unit: unit || 'مرة',
      dueTime: dueTime || '23:59',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [...tasks, newTask];
    await saveTasks(updated);
    await enqueueSyncAction('CREATE_TASK', { task: newTask });
    return { success: true, task: newTask };
  } catch (e) {
    console.error('خطأ أثناء إنشاء التكليف:', e);
    return { success: false, error: 'تعذر إنشاء التكليف' };
  }
};

/**
 * 23. حذف تكليف من النظام
 */
export const deleteTask = async (taskId) => {
  try {
    const tasks = await loadTasks();
    const updated = tasks.filter((t) => t.id !== taskId);
    await saveTasks(updated);
    await enqueueSyncAction('DELETE_TASK', { taskId });
    return true;
  } catch (e) {
    console.error('خطأ أثناء حذف التكليف:', e);
    return false;
  }
};

/**
 * 24. استرجاع سجل إنجاز التكاليف والمهام ليوم محدد
 */
export const loadTaskSubmissions = async (dateKey = getDateKey(0)) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.TASK_SUBMISSIONS);
    const all = jsonValue !== null ? JSON.parse(jsonValue) : {};
    return all[dateKey] || {};
  } catch (error) {
    console.error('خطأ أثناء قراءة إنجاز التكاليف:', error);
    return {};
  }
};

/**
 * 25. تسجيل إنجاز المستخدم لتكليف محدد (أديتها ✅ أو اعتذر ✋)
 * @param {string} dateKey - مفتاح التاريخ
 * @param {string} taskId - معرف التكليف
 * @param {string} userId - معرف المستخدم / القارئ
 * @param {'completed' | 'excused'} status - موقف الإنجاز
 * @param {string} excuseReason - سبب الاعتذار الاختياري
 */
export const submitUserTask = async (dateKey, taskId, userId, status, excuseReason = '') => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.TASK_SUBMISSIONS);
    const all = jsonValue !== null ? JSON.parse(jsonValue) : {};

    if (!all[dateKey]) all[dateKey] = {};
    if (!all[dateKey][taskId]) all[dateKey][taskId] = {};

    all[dateKey][taskId][userId] = {
      status, // 'completed' | 'excused'
      excuseReason: excuseReason ? excuseReason.trim() : '',
      timestamp: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.TASK_SUBMISSIONS, JSON.stringify(all));

    // إذا كان التكليف يخص الورد القرآني، نحدث أيضاً جدول الحالات اليومية المتوافق
    if (taskId === 'task_quran') {
      const mappedStatus = status === 'completed' ? 'read' : 'excused';
      await updateReaderDailyStatus(dateKey, userId, mappedStatus);
    }

    // إدراج العملية في طابور المزامنة التلقائية (Outbox Queue)
    await enqueueSyncAction('SUBMIT_TASK', {
      dateKey,
      taskId,
      readerId: userId,
      status,
      reason: excuseReason || '',
      timestamp: new Date().toISOString(),
    });

    return all[dateKey];
  } catch (error) {
    console.error('خطأ أثناء تسجيل إنجاز التكليف:', error);
    return null;
  }
};

export const DEFAULT_MOTIVATIONAL_MSG = 'هنيئاً لك يا قارئ القرآن، أنت من أهل الله وخاصته';

/**
 * 26. استرجاع الرسالة التحفيزية المخصصة من المدير
 */
export const loadMotivationalMessage = async () => {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.MOTIVATIONAL_MSG);
    return val !== null && val.trim() ? val.trim() : DEFAULT_MOTIVATIONAL_MSG;
  } catch (error) {
    console.error('خطأ أثناء استرجاع رسالة التحفيز:', error);
    return DEFAULT_MOTIVATIONAL_MSG;
  }
};

/**
 * 27. حفظ وتحديث الرسالة التحفيزية من قِبل المدير
 */
export const saveMotivationalMessage = async (msg) => {
  try {
    const cleanMsg = (msg || '').trim() || DEFAULT_MOTIVATIONAL_MSG;
    await AsyncStorage.setItem(STORAGE_KEYS.MOTIVATIONAL_MSG, cleanMsg);
    await enqueueSyncAction('SAVE_MOTIVATIONAL_MSG', { message: cleanMsg });
    return cleanMsg;
  } catch (error) {
    console.error('خطأ أثناء حفظ رسالة التحفيز:', error);
    return false;
  }
};

/**
 * 28. إرسال إشعار وتنبيه للأعضاء الذين لم يقرأوا الورد بعد
 * @param {Array<string>} selectedReaderIds - مصفوفة معرفات القراء المحددين
 * @param {string} title - عنوان الإشعار
 * @param {string} message - نص التذكير
 */
export const sendUnreadReminderNotification = async (selectedReaderIds = [], title, message) => {
  try {
    const defaultTitle = '📖 تذكير بوردك القرآني اليومي';
    const defaultMsg = 'تقبل الله طاعاتكم، نذكركم بفضل إتمام وردكم القرآني لليوم المبارك، والمشاركة في إنجاز ختمة المجموعة ✨';
    const finalTitle = (title || defaultTitle).trim();
    const finalMsg = (message || defaultMsg).trim();

    // 1. إضافة إعلان موجه (Targeted Announcement) للأعضاء المحددين
    const ann = {
      id: `ann_reminder_${Date.now()}`,
      title: finalTitle,
      message: finalMsg,
      targetUserIds: selectedReaderIds,
      isReminder: true,
      timestamp: new Date().toISOString(),
    };

    const currentAnns = await loadAnnouncements();
    const updatedAnns = [ann, ...currentAnns].slice(0, 15);
    await AsyncStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(updatedAnns));
    await enqueueSyncAction('ADD_ANNOUNCEMENT', { announcement: ann });

    // 2. إطلاق إشعار الجهاز الفوري
    await sendInstantNotification(finalTitle, finalMsg);

    // 3. حفظ تاريخ وتوقيت آخر تذكير تم إرساله لليوم
    const todayKey = getDateKey(0);
    await AsyncStorage.setItem(`@quran_wird_reminder_sent_${todayKey}`, new Date().toISOString());

    return { success: true, count: selectedReaderIds.length };
  } catch (e) {
    console.error('خطأ أثناء إرسال تذكير المتأخرين:', e);
    return { success: false, error: 'تعذر إرسال التذكير' };
  }
};

/**
 * 29. فحص ما إذا كان تم إرسال تذكير المتأخرين لليوم أم لا
 */
export const isUnreadReminderSentToday = async () => {
  try {
    const todayKey = getDateKey(0);
    const val = await AsyncStorage.getItem(`@quran_wird_reminder_sent_${todayKey}`);
    return Boolean(val);
  } catch (_e) {
    return false;
  }
};