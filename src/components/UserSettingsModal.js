import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { updateUserProfile } from '../services/storageService';

export default function UserSettingsModal({ visible, onClose, currentUser, onProfileUpdated }) {
  const [name, setName] = useState(currentUser?.name || currentUser?.readerName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // تحديث القيم عند فتح النافذة
  React.useEffect(() => {
    if (visible && currentUser) {
      setName(currentUser.name || currentUser.readerName || '');
      setUsername(currentUser.username || '');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [visible, currentUser]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسمك.');
      return;
    }

    if (newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        Alert.alert('تنبيه', 'يجب أن تتكون كلمة المرور من 4 خانات على الأقل.');
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        Alert.alert('تنبيه', 'كلمة المرور الجديدة وتأكيدها غير متطابقين.');
        return;
      }
    }

    setLoading(true);
    try {
      const userId = currentUser.id || currentUser.readerId;
      const res = await updateUserProfile(userId, {
        name: name.trim(),
        username: username.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
      });

      setLoading(false);
      if (res.success) {
        Alert.alert('تم الحفظ بنجاح ✅', 'تم تحديث بياناتك الشخصية بنجاح.');
        if (onProfileUpdated) {
          onProfileUpdated(res.user);
        }
        onClose();
      } else {
        Alert.alert('خطأ', res.error || 'تعذر تحديث البيانات.');
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('خطأ', 'حدث خطأ غير متوقع أثناء الحفظ.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        <View style={styles.modalCard}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scrollContent}
          >
          {/* الرأس الفاخر */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.headerIcon}>⚙️</Text>
            </View>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.modalTitle}>إعدادات حسابي</Text>
              <Text style={styles.modalSubtitle}>تعديل اسمك، اسم المستخدم، وتغيير كلمة المرور</Text>
            </View>
          </View>

          {/* حقول الإدخال */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>الاسم الشخصي / اللقب:</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="مثال: عبد الله بن مسعود"
              placeholderTextColor="#94A3B8"
              textAlign="right"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>معرف الدخول (اسم المستخدم):</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="اسم المستخدم لتسجيل الدخول"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>🔒 تغيير كلمة المرور (اتركه فارغاً إن لم ترغب بالتغيير):</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>كلمة المرور الجديدة:</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="أدخل كلمة مرور جديدة"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              textAlign="right"
            />
          </View>

          {newPassword.trim() ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>تأكيد كلمة المرور الجديدة:</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="أعد إدخال كلمة المرور"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                textAlign="right"
              />
            </View>
          ) : null}

          {/* الأزرار */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.disabledBtn]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>
                {loading ? '⏳ جاري الحفظ...' : 'حفظ التعديلات ✅'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 10,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 16,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: 'bold',
    fontSize: 13,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
