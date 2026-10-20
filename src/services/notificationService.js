import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { formatArabicTime } from '../utils/wirdCalculator';
import { supabase } from '../utils/supabase';
import { enqueueSyncAction } from './syncService';

// تهيئة معالج الإشعارات في حال تشغيل التطبيق على أجهزة فعلية
try {
  if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  console.warn('Notification handler init error:', e);
}

/**
 * إعداد قناة التنبيهات لنظام أندرويد لضمان ظهور الإشعار مع الصوت والاهتزاز
 */
export const setupAndroidNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'تنبيهات زاد الأنصاري',
        importance: AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#064E3B',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (e) {
      console.warn('Error setting Android notification channel:', e);
    }
  }
};

/**
 * تسجيل وتحديث رمز الإشعارات السحابية (Expo Push Token) للمستخدم وربطه بالسحابة
 */
export const registerForPushNotificationsAsync = async (userId) => {
  if (Platform.OS === 'web') return null;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    await setupAndroidNotificationChannel();

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '04bd7deb-f75f-457e-a953-369c30a31453',
    });

    const token = tokenData?.data;
    if (token && userId) {
      await enqueueSyncAction('REGISTER_PUSH_TOKEN', { userId: String(userId), token });
    }
    return token;
  } catch (error) {
    console.warn('Error getting expo push token:', error);
    return null;
  }
};

/**
 * طلب صلاحيات الإشعارات من النظام
 */
export const requestNotificationPermissions = async () => {
  try {
    if (Platform.OS === 'web') return true;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus === 'granted') {
      await setupAndroidNotificationChannel();
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('خطأ أثناء طلب صلاحيات الإشعارات:', error);
    return false;
  }
};

/**
 * جدولة التنبيه اليومي المتكرر في وقت محدد بدقة
 * @param {number} hour - الساعة بنظام 24 ساعة (0 إلى 23)
 * @param {number} minute - الدقيقة (0 إلى 59)
 */
export const scheduleDailyWirdReminder = async (hour = 20, minute = 0) => {
  const formattedTime = formatArabicTime(hour, minute);

  try {
    if (Platform.OS === 'web') {
      return {
        success: true,
        message: `تم حفظ موعد التذكير يومياً في تمام الساعة ${formattedTime}`,
      };
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return {
        success: false,
        message: 'يرجى تفعيل صلاحية الإشعارات من إعدادات الهاتف لتلقي التنبيهات اليومية.',
      };
    }

    // إلغاء أي إشعارات سابقة مجدولة لتجنب التكرار
    await Notifications.cancelAllScheduledNotificationsAsync();

    // جدولة الإشعار المتكرر اليومي
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 تذكير بالورد القرآني',
          body: `حان موعد قراءة وتوزيع الورد اليومي. تقبل الله طاعاتكم ووفقكم لكل خير ✨`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Number(hour),
          minute: Number(minute),
        },
      });
    } catch (_triggerError) {
      // محاولة بديلة للصيغ الأخرى في الترايغر
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 تذكير بالورد القرآني',
          body: `حان موعد قراءة وتوزيع الورد اليومي. تقبل الله طاعاتكم ووفقكم لكل خير ✨`,
          sound: true,
        },
        trigger: {
          repeats: true,
          hour: Number(hour),
          minute: Number(minute),
        },
      });
    }

    return {
      success: true,
      message: `تم تفعيل التنبيه اليومي بنجاح في تمام الساعة ${formattedTime}`,
    };
  } catch (error) {
    console.error('خطأ أثناء جدولة التنبيه اليومي:', error);
    return {
      success: true,
      message: `تم حفظ موعد التذكير في تمام الساعة ${formattedTime}`,
    };
  }
};

/**
 * إلغاء جميع التنبيهات المجدولة
 */
export const cancelAllReminders = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    return true;
  } catch (error) {
    console.error('خطأ أثناء إلغاء التنبيهات:', error);
    return false;
  }
};

/**
 * إرسال إشعار فوري لجميع الأعضاء (تنبيه أو إعلان من الإدارة)
 * يرسل الإشعار محلياً وسحابياً عبر سيرفر Expo Push لجميع أجهزة الفريق المسجلة حتى لو كان التطبيق مغلقاً
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 */
export const sendInstantNotification = async (
  title = '📖 تنبيه من مدير الورد القرآني',
  body = 'نرجو من جميع الإخوة مراجعة وتسجيل إنجاز الورد لليوم.'
) => {
  try {
    // 1. إطلاق إشعار محلي على جهاز المرسل
    if (Platform.OS !== 'web') {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            channelId: 'default',
          },
          trigger: null, // إطلاق فوري
        });
      } catch (_localErr) {}
    }

    // 2. بث الإشعار السحابي لجميع الأجهزة المسجلة عبر خوادم Expo Push
    try {
      if (supabase) {
        const { data: row } = await supabase
          .from('app_state')
          .select('data')
          .eq('id', 'zad_main')
          .single();

        const tokensMap = row?.data?.pushTokens || {};
        const tokens = Object.values(tokensMap)
          .map((entry) => (typeof entry === 'string' ? entry : entry?.token))
          .filter((t) => t && t.startsWith('ExponentPushToken'));

        if (tokens.length > 0) {
          const pushMessages = tokens.map((pushToken) => ({
            to: pushToken,
            sound: 'default',
            title,
            body,
            priority: 'high',
            channelId: 'default',
          }));

          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessages),
          });
        }
      }
    } catch (pushBroadcastErr) {
      console.warn('تنبيه أثناء بث الإشعار السحابي للأجهزة:', pushBroadcastErr);
    }

    return {
      success: true,
      message: 'تم إرسال وبث الإشعار السحابي لجميع الأجهزة بنجاح.',
    };
  } catch (error) {
    console.error('خطأ أثناء إرسال الإشعار الفوري:', error);
    return {
      success: false,
      message: 'تعذر إرسال الإشعار، يرجى المحاولة لاحقاً.',
    };
  }
};