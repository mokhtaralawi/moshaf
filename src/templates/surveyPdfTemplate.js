import { getFormattedArabicDate, getFormattedHijriDate } from '../utils/wirdCalculator.js';
import { pdfStyles } from './pdfStyles.js';

/**
 * بناء قالب HTML متكامل لتصدير نتائج استبيان المجموعة كملف PDF رسمي
 * @param {Object} survey - كائن الاستبيان النشط وبيانات التصويت
 * @param {Array} readers - قائمة جميع القراء في المجموعة
 * @param {string} title - عنوان التقرير
 */
export const buildSurveyPdfHtml = (
  survey,
  readers = [],
  title = 'زاد الأنصاري • مشورة إب (تقرير نتائج الاستبيان)'
) => {
  const dateStr = getFormattedArabicDate(0);
  const hijriStr = getFormattedHijriDate(0);

  const votes = survey?.votes || {};
  const totalReaders = readers.length;

  let yesCount = 0;
  let noCount = 0;

  readers.forEach((reader) => {
    const v = votes[reader.id]?.vote;
    if (v === 'yes') yesCount++;
    else if (v === 'no') noCount++;
  });

  const answeredCount = yesCount + noCount;
  const pendingCount = Math.max(0, totalReaders - answeredCount);

  const yesPercent = totalReaders > 0 ? Math.round((yesCount / totalReaders) * 100) : 0;
  const noPercent = totalReaders > 0 ? Math.round((noCount / totalReaders) * 100) : 0;
  const pendingPercent = totalReaders > 0 ? Math.round((pendingCount / totalReaders) * 100) : 0;

  // توليد صفوف الجدول
  const tableRowsHtml = readers
    .map((reader, index) => {
      const userVote = votes[reader.id];
      let voteCell = '<span class="status-tag status-pending">⏳ لم يُجب بعد</span>';
      let timeText = '—';

      if (userVote) {
        if (userVote.vote === 'yes') {
          voteCell = '<span class="status-tag status-read">✅ نعم</span>';
        } else if (userVote.vote === 'no') {
          voteCell = '<span class="status-tag status-excused">❌ لا</span>';
        }

        if (userVote.timestamp) {
          const d = new Date(userVote.timestamp);
          let h = d.getHours();
          const m = String(d.getMinutes()).padStart(2, '0');
          const ampm = h >= 12 ? 'م' : 'ص';
          h = h % 12 || 12;
          timeText = `${h}:${m} ${ampm}`;
        }
      }

      return `
        <tr>
          <td class="col-idx" style="width: 8%;">${index + 1}</td>
          <td class="col-name" style="width: 44%; text-align: right; font-weight: bold;">${reader.name}</td>
          <td style="width: 26%; text-align: center;">${voteCell}</td>
          <td style="width: 22%; text-align: center; color: #64748B; font-size: 9pt;">${timeText}</td>
        </tr>
      `;
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
          .survey-question-box {
            background-color: #ECFDF5;
            border: 2px solid #059669;
            border-radius: 10px;
            padding: 14px 18px;
            margin-bottom: 14px;
            text-align: right;
            direction: rtl;
          }
          .survey-label {
            font-size: 11pt;
            font-weight: bold;
            color: #065F46;
            margin-bottom: 4px;
          }
          .survey-question-text {
            font-size: 14pt;
            font-weight: bold;
            color: #0F172A;
            line-height: 1.4;
          }
          .stats-card-survey {
            width: 100%;
            border-collapse: separate;
            border-spacing: 8px 0;
            margin-bottom: 14px;
            direction: rtl;
          }
          .stats-cell-survey {
            background-color: #F8FAFC;
            border: 1.5px solid #E2E8F0;
            border-radius: 8px;
            padding: 10px 6px;
            text-align: center;
            vertical-align: middle;
          }
          .stat-yes {
            background-color: #F0FDF4 !important;
            border-color: #86EFAC !important;
          }
          .stat-no {
            background-color: #FFF1F2 !important;
            border-color: #FECDD3 !important;
          }
          .stat-pending {
            background-color: #FFFBEB !important;
            border-color: #FDE68A !important;
          }
          .stat-num-large {
            display: block;
            font-size: 16pt;
            font-weight: 900;
          }
          .stat-num-yes { color: #15803D; }
          .stat-num-no { color: #BE123C; }
          .stat-num-pending { color: #B45309; }
          .stat-lbl {
            font-size: 9.5pt;
            color: #475569;
            font-weight: bold;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <!-- البسملة -->
        <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>

        <!-- ترويسة التقرير -->
        <table class="header-table">
          <tr>
            <td class="title-area" style="width: 60%;">
              <h1>📋 ${title}</h1>
              <p>📅 التاريخ: ${dateStr} م ${hijriStr ? `| الهجري: ${hijriStr}` : ''}</p>
            </td>
            <td style="width: 40%; text-align: left;">
              <div style="font-size: 10pt; color: #065F46; font-weight: bold;">
                🕌 حلقة مُوزّع الورد القرآني
              </div>
              <div style="font-size: 9pt; color: #64748B; margin-top: 2px;">
                إجمالي الأعضاء: ${totalReaders} عضو
              </div>
            </td>
          </tr>
        </table>

        <!-- صندوق نص السؤال المطروح -->
        <div class="survey-question-box">
          <div class="survey-label">سؤال الاستبيان:</div>
          <div class="survey-question-text">« ${survey?.question || 'بدون سؤال'} »</div>
        </div>

        <!-- بطاقات ملخص الإحصائيات -->
        <table class="stats-card-survey">
          <tr>
            <td class="stats-cell-survey stat-yes" style="width: 33%;">
              <span class="stat-num-large stat-num-yes">${yesCount} (${yesPercent}%)</span>
              <div class="stat-lbl">أجابوا بـ (نعم ✅)</div>
            </td>
            <td class="stats-cell-survey stat-no" style="width: 33%;">
              <span class="stat-num-large stat-num-no">${noCount} (${noPercent}%)</span>
              <div class="stat-lbl">أجابوا بـ (لا ❌)</div>
            </td>
            <td class="stats-cell-survey stat-pending" style="width: 34%;">
              <span class="stat-num-large stat-num-pending">${pendingCount} (${pendingPercent}%)</span>
              <div class="stat-lbl">لم يُجيبوا بعد (⏳)</div>
            </td>
          </tr>
        </table>

        <!-- جدول تفاصيل إجابات الأعضاء -->
        <table class="wird-table">
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="width: 44%;">اسم القارئ / العضو</th>
              <th style="width: 26%;">الإجابة</th>
              <th style="width: 22%;">وقت الرد</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <!-- التذييل والتوقيع -->
        <div class="footer-box">
          <div class="hadith-banner">
            « خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ » • رواه البخاري
          </div>
          <table class="signatures-table">
            <tr>
              <td style="text-align: right; width: 50%;">
                <strong>إدارة المجموعة القرآنية:</strong> ____________________
              </td>
              <td style="text-align: left; width: 50%;">
                <strong>تاريخ الاعتماد:</strong> ${dateStr} م
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
};
