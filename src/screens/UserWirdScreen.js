import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {
  loadDailyStatuses,
  updateReaderDailyStatus,
  getDateKey,
  loadSettings,
  loadReaders,
  loadActiveSurvey,
  submitSurveyVote,
  loadAnnouncements,
  loadTasks,
  loadTaskSubmissions,
  submitUserTask,
  loadMotivationalMessage,
  DEFAULT_MOTIVATIONAL_MSG,
} from '../services/storageService';
import {
  getReaderWirdDetails,
  normalizeJuz,
  getFormattedArabicDate,
  getFormattedHijriDate,
} from '../utils/wirdCalculator';
import SyncStatusBadge from '../components/SyncStatusBadge';
import UserSettingsModal from '../components/UserSettingsModal';
import { subscribeSyncStatus } from '../services/syncService';

export default function UserWirdScreen({ currentUser: initialUser, onLogout, onUserUpdated }) {
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('pending'); // 'read' | 'pending' | 'excused'
  const [statusTimestamp, setStatusTimestamp] = useState(null);
  const [juzCount, setJuzCount] = useState(1);
  const [groupReaders, setGroupReaders] = useState([]);
  const [groupStatuses, setGroupStatuses] = useState({});
  const [showTomorrow, setShowTomorrow] = useState(false);

  // حالة التكاليف والمهام اليومية
  const [tasks, setTasks] = useState([]);
  const [taskSubmissions, setTaskSubmissions] = useState({});
  const [excuseModalTask, setExcuseModalTask] = useState(null);
  const [excuseReasonInput, setExcuseReasonInput] = useState('');

  // رسالة التحفيز والتهنئة عند إتمام الورد (المخصصة من المدير)
  const [motivationalMessage, setMotivationalMessage] = useState(DEFAULT_MOTIVATIONAL_MSG);
  const [isMotivationalModalVisible, setIsMotivationalModalVisible] = useState(false);

  // حالة الاستبيان والإعلانات
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [mySurveyVote, setMySurveyVote] = useState(null); // 'yes' | 'no' | null
  const [announcements, setAnnouncements] = useState([]);

  const todayKey = getDateKey(0);
  const todayArabicDate = getFormattedArabicDate(0);
  const todayHijriDate = getFormattedHijriDate(0);

  // حساب تفاصيل الورد لليوم والغد للقارئ الحالي
  const readerJuz = currentUser?.currentJuz || 1;
  const todayWird = getReaderWirdDetails(readerJuz, juzCount);
  const tomorrowStartJuz = normalizeJuz(readerJuz + juzCount);
  const tomorrowWird = getReaderWirdDetails(tomorrowStartJuz, juzCount);

  // نسبة التقدم في الختمة
  const progressPercent = Math.min(100, Math.round((readerJuz / 30) * 100));

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSyncStatus((status) => {
      if (status.hasRemoteUpdates) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    const settings = await loadSettings();
    setJuzCount(settings.juzCount || 1);

    const readers = await loadReaders();
    setGroupReaders(readers);

    const statuses = await loadDailyStatuses(todayKey);
    setGroupStatuses(statuses);

    if (statuses[currentUser?.readerId]) {
      setCurrentStatus(statuses[currentUser.readerId].status);
      setStatusTimestamp(statuses[currentUser.readerId].timestamp);
    }

    // تحميل الاستبيان النشط وتصويت القارئ
    const survey = await loadActiveSurvey();
    setActiveSurvey(survey);
    if (survey?.votes?.[currentUser?.readerId]) {
      setMySurveyVote(survey.votes[currentUser.readerId].vote);
    }

    // تحميل الإعلانات
    const anns = await loadAnnouncements();
    setAnnouncements(anns);

    // تحميل التكاليف والمهام اليومية وسجل الاستجابة
    const allTasks = await loadTasks();
    setTasks(allTasks.filter((t) => t.isActive));
    const submissions = await loadTaskSubmissions(todayKey);
    setTaskSubmissions(submissions);

    // تحميل الرسالة التحفيزية المخصصة من المدير
    const msg = await loadMotivationalMessage();
    setMotivationalMessage(msg);
  };

  // تسجيل إنجاز تكليف (أديتها ✅ أو اعتذر ✋)
  const handleTaskAction = async (taskId, status, excuseReason = '') => {
    const updated = await submitUserTask(
      todayKey,
      taskId,
      currentUser?.readerId,
      status,
      excuseReason
    );
    if (updated) {
      setTaskSubmissions(updated);

      // إذا كان التكليف يخص الورد القرآني، نحدث أيضاً حالة البطاقة العلوية ونظهر الإشعار التحفيزي
      if (taskId === 'task_quran') {
        const mappedStatus = status === 'completed' ? 'read' : 'excused';
        setCurrentStatus(mappedStatus);
        setStatusTimestamp(new Date().toISOString());

        if (status === 'completed') {
          setIsMotivationalModalVisible(true);
          return;
        }
      }

      if (status === 'completed') {
        Alert.alert('تقبّل الله طاعتكم 🌟', 'تم توثيق إنجاز المهمة بنجاح، بارك الله في أوقاتكم.');
      } else {
        Alert.alert('تقبّل الله عذركم 🤲', 'تم تسجيل اعتذاركم لليوم، نسأل الله أن ييسر أمركم.');
      }
    }
  };

  // التصويت في الاستبيان
  const handleVoteSurvey = async (vote) => {
    if (!activeSurvey) return;
    const updated = await submitSurveyVote(activeSurvey.id, currentUser?.readerId, vote);
    if (updated) {
      setMySurveyVote(vote);
      setActiveSurvey(updated);
      Alert.alert(
        'تم تسجيل إجابتك بنجاح ✅',
        `أجبت بـ (${vote === 'yes' ? 'نعم' : 'لا'})، شكراً لمشاركتك المباركة في الاستبيان.`
      );
    }
  };

  const handleSelectStatus = async (newStatus) => {
    const updated = await updateReaderDailyStatus(todayKey, currentUser?.readerId, newStatus);
    if (updated) {
      setCurrentStatus(newStatus);
      setStatusTimestamp(new Date().toISOString());
      setGroupStatuses(updated);

      if (newStatus === 'read') {
        // إظهار الرسالة التحفيزية المخصصة من المدير
        setIsMotivationalModalVisible(true);
      } else if (newStatus === 'excused') {
        Alert.alert('تقبّل الله عذركم 🤲', 'تم تسجيل اعتذارك عن قراءة الورد لليوم، نسأل الله أن ييسر أمرك.');
      }
    }
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" translucent={false} />

      {/* الرأس الفاخر */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTopLeft}>
            <TouchableOpacity
              style={styles.settingsUserBtn}
              onPress={() => setIsSettingsVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.settingsUserBtnText}>⚙️ إعداداتي</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
              <Text style={styles.logoutText}>🚪 خروج</Text>
            </TouchableOpacity>
            <SyncStatusBadge compact />
          </View>

          <View style={styles.userBadgeGroup}>
            <View style={styles.userBadgeRow}>
              <View style={styles.logoCircleUser}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImgUser}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.userTextCol}>
                <Text style={styles.appTitleUser}>زاد الأنصاري • « مشورة إب »</Text>
                <Text style={styles.userNameText}>{currentUser?.readerName || 'القارئ المبارك'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* شريط التاريخ */}
        <View style={styles.dateBar}>
          <Text style={styles.dateText}>
            📅 {todayArabicDate} م {todayHijriDate ? `• ${todayHijriDate}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* شريط الإعلانات والتنبيهات الصادرة من الإدارة */}
        {announcements
          .filter((ann) => {
            if (!ann.targetUserIds || !Array.isArray(ann.targetUserIds)) return true;
            const myId = String(currentUser?.readerId || currentUser?.id || '');
            return ann.targetUserIds.map(String).includes(myId);
          })
          .slice(0, 2)
          .map((ann) => (
            <View
              key={ann.id}
              style={[
                styles.announcementBanner,
                ann.isReminder && styles.announcementReminderBanner,
              ]}
            >
              <View style={styles.announcementHeader}>
                <Text
                  style={[
                    styles.announcementTag,
                    ann.isReminder && styles.announcementReminderTag,
                  ]}
                >
                  {ann.isReminder ? '⏰ تذكير خاص بالورد' : '📢 تنبيه من الإدارة'}
                </Text>
                <Text style={styles.announcementTitle}>{ann.title}</Text>
              </View>
              <Text style={styles.announcementMessage}>{ann.message}</Text>
            </View>
          ))}

        {/* بطاقة الاستبيان التفاعلي من الإدارة (نعم / لا) */}
        {activeSurvey && (
          <View style={styles.surveyCard}>
            <View style={styles.surveyCardHeader}>
              <View style={styles.surveyPill}>
                <Text style={styles.surveyPillText}>📋 استبيان المجموعة</Text>
              </View>
              <Text style={styles.surveyQuestion}>« {activeSurvey.question} »</Text>
            </View>

            <Text style={styles.surveyPromptText}>يرجى تحديد إجابتك (نعم / لا):</Text>

            <View style={styles.surveyButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.surveyVoteBtn,
                  styles.voteYesBtn,
                  mySurveyVote === 'yes' && styles.voteYesBtnActive,
                ]}
                onPress={() => handleVoteSurvey('yes')}
                activeOpacity={0.8}
              >
                <Text style={[styles.voteBtnText, mySurveyVote === 'yes' && styles.voteTextActive]}>
                  {mySurveyVote === 'yes' ? '✅ تم التصويت: نعم' : 'نعم ✅'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.surveyVoteBtn,
                  styles.voteNoBtn,
                  mySurveyVote === 'no' && styles.voteNoBtnActive,
                ]}
                onPress={() => handleVoteSurvey('no')}
                activeOpacity={0.8}
              >
                <Text style={[styles.voteBtnText, mySurveyVote === 'no' && styles.voteTextActive]}>
                  {mySurveyVote === 'no' ? '❌ تم التصويت: لا' : 'لا ❌'}
                </Text>
              </TouchableOpacity>
            </View>

            {mySurveyVote && (
              <View style={styles.votedStatusNote}>
                <Text style={styles.votedStatusText}>
                  ✨ تم تسجيل إجابتك بـ ({mySurveyVote === 'yes' ? 'نعم' : 'لا'})، شكراً لمشاركتك.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* بطاقة الورد اليومي المخصص */}
        <View style={styles.wirdCard}>
          <View style={styles.wirdCardTop}>
            <View style={styles.juzPill}>
              <Text style={styles.juzPillText}>{todayWird.juzText}</Text>
            </View>
            <Text style={styles.wirdCardTitle}>📖 وردك القرآني لليوم</Text>
          </View>

          {todayWird.surahs ? (
            <View style={styles.surahBanner}>
              <Text style={styles.surahBannerText}>سورة: {todayWird.surahs}</Text>
            </View>
          ) : null}

          {/* نطاق الصفحات والعدد */}
          <View style={styles.pagesGrid}>
            <View style={styles.pageBox}>
              <Text style={styles.pageBoxLabel}>من صفحة</Text>
              <Text style={styles.pageBoxNumber}>{todayWird.startPage}</Text>
            </View>

            <View style={styles.pageArrowBox}>
              <Text style={styles.pageArrowText}>⬅️</Text>
              <Text style={styles.pagesCountLabel}>{todayWird.pagesCount} صفحة</Text>
            </View>

            <View style={styles.pageBox}>
              <Text style={styles.pageBoxLabel}>إلى صفحة</Text>
              <Text style={styles.pageBoxNumber}>{todayWird.endPage}</Text>
            </View>
          </View>

          {/* شريط مسار الختمة */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>مسار الختمة المباركة:</Text>
              <Text style={styles.progressText}>
                الجزء {readerJuz} من 30 ({progressPercent}%)
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* قسم تسجيل حالة القراءة لليوم (المطلوب تحديداً) */}
        <View style={styles.statusSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>تسجيل إنجاز الورد لليوم:</Text>
            <Text style={styles.sectionSubtitle}>
              حدد حالتك لتحديث السجل والمساهمة في متابعة الختمة الجماعية
            </Text>
          </View>

          {/* الخيار 1: قرأت الورد */}
          <TouchableOpacity
            style={[styles.statusCard, styles.readCard, currentStatus === 'read' && styles.readCardActive]}
            onPress={() => handleSelectStatus('read')}
            activeOpacity={0.8}
          >
            <View style={styles.statusIconCircleRead}>
              <Text style={styles.statusIcon}>✅</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitleRead}>قرأت الورد</Text>
              <Text style={styles.statusDesc}>الحمد لله، أتممت قراءة ورد اليوم بالكامل.</Text>
            </View>
            <View style={[styles.radioCircle, currentStatus === 'read' && styles.radioActiveGreen]}>
              {currentStatus === 'read' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          {/* الخيار 2: لم أقرأ بعد */}
          <TouchableOpacity
            style={[
              styles.statusCard,
              styles.pendingCard,
              currentStatus === 'pending' && styles.pendingCardActive,
            ]}
            onPress={() => handleSelectStatus('pending')}
            activeOpacity={0.8}
          >
            <View style={styles.statusIconCirclePending}>
              <Text style={styles.statusIcon}>⏳</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitlePending}>لم أقرأ بعد</Text>
              <Text style={styles.statusDesc}>قيد المتابعة، سأقرأه خلال اليوم إن شاء الله.</Text>
            </View>
            <View style={[styles.radioCircle, currentStatus === 'pending' && styles.radioActiveAmber]}>
              {currentStatus === 'pending' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          {/* الخيار 3: أعتذر عن القراءة اليوم */}
          <TouchableOpacity
            style={[
              styles.statusCard,
              styles.excusedCard,
              currentStatus === 'excused' && styles.excusedCardActive,
            ]}
            onPress={() => handleSelectStatus('excused')}
            activeOpacity={0.8}
          >
            <View style={styles.statusIconCircleExcused}>
              <Text style={styles.statusIcon}>✋</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitleExcused}>أعتذر عن القراءة اليوم</Text>
              <Text style={styles.statusDesc}>لظرف طارئ، أعتذر عن قراءة وردي لهذا اليوم.</Text>
            </View>
            <View style={[styles.radioCircle, currentStatus === 'excused' && styles.radioActiveRed]}>
              {currentStatus === 'excused' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          {/* وقت آخر تسجيل */}
          {statusTimestamp && (
            <View style={styles.statusTimeBanner}>
              <Text style={styles.statusTimeText}>
                🕒 آخر تحديث لحالتك: {formatTimestamp(statusTimestamp)}
              </Text>
            </View>
          )}
        </View>

        {/* قسم التكاليف والمهام اليومية (القرآن والأذكار والأنشطة العامة) */}
        <View style={styles.tasksSection}>
          <View style={styles.tasksSectionHeader}>
            <View style={styles.tasksBadge}>
              <Text style={styles.tasksBadgeText}>📋 التكاليف والأنشطة اليومية</Text>
            </View>
            <Text style={styles.tasksSubtitle}>
              سجّل إنجازك اليومي في الأذكار والأوراد والأنشطة المقررة:
            </Text>
          </View>

          {tasks.map((task) => {
            const userSub = taskSubmissions[task.id]?.[currentUser?.readerId];
            const isCompleted = userSub?.status === 'completed';
            const isExcused = userSub?.status === 'excused';

            return (
              <View
                key={task.id}
                style={[
                  styles.taskCard,
                  isCompleted && styles.taskCardCompleted,
                  isExcused && styles.taskCardExcused,
                ]}
              >
                <View style={styles.taskCardHeader}>
                  <View style={styles.taskBadgeCategory}>
                    <Text style={styles.taskCategoryText}>
                      {task.category === 'QURAN'
                        ? '📖 قرآن'
                        : task.category === 'ADHKAR'
                        ? '📿 أذكار وعبادة'
                        : '⭐ نشاط عام'}
                    </Text>
                  </View>
                  <View style={styles.taskTitleRow}>
                    <Text style={styles.taskIcon}>{task.icon || '⭐'}</Text>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                  </View>
                </View>

                {task.description ? (
                  <Text style={styles.taskDescription}>{task.description}</Text>
                ) : null}

                <View style={styles.taskMetaRow}>
                  <Text style={styles.taskMetaText}>
                    🎯 المقدار المطلوب: <Text style={styles.taskMetaBold}>{task.targetCount} {task.unit}</Text>
                  </Text>
                  <Text style={styles.taskMetaText}>
                    ⏰ الاستحقاق: <Text style={styles.taskMetaBold}>{task.dueTime || '23:59'}</Text>
                  </Text>
                </View>

                {/* حالة إنجاز المستخدم وأزرار التفاعل */}
                <View style={styles.taskActionsContainer}>
                  {isCompleted ? (
                    <View style={styles.taskCompletedBanner}>
                      <Text style={styles.taskCompletedBannerText}>
                        ✅ أديتها بارك الله فيك
                      </Text>
                      {userSub?.timestamp && (
                        <Text style={styles.taskTimeSubText}>
                          {formatTimestamp(userSub.timestamp)}
                        </Text>
                      )}
                    </View>
                  ) : isExcused ? (
                    <View style={styles.taskExcusedBanner}>
                      <Text style={styles.taskExcusedBannerText}>
                        ✋ اعتذرت عن أداء المهمة لليوم
                      </Text>
                      {userSub?.excuseReason ? (
                        <Text style={styles.excuseReasonText}>« {userSub.excuseReason} »</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* أزرار الإجراء: أديتها ✅ / اعتذر ✋ */}
                  <View style={styles.taskButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.taskBtn,
                        styles.taskCompleteBtn,
                        isCompleted && styles.taskBtnActiveCompleted,
                      ]}
                      onPress={() => handleTaskAction(task.id, 'completed')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.taskBtnText,
                          isCompleted && styles.taskBtnTextActiveCompleted,
                        ]}
                      >
                        {isCompleted ? 'أديتها بنجاح ✅' : 'أديتها ✅'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.taskBtn,
                        styles.taskExcuseBtn,
                        isExcused && styles.taskBtnActiveExcused,
                      ]}
                      onPress={() => {
                        setExcuseModalTask(task);
                        setExcuseReasonInput('');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.taskBtnText,
                          isExcused && styles.taskBtnTextActiveExcused,
                        ]}
                      >
                        {isExcused ? 'معتذر ✋' : 'اعتذر ✋'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* زر معاينة ورد الغد */}
        <TouchableOpacity
          style={styles.tomorrowToggleBtn}
          onPress={() => setShowTomorrow(!showTomorrow)}
          activeOpacity={0.8}
        >
          <Text style={styles.tomorrowToggleText}>
            {showTomorrow ? 'إخفاء ورد الغد 🔼' : 'معاينة ورد الغد ⏩'}
          </Text>
        </TouchableOpacity>

        {showTomorrow && (
          <View style={styles.tomorrowCard}>
            <Text style={styles.tomorrowTitle}>وردك للغد بإذن الله:</Text>
            <Text style={styles.tomorrowJuz}>
              {tomorrowWird.juzText} • من صـ {tomorrowWird.startPage} إلى صـ {tomorrowWird.endPage}
            </Text>
            {tomorrowWird.surahs ? (
              <Text style={styles.tomorrowSurah}>({tomorrowWird.surahs})</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* نافذة تسجيل سبب الاعتذار الاختياري */}
      <Modal visible={Boolean(excuseModalTask)} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <View style={styles.excuseModalCard}>
            <View style={styles.excuseModalIcon}>
              <Text style={styles.excuseIconText}>✋</Text>
            </View>
            <Text style={styles.excuseModalTitle}>
              تقديم اعتذار عن: {excuseModalTask?.title}
            </Text>
            <Text style={styles.excuseModalDesc}>
              نقدّر ظروفكم، نسأل الله أن ييسر أمركم. يمكنك كتابة سبب الاعتذار (اختياري) أو المتابعة مباشرة:
            </Text>

            <TextInput
              style={styles.excuseInput}
              placeholder="اكتب سبب الاعتذار (اختياري)..."
              placeholderTextColor="#94A3B8"
              value={excuseReasonInput}
              onChangeText={setExcuseReasonInput}
              textAlign="right"
              multiline
            />

            <TouchableOpacity
              style={styles.confirmExcuseBtn}
              onPress={() => {
                if (excuseModalTask) {
                  handleTaskAction(excuseModalTask.id, 'excused', excuseReasonInput);
                  setExcuseModalTask(null);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmExcuseBtnText}>تأكيد تسجيل الاعتذار ✋</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelExcuseBtn}
              onPress={() => setExcuseModalTask(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelExcuseBtnText}>تراجع</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* إشعار تحفيزي فاخر داخل التطبيق عند إتمام قراءة الورد اليومي */}
      <Modal visible={isMotivationalModalVisible} transparent animationType="fade">
        <View style={styles.motivationalOverlay}>
          <View style={styles.motivationalCard}>
            <View style={styles.motivationalIconCircle}>
              <Text style={styles.motivationalIconEmoji}>📖</Text>
              <Text style={styles.motivationalStarEmoji}>✨</Text>
            </View>

            <Text style={styles.motivationalBismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            <Text style={styles.motivationalTitle}>🎉 مبارك إتمام الورد اليومي 🎉</Text>
            <Text style={styles.motivationalReaderName}>
              أيها القارئ المبارك / {currentUser?.readerName || currentUser?.name || 'محب القرآن'}
            </Text>

            {/* صندوق الرسالة التحفيزية المخصصة والقابلة للتغيير من المدير */}
            <View style={styles.motivationalQuoteBox}>
              <Text style={styles.motivationalQuoteMark}>❝</Text>
              <Text style={styles.motivationalQuoteText}>
                {motivationalMessage}
              </Text>
              <Text style={styles.motivationalQuoteMarkLeft}>❞</Text>
            </View>

            <Text style={styles.motivationalFooterNote}>
              نسأل الله تعالى أن يجعله شاهداً لك وشفيعاً يوم القيامة، وأن يجعل القرآن العظيم ربيع قلبك ونور صدرك.
            </Text>

            <TouchableOpacity
              style={styles.motivationalDismissBtn}
              onPress={() => setIsMotivationalModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.motivationalDismissBtnText}>🤲 آمين • تقبّل الله طاعتكم</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* نافذة تعديل بيانات المستخدم وكلمة المرور */}
      <UserSettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => {
          setCurrentUser(updated);
          if (onUserUpdated) {
            onUserUpdated(updated);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B',
  },
  header: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 28) : 10,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTopLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  tasksSection: {
    marginTop: 18,
    marginBottom: 8,
  },
  tasksSectionHeader: {
    marginBottom: 10,
  },
  tasksBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 12,
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  tasksBadgeText: {
    color: '#92400E',
    fontWeight: '900',
    fontSize: 12.5,
  },
  tasksSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  taskCardCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  taskCardExcused: {
    borderColor: '#FB7185',
    backgroundColor: '#FFF1F2',
  },
  taskCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  taskIcon: {
    fontSize: 22,
  },
  taskTitle: {
    fontSize: 14.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  taskBadgeCategory: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  taskCategoryText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  taskDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 10,
    lineHeight: 18,
  },
  taskMetaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  taskMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  taskMetaBold: {
    fontWeight: 'bold',
    color: '#0F172A',
  },
  taskActionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  taskCompletedBanner: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskCompletedBannerText: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  taskTimeSubText: {
    color: '#166534',
    fontSize: 10.5,
    fontWeight: '600',
  },
  taskExcusedBanner: {
    backgroundColor: '#FFE4E6',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  taskExcusedBannerText: {
    color: '#BE123C',
    fontSize: 11.5,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  excuseReasonText: {
    color: '#881337',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 2,
  },
  taskButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  taskBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCompleteBtn: {
    backgroundColor: '#059669',
  },
  taskBtnActiveCompleted: {
    backgroundColor: '#10B981',
  },
  taskExcuseBtn: {
    backgroundColor: '#E2E8F0',
  },
  taskBtnActiveExcused: {
    backgroundColor: '#FDA4AF',
  },
  taskBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12.5,
  },
  taskBtnTextActiveCompleted: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  taskBtnTextActiveExcused: {
    color: '#9F1239',
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  excuseModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  excuseModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  excuseIconText: {
    fontSize: 24,
  },
  excuseModalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  excuseModalDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  excuseInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  confirmExcuseBtn: {
    width: '100%',
    backgroundColor: '#E11D48',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmExcuseBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  cancelExcuseBtn: {
    paddingVertical: 6,
  },
  cancelExcuseBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  userBadgeGroup: {
    alignItems: 'flex-end',
  },
  userBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  logoCircleUser: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImgUser: {
    width: 34,
    height: 34,
  },
  userTextCol: {
    alignItems: 'flex-end',
  },
  appTitleUser: {
    fontSize: 11,
    color: '#6EE7B7',
    fontWeight: 'bold',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 1,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  settingsUserBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.6)',
  },
  settingsUserBtnText: {
    color: '#FDE68A',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  dateBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignSelf: 'center',
  },
  dateText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    paddingBottom: 40,
  },
  announcementBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  announcementReminderBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
    borderWidth: 2,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  announcementHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  announcementTag: {
    backgroundColor: '#D97706',
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  announcementReminderTag: {
    backgroundColor: '#B45309',
  },
  announcementTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'right',
  },
  announcementMessage: {
    fontSize: 12,
    color: '#78350F',
    textAlign: 'right',
    lineHeight: 18,
  },
  surveyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#059669',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  surveyCardHeader: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  surveyPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  surveyPillText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: 'bold',
  },
  surveyQuestion: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    lineHeight: 22,
  },
  surveyPromptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 10,
  },
  surveyButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  surveyVoteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  voteYesBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  voteYesBtnActive: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  voteNoBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  voteNoBtnActive: {
    backgroundColor: '#E11D48',
    borderColor: '#BE123C',
  },
  voteBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  voteTextActive: {
    color: '#FFFFFF',
  },
  votedStatusNote: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  votedStatusText: {
    fontSize: 11.5,
    color: '#065F46',
    fontWeight: '600',
  },
  wirdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRightWidth: 5,
    borderRightColor: '#059669',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 18,
  },
  wirdCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wirdCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#064E3B',
  },
  juzPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  juzPillText: {
    color: '#065F46',
    fontWeight: 'bold',
    fontSize: 14,
  },
  surahBanner: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  surahBannerText: {
    textAlign: 'right',
    color: '#D97706',
    fontWeight: '600',
    fontSize: 13,
  },
  pagesGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 16,
  },
  pageBox: {
    alignItems: 'center',
    flex: 1,
  },
  pageBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  pageBoxNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#065F46',
  },
  pageArrowBox: {
    alignItems: 'center',
    flex: 1,
  },
  pageArrowText: {
    fontSize: 18,
  },
  pagesCountLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065F46',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 4,
  },
  statusSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'right',
  },
  statusCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  readCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  readCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
  },
  pendingCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pendingCardActive: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
  },
  excusedCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  excusedCardActive: {
    borderColor: '#E11D48',
    backgroundColor: '#FFE4E6',
    borderWidth: 2,
  },
  statusIconCircleRead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconCirclePending: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconCircleExcused: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 18,
  },
  statusInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusTitleRead: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#15803D',
  },
  statusTitlePending: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#B45309',
  },
  statusTitleExcused: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#BE123C',
  },
  statusDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    textAlign: 'right',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActiveGreen: {
    borderColor: '#16A34A',
  },
  radioActiveAmber: {
    borderColor: '#D97706',
  },
  radioActiveRed: {
    borderColor: '#E11D48',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#059669',
  },
  statusTimeBanner: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  statusTimeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tomorrowToggleBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  tomorrowToggleText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  tomorrowCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  tomorrowTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 4,
  },
  tomorrowJuz: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  tomorrowSurah: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 2,
  },
  groupOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupOverviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#064E3B',
    marginBottom: 12,
    textAlign: 'right',
  },
  groupList: {
    gap: 8,
  },
  groupRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  groupRowMe: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  groupRowInfo: {
    alignItems: 'flex-end',
  },
  groupRowName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  groupRowNameMe: {
    color: '#065F46',
  },
  groupRowJuz: {
    fontSize: 11,
    color: '#64748B',
  },
  groupRowStatus: {},
  badgeRead: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeReadText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgeExcused: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeExcusedText: {
    color: '#BE123C',
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePendingText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: 'bold',
  },
  motivationalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  motivationalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#D4AF37', // ذهبي إسلامي
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  motivationalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  motivationalIconEmoji: {
    fontSize: 32,
  },
  motivationalStarEmoji: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 14,
  },
  motivationalBismillah: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  motivationalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#064E3B',
    marginBottom: 4,
    textAlign: 'center',
  },
  motivationalReaderName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D97706',
    marginBottom: 14,
  },
  motivationalQuoteBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  motivationalQuoteMark: {
    color: '#059669',
    fontSize: 22,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: -8,
  },
  motivationalQuoteText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#064E3B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  motivationalQuoteMarkLeft: {
    color: '#059669',
    fontSize: 22,
    fontWeight: 'bold',
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  motivationalFooterNote: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  motivationalDismissBtn: {
    width: '100%',
    backgroundColor: '#065F46',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  motivationalDismissBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
