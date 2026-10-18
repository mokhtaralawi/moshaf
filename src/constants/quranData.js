// خريطة أجزاء القرآن الكريم الثلاثين (طبعة مجمع الملك فهد - 604 صفحات) مع أسماء السور
export const QURAN_JUZ_DATA = [
  { juz: 1, startPage: 1, endPage: 21, surahs: 'الفاتحة - البقرة' },
  { juz: 2, startPage: 22, endPage: 41, surahs: 'سورة البقرة' },
  { juz: 3, startPage: 42, endPage: 61, surahs: 'البقرة - آل عمران' },
  { juz: 4, startPage: 62, endPage: 81, surahs: 'آل عمران - النساء' },
  { juz: 5, startPage: 82, endPage: 101, surahs: 'سورة النساء' },
  { juz: 6, startPage: 102, endPage: 121, surahs: 'النساء - المائدة' },
  { juz: 7, startPage: 122, endPage: 141, surahs: 'المائدة - الأنعام' },
  { juz: 8, startPage: 142, endPage: 161, surahs: 'الأنعام - الأعراف' },
  { juz: 9, startPage: 162, endPage: 181, surahs: 'الأعراف - الأنفال' },
  { juz: 10, startPage: 182, endPage: 201, surahs: 'الأنفال - التوبة' },
  { juz: 11, startPage: 202, endPage: 221, surahs: 'التوبة - هود' },
  { juz: 12, startPage: 222, endPage: 241, surahs: 'هود - يوسف' },
  { juz: 13, startPage: 242, endPage: 261, surahs: 'يوسف - إبراهيم' },
  { juz: 14, startPage: 262, endPage: 281, surahs: 'الحجر - النحل' },
  { juz: 15, startPage: 282, endPage: 301, surahs: 'الإسراء - الكهف' },
  { juz: 16, startPage: 302, endPage: 321, surahs: 'الكهف - طه' },
  { juz: 17, startPage: 322, endPage: 341, surahs: 'الأنبياء - الحج' },
  { juz: 18, startPage: 342, endPage: 361, surahs: 'المؤمنون - الفرقان' },
  { juz: 19, startPage: 362, endPage: 381, surahs: 'الفرقان - النمل' },
  { juz: 20, startPage: 382, endPage: 401, surahs: 'النمل - العنكبوت' },
  { juz: 21, startPage: 402, endPage: 421, surahs: 'العنكبوت - الأحزاب' },
  { juz: 22, startPage: 422, endPage: 441, surahs: 'الأحزاب - يس' },
  { juz: 23, startPage: 442, endPage: 461, surahs: 'يس - الزمر' },
  { juz: 24, startPage: 462, endPage: 481, surahs: 'الزمر - فصلت' },
  { juz: 25, startPage: 482, endPage: 501, surahs: 'فصلت - الجاثية' },
  { juz: 26, startPage: 502, endPage: 521, surahs: 'الأحقاف - الذاريات' },
  { juz: 27, startPage: 522, endPage: 541, surahs: 'الذاريات - الحديد' },
  { juz: 28, startPage: 542, endPage: 561, surahs: 'المجادلة - التحريم' },
  { juz: 29, startPage: 562, endPage: 581, surahs: 'الملك - المرسلات' },
  { juz: 30, startPage: 582, endPage: 604, surahs: 'النبأ - الناس' },
];

// القائمة الافتراضية للقراء عند تشغيل التطبيق لأول مرة
export const DEFAULT_READERS = [
  { id: '1', name: 'مراد', currentJuz: 1 },
  { id: '2', name: 'علي', currentJuz: 2 },
  { id: '3', name: 'العرندس', currentJuz: 3 },
  { id: '4', name: 'وائل', currentJuz: 4 },
  { id: '5', name: 'مختار', currentJuz: 5 },
  { id: '6', name: 'ابو طالوت', currentJuz: 6 },
];

// خيارات مقدار الورد اليومي (كم جزء يقرأ الشخص في اليوم)
export const WIRD_AMOUNT_OPTIONS = [
  { label: 'جزء واحد يومياً', value: 1 },
  { label: 'جزآن يومياً', value: 2 },
  { label: '3 أجزاء يومياً', value: 3 },
];