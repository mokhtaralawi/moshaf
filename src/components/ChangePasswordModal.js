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
} from 'react-native';
import { loadAdminCredentials, saveAdminCredentials } from '../services/storageService';

export default function ChangePasswordModal({ visible, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  const handleSave = async () => {
    setErrorMsg('');

    if (!currentPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور الحالية.');
      return;
    }

    if (!newPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }

    if (newPassword.trim().length < 4) {
      setErrorMsg('كلمة المرور الجديدة يجب أن تكون 4 خانات على الأقل.');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMsg('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    setLoading(true);
    try {
      const creds = await loadAdminCredentials();
      if (creds.password !== currentPassword.trim()) {
        setErrorMsg('كلمة المرور الحالية غير صحيحة!');
        setLoading(false);
        return;
      }

      await saveAdminCredentials(creds.username || 'admin', newPassword.trim());
      setLoading(false);
      Alert.alert('تم التغيير بنجاح', 'تم تحديث كلمة مرور المدير بنجاح.');
      handleClose();
    } catch (error) {
      setLoading(false);
      setErrorMsg('حدث خطأ أثناء حفظ كلمة المرور.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* رأس النافذة */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.headerIcon}>🔐</Text>
            </View>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.modalTitle}>تغيير كلمة مرور المدير</Text>
              <Text style={styles.modalSubtitle}>حماية صلاحيات إدارة وتوزيع الورد</Text>
            </View>
          </View>

          {/* رسالة الخطأ إن وجدت */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          {/* حقول الإدخال */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>كلمة المرور الحالية:</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل كلمة المرور الحالية"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={currentPassword}
              onChangeText={(t) => {
                setCurrentPassword(t);
                setErrorMsg('');
              }}
              textAlign="right"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>كلمة المرور الجديدة:</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل كلمة المرور الجديدة (4 خانات فأكثر)"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                setErrorMsg('');
              }}
              textAlign="right"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>تأكيد كلمة المرور الجديدة:</Text>
            <TextInput
              style={styles.input}
              placeholder="أعد إدخال كلمة المرور الجديدة"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setErrorMsg('');
              }}
              textAlign="right"
            />
          </View>

          {/* أزرار الحفظ والإلغاء */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn, loading && styles.btnDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{loading ? 'جاري الحفظ...' : '💾 حفظ التغيير'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#064E3B',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: '#059669',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
});
