import { normalizeJuz, getReaderWirdDetails, getFormattedArabicDate, getFormattedHijriDate } from '../utils/wirdCalculator.js';
import { pdfStyles } from './pdfStyles.js';

/**
 * دالة لتوليد كود HTML لصف قارئ واحد داخل الجدول
 * @param {Object} reader - بيانات القارئ
 * @param {number} index - ترتيب القارئ في القائمة
 * @param {number} juzCount - مقدار الورد
 * @param {number} daysOffset - إزاحة الأيام
 */
export const generateReaderRowHtml = (
  reader,
  index,
  juzCount = 1,
  daysOffset = 0,
  status = 'pending'
) => {
  const targetStartJuz = normalizeJuz(reader.currentJuz + daysOffset * juzCount);
  const details = getReaderWirdDetails(targetStartJuz, juzCount);

  let pagesCount = details.pagesCount || 0;
  let startPageText = `${details.startPage}`;
  let endPageText = `${details.endPage}`;

  if (juzCount > 1 && details.endPage < details.startPage) {
    pagesCount = 604 - details.startPage + 1 + details.endPage;
    endPageText = `604 ثم ${details.endPage}`;
  } else if (!pagesCount) {
    pagesCount = details.endPage - details.startPage + 1;
  }

  const surahNote = details.surahs
    ? `<div class="surah-label">(${details.surahs})</div>`
    : '';

  // عرض الحالة المنجزة لليوم الحالي، أو مربع تأشير للأيام القادمة
  let checkCellContent = '<div class="checkbox-box"></div>';
  if (daysOffset === 0) {
    if (status === 'read') {
      checkCellContent = '<span class="status-tag status-read">✅ أتم الورد</span>';
    } else if (status === 'excused') {
      checkCellContent = '<span class="status-tag status-excused">✋ معتذر</span>';
    } else {
      checkCellContent = '<span class="status-tag status-pending">⏳ قيد القراءة</span>';
    }
  }

  return {
    pagesCount,
    html: `
      <tr>
        <td class="col-idx">${index + 1}</td>
        <td class="col-name">${reader.name}</td>
        <td class="col-juz">
          <strong>${details.juzText}</strong>
          ${surahNote}
        </td>
        <td class="col-page">صـ ${startPageText}</td>
        <td class="col-page">صـ ${endPageText}</td>
        <td class="col-count">${pagesCount} صفحة</td>
        <td class="col-check">
          ${checkCellContent}
        </td>
      </tr>
    `,
  };
};

/**
 * دالة بناء هيكل الـ HTML الكامل لتقرير الورد القرآني
 * تدمج ملف التنسيق المنفصل (CSS) مع هيكل الجدول (HTML)
 * @param {Array} readers - قائمة القراء كاملة
 * @param {number} juzCount - مقدار الورد بالأجزاء
 * @param {number} daysOffset - 0 لليوم، 1 للغد
 * @param {string} title - عنوان التقرير
 * @param {Object} dailyStatuses - حالات القراءة لليوم
 */
export const buildWirdPdfHtml = (
  readers = [],
  juzCount = 1,
  daysOffset = 0,
  title = 'زاد الأنصاري • مشورة إب (جدول توزيع الورد القرآني)',
  dailyStatuses = {}
) => {
  const dateStr = getFormattedArabicDate(daysOffset);
  const hijriStr = getFormattedHijriDate(daysOffset);
  const dayLabel = daysOffset === 0 ? 'جدول اليوم' : daysOffset === 1 ? 'جدول الغد' : `جدول بعد ${daysOffset} أيام`;
  const totalAjza = readers.length * juzCount;

  let totalPagesSum = 0;
  const tableRowsHtml = readers
    .map((reader, index) => {
      const status = dailyStatuses[reader.id]?.status || 'pending';
      const { pagesCount, html } = generateReaderRowHtml(reader, index, juzCount, daysOffset, status);
      totalPagesSum += pagesCount;
      return html;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>${title} - ${dateStr}</title>
        <style>
          ${pdfStyles}
        </style>
      </head>
      <body>
        <!-- البسملة -->
        <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>

        <!-- ترويسة التقرير -->
        <table class="header-table">
          <tr>
            <td class="title-area" style="width: 58%;">
              <h1>📖 ${title}</h1>
              <p>📅 ${dayLabel} | الميلادي: ${dateStr} م ${hijriStr ? `| الهجري: ${hijriStr}` : ''}</p>
            </td>
            <td style="width: 40%; text-align: left;">
              <table class="stats-badge-table">
                <tr>
                  <td>
                    <span class="stats-num">${readers.length}</span>
                    القراء
                  </td>
                  <td>
                    <span class="stats-num">${juzCount}</span>
                    جزء/يوم
                  </td>
                  <td>
                    <span class="stats-num">${totalAjza}</span>
                    أجزاء اليوم
                  </td>
                  <td>
                    <span class="stats-num">${totalPagesSum}</span>
                    صفحة
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- الجدول الحقيقي الصريح بأعمدة وصفوف واضحة لجميع المشاركين -->
        <table class="main-wird-table">
          <thead>
            <tr>
              <th style="width: 6%;">م</th>
              <th style="width: 25%;">اسم القارئ</th>
              <th style="width: 23%;">الورد المقرر</th>
              <th style="width: 12%;">من صفحة</th>
              <th style="width: 12%;">إلى صفحة</th>
              <th style="width: 11%;">الصفحات</th>
              <th style="width: 11%;">الإنجاز</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr class="total-summary-row">
              <td colspan="2" style="text-align: right; padding-right: 12px;">المجموع الإجمالي للقراء:</td>
              <td>${readers.length} قارئ</td>
              <td colspan="2">${totalAjza} جزء لليوم</td>
              <td>${totalPagesSum} صفحة</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>

        <!-- تذييل التقرير وتوقيع المتابع -->
        <div class="footer-box">
          <div class="hadith-banner">
            ✨ قال رسول الله ﷺ: «خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» — تقبل الله منا ومنكم صالح الأعمال 🤲
          </div>
          <table class="signatures-table">
            <tr>
              <td style="text-align: right;">تم الاستخراج آلياً عبر تطبيق مُوزّع الورد القرآني</td>
              <td style="text-align: left; font-weight: bold; color: #0F172A;">
                توقيع المشرف / المتابع: ____________________
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
};
