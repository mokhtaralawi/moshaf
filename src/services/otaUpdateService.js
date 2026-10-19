import { Platform, Alert } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * خدمة إدارة التحديثات الهوائية (Over-The-Air Updates)
 * تتيح تحديث كود التطبيق وواجهاته عند جميع أجهزة الفريق تلقائياً
 * دون الحاجة لإعادة تثبيت ملف APK
 */

export const getUpdateInfo = () => {
  if (Platform.OS === 'web') {
    return {
      isSupported: false,
      isEnabled: false,
      channel: 'web',
      updateId: 'web-bundle',
      runtimeVersion: '1.0.0',
    };
  }

  return {
    isSupported: true,
    isEnabled: Updates.isEnabled,
    channel: Updates.channel || 'preview',
    updateId: Updates.updateId || 'embedded',
    runtimeVersion: Updates.runtimeVersion || '1.0.0',
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
};

/**
 * فحص وتطبيق التحديثات الهوائية يدوياً أو تلقائياً
 * @param {boolean} isManual - هل تم الاستدعاء بضغط زر من المستخدم
 * @returns {Promise<{ hasUpdate: boolean, success: boolean, message: string }>}
 */
export const checkAndApplyAppUpdate = async (isManual = false) => {
  if (Platform.OS === 'web') {
    if (isManual) {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    }
    return { hasUpdate: false, success: true, message: 'الويب يُحدّث تلقائياً عبر المتصفح' };
  }

  if (!Updates.isEnabled) {
    const msg = 'التحديثات الهوائية تعمل فقط في نسخ الإنتاج والتجربة (APK / Production)';
    if (isManual) {
      Alert.alert('تنبيه التحديث', msg);
    }
    return { hasUpdate: false, success: false, message: msg };
  }

  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      if (isManual) {
        Alert.alert('تحديث جديد 🚀', 'يوجد إصدار أحدث للتطبيق، جاري تنزيله الآن وتطبيقه...');
      }

      await Updates.fetchUpdateAsync();

      if (isManual) {
        Alert.alert(
          'تم تنزيل التحديث بنجاح ✅',
          'سيتم إعادة تشغيل التطبيق لتطبيق التحسينات الجديدة الآن.',
          [
            {
              text: 'إعادة التشغيل الآن',
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        // في الفحص التلقائي بالخلفية
        await Updates.reloadAsync();
      }

      return { hasUpdate: true, success: true, message: 'تم تطبيق التحديث بنجاح' };
    } else {
      if (isManual) {
        Alert.alert('أحدث إصدار ✅', 'أنت تستخدم بالفعل أحدث إصدار متوفر للتطبيق.');
      }
      return { hasUpdate: false, success: true, message: 'التطبيق على أحدث إصدار' };
    }
  } catch (error) {
    console.warn('خطأ في فحص التحديثات الهوائية:', error);
    if (isManual) {
      Alert.alert('فحص التحديثات', `تعذر التحقق من التحديثات: ${error.message || 'تأكد من الاتصال بالإنترنت'}`);
    }
    return { hasUpdate: false, success: false, message: error.message };
  }
};
