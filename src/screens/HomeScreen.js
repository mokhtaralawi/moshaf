import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadReaders,
  saveReaders,
  loadSettings,
  saveSettings,
  loadDailyStatuses,
  updateReaderDailyStatus,
  getDateKey,
  loadCurrentUser,
} from '../services/storageService';
import { advanceReadersToNextDay, getFormattedArabicDate, getFormattedHijriDate, formatArabicTime } from '../utils/wirdCalculator';
import { scheduleDailyWirdReminder, cancelAllReminders } from '../services/notificationService';
import { WIRD_AMOUNT_OPTIONS } from '../constants/quranData';

import ReaderCard from '../components/ReaderCard';
import AddReaderModal from '../components/AddReaderModal';
import ReportModal from '../components/ReportModal';
import ReminderModal from '../components/ReminderModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import AdminSettingsModal from '../components/AdminSettingsModal';
import AdminProfileModal from '../components/AdminProfileModal';
import UnreadReminderModal from '../components/UnreadReminderModal';
import SyncStatusBadge from '../components/SyncStatusBadge';
import { subscribeSyncStatus } from '../services/syncService';
import { useAppTheme, THEME_MODES } from '../context/ThemeContext';

export default function HomeScreen({ currentUser: initialUser, onLogout, onUserUpdated }) {
  const { themeMode, setThemeMode, isDark, colors } = useAppTheme();
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [readers, setReaders] = useState([]);
  const [juzCount, setJuzCount] = useState(1);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);

  // التحكم في النوافذ المنبثقة
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [isChangePasswordVisible, setIsChangePasswordVisible] = useState(false);
  const [isAdminSettingsVisible, setIsAdminSettingsVisible] = useState(false);
  const [isAdminProfileVisible, setIsAdminProfileVisible] = useState(false);
  const [isUnreadReminderVisible, setIsUnreadReminderVisible] = useState(false);
  const [editingReader, setEditingReader] = useState(null);

  // حالات قراءة الورد اليومية
  const [dailyStatuses, setDailyStatuses] = useState({});

  // مرجع لتفادي إغلاق الـ closure في التايمر الدوري
  const stateRef = useRef({
    readers: [],
    dailyStatuses: {},
    settings: { reminderEnabled: false, reminderHour: 20, reminderMinute: 0 },
  });
  stateRef.current = {
    readers,
    dailyStatuses,
    settings: { reminderEnabled, reminderHour, reminderMinute },
  };

  // تاريخ اليوم المنسق باللغة العربية (ميلادي وهجري)
  const todayArabicDate = getFormattedArabicDate(0);
  const todayHijriDate = getFormattedHijriDate(0);

  // فحص وإظهار تذكير المتأخرين تلقائياً عند حلول الوقت المضبوط من الإعدادات
  const checkScheduledReminder = useCallback(async (settingsObj, currentReaders, currentStatuses) => {
    try {
      if (!settingsObj || !settingsObj.reminderEnabled) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const targetHour = settingsObj.reminderHour !== undefined ? Number(settingsObj.reminderHour) : 20;
      const targetMinute = settingsObj.reminderMinute !== undefined ? Number(settingsObj.reminderMinute) : 0;

      const nowMinutes = currentHour * 60 + currentMinute;
      const targetMinutes = targetHour * 60 + targetMinute;

      // إذا وصلنا إلى أو تجاوزنا وقت التذكير لليوم
      if (nowMinutes >= targetMinutes) {
        const todayKey = getDateKey(0);
        const lastPrompted = await AsyncStorage.getItem(`@quran_wird_admin_prompted_${todayKey}`);
        if (!lastPrompted) {
          const unreadList = (currentReaders || []).filter(
            (r) => (currentStatuses[r.id]?.status || 'pending') === 'pending'
          );

          if (unreadList.length > 0) {
            await AsyncStorage.setItem(
              `@quran_wird_admin_prompted_${todayKey}`,
              new Date().toISOString()
            );
            setIsUnreadReminderVisible(true);
          }
        }
      }
    } catch (e) {
      console.warn('Scheduled reminder check error:', e);
    }
  }, []);

  const initApp = useCallback(async () => {
    const storedReaders = await loadReaders();
    const storedSettings = await loadSettings();
    const todayStatuses = await loadDailyStatuses(getDateKey(0));
    const user = await loadCurrentUser();
    if (user) setCurrentUser(user);

    setReaders(storedReaders);
    setDailyStatuses(todayStatuses || {});
    setJuzCount(storedSettings.juzCount || 1);
    setReminderEnabled(storedSettings.reminderEnabled || false);
    setReminderHour(storedSettings.reminderHour !== undefined ? storedSettings.reminderHour : 20);
    setReminderMinute(storedSettings.reminderMinute !== undefined ? storedSettings.reminderMinute : 0);

    // فحص موعد التذكير فور تحميل البيانات
    checkScheduledReminder(storedSettings, storedReaders, todayStatuses || {});
  }, [checkScheduledReminder]);

  // تحميل البيانات ومتابعة التحديثات اللحظية من السحابة وفحص مؤقت التذكير الدوري
  useEffect(() => {
    initApp();
    const unsubscribe = subscribeSyncStatus((status) => {
      if (status.hasRemoteUpdates) {
        initApp();
      }
    });

    // مؤقت فحص موعد التذكير كل 25 ثانية أثناء فتح التطبيق
    const timer = setInterval(() => {
      const { readers: r, dailyStatuses: ds, settings: s } = stateRef.current;
      checkScheduledReminder(s, r, ds);
    }, 25000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [initApp, checkScheduledReminder]);

  // تغيير مقدار الورد اليومي (جزء، جزأين، 3)
  const handleWirdCountChange = async (count) => {
    setJuzCount(count);
    await saveSettings({
      juzCount: count,
      reminderEnabled,
      reminderHour,
      reminderMinute,
    });
  };

  // ترحيل جميع القراء إلى ورد اليوم التالي
  const handleAdvanceDay = () => {
    Alert.alert(
      'ترحيل إلى اليوم التالي',
      `هل تريد ترحيل جميع القراء (${readers.length}) بمقدار ${juzCount} جزء؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، ترحيل الورد',
          onPress: async () => {
            const updated = advanceReadersToNextDay(readers, juzCount);
            setReaders(updated);
            await saveReaders(updated);
            Alert.alert('تم الترحيل بنجاح', 'تم تحديث ورد جميع القراء إلى اليوم التالي.');
          },
        },
      ]
    );
  };

  // حفظ قارئ جديد أو تحديث بيانات قارئ حالي
  const handleSaveReader = async (readerData) => {
    let updatedReaders;
    if (editingReader) {
      updatedReaders = readers.map((r) => (r.id === readerData.id ? readerData : r));
    } else {
      updatedReaders = [...readers, readerData];
    }

    setReaders(updatedReaders);
    await saveReaders(updatedReaders);
    setEditingReader(null);
  };

  // حذف قارئ
  const handleDeleteReader = (id) => {
    const target = readers.find((r) => String(r.id) === String(id));
    const confirmMessage = `هل أنت متأكد من حذف القارئ (${target?.name || ''}) من القائمة؟`;

    const executeDelete = async () => {
      const updated = readers.filter((r) => String(r.id) !== String(id));
      setReaders(updated);
      await saveReaders(updated);
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm(confirmMessage)) {
          executeDelete();
        }
      } else {
        executeDelete();
      }
    } else {
      Alert.alert('تأكيد الحذف', confirmMessage, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: executeDelete,
        },
      ]);
    }
  };

  // حفظ وتطبيق إعدادات التنبيه المحددة من المودال
  const handleSaveReminderSettings = async ({ enabled, hour, minute }) => {
    setReminderEnabled(enabled);
    setReminderHour(hour);
    setReminderMinute(minute);

    if (enabled) {
      const res = await scheduleDailyWirdReminder(hour, minute);
      await saveSettings({
        juzCount,
        reminderEnabled: true,
        reminderHour: hour,
        reminderMinute: minute,
      });

      if (res.success) {
        Alert.alert('تم تفعيل التنبيه بنجاح', res.message);
      } else {
        Alert.alert('تنبيه', res.message);
      }
    } else {
      await cancelAllReminders();
      await saveSettings({
        juzCount,
        reminderEnabled: false,
        reminderHour: hour,
        reminderMinute: minute,
      });
      Alert.alert('تم إيقاف التنبيه', 'تم إيقاف المنبه اليومي بنجاح.');
    }
  };

  // تبديل حالة قراءة القارئ يدويًا من قِبل المدير
  const handleToggleReaderStatus = async (readerId) => {
    const current = dailyStatuses[readerId]?.status || 'pending';
    const next = current === 'pending' ? 'read' : current === 'read' ? 'excused' : 'pending';
    const todayKey = getDateKey(0);
    const updated = await updateReaderDailyStatus(todayKey, readerId, next);
    if (updated) {
      setDailyStatuses({ ...updated });
    }
  };

  // إحصائيات إنجاز ورد اليوم
  const readCount = readers.filter((r) => dailyStatuses[r.id]?.status === 'read').length;
  const excusedCount = readers.filter((r) => dailyStatuses[r.id]?.status === 'excused').length;
  const pendingCount = Math.max(0, readers.length - readCount - excusedCount);

  // حساب إجمالي الأجزاء المقروءة اليوم
  const totalDailyAjza = readers.length * juzCount;

  return (
    <SafeAreaView style={[styles.container, isDark && { backgroundColor: colors.bgPage }]}>
      <StatusBar barStyle="light-content" backgroundColor={isDark ? colors.bgPrimary : "#064E3B"} translucent={false} />

      {/* قائمة الصفحة الرئيسية الموحدة: الرأس الترحيبي وأدوات التحكم وقائمة القراء تتحرك كلها مع السكرول بار */}
      <FlatList
        data={readers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, isDark && { backgroundColor: colors.bgPage }]}
        renderItem={({ item, index }) => (
          <View style={styles.readerItemWrapper}>
            <ReaderCard
              reader={item}
              index={index}
              juzCount={juzCount}
              status={dailyStatuses[item.id]?.status || 'pending'}
              onToggleStatus={handleToggleReaderStatus}
              onEdit={(r) => {
                setEditingReader(r);
                setIsAddModalVisible(true);
              }}
              onDelete={handleDeleteReader}
            />
          </View>
        )}
        ListHeaderComponent={
          <View>
            {/* الرأس الفاخر (Emerald Islamic Header) - المربع الترحيبي قابل للحركة مع التمرير */}
            <View style={[styles.header, isDark && { backgroundColor: colors.bgPrimary, borderBottomColor: colors.gold }]}>
              {/* شريط الإدارة العلوي (صلاحيات المدير + الإعدادات + كلمة المرور + خروج) */}
              <View style={styles.adminBar}>
                <View style={styles.adminBadgeRow}>
                  <TouchableOpacity
                    style={styles.adminBadge}
                    onPress={() => setIsAdminProfileVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.adminBadgeText}>
                      👑 {currentUser?.name || 'المدير'} (@{currentUser?.username || 'admin'})
                    </Text>
                  </TouchableOpacity>
                  <SyncStatusBadge compact />
                </View>

                <View style={styles.adminActions}>
                  {/* زر التبديل السريع للأوضاع (نهاري / ليلي / النظام) */}
                  <TouchableOpacity
                    style={[
                      styles.adminActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(255, 255, 255, 0.18)',
                        borderColor: isDark ? '#F59E0B' : 'rgba(255, 255, 255, 0.35)',
                      },
                    ]}
                    onPress={() => {
                      const nextMode =
                        themeMode === THEME_MODES.LIGHT
                          ? THEME_MODES.DARK
                          : themeMode === THEME_MODES.DARK
                          ? THEME_MODES.SYSTEM
                          : THEME_MODES.LIGHT;
                      setThemeMode(nextMode);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: isDark ? '#FDE68A' : '#FFFFFF', fontSize: 10.5, fontWeight: 'bold' }}>
                      {themeMode === THEME_MODES.DARK ? '🌙 ليلي' : themeMode === THEME_MODES.LIGHT ? '☀️ نهاري' : '⚙️ النظام'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.adminActionBtn, styles.profileBtn]}
                    onPress={() => setIsAdminProfileVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.profileBtnText}>👤 حسابي</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.adminActionBtn, styles.settingsBtn]}
                    onPress={() => setIsAdminSettingsVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.settingsBtnText}>⚙️ الإعدادات</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.adminActionBtn}
                    onPress={() => setIsChangePasswordVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.adminActionText}>🔑 كلمة المرور</Text>
                  </TouchableOpacity>

                  {onLogout && (
                    <TouchableOpacity
                      style={[styles.adminActionBtn, styles.logoutBtn]}
                      onPress={onLogout}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.logoutBtnText}>🚪 خروج</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* الصف العلوي: العنوان والتاريخ وزر المنبه */}
              <View style={styles.headerTopRow}>
                <View style={styles.titleGroup}>
                  <View style={[styles.iconCircle, isDark && { backgroundColor: colors.bgCard, borderColor: colors.gold }]}>
                    <Image
                      source={require('../../assets/logo.png')}
                      style={styles.headerLogoImg}
                      resizeMode="contain"
                    />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>زاد الأنصاري</Text>
                    <Text style={styles.headerSubtitleText}>« مشورة إب »</Text>
                    <Text style={styles.headerDate}>
                      {todayArabicDate} م {todayHijriDate ? `• ${todayHijriDate}` : ''}
                    </Text>
                  </View>
                </View>

                {/* أزرار التنبيهات: زر من لم يقرأ + زر ضبط التنبيه */}
                <View style={styles.headerTopActions}>
                  {pendingCount > 0 && (
                    <TouchableOpacity
                      style={[styles.unreadReminderPill, isDark && { backgroundColor: '#78350F', borderColor: colors.gold }]}
                      onPress={() => setIsUnreadReminderVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.unreadReminderPillText, isDark && { color: '#FDE68A' }]}>
                        📢 تذكير ({pendingCount})
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.reminderPill, reminderEnabled && styles.reminderPillActive]}
                    onPress={() => setIsReminderModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.reminderText, reminderEnabled && styles.reminderTextActive]}>
                      {reminderEnabled ? `🔔 ${formatArabicTime(reminderHour, reminderMinute)}` : '⏰ ضبط التنبيه'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* بطاقة الإحصائيات والإنجاز اليومي المدمجة */}
              <View style={[styles.headerStatsCard, isDark && { backgroundColor: colors.bgCard, borderColor: colors.cardBorder }]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, isDark && { color: colors.textSecondary }]}>إجمالي القراء</Text>
                  <Text style={[styles.statNumber, isDark && { color: colors.textPrimary }]}>{readers.length}</Text>
                </View>

                <View style={[styles.statDivider, isDark && { backgroundColor: colors.border }]} />

                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, isDark && { color: colors.textSecondary }]}>الورد لكل قارئ</Text>
                  <Text style={[styles.statNumberGold, isDark && { color: colors.gold }]}>
                    {juzCount === 1 ? '1 جزء' : juzCount === 2 ? 'جزآن' : `${juzCount} أجزاء`}
                  </Text>
                </View>

                <View style={[styles.statDivider, isDark && { backgroundColor: colors.border }]} />

                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, isDark && { color: colors.textSecondary }]}>أجزاء المجموعة</Text>
                  <Text style={[styles.statNumberEmerald, isDark && { color: colors.emeraldLight }]}>{totalDailyAjza}</Text>
                </View>
              </View>

              {/* شريط متابعة حالات قراءة الورد لليوم */}
              <View style={styles.statusSummaryBar}>
                <View style={styles.statusPillReadBox}>
                  <Text style={styles.statusPillReadText}>✅ أتموا: {readCount}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusPillPendingBox, pendingCount > 0 && styles.statusPillPendingBoxActive]}
                  onPress={() => setIsUnreadReminderVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.statusPillPendingText}>
                    ⏳ قيد القراءة: {pendingCount} {pendingCount > 0 ? '📢' : ''}
                  </Text>
                </TouchableOpacity>
                <View style={styles.statusPillExcusedBox}>
                  <Text style={styles.statusPillExcusedText}>✋ معتذر: {excusedCount}</Text>
                </View>
              </View>
            </View>

            {/* قسم أدوات التحكم (محدد الورد + أزرار العمليات + ترويسة القائمة) */}
            <View style={styles.contentSection}>
              {/* محدد مقدار الورد اليومي (Pill Tabs) */}
              <View style={styles.wirdSelectorContainer}>
                <Text style={[styles.selectorLabel, isDark && { color: colors.textSecondary }]}>مقدار الورد اليومي:</Text>
                <View style={[styles.wirdPillRow, isDark && { backgroundColor: colors.bgCard, borderColor: colors.cardBorder, borderWidth: 1 }]}>
                  {WIRD_AMOUNT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.wirdPill, juzCount === opt.value && (isDark ? { backgroundColor: colors.emerald, shadowColor: colors.emerald } : styles.activeWirdPill)]}
                      onPress={() => handleWirdCountChange(opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.wirdPillText, isDark && { color: colors.textSecondary }, juzCount === opt.value && (isDark ? { color: colors.gold } : styles.activeWirdPillText)]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* أزرار العمليات الرئيسية (تصدير PDF وترحيل الورد) */}
              <View style={styles.mainActionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.reportPdfBtn]}
                  onPress={() => setIsReportModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.reportPdfBtnText}>📄 تصدير جدول PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.advanceBtn]}
                  onPress={handleAdvanceDay}
                  activeOpacity={0.8}
                >
                  <Text style={styles.advanceBtnText}>⏩ ترحيل للغد</Text>
                </TouchableOpacity>
              </View>

              {/* ترويسة قائمة القراء مع زر الإضافة الزمردي */}
              <View style={styles.listHeaderRow}>
                <View style={styles.listTitleGroup}>
                  <Text style={[styles.listTitle, isDark && { color: colors.textPrimary }]}>قائمة القراء والمتابعة</Text>
                  <View style={[styles.countBadge, isDark && { backgroundColor: colors.bgSubtle, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.countBadgeText, isDark && { color: colors.gold }]}>{readers.length}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.addReaderBtn}
                  onPress={() => {
                    setEditingReader(null);
                    setIsAddModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addReaderBtnText}>+ إضافة قارئ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={
          <View style={[styles.emptyCard, isDark && { backgroundColor: colors.bgCard, borderColor: colors.cardBorder }]}>
            <Text style={styles.emptyIcon}>🕌</Text>
            <Text style={[styles.emptyTitle, isDark && { color: colors.textPrimary }]}>لا يوجد قراء مسجلين حالياً</Text>
            <Text style={[styles.emptySubtitle, isDark && { color: colors.textSecondary }]}>
              ابدأ بإضافة أعضاء المجموعة لتوزيع الورد القرآني تلقائياً ومتابعة الإنجاز اليومي.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyAddBtnText}>+ إضافة أول قارئ الآن</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* المودالات */}
      <AddReaderModal
        visible={isAddModalVisible}
        editingReader={editingReader}
        onClose={() => {
          setIsAddModalVisible(false);
          setEditingReader(null);
        }}
        onSave={handleSaveReader}
      />

      <ReportModal
        visible={isReportModalVisible}
        readers={readers}
        juzCount={juzCount}
        dailyStatuses={dailyStatuses}
        onClose={() => setIsReportModalVisible(false)}
      />

      <ReminderModal
        visible={isReminderModalVisible}
        onClose={() => setIsReminderModalVisible(false)}
        initialHour={reminderHour}
        initialMinute={reminderMinute}
        isEnabled={reminderEnabled}
        onSaveReminder={handleSaveReminderSettings}
      />

      <ChangePasswordModal
        visible={isChangePasswordVisible}
        onClose={() => setIsChangePasswordVisible(false)}
      />

      <AdminSettingsModal
        visible={isAdminSettingsVisible}
        onClose={() => setIsAdminSettingsVisible(false)}
        currentJuzCount={juzCount}
        onUpdateJuzCount={handleWirdCountChange}
        readers={readers}
        onUpdateReaders={setReaders}
        dailyStatuses={dailyStatuses}
        reminderHour={reminderHour}
        reminderMinute={reminderMinute}
        reminderEnabled={reminderEnabled}
        onOpenReminderSettings={() => setIsReminderModalVisible(true)}
        onOpenUnreadReminder={() => setIsUnreadReminderVisible(true)}
      />

      <AdminProfileModal
        visible={isAdminProfileVisible}
        onClose={() => setIsAdminProfileVisible(false)}
        admin={currentUser || { id: 'admin_root', username: 'admin', name: 'المدير العام' }}
        onProfileUpdated={(updatedAdmin) => {
          setCurrentUser(updatedAdmin);
          if (onUserUpdated) onUserUpdated(updatedAdmin);
        }}
      />

      <UnreadReminderModal
        visible={isUnreadReminderVisible}
        onClose={() => setIsUnreadReminderVisible(false)}
        readers={readers}
        dailyStatuses={dailyStatuses}
        reminderTimeStr={formatArabicTime(reminderHour, reminderMinute)}
        onOpenTimeSettings={() => setIsReminderModalVisible(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF8', // خلفية عاجية مريحة للعين
  },
  header: {
    backgroundColor: '#064E3B', // زمردي ملكي داكن
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 28) : 12,
    paddingBottom: 18,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#F59E0B', // لمسة الذهب الدافئ
  },
  adminBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  adminBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  adminBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  adminBadgeText: {
    color: '#FDE68A',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  adminActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  adminActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  adminActionText: {
    color: '#ECFDF5',
    fontSize: 10.5,
    fontWeight: '600',
  },
  profileBtn: {
    backgroundColor: 'rgba(5, 150, 105, 0.35)',
    borderColor: '#34D399',
  },
  profileBtnText: {
    color: '#D1FAE5',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  settingsBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.28)',
    borderColor: '#F59E0B',
  },
  settingsBtnText: {
    color: '#FDE68A',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  logoutBtnText: {
    color: '#FECACA',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  headerTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerLogoImg: {
    width: 38,
    height: 38,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitleText: {
    fontSize: 11,
    color: '#6EE7B7',
    fontWeight: 'bold',
    marginTop: -1,
    marginBottom: 2,
  },
  headerDate: {
    fontSize: 11.5,
    color: '#D1FAE5',
    marginTop: 2,
    fontWeight: '600',
  },
  headerTopActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  unreadReminderPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  unreadReminderPillText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '900',
  },
  reminderPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reminderPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  reminderText: {
    fontSize: 11.5,
    color: '#ECFDF5',
    fontWeight: '700',
  },
  reminderTextActive: {
    color: '#92400E',
  },
  headerStatsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#A7F3D0',
    fontWeight: '600',
    marginBottom: 2,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statNumberGold: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FDE68A', // ذهبي
  },
  statNumberEmerald: {
    fontSize: 16,
    fontWeight: '900',
    color: '#6EE7B7', // زمردي فاتح
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusSummaryBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  statusPillReadBox: {
    flex: 1,
    backgroundColor: 'rgba(22, 163, 74, 0.22)',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4ADE80',
    alignItems: 'center',
  },
  statusPillReadText: {
    color: '#DCFCE7',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  statusPillPendingBox: {
    flex: 1,
    backgroundColor: 'rgba(217, 119, 6, 0.22)',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FBBF24',
    alignItems: 'center',
  },
  statusPillPendingBoxActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.38)',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
  },
  statusPillPendingText: {
    color: '#FEF3C7',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  statusPillExcusedBox: {
    flex: 1,
    backgroundColor: 'rgba(225, 29, 72, 0.22)',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FB7185',
    alignItems: 'center',
  },
  statusPillExcusedText: {
    color: '#FFE4E6',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  readerItemWrapper: {
    paddingHorizontal: 16,
  },
  wirdSelectorContainer: {
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 6,
  },
  wirdPillRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  wirdPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeWirdPill: {
    backgroundColor: '#065F46',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  wirdPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  activeWirdPillText: {
    color: '#FDE68A', // ذهبي ناعم على الأخضر الزمردي
  },
  mainActionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  reportPdfBtn: {
    backgroundColor: '#059669',
    borderWidth: 1,
    borderColor: '#10B981',
    shadowColor: '#059669',
    shadowOpacity: 0.25,
  },
  reportPdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  advanceBtn: {
    backgroundColor: '#0284C7',
    borderWidth: 1,
    borderColor: '#38BDF8',
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
  },
  advanceBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  listHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46',
  },
  addReaderBtn: {
    backgroundColor: '#065F46',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addReaderBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12.5,
  },
  listContent: {
    paddingBottom: 36,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 280,
  },
  emptyAddBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});