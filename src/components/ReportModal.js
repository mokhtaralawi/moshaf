import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  generateWhatsAppReport,
  getReaderWirdDetails,
  normalizeJuz,
  getFormattedArabicDate,
  getFormattedHijriDate,
} from '../utils/wirdCalculator';
import { exportWirdToPdf, printWirdDirectly } from '../services/pdfService';

export default function ReportModal({
  visible,
  onClose,
  readers = [],
  juzCount = 1,
  dailyStatuses = {},
}) {
  // 0 = تقرير اليوم، 1 = تقرير الغد
  const [dayOffset, setDayOffset] = useState(0);
  // 'table' = عرض الجدول المنظم (PDF)، 'text' = عرض النص للواتساب
  const [viewMode, setViewMode] = useState('table');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const reportDate = getFormattedArabicDate(dayOffset);
  const reportHijri = getFormattedHijriDate(dayOffset);
  const reportText = generateWhatsAppReport(readers, juzCount, dayOffset);

  // تصدير جدول PDF ومشاركته
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportWirdToPdf(
        readers,
        juzCount,
        dayOffset,
        'زاد الأنصاري • مشورة إب (جدول توزيع الورد القرآني)',
        dailyStatuses
      );
    } catch (error) {
      console.error('خطأ في تصدير PDF:', error);
      Alert.alert('خطأ', 'تعذر تصدير ملف PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // طباعة أو معاينة الجدول مباشرة
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printWirdDirectly(
        readers,
        juzCount,
        dayOffset,
        'زاد الأنصاري • مشورة إب (جدول توزيع الورد القرآني)',
        dailyStatuses
      );
    } catch (error) {
      console.error('خطأ في الطباعة:', error);
      Alert.alert('خطأ', 'تعذر فتح نافذة الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  // نسخ النص إلى الحافظة
  const handleCopyText = async () => {
    await Clipboard.setStringAsync(reportText);
    Alert.alert('تم النسخ بنجاح', 'تم نسخ جدول الورد، يمكنك لصقه الآن في الواتساب.');
  };

  // فتح نافذة المشاركة لإرسال النص مباشرة إلى واتساب
  const handleShareText = async () => {
    try {
      await Share.share({
        message: reportText,
      });
    } catch (error) {
      console.error('خطأ أثناء المشاركة:', error);
    }
  };

  // حساب إجمالي الصفحات
  let totalPagesCount = 0;
  readers.forEach((reader) => {
    const targetStartJuz = normalizeJuz(reader.currentJuz + dayOffset * juzCount);
    const details = getReaderWirdDetails(targetStartJuz, juzCount);
    totalPagesCount += details.pagesCount || 0;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* عنوان التقرير */}
          <View style={styles.headerBox}>
            <Text style={styles.modalTitle}>📄 زاد الأنصاري • تقارير الورد</Text>
            <Text style={styles.modalSubtitle}>« مشورة إب » • تصدير جدول PDF متجهي كامل</Text>
          </View>

          {/* التبديل بين جدول اليوم وجدول الغد */}
          <View style={styles.dayTabContainer}>
            <TouchableOpacity
              style={[styles.dayTab, dayOffset === 0 && styles.activeDayTab]}
              onPress={() => setDayOffset(0)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayTabText, dayOffset === 0 && styles.activeDayTabText]}>
                📅 جدول اليوم
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dayTab, dayOffset === 1 && styles.activeDayTab]}
              onPress={() => setDayOffset(1)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayTabText, dayOffset === 1 && styles.activeDayTabText]}>
                📅 جدول الغد
              </Text>
            </TouchableOpacity>
          </View>

          {/* التبديل بين معاينة الجدول ومعاينة النص */}
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[styles.modeTab, viewMode === 'table' && styles.activeModeTab]}
              onPress={() => setViewMode('table')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeTabText, viewMode === 'table' && styles.activeModeTabText]}>
                📊 معاينة الجدول الكامل (أعمدة وصفوف)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, viewMode === 'text' && styles.activeModeTab]}
              onPress={() => setViewMode('text')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeTabText, viewMode === 'text' && styles.activeModeTabText]}>
                💬 نص الواتساب
              </Text>
            </TouchableOpacity>
          </View>

          {/* شريط الإحصائيات السريعة */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>الميلادي: </Text>
              <Text style={styles.summaryValue}>{reportDate} م</Text>
            </View>
            {reportHijri ? (
              <View style={styles.summaryPill}>
                <Text style={styles.summaryLabel}>الهجري: </Text>
                <Text style={styles.summaryValue}>{reportHijri}</Text>
              </View>
            ) : null}
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>القراء: </Text>
              <Text style={styles.summaryValue}>{readers.length} عضو</Text>
            </View>
          </View>

          {/* محتوى المعاينة */}
          {viewMode === 'table' ? (
            /* معاينة الجدول المتناسق الممتد من اليمين للشمال */
            <View style={styles.tableCard}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                <View style={styles.tableInner}>
                  {/* ترويسة أعمدة الجدول الرسمية */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thCell, styles.colIdx]}>م</Text>
                    <Text style={[styles.thCell, styles.colName]}>اسم القارئ</Text>
                    <Text style={[styles.thCell, styles.colJuz]}>الورد المقرر</Text>
                    <Text style={[styles.thCell, styles.colPage]}>من صـ</Text>
                    <Text style={[styles.thCell, styles.colPage]}>إلى صـ</Text>
                    <Text style={[styles.thCell, styles.colPagesCount]}>الصفحات</Text>
                    <Text style={[styles.thCell, styles.colCheck]}>الإنجاز</Text>
                  </View>

                  {/* صفوف الجدول لجميع القراء */}
                  <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
                    {readers.map((reader, idx) => {
                      const targetStartJuz = normalizeJuz(reader.currentJuz + dayOffset * juzCount);
                      const details = getReaderWirdDetails(targetStartJuz, juzCount);
                      const isEven = idx % 2 === 0;

                      return (
                        <View
                          key={reader.id || idx}
                          style={[styles.tableRow, isEven ? styles.rowEven : styles.rowOdd]}
                        >
                          <Text style={[styles.tdCell, styles.colIdx, styles.textCenter]}>{idx + 1}</Text>
                          <Text style={[styles.tdCell, styles.colName, styles.nameText]}>{reader.name}</Text>
                          <View style={[styles.tdCell, styles.colJuz, styles.centerCol]}>
                            <Text style={styles.juzBadgeText}>{details.juzText}</Text>
                            {details.surahs ? (
                              <Text style={styles.surahHint} numberOfLines={1}>
                                {details.surahs}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.tdCell, styles.colPage, styles.pageText]}>{details.startPage}</Text>
                          <Text style={[styles.tdCell, styles.colPage, styles.pageText]}>{details.endPage}</Text>
                          <Text style={[styles.tdCell, styles.colPagesCount, styles.countText]}>
                            {details.pagesCount} ص
                          </Text>
                          <View style={[styles.tdCell, styles.colCheck, styles.centerCol]}>
                            {dayOffset === 0 ? (
                              dailyStatuses[reader.id]?.status === 'read' ? (
                                <Text style={styles.statusDoneText}>✅ تم</Text>
                              ) : dailyStatuses[reader.id]?.status === 'excused' ? (
                                <Text style={styles.statusExcusedText}>✋ اعتذر</Text>
                              ) : (
                                <View style={styles.checkIndicator} />
                              )
                            ) : (
                              <View style={styles.checkIndicator} />
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* صف الإجمالي النهائي */}
                    <View style={styles.tableTotalRow}>
                      <View style={[styles.tdCell, styles.colTotalLabel]}>
                        <Text style={styles.totalLabelText}>
                          المجموع الإجمالي ({readers.length} قراء):
                        </Text>
                      </View>
                      <View style={[styles.tdCell, styles.colTotalJuz]}>
                        <Text style={styles.totalValueText}>
                          {readers.length * juzCount} جزء
                        </Text>
                      </View>
                      <View style={[styles.tdCell, styles.colTotalPages]}>
                        <Text style={styles.totalValueText}>
                          {totalPagesCount} صفحة
                        </Text>
                      </View>
                    </View>
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          ) : (
            /* معاينة النص الموجه للواتساب */
            <ScrollView style={styles.textBox} showsVerticalScrollIndicator={false}>
              <Text style={styles.reportContent}>{reportText}</Text>
            </ScrollView>
          )}

          {/* زر تصدير PDF كجدول حقيقي (الزر الأساسي) */}
          <TouchableOpacity
            style={[styles.primaryPdfBtn, isExportingPdf && styles.btnDisabled]}
            onPress={handleExportPdf}
            disabled={isExportingPdf || isPrinting}
            activeOpacity={0.8}
          >
            {isExportingPdf ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.primaryPdfBtnText}>جاري تجهيز مستند الـ PDF المتجهي...</Text>
              </View>
            ) : (
              <View style={styles.btnTextContainer}>
                <Text style={styles.primaryPdfBtnText}>
                  📄 تصدير وحفظ جدول PDF (كامل لجميع القراء)
                </Text>
                <Text style={styles.primaryPdfBtnSub}>
                  مستند PDF رسمي متجهي يضم كافة أسماء القراء بصفوف وأعمدة واضحة
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* صف الأزرار الثانوية (طباعة ومشاركة نص) */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.printBtn, isPrinting && styles.btnDisabled]}
              onPress={handlePrint}
              disabled={isExportingPdf || isPrinting}
              activeOpacity={0.8}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionBtnText}>🖨️ طباعة / حفظ كـ PDF</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.copyBtn]}
              onPress={handleCopyText}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>📋 نسخ النص</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn]}
              onPress={handleShareText}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>📲 واتساب</Text>
            </TouchableOpacity>
          </View>

          {/* زر الإغلاق */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 820, // عرض متناسق ومتمركز يملأ شاشة الكمبيوتر والأجهزة اللوحية بأناقة
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    maxHeight: '94%',
    borderWidth: 1.5,
    borderColor: '#059669',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    textAlign: 'center',
  },
  dayTabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#E5E7EB',
    borderRadius: 9,
    padding: 3,
    marginBottom: 8,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 7,
  },
  activeDayTab: {
    backgroundColor: '#059669',
  },
  dayTabText: {
    fontSize: 12.5,
    color: '#374151',
    fontWeight: '700',
  },
  activeDayTabText: {
    color: '#FFFFFF',
  },
  modeContainer: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeModeTab: {
    borderBottomColor: '#059669',
  },
  modeTabText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  activeModeTabText: {
    color: '#059669',
    fontWeight: 'bold',
  },
  summaryBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  summaryPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#065F46',
  },
  summaryValue: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#065F46',
  },
  tableCard: {
    borderWidth: 2,
    borderColor: '#065F46',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    width: '100%',
    overflow: 'hidden',
  },
  horizontalScrollContent: {
    width: '100%',
    minWidth: 540,
  },
  tableInner: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#065F46',
    paddingVertical: 8,
    borderBottomWidth: 2.5,
    borderBottomColor: '#F59E0B',
    width: '100%',
  },
  thCell: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: 'bold',
    textAlign: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* توزيع الأعمدة بنسب مئوية مرنة لملء كامل عرض الشاشة من اليمين للشمال */
  colIdx: {
    flex: 0.5,
    minWidth: 32,
  },
  colName: {
    flex: 2.2,
    minWidth: 105,
  },
  colJuz: {
    flex: 2.1,
    minWidth: 95,
  },
  colPage: {
    flex: 1.1,
    minWidth: 55,
  },
  colPagesCount: {
    flex: 1.1,
    minWidth: 55,
  },
  colCheck: {
    flex: 0.8,
    minWidth: 42,
    borderLeftWidth: 0,
  },

  tableBodyScroll: {
    maxHeight: 250,
  },
  tableRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    width: '100%',
  },
  rowEven: {
    backgroundColor: '#FFFFFF',
  },
  rowOdd: {
    backgroundColor: '#F8FAFC',
  },
  tdCell: {
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    paddingVertical: 2,
  },
  textCenter: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
  },
  nameText: {
    textAlign: 'right',
    paddingRight: 8,
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  centerCol: {
    alignItems: 'center',
  },
  juzBadgeText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#065F46',
  },
  surahHint: {
    fontSize: 8.5,
    color: '#047857',
  },
  pageText: {
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  countText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  checkIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  statusDoneText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#15803D',
  },
  statusExcusedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#BE123C',
  },

  /* ترويسة الإجمالي في الأسفل */
  tableTotalRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#E2E8F0',
    borderTopWidth: 2,
    borderTopColor: '#065F46',
    width: '100%',
  },
  colTotalLabel: {
    flex: 4.8, // يغطي التسلسل + الاسم
    paddingRight: 10,
  },
  totalLabelText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#064E3B',
    textAlign: 'right',
  },
  colTotalJuz: {
    flex: 2.1,
    alignItems: 'center',
  },
  colTotalPages: {
    flex: 3,
    alignItems: 'center',
    borderLeftWidth: 0,
  },
  totalValueText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#064E3B',
    textAlign: 'center',
  },

  textBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    maxHeight: 220,
    marginBottom: 10,
  },
  reportContent: {
    color: '#F8FAFC',
    fontFamily: 'monospace',
    fontSize: 12.5,
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  primaryPdfBtn: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#047857',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  btnTextContainer: {
    alignItems: 'center',
  },
  primaryPdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13.5,
  },
  primaryPdfBtnSub: {
    color: '#D1FAE5',
    fontSize: 10,
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  secondaryActionsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printBtn: {
    backgroundColor: '#0284C7',
  },
  copyBtn: {
    backgroundColor: '#4B5563',
  },
  shareBtn: {
    backgroundColor: '#25D366',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  closeBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
});
