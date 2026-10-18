/**
 * ملف تنسيقات CSS الخاص بطباعة وتصدير تقرير الورد القرآني (PDF)
 * مصمم لضمان إخراج متجهي كامل (Vector PDF) من اليمين إلى الشمال بدون أي تشويه أو لقطة شاشة
 */

export const pdfStyles = `
  @page {
    size: A4 portrait;
    margin: 10mm 10mm 12mm 10mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html, body {
    direction: rtl !important;
    text-align: right !important;
    background-color: #ffffff !important;
    color: #000000 !important;
    margin: 0;
    padding: 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Traditional Arabic", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
  }

  /* البسملة التزيينية في أعلى الصفحة */
  .bismillah {
    text-align: center;
    font-size: 17pt;
    font-weight: bold;
    color: #065F46;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    direction: rtl;
  }

  /* ترويسة التقرير المنظمة */
  .header-table {
    width: 100% !important;
    border-collapse: collapse !important;
    border-bottom: 2.5px solid #065F46 !important;
    padding-bottom: 6px;
    margin-bottom: 10px;
    direction: rtl !important;
  }

  .header-table td {
    border: none !important;
    padding: 4px 2px;
    vertical-align: middle;
  }

  .title-area h1 {
    margin: 0 0 3px 0;
    font-size: 16pt;
    color: #064E3B;
    font-weight: 900;
  }

  .title-area p {
    margin: 0;
    font-size: 10pt;
    color: #475569;
  }

  /* بطاقات الإحصائيات في الترويسة */
  .stats-badge-table {
    border-collapse: collapse !important;
    border: 1.5px solid #065F46 !important;
    background-color: #F0FDF4 !important;
    border-radius: 6px;
    margin-left: auto;
    direction: rtl !important;
  }

  .stats-badge-table td {
    border: 1px solid #A7F3D0 !important;
    padding: 5px 10px;
    text-align: center !important;
    font-size: 9.5pt;
  }

  .stats-num {
    font-size: 12pt;
    font-weight: bold;
    color: #065F46;
    display: block;
  }

  /* جدول الورد القرآني الحقيقي بأعمدة وصفوف صريحة من اليمين لليسار */
  table.main-wird-table {
    width: 100% !important;
    border-collapse: collapse !important;
    border: 2px solid #065F46 !important;
    margin-top: 10px;
    table-layout: fixed !important;
    direction: rtl !important;
    page-break-inside: auto;
  }

  table.main-wird-table thead {
    display: table-header-group !important;
  }

  table.main-wird-table tr {
    page-break-inside: avoid !important;
    page-break-after: auto;
  }

  table.main-wird-table th {
    background-color: #065F46 !important;
    color: #FFFFFF !important;
    font-size: 10.5pt;
    font-weight: bold;
    padding: 8px 4px;
    border: 1.5px solid #065F46 !important;
    text-align: center !important;
    vertical-align: middle;
  }

  table.main-wird-table td {
    border: 1px solid #64748B !important;
    padding: 7px 5px;
    font-size: 10pt;
    text-align: center !important;
    vertical-align: middle;
    color: #0F172A;
  }

  table.main-wird-table tbody tr:nth-child(even) {
    background-color: #F8FAFC !important;
  }

  table.main-wird-table tbody tr:nth-child(odd) {
    background-color: #FFFFFF !important;
  }

  .col-idx {
    width: 6%;
    font-weight: bold;
    color: #334155;
    background-color: #F1F5F9 !important;
  }

  .col-name {
    width: 25%;
    text-align: right !important;
    padding-right: 10px !important;
    font-weight: bold;
    font-size: 11pt;
    color: #000000;
  }

  .col-juz {
    width: 23%;
    color: #065F46;
    font-weight: bold;
  }

  .surah-label {
    font-size: 8.5pt;
    color: #475569;
    font-weight: normal;
    margin-top: 2px;
  }

  .col-page {
    width: 12%;
    font-weight: bold;
    color: #1E293B;
  }

  .col-count {
    width: 11%;
    font-weight: bold;
    color: #065F46;
  }

  .col-check {
    width: 11%;
  }

  .checkbox-box {
    display: inline-block;
    width: 17px;
    height: 17px;
    border: 2px solid #065F46;
    background-color: #FFFFFF;
    border-radius: 3px;
  }

  .status-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 8.5pt;
    font-weight: bold;
  }

  .status-read {
    background-color: #DCFCE7 !important;
    color: #15803D !important;
    border: 1px solid #86EFAC !important;
  }

  .status-excused {
    background-color: #FFE4E6 !important;
    color: #BE123C !important;
    border: 1px solid #FECDD3 !important;
  }

  .status-pending {
    background-color: #FEF3C7 !important;
    color: #B45309 !important;
    border: 1px solid #FDE68A !important;
  }

  /* صف الإجمالي النهائي في أسفل الجدول */
  .total-summary-row td {
    background-color: #E2E8F0 !important;
    border: 1.5px solid #065F46 !important;
    font-weight: bold;
    color: #064E3B;
    padding: 8px 4px;
    font-size: 10.5pt;
  }

  /* التذييل والتوقيع */
  .footer-box {
    margin-top: 14px;
    page-break-inside: avoid;
    direction: rtl !important;
  }

  .hadith-banner {
    text-align: center;
    background-color: #F0FDF4 !important;
    border: 1px solid #86EFAC !important;
    border-right: 4px solid #059669 !important;
    padding: 8px 12px;
    color: #065F46;
    font-weight: bold;
    font-size: 10pt;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .signatures-table {
    width: 100% !important;
    border-collapse: collapse !important;
    direction: rtl !important;
  }

  .signatures-table td {
    border: none !important;
    padding: 4px 6px;
    font-size: 9.5pt;
    color: #475569;
  }
`;
