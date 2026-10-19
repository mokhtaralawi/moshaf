import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  authenticateUser,
  updateUserPassword,
  updateUserFirstLoginDecision,
  loadReaders,
} from '../services/storageService';
import { getFormattedArabicDate, getFormattedHijriDate } from '../utils/wirdCalculator';
import FirstLoginModal from '../components/FirstLoginModal';
import SyncStatusBadge from '../components/SyncStatusBadge';

export default function LoginScreen({ onLoginSuccess }) {
  // بيانات تسجيل الدخول الموحد
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // قائمة المساعدة لاختيار اسم العضو
  const [isHelperModalVisible, setIsHelperModalVisible] = useState(false);
  const [readers, setReaders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // حالة نافذة أول تسجيل دخول
  const [firstLoginUser, setFirstLoginUser] = useState(null);
  const [isFirstLoginVisible, setIsFirstLoginVisible] = useState(false);

  const todayArabicDate = getFormattedArabicDate(0);
  const todayHijriDate = getFormattedHijriDate(0);

  useEffect(() => {
    fetchReaders();
  }, []);

  const fetchReaders = async () => {
    try {
      const list = await loadReaders();
      setReaders(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async () => {
    setErrorMsg('');
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const result = await authenticateUser(identifier.trim(), password.trim());
      setLoading(false);

      if (!result.success) {
        setErrorMsg(result.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        return;
      }

      const loggedUser = result.user;

      // فحص إذا كان أول تسجيل دخول للمستخدم
      if (loggedUser.role === 'user' && loggedUser.isFirstLogin) {
        setFirstLoginUser(loggedUser);
        setIsFirstLoginVisible(true);
      } else {
        onLoginSuccess(loggedUser);
      }
    } catch (e) {
      setLoading(false);
      setErrorMsg('حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    }
  };

  // قرار أول دخول: الإبقاء على كلمة المرور الحالية 123456
  const handleKeepPasswordDecision = async () => {
    if (firstLoginUser) {
      await updateUserFirstLoginDecision(firstLoginUser.id);
      setIsFirstLoginVisible(false);
      onLoginSuccess({
        ...firstLoginUser,
        isFirstLogin: false,
      });
    }
  };

  // قرار أول دخول: حفظ كلمة مرور جديدة
  const handleSaveNewPasswordDecision = async (newPassword) => {
    if (firstLoginUser) {
      await updateUserPassword(firstLoginUser.id, newPassword);
      setIsFirstLoginVisible(false);
      onLoginSuccess({
        ...firstLoginUser,
        isFirstLogin: false,
      });
    }
  };

  const filteredReaders = readers.filter((r) =>
    (r.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    (r.username || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* الرأس الفاخر للواجهة */}
      <View style={styles.header}>
        <View style={styles.headerTopLine}>
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          <SyncStatusBadge compact />
        </View>

        <View style={styles.headerLogoRow}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogoImg}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTitles}>
            <Text style={styles.mainTitle}>زاد الأنصاري</Text>
            <Text style={styles.subTitle}>« مشورة إب »</Text>
          </View>
        </View>

        {/* شريط التاريخين */}
        <View style={styles.dateBar}>
          <Text style={styles.dateText}>
            📅 {todayArabicDate} م {todayHijriDate ? `• ${todayHijriDate}` : ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* بطاقة تسجيل الدخول الموحدة */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircleHeader}>
                <Text style={styles.iconHeaderEmoji}>🔐</Text>
              </View>
              <Text style={styles.cardTitle}>تسجيل الدخول الموحد</Text>
              <Text style={styles.cardDesc}>
                أهلاً بكم في نظام إدارة الورد والتكاليف اليومية. سجّل دخولك لمرة واحدة وسيحفظ النظام جلستك دائماً.
              </Text>
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            {/* حقل اسم المستخدم أو المعرف */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>اسم المستخدم أو الاسم:</Text>
                <TouchableOpacity
                  onPress={() => setIsHelperModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.helperLinkText}>📋 اختيار من القائمة</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="أدخل اسمك أو اسم المستخدم..."
                placeholderTextColor="#94A3B8"
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t);
                  setErrorMsg('');
                }}
                autoCapitalize="none"
                textAlign="right"
              />
            </View>

            {/* حقل كلمة المرور */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>كلمة المرور:</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="أدخل كلمة المرور..."
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setErrorMsg('');
                  }}
                  textAlign="right"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeBtnText}>{showPassword ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* زر تسجيل الدخول الزمردي الفاخر */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>دخول إلى النظام 🌟</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* نافذة المساعدة لاختيار اسم القارئ */}
      <Modal visible={isHelperModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.helperCard}>
            <View style={styles.helperHeader}>
              <Text style={styles.helperTitle}>اختر اسمك من قائمة الأعضاء</Text>
              <TouchableOpacity
                onPress={() => setIsHelperModalVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="🔍 ابحث عن اسمك..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />

            <ScrollView style={styles.readersListScroll}>
              {filteredReaders.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.readerOption}
                  onPress={() => {
                    setIdentifier(r.username || r.name);
                    setIsHelperModalVisible(false);
                    setErrorMsg('');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.readerOptionLeft}>
                    <Text style={styles.selectMemberBadge}>اختيار 👈</Text>
                  </View>
                  <View style={styles.readerOptionRight}>
                    <Text style={styles.readerOptionName}>{r.name}</Text>
                    <Text style={styles.readerOptionUser}>@{r.username || r.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {filteredReaders.length === 0 && (
                <View style={styles.emptyHelpBox}>
                  <Text style={styles.emptyHelpText}>لا يوجد أعضاء مطابقين للبحث</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* نافذة خيار تغيير كلمة المرور عند أول تسجيل دخول */}
      <FirstLoginModal
        visible={isFirstLoginVisible}
        user={firstLoginUser}
        onDismissKeepPassword={handleKeepPasswordDecision}
        onSaveNewPassword={handleSaveNewPasswordDecision}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B', // زمردي ملكي
  },
  header: {
    backgroundColor: '#064E3B',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 3,
    borderBottomColor: '#F59E0B',
  },
  headerTopLine: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bismillah: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerLogoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerLogoImg: {
    width: 42,
    height: 42,
  },
  headerTitles: {
    alignItems: 'flex-end',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6EE7B7',
    marginTop: -2,
  },
  dateBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '600',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAF8',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircleHeader: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconHeaderEmoji: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#064E3B',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  errorBox: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#E11D48',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'right',
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },
  helperLinkText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#059669',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingLeft: 45,
  },
  eyeBtn: {
    position: 'absolute',
    left: 10,
    padding: 6,
  },
  eyeBtnText: {
    fontSize: 18,
  },
  loginBtn: {
    backgroundColor: '#065F46',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  helperCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  helperHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  helperTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 12,
  },
  readersListScroll: {
    maxHeight: 320,
  },
  readerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  readerOptionRight: {
    alignItems: 'flex-end',
  },
  readerOptionName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  readerOptionUser: {
    fontSize: 11,
    color: '#64748B',
  },
  readerOptionLeft: {
    alignItems: 'flex-start',
  },
  selectMemberBadge: {
    fontSize: 11,
    color: '#065F46',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    fontWeight: '600',
  },
  emptyHelpBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHelpText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
