import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

export default function FirstLoginModal({
  visible,
  user,
  onDismissKeepPassword,
  onSaveNewPassword,
}) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeepPassword = async () => {
    setLoading(true);
    try {
      await onDismissKeepPassword();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    setErrorMsg('');
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setErrorMsg('يجب أن تتكون كلمة المرور الجديدة من 4 خانات على الأقل.');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      await onSaveNewPassword(newPassword.trim());
      Alert.alert('تم بنجاح', 'تم تحديث وتأمين كلمة المرور بنجاح.');
    } catch (e) {
      setErrorMsg('حدث خطأ أثناء حفظ كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* أيقونة القفل الفاخرة */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔐</Text>
          </View>

          <Text style={styles.title}>مرحباً بك في « زاد الأنصاري »</Text>
          <Text style={styles.userName}>{user?.name || user?.username || 'أيها القارئ المبارك'}</Text>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              تم تعيين كلمة المرور الافتراضية لحسابك{' '}
              <Text style={styles.boldCode}>123456</Text>. لتأمين حسابك، نوصي بتعيين كلمة مرور شخصية خاصة بك، أو يمكنك المتابعة بكلمة المرور الحالية.
            </Text>
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {!isChangingPassword ? (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.btn, styles.changeBtn]}
                onPress={() => setIsChangingPassword(true)}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.changeBtnText}>🔒 تغيير كلمة المرور وتأمين الحساب</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.keepBtn]}
                onPress={handleKeepPassword}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#065F46" />
                ) : (
                  <Text style={styles.keepBtnText}>⏭️ الإبقاء على الحالية والمتابعة</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>كلمة المرور الجديدة:</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="أدخل كلمة المرور الجديدة"
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
                textAlign="right"
              />

              <Text style={styles.inputLabel}>تأكيد كلمة المرور الجديدة:</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="أعد إدخال كلمة المرور"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                textAlign="right"
              />

              <TouchableOpacity
                style={[styles.btn, styles.changeBtn]}
                onPress={handleSavePassword}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.changeBtnText}>💾 حفظ وتأمين الحساب</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={() => {
                  setIsChangingPassword(false);
                  setErrorMsg('');
                }}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>تراجع</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4AF37', // ذهبي إسلامي
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#064E3B',
    marginBottom: 4,
    textAlign: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D97706',
    marginBottom: 14,
  },
  noticeBox: {
    backgroundColor: '#F8FAF8',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    width: '100%',
  },
  noticeText: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 20,
  },
  boldCode: {
    fontWeight: '900',
    color: '#059669',
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#E11D48',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
  },
  inputSection: {
    width: '100%',
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'right',
    marginBottom: -4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  btn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtn: {
    backgroundColor: '#065F46',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  changeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  keepBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  keepBtnText: {
    color: '#334155',
    fontWeight: 'bold',
    fontSize: 13,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12.5,
  },
});
