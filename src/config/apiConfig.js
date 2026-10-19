import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_SERVER_URL = '@quran_wird_server_url';

// يمكن وضع رابط استضافتك المجانية هنا كقيمة افتراضية (مثلاً على Render أو Vercel)
// مثال: 'https://quran-wird.onrender.com'
export const DEFAULT_PRODUCTION_URL = '';

/**
 * الحصول على رابط خادم المزامنة وقاعدة البيانات المركزية
 */
export const getServerUrl = async () => {
  try {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
    if (savedUrl && savedUrl.trim() !== '') {
      return savedUrl.trim().replace(/\/+$/, '');
    }

    // إذا كان التطبيق يعمل داخل المتصفح (Web)، يستخدم نفس عنوان الموقع الحالي تلقائياً
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }

    if (DEFAULT_PRODUCTION_URL && DEFAULT_PRODUCTION_URL.trim() !== '') {
      return DEFAULT_PRODUCTION_URL.trim().replace(/\/+$/, '');
    }

    // القيمة الافتراضية للشبكة المحلية أثناء التطوير
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  } catch (e) {
    return 'http://localhost:3000';
  }
};

/**
 * حفظ رابط الخادم السحابي الجديد
 */
export const setServerUrl = async (url) => {
  try {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, cleanUrl);
    return cleanUrl;
  } catch (e) {
    console.error('Error saving server url:', e);
    return null;
  }
};

/**
 * اختبار الاتصال بالخادم السحابي
 */
export const testServerConnection = async (targetUrl) => {
  try {
    const baseUrl = (targetUrl || await getServerUrl()).replace(/\/+$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { success: true, data, message: 'الاتصال بالخادم السحابي ناجح 🟢' };
    } else {
      return { success: false, status: response.status, message: `فشل الاتصال: رمز ${response.status} 🔴` };
    }
  } catch (error) {
    return {
      success: false,
      message: error.name === 'AbortError' ? 'انتهت مهلة الاتصال بالخادم (تأكد من الرابط والإنترنت)' : `تعذر الوصول للخادم: ${error.message}`,
    };
  }
};
