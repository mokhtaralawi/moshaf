import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { getReaderWirdDetails } from '../utils/wirdCalculator';

export default function AddReaderModal({ visible, onClose, onSave, editingReader }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentJuz, setCurrentJuz] = useState('1');

  // تعبئة الحقول إذا كان المودال في وضع التعديل (Edit Mode)
  useEffect(() => {
    if (editingReader) {
      setName(editingReader.name || '');
      setUsername(editingReader.username || '');
      setPassword(editingReader.password || '');
      setCurrentJuz(String(editingReader.currentJuz || 1));
    } else {
      setName('');
      setUsername('');
      setPassword('123456');
      setCurrentJuz('1');
    }
  }, [editingReader, visible]);

  // معاينة تفاصيل الجزء المكتوب
  const parsedJuz = parseInt(currentJuz, 10);
  const isValidJuz = !isNaN(parsedJuz) && parsedJuz >= 1 && parsedJuz <= 30;
  const previewWird = isValidJuz ? getReaderWirdDetails(parsedJuz, 1) : null;

  // تغيير الجزء بالأزرار السريعة (- / +)
  const adjustJuz = (delta) => {
    const current = parseInt(currentJuz, 10) || 1;
    let next = current + delta;
    if (next < 1) next = 30;
    if (next > 30) next = 1;
    setCurrentJuz(String(next));
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم القارئ.');
      return;
    }

    if (!isValidJuz) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم جزء صحيح بين 1 و 30.');
      return;
    }

    onSave({
      ...(editingReader || {}),
      id: editingReader ? editingReader.id : Date.now().toString(),
      name: name.trim(),
      username: username.trim() || editingReader?.username || name.trim().replace(/\s+/g, '_'),
      password: password.trim() || editingReader?.password || '123456',
      currentJuz: parsedJuz,
      isFirstLogin: editingReader ? editingReader.isFirstLogin : true,
    });

    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* شريط العنوان التزييني */}
          <View style={styles.headerBar}>
            <View style={styles.headerIconBox}>
              <Text style={styles.headerIconText}>{editingReader ? '✏️' : '📖'}</Text>
            </View>
            <Text style={styles.modalTitle}>
              {editingReader ? 'تعديل بيانات القارئ' : 'إضافة قارئ جديد للقائمة'}
            </Text>
            <Text style={styles.modalSubtitle}>
              حدد اسم القارئ ورقم الجزء الذي سيبدأ منه القراءة
            </Text>
          </View>

          {/* حقل اسم القارئ */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>اسم القارئ / الشخص:</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="مثال: عبد الله، مصطفى..."
              placeholderTextColor="#94A3B8"
              textAlign="right"
            />
          </View>

          {/* حقل اسم المستخدم لتسجيل الدخول */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>معرف الدخول (اسم المستخدم):</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="مثال: user_1 أو mohammed"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          {/* حقل كلمة المرور */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>كلمة المرور:</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="مثال: 123456"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              textAlign="right"
            />
          </View>

          {/* حقل رقم الجزء مع أزرار التحكم السريع */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>الجزء الحالي (1 إلى 30):</Text>
            <View style={styles.juzControlRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustJuz(1)}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>+1</Text>
              </TouchableOpacity>

              <TextInput
                style={[styles.input, styles.juzInput]}
                value={currentJuz}
                onChangeText={setCurrentJuz}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1"
                placeholderTextColor="#94A3B8"
                textAlign="center"
              />

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustJuz(-1)}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>-1</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* بطاقة معاينة تفاصيل الجزء */}
          {previewWird ? (
            <View style={styles.previewBox}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>✨ معاينة بداية الورد:</Text>
                <Text style={styles.previewJuzBadge}>{previewWird.juzText}</Text>
              </View>
              <Text style={styles.previewSurah}>
                {previewWird.surahs ? `السور: ${previewWird.surahs}` : ''}
              </Text>
              <Text style={styles.previewPages}>
                الصفحات: صـ {previewWird.startPage} إلى صـ {previewWird.endPage} ({previewWird.pagesCount} صفحة)
              </Text>
            </View>
          ) : null}

          {/* أزرار الحفظ والإلغاء */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>
                {editingReader ? 'تحديث البيانات' : 'إضافة القارئ'}
              </Text>
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
    backgroundColor: 'rgba(6, 78, 59, 0.6)', // خلفية زمردية شبه شفافة
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#059669',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBar: {
    alignItems: 'center',
    marginBottom: 18,
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
    fontSize: 20,
  },
  modalTitle: {
    fontSize: 18,
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
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  juzControlRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
  },
  juzInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065F46',
  },
  stepperBtn: {
    width: 48,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#065F46',
  },
  previewBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  previewJuzBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewSurah: {
    fontSize: 11,
    color: '#059669',
    textAlign: 'right',
    fontWeight: '600',
  },
  previewPages: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'right',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 6,
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