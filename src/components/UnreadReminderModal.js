import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { sendUnreadReminderNotification } from '../services/storageService';

const MESSAGE_TEMPLATES = [
  {
    id: 'evening',
    label: '📖 تذكير المساء',
    text: 'تقبل الله طاعاتكم، نذكركم بفضل إتمام وردكم القرآني لليوم والمشاركة في إنجاز الختمة المباركة ✨',
  },
  {
    id: 'closing',
    label: '⏰ قرب ختام اليوم',
    text: 'تذكير ختام اليوم: تبقت ساعات قليلة على نهاية اليوم، سارع بإتمام وردك ليكون شاهداً لك 🌿',
  },
  {
    id: 'encouraging',
    label: '🌟 همّة ونشاط',
    text: 'همة يا أهل القرآن! بقيت أجزاء يسيرة لنكمل إنجاز حلقة الورد لليوم، تقبل الله منا ومنكم 🤲',
  },
];

export default function UnreadReminderModal({
  visible,
  onClose,
  readers = [],
  dailyStatuses = {},
  reminderTimeStr = '08:00 م',
  onOpenTimeSettings,
}) {
  // تصفية القراء الذين لم يقرأوا بعد (الحالة pending أو لم تسجل)
  const unreadReaders = readers.filter(
    (r) => (dailyStatuses[r.id]?.status || 'pending') === 'pending'
  );

  const [selectedIds, setSelectedIds] = useState([]);
  const [notificationMsg, setNotificationMsg] = useState(MESSAGE_TEMPLATES[0].text);
  const [isSending, setIsSending] = useState(false);

  // عند فتح النافذة، نحدد تلقائياً جميع القراء المتأخرين
  useEffect(() => {
    if (visible) {
      setSelectedIds(unreadReaders.map((r) => String(r.id)));
      setNotificationMsg(MESSAGE_TEMPLATES[0].text);
    }
  }, [visible, readers, dailyStatuses]);

  const toggleSelectReader = (id) => {
    const strId = String(id);
    setSelectedIds((prev) =>
      prev.includes(strId) ? prev.filter((item) => item !== strId) : [...prev, strId]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(unreadReaders.map((r) => String(r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleSendReminder = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('تنبيه', 'يرجى تحديد قارئ واحد على الأقل لإرسال الإشعار إليه.');
      return;
    }

    if (!notificationMsg.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة نص الإشعار.');
      return;
    }

    setIsSending(true);
    const res = await sendUnreadReminderNotification(
      selectedIds,
      '📖 تذكير بوردك القرآني لليوم',
      notificationMsg.trim()
    );
    setIsSending(false);

    if (res.success) {
      Alert.alert(
        'تم إرسال التنبيه بنجاح 📢',
        `تم إرسال التذكير إلى (${selectedIds.length}) من القراء المتأخرين، وظهر لهم في واجهة التطبيق.`
      );
      onClose();
    } else {
      Alert.alert('خطأ', res.error || 'تعذر إرسال التذكير.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.backdropArea} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContent}>
          {/* رأس النافذة */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕ إغلاق</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>⏰ تذكير المتأخرين عن القراءة</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                متابعة وتحديد القراء الذين لم يسجلوا قراءة ورد اليوم وإرسال إشعار فوري لهم
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollAreaContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* شريط معلومات وقت التذكير المضبوط من الإعدادات */}
            <View style={styles.timeInfoBanner}>
              <View style={styles.timeInfoLeft}>
                {onOpenTimeSettings && (
                  <TouchableOpacity
                    style={styles.adjustTimeBtn}
                    onPress={() => {
                      onClose();
                      onOpenTimeSettings();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.adjustTimeBtnText}>⚙️ ضبط الوقت</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.timeInfoRight}>
                <Text style={styles.timeInfoTitle}>
                  🔔 موعد التنبيه المضبوط: <Text style={styles.timeInfoHighlight}>{reminderTimeStr}</Text>
                </Text>
                <Text style={styles.timeInfoDesc}>
                  يظهر هذا التذكير تلقائياً في حساب المدير بهذا الوقت يومياً
                </Text>
              </View>
            </View>

            {/* حالة الإنجاز: هل الجميع قرأ أم يوجد متأخرين؟ */}
            {unreadReaders.length === 0 ? (
              <View style={styles.allDoneCard}>
                <Text style={styles.allDoneIcon}>🎉</Text>
                <Text style={styles.allDoneTitle}>ما شاء الله، اكتملت القراءات!</Text>
                <Text style={styles.allDoneSubtitle}>
                  جميع أعضاء المجموعة أتموا ورد اليوم بنجاح، لا يوجد أي قارئ متأخر حالياً.
                </Text>
              </View>
            ) : (
              <>
                {/* بطاقة التحكم في التحديد */}
                <View style={styles.sectionCard}>
                  <View style={styles.selectionHeaderRow}>
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>
                        تم تحديد ({selectedIds.length}) من ({unreadReaders.length})
                      </Text>
                    </View>
                    <View style={styles.selectButtonsGroup}>
                      <TouchableOpacity
                        style={styles.quickSelectBtn}
                        onPress={handleSelectAll}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickSelectBtnText}>☑️ تحديد الكل</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickSelectBtn, styles.quickDeselectBtn]}
                        onPress={handleDeselectAll}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickDeselectBtnText}>⏹️ إلغاء التحديد</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.membersListInstruction}>
                    اضغط على أي قارئ لتحديده أو استثنائه من التنبيه:
                  </Text>

                  {/* قائمة القراء الذين لم يقرأوا بعد */}
                  <View style={styles.readersListContainer}>
                    {unreadReaders.map((reader, index) => {
                      const isSelected = selectedIds.includes(String(reader.id));
                      return (
                        <TouchableOpacity
                          key={reader.id || index}
                          style={[styles.readerRow, isSelected && styles.readerRowSelected]}
                          onPress={() => toggleSelectReader(reader.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.readerRowLeft}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                              {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                            </View>
                            <View style={styles.statusPillPending}>
                              <Text style={styles.statusPillPendingText}>⏳ لم يقرأ</Text>
                            </View>
                          </View>

                          <View style={styles.readerRowRight}>
                            <Text style={styles.readerName}>
                              {index + 1}. {reader.name}
                            </Text>
                            <Text style={styles.readerMeta}>
                              @{reader.username || reader.name} • الورد: الجزء {reader.currentJuz || 1}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* بطاقة تخصيص نص الإشعار */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>✉️ نص التنبيه والإشعار:</Text>
                  <Text style={styles.sectionDesc}>
                    يصل هذا التنبيه كهاتف وإشعار داخل التطبيق للأعضاء المحددين أعلاه.
                  </Text>

                  {/* قوالب سريعة */}
                  <View style={styles.templatesRow}>
                    {MESSAGE_TEMPLATES.map((tmpl) => (
                      <TouchableOpacity
                        key={tmpl.id}
                        style={[
                          styles.templatePill,
                          notificationMsg === tmpl.text && styles.templatePillActive,
                        ]}
                        onPress={() => setNotificationMsg(tmpl.text)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.templatePillText,
                            notificationMsg === tmpl.text && styles.templatePillTextActive,
                          ]}
                        >
                          {tmpl.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.messageTextInput}
                    value={notificationMsg}
                    onChangeText={setNotificationMsg}
                    multiline
                    numberOfLines={3}
                    placeholder="اكتب نص التذكير هنا..."
                    placeholderTextColor="#94A3B8"
                    textAlign="right"
                  />

                  {/* زر الإرسال للمحددين */}
                  <TouchableOpacity
                    style={[
                      styles.sendActionBtn,
                      (selectedIds.length === 0 || isSending) && styles.btnDisabled,
                    ]}
                    onPress={handleSendReminder}
                    disabled={selectedIds.length === 0 || isSending}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.sendActionBtnText}>
                      {isSending
                        ? '⏳ جاري إرسال الإشعار...'
                        : `📢 إرسال التنبيه الآن للمحددين (${selectedIds.length})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#F8FAF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    flex: 1,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#064E3B',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  headerTitleGroup: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 8,
  },
  headerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 2,
    textAlign: 'right',
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
  },
  scrollAreaContent: {
    padding: 16,
    paddingBottom: 32,
  },
  timeInfoBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeInfoRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  timeInfoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
  },
  timeInfoHighlight: {
    color: '#B45309',
    fontWeight: '900',
  },
  timeInfoDesc: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    textAlign: 'right',
  },
  timeInfoLeft: {
    marginLeft: 8,
  },
  adjustTimeBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  adjustTimeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  allDoneCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 10,
  },
  allDoneIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  allDoneTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 4,
  },
  allDoneSubtitle: {
    fontSize: 12.5,
    color: '#047857',
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  selectionHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065F46',
  },
  selectButtonsGroup: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  quickSelectBtn: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickSelectBtnText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: 'bold',
  },
  quickDeselectBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  quickDeselectBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: 'bold',
  },
  membersListInstruction: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 10,
  },
  readersListContainer: {
    gap: 8,
  },
  readerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  readerRowSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  readerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusPillPending: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillPendingText: {
    color: '#B45309',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  readerRowRight: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 8,
  },
  readerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  readerMeta: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 10,
  },
  templatesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  templatePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  templatePillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  templatePillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  templatePillTextActive: {
    color: '#065F46',
    fontWeight: 'bold',
  },
  messageTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  sendActionBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  sendActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
