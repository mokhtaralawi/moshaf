import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildWirdPdfHtml } from '../templates/pdfTemplate.js';
import { buildSurveyPdfHtml } from '../templates/surveyPdfTemplate.js';

// إعادة تصدير دالات توليد الـ HTML للاستخدام المباشر
export { buildWirdPdfHtml, buildSurveyPdfHtml };

/**
 * تصدير جدول الورد القرآني كملف PDF حقيقي ومشاركته أو حفظه في ملفات الجهاز
 * @param {Array} readers - قائمة القراء كاملة
 * @param {number} juzCount - مقدار الورد
 * @param {number} daysOffset - 0 لليوم، 1 للغد
 * @param {string} title - اسم التقرير
 * @returns {Promise<boolean>}
 */
export const exportWirdToPdf = async (
  readers = [],
  juzCount = 1,
  daysOffset = 0,
  title = 'جدول توزيع الورد القرآني',
  dailyStatuses = {}
) => {
  try {
    if (!readers || readers.length === 0) {
      Alert.alert('تنبيه', 'لا يوجد قراء مسجلين في القائمة لتصدير تقرير PDF.');
      return false;
    }

    // توليد كود HTML المتجهي النقي عبر القالب المخصص
    const html = buildWirdPdfHtml(readers, juzCount, daysOffset, title, dailyStatuses);

    if (Platform.OS === 'web') {
      // على الويب: فتح نافذة مستقلة نظيفة تحتوي فقط على المستند الحقيقي دون واجهة التطبيق
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();

          // الانتظار لبضع أجزاء من الثانية لضمان اكتمال الرسم ثم فتح شاشة الطباعة وحفظ PDF
          setTimeout(() => {
            printWindow.print();
          }, 400);
          return true;
        }
      } catch (webError) {
        console.warn('Web popup blocked, falling back to Print.printAsync:', webError);
      }

      await Print.printAsync({ html });
      return true;
    }

    // على الهواتف (Android / iOS): توليد ملف PDF حقيقي في الذاكرة ومشاركته
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'تصدير جدول الورد القرآني (PDF)',
      });
      return true;
    } else {
      Alert.alert('تم إنشاء ملف PDF بنجاح', `تم حفظ الملف في المسار:\n${uri}`);
      return true;
    }
  } catch (error) {
    console.error('خطأ أثناء تصدير تقرير PDF:', error);
    Alert.alert('خطأ', 'حدث خطأ أثناء تصدير ملف PDF. يرجى التأكد من الصلاحيات والمحاولة مجدداً.');
    return false;
  }
};

/**
 * طباعة جدول الورد القرآني مباشرة أو حفظه كـ PDF عبر شاشة الطباعة الخاصة بالنظام
 * @param {Array} readers - قائمة القراء
 * @param {number} juzCount - مقدار الورد
 * @param {number} daysOffset - 0 لليوم، 1 للغد
 * @param {string} title - اسم التقرير
 * @returns {Promise<boolean>}
 */
export const printWirdDirectly = async (
  readers = [],
  juzCount = 1,
  daysOffset = 0,
  title = 'جدول توزيع الورد القرآني',
  dailyStatuses = {}
) => {
  try {
    if (!readers || readers.length === 0) {
      Alert.alert('تنبيه', 'لا يوجد قراء مسجلين لطباعة الجدول.');
      return false;
    }

    const html = buildWirdPdfHtml(readers, juzCount, daysOffset, title, dailyStatuses);

    if (Platform.OS === 'web') {
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 400);
          return true;
        }
      } catch (e) {
        console.warn('printWindow fallback:', e);
      }
    }

    await Print.printAsync({ html });
    return true;
  } catch (error) {
    console.error('خطأ أثناء طباعة الجدول:', error);
    Alert.alert('خطأ', 'حدث خطأ أثناء فتح شاشة الطباعة.');
    return false;
  }
};

/**
 * تصدير نتائج استبيان المجموعة كملف PDF رسمي ومشاركته
 * @param {Object} survey - كائن الاستبيان
 * @param {Array} readers - قائمة القراء
 * @param {string} title - عنوان التقرير
 */
export const exportSurveyToPdf = async (
  survey,
  readers = [],
  title = 'تقرير نتائج استبيان المجموعة القرآني'
) => {
  try {
    if (!survey) {
      Alert.alert('تنبيه', 'لا يوجد استبيان نشط حالياً لتصدير نتائجه.');
      return false;
    }

    const html = buildSurveyPdfHtml(survey, readers, title);

    if (Platform.OS === 'web') {
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 400);
          return true;
        }
      } catch (e) {
        console.warn('Survey print popup fallback:', e);
      }
      await Print.printAsync({ html });
      return true;
    }

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'تصدير نتائج الاستبيان (PDF)',
      });
      return true;
    } else {
      Alert.alert('تم إنشاء تقرير الاستبيان', `تم حفظ الملف بنجاح:\n${uri}`);
      return true;
    }
  } catch (error) {
    console.error('خطأ في تصدير نتائج الاستبيان PDF:', error);
    Alert.alert('خطأ', 'تعذر تصدير تقرير الاستبيان كـ PDF.');
    return false;
  }
};

/**
 * طباعة نتائج الاستبيان مباشرة
 */
export const printSurveyDirectly = async (
  survey,
  readers = [],
  title = 'تقرير نتائج استبيان المجموعة القرآني'
) => {
  try {
    if (!survey) {
      Alert.alert('تنبيه', 'لا يوجد استبيان نشط للطباعة.');
      return false;
    }

    const html = buildSurveyPdfHtml(survey, readers, title);

    if (Platform.OS === 'web') {
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 400);
          return true;
        }
      } catch (e) {
        console.warn('Survey print popup fallback:', e);
      }
    }

    await Print.printAsync({ html });
    return true;
  } catch (error) {
    console.error('خطأ أثناء طباعة تقرير الاستبيان:', error);
    Alert.alert('خطأ', 'تعذر فتح نافذة الطباعة.');
    return false;
  }
};
