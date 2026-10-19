import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  loadActiveSurvey,
  createSurvey,
  closeSurvey,
  saveSettings,
  saveReaders,
  addAnnouncement,
  loadTasks,
  createTask,
  deleteTask,
  loadAdminAccounts,
  createAdminAccount,
  deleteAdminAccount,
  deleteReader,
  loadMotivationalMessage,
  saveMotivationalMessage,
  DEFAULT_MOTIVATIONAL_MSG,
} from '../services/storageService.js';
import { sendInstantNotification } from '../services/notificationService.js';
import { exportSurveyToPdf, printSurveyDirectly } from '../services/pdfService.js';
import { getServerUrl, setServerUrl, testServerConnection } from '../config/apiConfig.js';
import { syncWithCloud, getSyncState } from '../services/syncService.js';
import { checkAndApplyAppUpdate, getUpdateInfo } from '../services/otaUpdateService.js';

export default function AdminSettingsModal({
  visible,
  onClose,
  currentJuzCount = 1,
  onUpdateJuzCount,
  readers = [],
  onUpdateReaders,
}) {
  const [activeTab, setActiveTab] = useState('wird'); // 'wird' | 'tasks' | 'accounts' | 'notifications' | 'survey'

  // إعدادات الورد اليومي
  const [customJuz, setCustomJuz] = useState(currentJuzCount);
  const [motivationalMessage, setMotivationalMessage] = useState(DEFAULT_MOTIVATIONAL_MSG);

  // إضافة عضو جديد
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberStartJuz, setNewMemberStartJuz] = useState(1);
  const [bulkNames, setBulkNames] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // محرك التكاليف والأنشطة
  const [tasksList, setTasksList] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('ADHKAR'); // 'QURAN' | 'ADHKAR' | 'GENERAL'
  const [newTaskTarget, setNewTaskTarget] = useState('100');
  const [newTaskUnit, setNewTaskUnit] = useState('مرة');
  const [newTaskDueTime, setNewTaskDueTime] = useState('23:59');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  // إدارة الحسابات والصلاحيات (RBAC)
  const [adminsList, setAdminsList] = useState([]);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  // إرسال الإشعارات
  const [notifTitle, setNotifTitle] = useState('📖 تذكير بالورد القرآني');
  const [notifBody, setNotifBody] = useState(
    'نرجو من جميع الإخوة الكرام مراجعة ورد اليوم وتسجيل حالة القراءة المباركة.'
  );
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // الاستبيان
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [newSurveyQuestion, setNewSurveyQuestion] = useState('');
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false);
  const [isExportingSurveyPdf, setIsExportingSurveyPdf] = useState(false);

  // السحابة والتحديثات الهوائية
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [syncStatusData, setSyncStatusData] = useState(getSyncState());
  const [appUpdateInfo, setAppUpdateInfo] = useState(getUpdateInfo());

  useEffect(() => {
    if (visible) {
      setCustomJuz(currentJuzCount);
      fetchSurvey();
      fetchTasks();
      fetchAdmins();
      fetchMotivational();
      fetchCloudSettings();
    }
  }, [visible, currentJuzCount]);

  const fetchCloudSettings = async () => {
    const url = await getServerUrl();
    setServerUrlInput(url);
    setSyncStatusData(getSyncState());
    setAppUpdateInfo(getUpdateInfo());
  };

  const handleSaveServerUrl = async () => {
    await setServerUrl(serverUrlInput);
    Alert.alert('تم حفظ رابط السحابة ✅', 'تم تحديث رابط الخادم السحابي للمزامنة بنجاح.');
  };

  const handleTestConnection = async () => {
    setIsTestingServer(true);
    const res = await testServerConnection(serverUrlInput);
    setIsTestingServer(false);
    Alert.alert(res.success ? 'اتصال ناجح 🟢' : 'فشل الاتصال 🔴', res.message);
  };

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    const res = await syncWithCloud(true);
    setIsSyncingNow(false);
    setSyncStatusData(getSyncState());
    Alert.alert(res.success ? 'تمت المزامنة بنجاح ✅' : 'تنبيه المزامنة ⚠️', res.message || 'تمت محاولة المزامنة مع السحابة.');
  };

  const handleCheckOtaUpdate = async () => {
    setIsCheckingUpdate(true);
    await checkAndApplyAppUpdate(true);
    setIsCheckingUpdate(false);
  };

  const fetchMotivational = async () => {
    const msg = await loadMotivationalMessage();
    setMotivationalMessage(msg);
  };

  const handleSaveMotivationalMsg = async () => {
    await saveMotivationalMessage(motivationalMessage);
    Alert.alert('تم الحفظ بنجاح ✅', 'تم تحديث الرسالة التحفيزية التي ستظهر للقراء فور إتمام الورد اليومي.');
  };

  const fetchSurvey = async () => {
    const s = await loadActiveSurvey();
    setActiveSurvey(s);
  };

  const fetchTasks = async () => {
    const t = await loadTasks();
    setTasksList(t);
  };

  const fetchAdmins = async () => {
    const a = await loadAdminAccounts();
    setAdminsList(a);
  };

  // إضافة تكليف جديد
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان التكليف أو النشاط.');
      return;
    }
    const res = await createTask({
      title: newTaskTitle,
      category: newTaskCategory,
      targetCount: Number(newTaskTarget) || 1,
      unit: newTaskUnit,
      dueTime: newTaskDueTime,
      description: newTaskDesc,
    });
    if (res.success) {
      setNewTaskTitle('');
      setNewTaskDesc('');
      fetchTasks();
      Alert.alert('تم بنجاح 🎉', 'تمت إضافة التكليف وتعميمه على الأعضاء بنجاح.');
    }
  };

  // حذف تكليف (يدعم الويب والموبايل)
  const handleDeleteTask = async (taskId) => {
    const execute = async () => {
      await deleteTask(taskId);
      fetchTasks();
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm('هل أنت متأكد من حذف هذا التكليف نهائياً؟')) {
          execute();
        }
      } else {
        execute();
      }
    } else {
      Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا التكليف نهائياً؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: execute },
      ]);
    }
  };

  // حذف حساب قارئ / عضو (يدعم الويب والموبايل)
  const handleDeleteMember = (memberId, memberName) => {
    const confirmMessage = `هل أنت متأكد من حذف حساب القارئ (${memberName}) نهائياً؟`;
    const execute = async () => {
      const res = await deleteReader(memberId);
      if (res.success) {
        if (onUpdateReaders) {
          onUpdateReaders(res.readers);
        }
        Alert.alert('تم الحذف بنجاح ✅', `تم حذف حساب القارئ (${memberName}) من النظام.`);
      } else {
        Alert.alert('خطأ', res.error || 'تعذر حذف الحساب.');
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm(confirmMessage)) {
          execute();
        }
      } else {
        execute();
      }
    } else {
      Alert.alert('تأكيد الحذف', confirmMessage, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: execute },
      ]);
    }
  };

  // حذف حساب مدير مساعد (يدعم الويب والموبايل)
  const handleDeleteAdmin = (adminId, adminName) => {
    const confirmMessage = `هل أنت متأكد من حذف حساب المدير (${adminName})؟`;
    const execute = async () => {
      const res = await deleteAdminAccount(adminId);
      if (res.success) {
        setAdminsList(res.admins);
        Alert.alert('تم الحذف بنجاح ✅', `تم حذف حساب المدير (${adminName}).`);
      } else {
        Alert.alert('تنبيه', res.error || 'تعذر حذف حساب المدير.');
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm(confirmMessage)) {
          execute();
        }
      } else {
        execute();
      }
    } else {
      Alert.alert('تأكيد الحذف', confirmMessage, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: execute },
      ]);
    }
  };

  // إنشاء حساب مدير جديد
  const handleCreateAdmin = async () => {
    if (!newAdminUser.trim() || !newAdminPass.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المستخدم وكلمة المرور للمدير.');
      return;
    }
    const res = await createAdminAccount(newAdminUser, newAdminPass, newAdminName || 'مدير مساعد');
    if (res.success) {
      setNewAdminUser('');
      setNewAdminPass('');
      setNewAdminName('');
      fetchAdmins();
      Alert.alert('تم بنجاح 👑', `تم إنشاء حساب المدير (${res.admin.username}) بنجاح.`);
    } else {
      Alert.alert('خطأ', res.error || 'تعذر إنشاء حساب المدير');
    }
  };

  // حفظ مقدار الورد اليومي
  const handleSaveJuzCount = async () => {
    if (customJuz < 1 || customJuz > 30) {
      Alert.alert('تنبيه', 'يجب أن يكون مقدار الورد بين جزء واحد و 30 جزءاً.');
      return;
    }
    await onUpdateJuzCount(customJuz);
    Alert.alert('تم الحفظ', `تم تحديث مقدار الورد اليومي بنجاح إلى (${customJuz} أجزاء).`);
  };

  // إضافة عضو فردي
  const handleAddSingleMember = async () => {
    if (!newMemberName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم القارئ.');
      return;
    }

    const newReader = {
      id: `reader_${Date.now()}`,
      name: newMemberName.trim(),
      currentJuz: Number(newMemberStartJuz) || 1,
    };

    const updated = [...readers, newReader];
    await saveReaders(updated);
    onUpdateReaders(updated);

    setNewMemberName('');
    Alert.alert('تمت الإضافة', `تمت إضافة القارئ (${newReader.name}) بنجاح.`);
  };

  // إضافة جماعية سريعة للأعضاء
  const handleBulkAddMembers = async () => {
    if (!bulkNames.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال أسماء القراء مفصولة بفواصل أو أسطر.');
      return;
    }

    const names = bulkNames
      .split(/[\n,،]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) return;

    let currentJuzCounter = (readers.length % 30) + 1;
    const newReadersList = names.map((name, idx) => ({
      id: `reader_${Date.now()}_${idx}`,
      name,
      currentJuz: ((currentJuzCounter + idx - 1) % 30) + 1,
    }));

    const updated = [...readers, ...newReadersList];
    await saveReaders(updated);
    onUpdateReaders(updated);

    setBulkNames('');
    setShowBulkAdd(false);
    Alert.alert('تمت الإضافة الجماعية', `تمت إضافة ${newReadersList.length} أعضاء بنجاح.`);
  };

  // إرسال وبث إشعار للأعضاء
  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان ونص الإشعار.');
      return;
    }

    setIsSendingNotif(true);
    await addAnnouncement(notifTitle, notifBody);
    const res = await sendInstantNotification(notifTitle.trim(), notifBody.trim());
    setIsSendingNotif(false);

    Alert.alert(res.success ? 'تم الإرسال 📢' : 'تنبيه', res.message);
  };

  // قوالب إشعارات سريعة
  const handleApplyTemplate = (title, body) => {
    setNotifTitle(title);
    setNotifBody(body);
  };

  // إنشاء استبيان جديد
  const handleCreateSurvey = async () => {
    if (!newSurveyQuestion.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة سؤال الاستبيان.');
      return;
    }

    setIsCreatingSurvey(true);
    const created = await createSurvey(newSurveyQuestion.trim());
    setIsCreatingSurvey(false);

    if (created) {
      setActiveSurvey(created);
      setNewSurveyQuestion('');
      // إرسال إشعار للأعضاء بوجود استبيان جديد
      await sendInstantNotification(
        '📋 استبيان جديد من مدير الورد',
        `يرجى الإجابة بـ نعم أو لا على: ${created.question}`
      );
      Alert.alert('تم إطلاق الاستبيان 🚀', 'تم إرسال الاستبيان لجميع الأعضاء وسيظهر في واجهاتهم فوراً.');
    }
  };

  // إغلاق الاستبيان (يدعم الويب والموبايل)
  const handleCloseSurvey = () => {
    const execute = async () => {
      if (activeSurvey) {
        await closeSurvey(activeSurvey.id);
        setActiveSurvey(null);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm('هل تريد إنهاء هذا الاستبيان وإيقاف استقبال الإجابات؟')) {
          execute();
        }
      } else {
        execute();
      }
    } else {
      Alert.alert(
        'تأكيد إغلاق الاستبيان',
        'هل تريد إنهاء هذا الاستبيان وإيقاف استقبال الإجابات؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'نعم، إغلاق الاستبيان',
            style: 'destructive',
            onPress: execute,
          },
        ]
      );
    }
  };

  // تصدير نتائج الاستبيان كـ PDF
  const handleExportSurveyPdf = async () => {
    if (!activeSurvey) return;
    setIsExportingSurveyPdf(true);
    await exportSurveyToPdf(
      activeSurvey,
      readers,
      'زاد الأنصاري • مشورة إب (تقرير نتائج الاستبيان)'
    );
    setIsExportingSurveyPdf(false);
  };

  // طباعة نتائج الاستبيان
  const handlePrintSurvey = async () => {
    if (!activeSurvey) return;
    await printSurveyDirectly(
      activeSurvey,
      readers,
      'زاد الأنصاري • مشورة إب (تقرير نتائج الاستبيان)'
    );
  };

  // حساب إحصائيات الاستبيان النشط
  const votes = activeSurvey?.votes || {};
  let yesCount = 0;
  let noCount = 0;
  readers.forEach((r) => {
    const v = votes[r.id]?.vote;
    if (v === 'yes') yesCount++;
    else if (v === 'no') noCount++;
  });
  const answeredTotal = yesCount + noCount;
  const pendingTotal = Math.max(0, readers.length - answeredTotal);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* رأس النافذة */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕ إغلاق</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>⚙️ زاد الأنصاري • إعدادات المدير</Text>
              <Text style={styles.headerSubtitle}>« مشورة إب » • إدارة الورد، الإشعارات، والاستبيانات</Text>
            </View>
          </View>

          {/* أزرار التبويبات (Tabs) */}
          <View style={styles.tabBarWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBar}
            >
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'wird' && styles.activeTabItem]}
                onPress={() => setActiveTab('wird')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabItemText, activeTab === 'wird' && styles.activeTabText]}>
                  📖 الورد
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'tasks' && styles.activeTabItem]}
                onPress={() => setActiveTab('tasks')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabItemText, activeTab === 'tasks' && styles.activeTabText]}>
                  ⭐ التكاليف
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'accounts' && styles.activeTabItem]}
                onPress={() => setActiveTab('accounts')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabItemText, activeTab === 'accounts' && styles.activeTabText]}>
                  👥 الحسابات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'notifications' && styles.activeTabItem]}
                onPress={() => setActiveTab('notifications')}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.tabItemText, activeTab === 'notifications' && styles.activeTabText]}
                >
                  📢 الإشعارات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'survey' && styles.activeTabItem]}
                onPress={() => setActiveTab('survey')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabItemText, activeTab === 'survey' && styles.activeTabText]}>
                  📋 الاستبيان
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'cloud' && styles.activeTabItem]}
                onPress={() => setActiveTab('cloud')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabItemText, activeTab === 'cloud' && styles.activeTabText]}>
                  ☁️ السحابة والتحديث
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* 1. تبويب الورد والأعضاء */}
            {activeTab === 'wird' && (
              <View style={styles.tabContent}>
                {/* قسم تعديل مقدار الورد اليومي إلى عدة أجزاء */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>📖 تعديل مقدار الورد اليومي (عدة أجزاء):</Text>
                  <Text style={styles.sectionDesc}>
                    حدد عدد الأجزاء المقررة يومياً لكل قارئ في المجموعة.
                  </Text>

                  {/* عداد الأجزاء التفاعلي (+ / -) */}
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setCustomJuz((prev) => Math.min(30, prev + 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepperBtnText}>+1</Text>
                    </TouchableOpacity>

                    <View style={styles.stepperValueBox}>
                      <Text style={styles.stepperValueText}>{customJuz}</Text>
                      <Text style={styles.stepperValueLabel}>
                        {customJuz === 1 ? 'جزء واحد' : customJuz === 2 ? 'جزآن' : `${customJuz} أجزاء`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setCustomJuz((prev) => Math.max(1, prev - 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepperBtnText}>-1</Text>
                    </TouchableOpacity>
                  </View>

                  {/* خيارات سريعة */}
                  <View style={styles.quickPillsRow}>
                    {[1, 2, 3, 5, 10].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[styles.quickPill, customJuz === val && styles.quickPillActive]}
                        onPress={() => setCustomJuz(val)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickPillText,
                            customJuz === val && styles.quickPillTextActive,
                          ]}
                        >
                          {val} {val === 1 ? 'جزء' : val === 2 ? 'جزآن' : 'أجزاء'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.saveActionBtn}
                    onPress={handleSaveJuzCount}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.saveActionBtnText}>💾 تطبيق وحفظ مقدار الورد</Text>
                  </TouchableOpacity>
                </View>

                {/* قسم تخصيص الرسالة التحفيزية للقراء عند إتمام الورد */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>✨ رسالة التهنئة والتحفيز عند إتمام الورد:</Text>
                  <Text style={styles.sectionDesc}>
                    تظهر هذه الرسالة للقارئ كإشعار تحفيزي فاخر داخل التطبيق فور تسجيله إتمام الورد اليومي، ويمكنك تعديلها بأي وقت:
                  </Text>

                  <TextInput
                    style={[styles.textInput, { minHeight: 65, textAlignVertical: 'top' }]}
                    placeholder="اكتب الرسالة التحفيزية هنا..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={motivationalMessage}
                    onChangeText={setMotivationalMessage}
                    textAlign="right"
                  />

                  <TouchableOpacity
                    style={[styles.saveActionBtn, { backgroundColor: '#059669', marginTop: 10 }]}
                    onPress={handleSaveMotivationalMsg}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.saveActionBtnText}>💾 حفظ وتحديث الرسالة التحفيزية</Text>
                  </TouchableOpacity>
                </View>

                {/* قسم إضافة الأعضاء */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>👤 إضافة أعضاء إلى حلقة الورد:</Text>
                  <Text style={styles.sectionDesc}>
                    إجمالي القراء الحاليين في المجموعة: {readers.length} عضو
                  </Text>

                  {/* إضافة فردية */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>اسم القارئ الجديد:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="مثال: عبد الرحمن السعدي"
                      placeholderTextColor="#94A3B8"
                      value={newMemberName}
                      onChangeText={setNewMemberName}
                      textAlign="right"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>الجزء الذي يبدأ منه (1 - 30):</Text>
                    <View style={styles.miniStepperRow}>
                      <TouchableOpacity
                        style={styles.miniStepperBtn}
                        onPress={() => setNewMemberStartJuz((p) => Math.min(30, p + 1))}
                      >
                        <Text style={styles.miniStepperBtnText}>+1</Text>
                      </TouchableOpacity>
                      <Text style={styles.miniStepperText}>الجزء {newMemberStartJuz}</Text>
                      <TouchableOpacity
                        style={styles.miniStepperBtn}
                        onPress={() => setNewMemberStartJuz((p) => Math.max(1, p - 1))}
                      >
                        <Text style={styles.miniStepperBtnText}>-1</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.addMemberBtn}
                    onPress={handleAddSingleMember}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addMemberBtnText}>+ إضافة العضو الآن</Text>
                  </TouchableOpacity>

                  {/* خيار الإضافة الجماعية */}
                  <TouchableOpacity
                    style={styles.bulkToggleBtn}
                    onPress={() => setShowBulkAdd(!showBulkAdd)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.bulkToggleText}>
                      {showBulkAdd ? 'إخفاء الإضافة السريعة 🔼' : '⚡ إضافة سريعة لمجموعة أسماء دفعة واحدة 🔽'}
                    </Text>
                  </TouchableOpacity>

                  {showBulkAdd && (
                    <View style={styles.bulkBox}>
                      <Text style={styles.bulkNote}>
                        الصق أو اكتب الأسماء مفصولة بأسطر أو فواصل:
                      </Text>
                      <TextInput
                        style={styles.bulkTextArea}
                        placeholder="أحمد علي&#10;محمد عمر&#10;خالد بن الوليد..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={4}
                        value={bulkNames}
                        onChangeText={setBulkNames}
                        textAlign="right"
                      />
                      <TouchableOpacity
                        style={styles.bulkSubmitBtn}
                        onPress={handleBulkAddMembers}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.bulkSubmitBtnText}>إضافة جميع الأسماء المكتوبة 🚀</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* تبويب محرك التكاليف والأنشطة الديناميكية */}
            {activeTab === 'tasks' && (
              <View style={styles.tabContent}>
                {/* نموذج إنشاء تكليف جديد */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>⭐ إنشاء تكليف أو نشاط جديد:</Text>
                  <Text style={styles.sectionDesc}>
                    أضف ورداً، أذكاراً، أو أنشطة مخصصة لتعميمها على جميع أعضاء المجموعة.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>عنوان التكليف أو النشاط:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="مثال: أذكار النوم، صيام الإثنين، صلاة الضحى..."
                      placeholderTextColor="#94A3B8"
                      value={newTaskTitle}
                      onChangeText={setNewTaskTitle}
                      textAlign="right"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>تصنيف التكليف:</Text>
                    <View style={styles.categoryRow}>
                      <TouchableOpacity
                        style={[styles.catPill, newTaskCategory === 'QURAN' && styles.catPillActive]}
                        onPress={() => {
                          setNewTaskCategory('QURAN');
                          setNewTaskUnit('أجزاء');
                        }}
                      >
                        <Text style={[styles.catPillText, newTaskCategory === 'QURAN' && styles.catPillTextActive]}>
                          📖 قرآن
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.catPill, newTaskCategory === 'ADHKAR' && styles.catPillActive]}
                        onPress={() => {
                          setNewTaskCategory('ADHKAR');
                          setNewTaskUnit('مرة');
                        }}
                      >
                        <Text style={[styles.catPillText, newTaskCategory === 'ADHKAR' && styles.catPillTextActive]}>
                          📿 أذكار وعبادة
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.catPill, newTaskCategory === 'GENERAL' && styles.catPillActive]}
                        onPress={() => {
                          setNewTaskCategory('GENERAL');
                          setNewTaskUnit('نشاط');
                        }}
                      >
                        <Text style={[styles.catPillText, newTaskCategory === 'GENERAL' && styles.catPillTextActive]}>
                          ⭐ نشاط عام
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.rowTwoCols}>
                    <View style={styles.halfCol}>
                      <Text style={styles.inputLabel}>المقدار المستهدف:</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="100"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={newTaskTarget}
                        onChangeText={setNewTaskTarget}
                        textAlign="center"
                      />
                    </View>
                    <View style={styles.halfCol}>
                      <Text style={styles.inputLabel}>وحدة القياس:</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="مرة / جزء / ركعة"
                        placeholderTextColor="#94A3B8"
                        value={newTaskUnit}
                        onChangeText={setNewTaskUnit}
                        textAlign="center"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>وقت الاستحقاق النهائي:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="23:59"
                      placeholderTextColor="#94A3B8"
                      value={newTaskDueTime}
                      onChangeText={setNewTaskDueTime}
                      textAlign="center"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>تفاصيل أو مواصفات إضافية (اختياري):</Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 60 }]}
                      placeholder="اكتب أي ملاحظة أو توجيه للأعضاء..."
                      placeholderTextColor="#94A3B8"
                      multiline
                      value={newTaskDesc}
                      onChangeText={setNewTaskDesc}
                      textAlign="right"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={handleCreateTask}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionBtnText}>إضافة التكليف وتعميمه فوراً 🚀</Text>
                  </TouchableOpacity>
                </View>

                {/* قائمة التكاليف الحالية النشطة */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>📋 التكاليف والمهام الحالية في النظام ({tasksList.length}):</Text>
                  {tasksList.map((t) => (
                    <View key={t.id} style={styles.taskManageRow}>
                      <TouchableOpacity
                        style={styles.deleteTaskBtn}
                        onPress={() => handleDeleteTask(t.id)}
                      >
                        <Text style={styles.deleteTaskBtnText}>حذف 🗑️</Text>
                      </TouchableOpacity>
                      <View style={styles.taskManageInfo}>
                        <Text style={styles.taskManageTitle}>{t.icon} {t.title}</Text>
                        <Text style={styles.taskManageSub}>
                          المقدار: {t.targetCount} {t.unit} • الاستحقاق: {t.dueTime || '23:59'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* تبويب إدارة الحسابات والصلاحيات RBAC */}
            {activeTab === 'accounts' && (
              <View style={styles.tabContent}>
                {/* قسم إنشاء حساب مدير جديد */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>👑 إنشاء حساب مدير جديد بصلاحيات كاملة:</Text>
                  <Text style={styles.sectionDesc}>
                    يمكن للمدير إضافة وحذف القراء وتصدير التقارير وإدارة التكاليف.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>اسم المدير الكامل:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="مثال: الشيخ عبد الرحمن"
                      placeholderTextColor="#94A3B8"
                      value={newAdminName}
                      onChangeText={setNewAdminName}
                      textAlign="right"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>اسم المستخدم (معرف الدخول):</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="admin2"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      value={newAdminUser}
                      onChangeText={setNewAdminUser}
                      textAlign="right"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>كلمة المرور:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="أدخل كلمة المرور للمدير"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                      value={newAdminPass}
                      onChangeText={setNewAdminPass}
                      textAlign="right"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#B45309' }]}
                    onPress={handleCreateAdmin}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionBtnText}>+ حفظ وإنشاء حساب المدير 👑</Text>
                  </TouchableOpacity>
                </View>

                {/* قائمة حسابات المدراء */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>👑 حسابات المدراء الحاليين ({adminsList.length}):</Text>
                  {adminsList.map((a) => (
                    <View key={a.id} style={styles.accountRow}>
                      <View style={styles.accountLeftActions}>
                        {a.id !== 'admin_root' ? (
                          <TouchableOpacity
                            style={styles.deleteTaskBtn}
                            onPress={() => handleDeleteAdmin(a.id, a.name || a.username)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.deleteTaskBtnText}>حذف 🗑️</Text>
                          </TouchableOpacity>
                        ) : null}
                        <View style={styles.rolePillAdmin}>
                          <Text style={styles.rolePillAdminText}>
                            {a.id === 'admin_root' ? '👑 مدير رئيسي' : '👑 مدير مساعد'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName}>{a.name || 'مدير'}</Text>
                        <Text style={styles.accountUser}>@{a.username}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* كشف جدول حسابات الأعضاء والقراء */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>👤 حسابات الأعضاء والقراء ({readers.length}):</Text>
                  <Text style={styles.sectionDesc}>
                    يمكن لكل عضو تغيير وتأمين كلمة المرور الخاصة به عند تسجيل الدخول.
                  </Text>

                  {readers.map((r, idx) => (
                    <View key={r.id || idx} style={styles.accountRow}>
                      <View style={styles.accountLeftActions}>
                        <TouchableOpacity
                          style={styles.deleteTaskBtn}
                          onPress={() => handleDeleteMember(r.id, r.name)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteTaskBtnText}>حذف 🗑️</Text>
                        </TouchableOpacity>
                        <View style={[styles.defaultPassBadge, r.isFirstLogin === false && styles.customPassBadge]}>
                          <Text style={[styles.defaultPassBadgeText, r.isFirstLogin === false && styles.customPassBadgeText]}>
                            {r.isFirstLogin === false ? '🔒 كلمة مرور مخصصة' : '🔑 كلمة مرور أولية'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName}>{r.name}</Text>
                        <Text style={styles.accountUser}>@{r.username || r.name} • الجزء {r.currentJuz}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 2. تبويب إرسال الإشعارات */}
            {activeTab === 'notifications' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>📢 إرسال وبث إشعار فوري لجميع الأعضاء:</Text>
                  <Text style={styles.sectionDesc}>
                    يصل الإشعار فوراً إلى هواتف القراء كتنبيه ويظهر في واجهة تطبيقهم.
                  </Text>

                  {/* نماذج سريعة جاهزة */}
                  <Text style={styles.templatesTitle}>💡 نماذج رسائل جاهزة:</Text>
                  <View style={styles.templatesGrid}>
                    <TouchableOpacity
                      style={styles.templatePill}
                      onPress={() =>
                        handleApplyTemplate(
                          '📖 تذكير بالورد القرآني',
                          'تقبل الله طاعاتكم، نذكركم بقراءة وتسجيل ورد اليوم المبارك.'
                        )
                      }
                    >
                      <Text style={styles.templatePillText}>📖 تذكير الورد</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.templatePill}
                      onPress={() =>
                        handleApplyTemplate(
                          '🌿 سورة الكهف والصلاة على النبي',
                          'جمعة مباركة طيبة، نذكركم بقراءة سورة الكهف وكثرة الصلاة على النبي ﷺ.'
                        )
                      }
                    >
                      <Text style={styles.templatePillText}>🌿 سورة الكهف</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.templatePill}
                      onPress={() =>
                        handleApplyTemplate(
                          '⏰ تبقت ساعات قليلة',
                          'نهاية اليوم تقترب، سارع بإتمام وردك والمشاركة في إنجاز المجموعة.'
                        )
                      }
                    >
                      <Text style={styles.templatePillText}>⏰ ختام اليوم</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.templatePill}
                      onPress={() =>
                        handleApplyTemplate(
                          '🎉 مبارك ختم القرآن',
                          'الحمد لله الذي بنعمته تتم الصالحات، اكتملت الختمة المباركة.'
                        )
                      }
                    >
                      <Text style={styles.templatePillText}>🎉 اكتمال الختمة</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>عنوان الإشعار:</Text>
                    <TextInput
                      style={styles.textInput}
                      value={notifTitle}
                      onChangeText={setNotifTitle}
                      textAlign="right"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>نص التنبيه:</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={notifBody}
                      onChangeText={setNotifBody}
                      multiline
                      numberOfLines={3}
                      textAlign="right"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.sendNotifBtn, isSendingNotif && styles.btnDisabled]}
                    onPress={handleSendNotification}
                    disabled={isSendingNotif}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.sendNotifBtnText}>
                      {isSendingNotif ? 'جاري البث...' : '📢 إرسال التنبيه الآن لجميع الأعضاء'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. تبويب الاستبيانات وتصدير PDF */}
            {activeTab === 'survey' && (
              <View style={styles.tabContent}>
                {/* إذا كان هناك استبيان نشط حالياً */}
                {activeSurvey ? (
                  <View style={styles.sectionCard}>
                    <View style={styles.surveyActiveHeader}>
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>🔴 استبيان نشط حالياً</Text>
                      </View>
                      <Text style={styles.surveyQuestionTitle}>« {activeSurvey.question} »</Text>
                    </View>

                    {/* نتائج التصويت الحية */}
                    <View style={styles.surveyResultsBox}>
                      <Text style={styles.surveyResultsTitle}>
                        نتائج تصويت الأعضاء الحية ({answeredTotal} من {readers.length}):
                      </Text>

                      <View style={styles.surveyStatsRow}>
                        <View style={[styles.surveyStatCard, styles.statYesBox]}>
                          <Text style={styles.statYesNum}>{yesCount}</Text>
                          <Text style={styles.statYesLabel}>نعم ✅</Text>
                        </View>

                        <View style={[styles.surveyStatCard, styles.statNoBox]}>
                          <Text style={styles.statNoNum}>{noCount}</Text>
                          <Text style={styles.statNoLabel}>لا ❌</Text>
                        </View>

                        <View style={[styles.surveyStatCard, styles.statPendingBox]}>
                          <Text style={styles.statPendingNum}>{pendingTotal}</Text>
                          <Text style={styles.statPendingLabel}>لم يجيبوا ⏳</Text>
                        </View>
                      </View>
                    </View>

                    {/* تفاصيل إجابات كل عضو */}
                    <Text style={styles.votersListTitle}>تفاصيل إجابات كل عضو في المجموعة:</Text>
                    <View style={styles.votersList}>
                      {readers.map((r, i) => {
                        const v = votes[r.id]?.vote;
                        return (
                          <View key={r.id} style={styles.voterRow}>
                            <View>
                              {v === 'yes' ? (
                                <Text style={styles.voteYesTag}>✅ نعم</Text>
                              ) : v === 'no' ? (
                                <Text style={styles.voteNoTag}>❌ لا</Text>
                              ) : (
                                <Text style={styles.votePendingTag}>⏳ بانتظار الإجابة</Text>
                              )}
                            </View>
                            <Text style={styles.voterName}>
                              {i + 1}. {r.name}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* أزرار التصدير إلى PDF والطباعة والإغلاق */}
                    <View style={styles.surveyActionsGroup}>
                      <TouchableOpacity
                        style={[styles.pdfExportBtn, isExportingSurveyPdf && styles.btnDisabled]}
                        onPress={handleExportSurveyPdf}
                        disabled={isExportingSurveyPdf}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.pdfExportBtnText}>
                          {isExportingSurveyPdf ? 'جاري تجهيز PDF...' : '📄 تصدير نتائج الاستبيان PDF'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.printSurveyBtn}
                        onPress={handlePrintSurvey}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.printSurveyBtnText}>🖨️ طباعة النتائج</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.closeSurveyBtn}
                        onPress={handleCloseSurvey}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.closeSurveyBtnText}>🛑 إنهاء وإغلاق هذا الاستبيان</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* إنشاء استبيان جديد بنعم أو لا */
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>📋 إنشاء وإرسال استبيان جديد (نعم / لا):</Text>
                    <Text style={styles.sectionDesc}>
                      اطرح سؤالاً على جميع أعضاء المجموعة، وسيتمكن كل عضو من الإجابة بـ (نعم) أو (لا)،
                      مع إمكانية متابعة النتائج لحظياً وتصديرها كملف PDF منظم.
                    </Text>

                    {/* أسئلة مقترحة سريعة */}
                    <Text style={styles.templatesTitle}>💡 أسئلة استبيان شائعة:</Text>
                    <View style={styles.templatesGrid}>
                      {[
                        'هل قرأت سورة الكهف اليوم؟',
                        'هل يناسبك زيادة الورد إلى جزأين يومياً؟',
                        'هل أنت مستعد لبدء الختمة الجديدة غداً؟',
                        'هل أتممت قراءة جميع الأوراد الفائتة؟',
                      ].map((q) => (
                        <TouchableOpacity
                          key={q}
                          style={styles.templatePill}
                          onPress={() => setNewSurveyQuestion(q)}
                        >
                          <Text style={styles.templatePillText}>{q}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>اكتب سؤال الاستبيان:</Text>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        placeholder="مثال: هل قرأت سورة الكهف اليوم؟"
                        placeholderTextColor="#94A3B8"
                        value={newSurveyQuestion}
                        onChangeText={setNewSurveyQuestion}
                        multiline
                        numberOfLines={3}
                        textAlign="right"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.createSurveyBtn, isCreatingSurvey && styles.btnDisabled]}
                      onPress={handleCreateSurvey}
                      disabled={isCreatingSurvey}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.createSurveyBtnText}>
                        {isCreatingSurvey ? 'جاري الإطلاق...' : '🚀 إطلاق الاستبيان للأعضاء الآن'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* 6. تبويب السحابة والتحديثات الهوائية */}
            {activeTab === 'cloud' && (
              <View style={styles.tabContent}>
                {/* بطاقة خادم المزامنة السحابي */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>☁️ خادم المزامنة وقاعدة البيانات المركزية:</Text>
                  <Text style={styles.sectionDesc}>
                    عند ربط التطبيق بخادم سحابي، تنعكس كافة تعديلات الورد، التكاليف، والاستبيانات تلقائياً ولحظياً عند جميع أجهزة الفريق.
                  </Text>

                  {/* شارة الحالة اللحظية */}
                  <View
                    style={[
                      styles.cloudStatusBanner,
                      syncStatusData.isOnline ? styles.cloudBannerOnline : styles.cloudBannerOffline,
                    ]}
                  >
                    <Text style={styles.cloudBannerText}>
                      {syncStatusData.isOnline
                        ? '🟢 متصل بالإنترنت ومحرك المزامنة نشط'
                        : '🔴 غير متصل بالإنترنت (الوضع المحلي نشط)'}
                    </Text>
                    {syncStatusData.lastSyncedAt && (
                      <Text style={styles.cloudBannerSub}>
                        آخر مزامنة ناجحة: {new Date(syncStatusData.lastSyncedAt).toLocaleTimeString('ar-SA')}
                      </Text>
                    )}
                    {syncStatusData.pendingCount > 0 && (
                      <Text style={styles.cloudBannerPending}>
                        ⏳ يوجد {syncStatusData.pendingCount} عملية محلية في الانتظار للإرسال
                      </Text>
                    )}
                  </View>

                  {/* إدخال رابط السيرفر */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>رابط الخادم السحابي (Server URL):</Text>
                    <TextInput
                      style={[styles.textInput, { direction: 'ltr', textAlign: 'left' }]}
                      placeholder="https://your-app.onrender.com أو http://localhost:3000"
                      placeholderTextColor="#94A3B8"
                      value={serverUrlInput}
                      onChangeText={setServerUrlInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.helperText}>
                      * في الويب: يكتشف التطبيق الرابط تلقائياً. في الهواتف (APK): ضع رابط الاستضافة السحابية الخاصة بك.
                    </Text>
                  </View>

                  {/* أزرار الحفظ والفحص */}
                  <View style={styles.cloudBtnRow}>
                    <TouchableOpacity
                      style={[styles.cloudActionBtn, styles.testBtn, isTestingServer && styles.btnDisabled]}
                      onPress={handleTestConnection}
                      disabled={isTestingServer}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cloudBtnText}>
                        {isTestingServer ? 'جاري الفحص...' : '🔍 فحص الاتصال'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cloudActionBtn, styles.saveServerBtn]}
                      onPress={handleSaveServerUrl}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cloudBtnText}>💾 حفظ الرابط</Text>
                    </TouchableOpacity>
                  </View>

                  {/* زر المزامنة الفورية الشاملة */}
                  <TouchableOpacity
                    style={[styles.manualSyncBtn, isSyncingNow && styles.btnDisabled]}
                    onPress={handleManualSync}
                    disabled={isSyncingNow}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.manualSyncBtnText}>
                      {isSyncingNow ? '🔄 جاري المزامنة مع السحابة...' : '🔄 مزامنة فورية شاملة الآن'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* بطاقة التحديثات الهوائية Over-The-Air */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🚀 التحديثات الهوائية الفورية (EAS Over-The-Air):</Text>
                  <Text style={styles.sectionDesc}>
                    تتيح لك هذه الميزة إرسال أي تعديل على شاشات وكود التطبيق لجميع أجهزة الفريق فوراً، دون الحاجة لإعادة إنشاء أو تثبيت ملف APK من جديد.
                  </Text>

                  <View style={styles.otaInfoBox}>
                    <View style={styles.otaInfoRow}>
                      <Text style={styles.otaInfoLabel}>قناة التحديث (Channel):</Text>
                      <Text style={styles.otaInfoVal}>{appUpdateInfo.channel || 'preview'}</Text>
                    </View>
                    <View style={styles.otaInfoRow}>
                      <Text style={styles.otaInfoLabel}>إصدار الـ Runtime:</Text>
                      <Text style={styles.otaInfoVal}>{appUpdateInfo.runtimeVersion || '1.0.0'}</Text>
                    </View>
                    <View style={styles.otaInfoRow}>
                      <Text style={styles.otaInfoLabel}>حالة البيئة:</Text>
                      <Text style={styles.otaInfoVal}>
                        {appUpdateInfo.isSupported
                          ? 'جاهز للتحديثات الهوائية ✅'
                          : 'نسخة الويب (تحديث عبر المتصفح) 🌐'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.checkOtaBtn, isCheckingUpdate && styles.btnDisabled]}
                    onPress={handleCheckOtaUpdate}
                    disabled={isCheckingUpdate}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.checkOtaBtnText}>
                      {isCheckingUpdate ? '⏳ جاري فحص السحابة...' : '🚀 فحص وتنزيل التحديثات الهوائية الآن'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    backgroundColor: 'rgba(6, 78, 59, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F8FAF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 24,
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 2,
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
  tabBarWrapper: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  tabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  tabItem: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabItem: {
    backgroundColor: '#065F46',
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  cloudStatusBanner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  cloudBannerOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  cloudBannerOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  cloudBannerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#065F46',
    textAlign: 'right',
  },
  cloudBannerSub: {
    fontSize: 11,
    color: '#047857',
    textAlign: 'right',
    marginTop: 4,
  },
  cloudBannerPending: {
    fontSize: 11,
    color: '#B45309',
    textAlign: 'right',
    marginTop: 4,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
  },
  cloudBtnRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  cloudActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtn: {
    backgroundColor: '#0284C7',
  },
  saveServerBtn: {
    backgroundColor: '#059669',
  },
  cloudBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  manualSyncBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  manualSyncBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  otaInfoBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otaInfoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  otaInfoLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  otaInfoVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: 'bold',
  },
  checkOtaBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkOtaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scrollArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabContent: {
    paddingBottom: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#064E3B',
    textAlign: 'right',
  },
  sectionDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
    marginBottom: 12,
  },
  stepperContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 12,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065F46',
  },
  stepperValueBox: {
    alignItems: 'center',
    minWidth: 110,
  },
  stepperValueText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#065F46',
  },
  stepperValueLabel: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '600',
    marginTop: -2,
  },
  quickPillsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  quickPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickPillActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  quickPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  quickPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  saveActionBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  saveActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'right',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 64,
  },
  miniStepperRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 6,
    justifyContent: 'space-between',
  },
  miniStepperBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  miniStepperBtnText: {
    color: '#065F46',
    fontWeight: 'bold',
    fontSize: 13,
  },
  miniStepperText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  addMemberBtn: {
    backgroundColor: '#065F46',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addMemberBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  bulkToggleBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bulkToggleText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  bulkBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 10,
  },
  bulkNote: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
    textAlign: 'right',
  },
  bulkTextArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    minHeight: 70,
  },
  bulkSubmitBtn: {
    backgroundColor: '#059669',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  bulkSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  templatesTitle: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 6,
  },
  templatesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  templatePill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  templatePillText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
  },
  sendNotifBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  sendNotifBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  surveyActiveHeader: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  activePill: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  activePillText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: 'bold',
  },
  surveyQuestionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    lineHeight: 22,
  },
  surveyResultsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  surveyResultsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  surveyStatsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  surveyStatCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statYesBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  statYesNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#15803D',
  },
  statYesLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#166534',
    marginTop: 2,
  },
  statNoBox: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  statNoNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#BE123C',
  },
  statNoLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9F1239',
    marginTop: 2,
  },
  statPendingBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statPendingNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#B45309',
  },
  statPendingLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
    marginTop: 2,
  },
  votersListTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 6,
  },
  votersList: {
    maxHeight: 160,
    marginBottom: 14,
  },
  voterRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  voterName: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  voteYesTag: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },
  voteNoTag: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#BE123C',
  },
  votePendingTag: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  surveyActionsGroup: {
    gap: 8,
  },
  pdfExportBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#047857',
  },
  pdfExportBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  printSurveyBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  printSurveyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  closeSurveyBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  closeSurveyBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: 'bold',
  },
  createSurveyBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  createSurveyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  rowTwoCols: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 12,
  },
  halfCol: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  catPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  catPillActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  catPillTextActive: {
    color: '#FDE68A',
  },
  primaryActionBtn: {
    backgroundColor: '#065F46',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  taskManageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  taskManageInfo: {
    alignItems: 'flex-end',
    flex: 1,
    paddingRight: 10,
  },
  taskManageTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  taskManageSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  deleteTaskBtn: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDA4AF',
  },
  deleteTaskBtnText: {
    fontSize: 11,
    color: '#BE123C',
    fontWeight: 'bold',
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  accountInfo: {
    alignItems: 'flex-end',
  },
  accountName: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  accountUser: {
    fontSize: 11,
    color: '#64748B',
  },
  rolePillAdmin: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  rolePillAdminText: {
    fontSize: 10.5,
    color: '#92400E',
    fontWeight: 'bold',
  },
  defaultPassBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  defaultPassBadgeText: {
    fontSize: 10.5,
    color: '#92400E',
    fontWeight: 'bold',
  },
  customPassBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  customPassBadgeText: {
    color: '#065F46',
  },
  accountLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
