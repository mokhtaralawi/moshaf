import { QURAN_JUZ_DATA } from '../constants/quranData.js';

/**
 * 1. دالة لضبط رقم الجزء دائرياً بين 1 و 30
 * مثال: إذا وصل القارئ إلى الجزء 31 يتحول تلقائياً إلى الجزء 1
 */
export const normalizeJuz = (juzNumber) => {
  return ((juzNumber - 1) % 30) + 1;
};

/**
 * 2. دالة لحساب تفاصيل الورد (الأجزاء والصفحات) لقارئ معين
 * @param {number} startJuz - الجزء الحالي للقارئ
 * @param {number} juzCount - عدد الأجزاء المقررة يومياً (الافتراضي 1)
 */
export const getReaderWirdDetails = (startJuz, juzCount = 1) => {
  const firstJuzNum = normalizeJuz(startJuz);
  const lastJuzNum = normalizeJuz(startJuz + juzCount - 1);

  const firstJuzObj = QURAN_JUZ_DATA.find((item) => item.juz === firstJuzNum) || { startPage: 1, endPage: 21, surahs: '' };
  const lastJuzObj = QURAN_JUZ_DATA.find((item) => item.juz === lastJuzNum) || { startPage: 1, endPage: 21, surahs: '' };

  // إذا كان الورد جزءاً واحداً فقط
  if (juzCount === 1) {
    const pagesCount = firstJuzObj.endPage - firstJuzObj.startPage + 1;
    return {
      juzNumber: firstJuzNum,
      juzText: `الجزء ${firstJuzNum}`,
      surahs: firstJuzObj.surahs || '',
      startPage: firstJuzObj.startPage,
      endPage: firstJuzObj.endPage,
      pagesCount,
      NextJuz: normalizeJuz(startJuz + 1),
    };
  }

  // إذا كان الورد أكثر من جزء (مثلاً جزأين أو ثلاثة)
  let pagesCount = 0;
  if (lastJuzObj.endPage < firstJuzObj.startPage) {
    pagesCount = 604 - firstJuzObj.startPage + 1 + lastJuzObj.endPage;
  } else {
    pagesCount = lastJuzObj.endPage - firstJuzObj.startPage + 1;
  }

  const surahsText = firstJuzObj.surahs === lastJuzObj.surahs
    ? firstJuzObj.surahs
    : `${firstJuzObj.surahs} حتى ${lastJuzObj.surahs}`;

  return {
    juzNumber: firstJuzNum,
    juzText: `الأجزاء (${firstJuzNum} - ${lastJuzNum})`,
    surahs: surahsText,
    startPage: firstJuzObj.startPage,
    endPage: lastJuzObj.endPage,
    pagesCount,
    NextJuz: normalizeJuz(startJuz + juzCount),
  };
};

/**
 * 3. دالة لترحيل جميع القراء إلى ورد اليوم التالي
 * @param {Array} readers - مصفوفة القراء الحالية
 * @param {number} juzCount - مقدار الزيادة اليومية بالأجزاء
 */
export const advanceReadersToNextDay = (readers, juzCount = 1) => {
  return readers.map((reader) => ({
    ...reader,
    currentJuz: normalizeJuz(reader.currentJuz + juzCount),
  }));
};

/**
 * 4. دالة لتنسيق التاريخ باللغة العربية (مثال: الأحد 18 / 10 / 2026)
 * @param {number} daysOffset - عدد الأيام المضافة (0 لليوم، 1 للغد، إلخ)
 */
export const getFormattedArabicDate = (daysOffset = 0) => {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysOffset);

  const dayName = days[targetDate.getDay()];
  const day = String(targetDate.getDate()).padStart(2, '0');
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const year = targetDate.getFullYear();

  return `${dayName} ${day} / ${month} / ${year}`;
};

/**
 * 5. دالة لحساب وتنسيق التاريخ الهجري (مثال: 7 جمادى الأولى 1448 هـ)
 * @param {number} daysOffset - عدد الأيام المضافة (0 لليوم، 1 للغد، إلخ)
 */
export const getFormattedHijriDate = (daysOffset = 0) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysOffset);

  try {
    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formatted = formatter.format(targetDate);
    return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
  } catch (error) {
    try {
      const fallbackFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const formatted = fallbackFormatter.format(targetDate);
      return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
    } catch (e) {
      return '';
    }
  }
};

/**
 * 6. دالة توليد النص المنسق الجاهز للنسخ والإرسال في واتساب
 * @param {Array} readers - قائمة القراء
 * @param {number} juzCount - عدد الأجزاء اليومية لكل شخص
 * @param {number} daysOffset - 0 لجدول اليوم، 1 لجدول الغد، إلخ
 */
export const generateWhatsAppReport = (readers, juzCount = 1, daysOffset = 0) => {
  if (!readers || readers.length === 0) {
    return 'لا يوجد قراء مضافين في القائمة حالياً.';
  }

  const gregorianDate = getFormattedArabicDate(daysOffset);
  const hijriDate = getFormattedHijriDate(daysOffset);
  const hijriText = hijriDate ? ` | الهجري: ${hijriDate}` : '';
  const appHeader = `📖 زاد الأنصاري • « مشورة إب »\nجدول توزيع الورد القرآني المبارك\n`;
  const dateHeader = `${appHeader}التاريخ: ${gregorianDate} م${hijriText}\n\n`;

  // حساب أطول اسم في القائمة لضبط المسافات بعده بشكل متناسق
  const maxNameLength = Math.max(...readers.map((r) => r.name.length));

  const lines = readers.map((reader) => {
    // حساب الجزء المستهدف بناءً على اليوم المطلوب (اليوم = 0، الغد = 1)
    const targetStartJuz = normalizeJuz(reader.currentJuz + daysOffset * juzCount);
    const details = getReaderWirdDetails(targetStartJuz, juzCount);

    // إضافة نقطة ومسافات بعد الاسم لتوحيد المحاذاة كما طلبت
    const nameWithDot = `${reader.name}.`;
    const spacesCount = Math.max(2, maxNameLength - reader.name.length + 4);
    const spaces = ' '.repeat(spacesCount);

    // معالجة حالة التداخل إذا بدأ القارئ من الجزء 30 وأكمل في الجزء 1 (عند قراءة أكثر من جزء)
    if (juzCount > 1 && details.endPage < details.startPage) {
      return `${nameWithDot}${spaces}${details.juzText} ، من صـ ${details.startPage} إلى 604 ثم من 1 إلى ${details.endPage}`;
    }

    return `${nameWithDot}${spaces}${details.juzText} ، من صفحة ${details.startPage} الى صفحة ${details.endPage}`;
  });

  return dateHeader + lines.join('\n');
};

/**
 * 6. دالة لتنسيق الوقت بصيغة 12 ساعة باللغة العربية (مثال: 8:00 م، 5:30 ص)
 * @param {number} hour - الساعة (0 - 23)
 * @param {number} minute - الدقيقة (0 - 59)
 */
export const formatArabicTime = (hour = 20, minute = 0) => {
  const h = Number(hour) || 0;
  const m = Number(minute) || 0;
  const period = h >= 12 ? 'م' : 'ص';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMinute = String(m).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
};