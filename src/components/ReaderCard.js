import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getReaderWirdDetails } from '../utils/wirdCalculator';
import { useAppTheme } from '../context/ThemeContext';

export default function ReaderCard({
  reader,
  juzCount = 1,
  onEdit,
  onDelete,
  index = 0,
  status = 'pending',
  onToggleStatus,
}) {
  const { isDark, colors } = useAppTheme();
  // حساب تفاصيل الورد والصفحات والسور
  const wird = getReaderWirdDetails(reader.currentJuz, juzCount);

  // نسبة التقدم في ختم المصحف (من 30 جزء)
  const progressPercent = Math.min(100, Math.round((reader.currentJuz / 30) * 100));

  return (
    <View style={[styles.cardContainer, isDark && { backgroundColor: colors.bgCard, borderColor: colors.cardBorder }]}>
      {/* الرأس: شارة الترتيب + اسم القارئ + شارة الحالة والجزء */}
      <View style={styles.cardHeader}>
        <View style={styles.readerInfoRow}>
          {/* رقم الترتيب الدائري */}
          <View style={styles.indexCircle}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>

          <View style={styles.nameBlock}>
            <Text style={[styles.readerName, isDark && { color: colors.textPrimary }]}>{reader.name}</Text>
            {wird.surahs ? (
              <Text style={[styles.surahSubtitle, isDark && { color: colors.textSecondary }]} numberOfLines={1}>
                📖 {wird.surahs}
              </Text>
            ) : null}
          </View>
        </View>

        {/* شارة الحالة التفاعلية وشارة الجزء */}
        <View style={styles.headerBadgesRow}>
          <TouchableOpacity
            style={[
              styles.statusPill,
              status === 'read' && styles.statusPillRead,
              status === 'excused' && styles.statusPillExcused,
              status === 'pending' && styles.statusPillPending,
            ]}
            onPress={() => onToggleStatus && onToggleStatus(reader.id)}
            activeOpacity={0.7}
            disabled={!onToggleStatus}
          >
            <Text
              style={[
                styles.statusPillText,
                status === 'read' && styles.statusTextRead,
                status === 'excused' && styles.statusTextExcused,
                status === 'pending' && styles.statusTextPending,
              ]}
            >
              {status === 'read' ? '✅ قرأ' : status === 'excused' ? '✋ معتذر' : '⏳ قيد القراءة'}
            </Text>
          </TouchableOpacity>

          <View style={styles.juzBadge}>
            <Text style={styles.juzBadgeText}>{wird.juzText}</Text>
          </View>
        </View>
      </View>

      {/* خط فاصل ناعم */}
      <View style={styles.cardDivider} />

      {/* تفاصيل الصفحات ومقدار الورد */}
      <View style={styles.detailsRow}>
        <View style={styles.pagesBox}>
          <Text style={[styles.pagesLabel, isDark && { color: colors.textSecondary }]}>نطاق الصفحات:</Text>
          <Text style={[styles.pagesRange, isDark && { color: colors.textSecondary }]}>
            صـ <Text style={styles.pageHighlight}>{wird.startPage}</Text> إلى{' '}
            <Text style={styles.pageHighlight}>{wird.endPage}</Text>
          </Text>
        </View>

        <View style={styles.pagesCountBadge}>
          <Text style={styles.pagesCountText}>{wird.pagesCount} صفحة</Text>
        </View>
      </View>

      {/* شريط التقدم في المصحف (30 جزء) */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, isDark && { color: colors.textSecondary }]}>مسار الختمة:</Text>
          <Text style={[styles.progressPercentText, isDark && { color: colors.gold }]}>{reader.currentJuz} من 30 جزء ({progressPercent}%)</Text>
        </View>
        <View style={[styles.progressBarTrack, isDark && { backgroundColor: colors.bgSubtle }]}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* أزرار الإجراءات (تعديل وحذف) */}
      <View style={styles.actionsFooter}>
        <TouchableOpacity
          onPress={() => onEdit(reader)}
          style={[styles.actionBtn, styles.editBtn]}
          activeOpacity={0.7}
        >
          <Text style={styles.editBtnText}>✏️ تعديل الورد</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onDelete(reader.id)}
          style={[styles.actionBtn, styles.deleteBtn]}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteBtnText}>🗑️ حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRightWidth: 4,
    borderRightColor: '#059669', // الشريط الزمردي الأيمن
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readerInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  indexCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  nameBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  readerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  surahSubtitle: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
    fontWeight: '600',
  },
  headerBadgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillRead: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusPillExcused: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FECDD3',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusTextRead: {
    color: '#15803D',
  },
  statusTextExcused: {
    color: '#BE123C',
  },
  statusTextPending: {
    color: '#B45309',
  },
  juzBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#047857',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  juzBadgeText: {
    fontSize: 12,
    color: '#FDE68A', // لمسة ذهبية
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  detailsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pagesBox: {
    alignItems: 'flex-end',
  },
  pagesLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  pagesRange: {
    fontSize: 13.5,
    color: '#1E293B',
    fontWeight: '600',
  },
  pageHighlight: {
    fontWeight: '800',
    color: '#059669',
  },
  pagesCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pagesCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  progressContainer: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  progressHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  progressPercentText: {
    fontSize: 10.5,
    color: '#065F46',
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 6,
  },
  actionsFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
});