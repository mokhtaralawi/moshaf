import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { formatArabicTime } from '../utils/wirdCalculator';

export default function ReminderModal({
  visible,
  onClose,
  initialHour = 20,
  initialMinute = 0,
  isEnabled = false,
  onSaveReminder,
}) {
  // تحويل وقت 24 ساعة إلى نظام 12 ساعة مع ص / م
  const [hour12, setHour12] = useState(8);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState('PM'); // 'AM' | 'PM'
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (visible) {
      const h24 = Number(initialHour) || 20;
      const m = Number(initialMinute) || 0;
      const isPM = h24 >= 12;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

      setHour12(h12);
      setMinute(m);
      setPeriod(isPM ? 'PM' : 'AM');
      setEnabled(isEnabled);
    }
  }, [visible, initialHour, initialMinute, isEnabled]);

  // تحويل نظام 12 ساعة الحالي إلى نظام 24 ساعة
  const getHour24 = () => {
    if (period === 'AM') {
      return hour12 === 12 ? 0 : hour12;
    } else {
      return hour12 === 12 ? 12 : hour12 + 12;
    }
  };

  // تعديل الساعة
  const adjustHour = (delta) => {
    let next = hour12 + delta;
    if (next < 1) next = 12;
    if (next > 12) next = 1;
    setHour12(next);
  };

  // تعديل الدقائق (+5 / -5)
  const adjustMinute = (delta) => {
    let next = minute + delta;
    if (next < 0) next = 55;
    if (next >= 60) next = 0;
    setMinute(next);
  };

  // اختيار من الأوقات الشائعة المقترحة
  const applyPreset = (h24, m) => {
    const isPM = h24 >= 12;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    setHour12(h12);
    setMinute(m);
    setPeriod(isPM ? 'PM' : 'AM');
    setEnabled(true);
  };

  const handleSave = () => {
    const h24 = getHour24();
    onSaveReminder({
      enabled,
      hour: h24,
      minute,
    });
    onClose();
  };

  const currentHour24 = getHour24();
  const previewTimeStr = formatArabicTime(currentHour24, minute);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* شريط العنوان التزييني */}
          <View style={styles.headerBar}>
            <View style={styles.headerIconBox}>
              <Text style={styles.headerIconText}>⏰</Text>
            </View>
            <Text style={styles.modalTitle}>تحديد موعد التنبيه اليومي</Text>
            <Text style={styles.modalSubtitle}>
              حدد الساعة المناسبة لتذكيرك بقراءة وتوزيع الورد القرآني
            </Text>
          </View>

          {/* مفتاح تفعيل/تعطيل التنبيه الرئيسي */}
          <TouchableOpacity
            style={[styles.toggleContainer, enabled ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => setEnabled(!enabled)}
            activeOpacity={0.8}
          >
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleTitle, enabled && styles.toggleTitleActive]}>
                {enabled ? '🔔 التنبيه اليومي (مفعّل)' : '🔕 التنبيه اليومي (موقوف)'}
              </Text>
              <View style={[styles.switchTrack, enabled && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, enabled && styles.switchThumbActive]} />
              </View>
            </View>
            <Text style={styles.toggleDesc}>
              {enabled
                ? `سيتم إرسال إشعار يومياً في تمام الساعة ${previewTimeStr}`
                : 'اضغط هنا لتفعيل الإشعار اليومي في الوقت المختار'}
            </Text>
          </TouchableOpacity>

          {/* محدد الوقت الرقمي الفاخر (Digital Clock Stepper) */}
          <View style={styles.clockCard}>
            <Text style={styles.clockCardLabel}>الوقت المختار:</Text>

            <View style={styles.clockRow}>
              {/* اختيار ص / م */}
              <View style={styles.periodCol}>
                <TouchableOpacity
                  style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
                  onPress={() => setPeriod('AM')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodBtnText, period === 'AM' && styles.periodBtnTextActive]}>
                    صباحاً (ص)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
                  onPress={() => setPeriod('PM')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodBtnText, period === 'PM' && styles.periodBtnTextActive]}>
                    مساءً (م)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* جزء الدقائق */}
              <View style={styles.digitCol}>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => adjustMinute(5)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperArrowText}>▲</Text>
                </TouchableOpacity>

                <View style={styles.digitBox}>
                  <Text style={styles.digitText}>{String(minute).padStart(2, '0')}</Text>
                  <Text style={styles.digitLabel}>دقيقة</Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => adjustMinute(-5)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperArrowText}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.clockSeparator}>:</Text>

              {/* جزء الساعات */}
              <View style={styles.digitCol}>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => adjustHour(1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperArrowText}>▲</Text>
                </TouchableOpacity>

                <View style={styles.digitBox}>
                  <Text style={styles.digitText}>{String(hour12).padStart(2, '0')}</Text>
                  <Text style={styles.digitLabel}>ساعة</Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => adjustHour(-1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperArrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* خيارات سريعة شائعة (Presets) */}
          <View style={styles.presetsSection}>
            <Text style={styles.presetsLabel}>أوقات مقترحة سريعة:</Text>
            <View style={styles.presetsGrid}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset(5, 30)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>🌅 الفجر (5:30 ص)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset(16, 0)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>🌤️ العصر (4:00 م)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset(18, 30)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>🌇 المغرب (6:30 م)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset(20, 0)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>🌙 العشاء (8:00 م)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset(22, 0)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>✨ قبل النوم (10:00 م)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* أزرار الحفظ والإلغاء */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>حفظ الإعدادات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
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
    padding: 18,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#059669',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBar: {
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerIconText: {
    fontSize: 22,
  },
  modalTitle: {
    fontSize: 17.5,
    fontWeight: '900',
    color: '#064E3B',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
  },
  toggleContainer: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
  },
  toggleActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  toggleInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  toggleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  toggleTitleActive: {
    color: '#065F46',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#059669',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  clockCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    alignItems: 'center',
  },
  clockCardLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  clockRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  digitCol: {
    alignItems: 'center',
  },
  stepperArrow: {
    width: 38,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperArrowText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46',
  },
  digitBox: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 62,
    alignItems: 'center',
    marginVertical: 4,
    borderWidth: 1.5,
    borderColor: '#059669',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  digitText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FDE68A', // لمسة الذهب
    fontFamily: 'monospace',
  },
  digitLabel: {
    fontSize: 9.5,
    color: '#D1FAE5',
    fontWeight: '600',
    marginTop: 1,
  },
  clockSeparator: {
    fontSize: 26,
    fontWeight: '900',
    color: '#064E3B',
    marginHorizontal: 2,
    marginBottom: 6,
  },
  periodCol: {
    gap: 6,
    marginLeft: 6,
  },
  periodBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  periodBtnActive: {
    backgroundColor: '#059669',
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  presetsSection: {
    marginBottom: 16,
  },
  presetsLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 6,
  },
  presetsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  presetChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: '#059669',
    borderWidth: 1,
    borderColor: '#047857',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
});
