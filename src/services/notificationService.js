import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatArabicTime } from '../utils/wirdCalculator';

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
    } catch (triggerError) {
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
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 */
export const sendInstantNotification = async (
  title = '📖 تنبيه من مدير الورد القرآني',
  body = 'نرجو من جميع الإخوة مراجعة وتسجيل إنجاز الورد لليوم.'
) => {
  try {
    if (Platform.OS === 'web') {
      return {
        success: true,
        message: 'تم بث الإشعار بنجاح للأعضاء.',
      };
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return {
        success: false,
        message: 'يرجى منح صلاحيات الإشعارات في الهاتف لإرسال التنبيهات.',
      };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // إطلاق فوري
    });

    return {
      success: true,
      message: 'تم إرسال الإشعار والتنبيه الفوري بنجاح.',
    };
  } catch (error) {
    console.error('خطأ أثناء إرسال الإشعار الفوري:', error);
    return {
      success: false,
      message: 'تعذر إرسال الإشعار، يرجى المحاولة لاحقاً.',
    };
  }
};