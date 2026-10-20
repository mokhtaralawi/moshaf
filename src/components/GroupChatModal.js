import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import {
  loadChatMessages,
  sendGroupMessage,
  subscribeChatMessages,
  setChatActiveState,
  loadChatGroups,
  createOrUpdateChatGroup,
  deleteChatGroup,
  subscribeGroups,
  DEFAULT_MAIN_GROUP,
} from '../services/chatService';
import ChatSecurityModal from './ChatSecurityModal';
import CreateGroupModal from './CreateGroupModal';

export default function GroupChatModal({ visible, onClose, currentUser }) {
  const { colors, isDark } = useAppTheme();
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([DEFAULT_MAIN_GROUP]);
  const [activeGroup, setActiveGroup] = useState(DEFAULT_MAIN_GROUP);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isGroupPickerVisible, setIsGroupPickerVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);

  const flatListRef = useRef(null);
  const isAdmin = currentUser?.role === 'admin';
  const currentUserId = String(currentUser?.id || currentUser?.readerId || currentUser?.username || '');

  // 1. تحميل المجموعات والرسائل عند فتح الشاشة
  useEffect(() => {
    let unsubscribeMsgs = null;
    let unsubscribeGrp = null;

    if (visible && currentUser) {
      setChatActiveState(true);

      // تحميل المجموعات
      loadChatGroups(currentUser).then((grps) => {
        setGroups(grps);
        if (grps.length > 0 && !activeGroup) {
          setActiveGroup(grps[0]);
        }
      });

      // تحميل الرسائل للمجموعة الحالية
      loadChatMessages(currentUser, activeGroup?.id || 'group_main').then((msgs) => {
        setMessages(msgs);
        setLoading(false);
      });

      unsubscribeMsgs = subscribeChatMessages((newMsgs) => {
        setMessages(newMsgs);
      });

      unsubscribeGrp = subscribeGroups((updatedGroups) => {
        setGroups(updatedGroups);
      });
    }

    return () => {
      if (visible) {
        setChatActiveState(false);
      }
      if (unsubscribeMsgs) unsubscribeMsgs();
      if (unsubscribeGrp) unsubscribeGrp();
    };
  }, [visible, currentUser, activeGroup]);

  // 2. مستمع لوحة المفاتيح للتمرير التلقائي لأسفل عند ظهور الكيبورد لمنع تغطية حقل الإدخال
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => sub.remove();
  }, []);

  const handleSwitchGroup = (group) => {
    setActiveGroup(group);
    setIsGroupPickerVisible(false);
    setLoading(true);
    loadChatMessages(currentUser, group.id).then((msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
  };

  const handleGroupSaved = async (groupData) => {
    await createOrUpdateChatGroup(groupData, currentUser);
    setActiveGroup(groupData);
    const updated = await loadChatGroups(currentUser);
    setGroups(updated);
    Alert.alert('نجاح ✅', `تم حفظ مجموعة "${groupData.name}" بنجاح.`);
  };

  const handleDeleteGroup = (group) => {
    if (group.isDefault) {
      Alert.alert('تنبيه', 'لا يمكن حذف المجموعة العامة');
      return;
    }
    Alert.alert(
      'تأكيد الحذف ⚠️',
      `هل أنت متأكد من حذف مجموعة "${group.name}" نهائياً؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، حذف',
          style: 'destructive',
          onPress: async () => {
            await deleteChatGroup(group.id);
            setActiveGroup(DEFAULT_MAIN_GROUP);
            const grps = await loadChatGroups(currentUser);
            setGroups(grps);
          },
        },
      ]
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await sendGroupMessage({
        text: textToSend,
        currentUser,
        group: activeGroup,
      });

      if (!res.success) {
        Alert.alert('خطأ', res.error || 'تعذر تشفير وإرسال الرسالة');
        setInputText(textToSend);
      } else {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (_e) {
      Alert.alert('خطأ', 'حدث خطأ غير متوقع أثناء إرسال الرسالة');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch (_e) {
      return '';
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMine = String(item.senderId) === currentUserId;
    const isMsgAdmin = item.senderRole === 'admin';
    const isUndecryptable = item.isUndecryptable;

    return (
      <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.otherMessageRow]}>
        <View
          style={[
            styles.bubble,
            isMine
              ? [styles.myBubble, { backgroundColor: colors.accent }]
              : [
                  styles.otherBubble,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ],
          ]}
        >
          {/* Sender Header for other members */}
          {!isMine && (
            <View style={styles.senderHeader}>
              <Text style={[styles.senderName, { color: isMsgAdmin ? colors.gold : colors.accent }]}>
                {item.senderName || 'قارئ'}
              </Text>
              {isMsgAdmin && (
                <View style={[styles.adminBadge, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                  <Text style={[styles.adminBadgeText, { color: colors.gold }]}>👑 مشرف</Text>
                </View>
              )}
            </View>
          )}

          {/* Message Content */}
          <Text
            style={[
              styles.messageText,
              isMine
                ? styles.myMessageText
                : [
                    styles.otherMessageText,
                    { color: isUndecryptable ? colors.textMuted : colors.textPrimary },
                  ],
            ]}
          >
            {item.decryptedText || item.text || '🔒 [رسالة مشفرة]'}
          </Text>

          {/* Footer: Time + Lock Icon + Status */}
          <View style={styles.bubbleFooter}>
            <Text
              style={[
                styles.timeText,
                { color: isMine ? 'rgba(255, 255, 255, 0.75)' : colors.textMuted },
              ]}
            >
              {formatMessageTime(item.timestamp)}
            </Text>

            <View style={styles.securityMeta}>
              <Text style={styles.lockIcon} title="مشفرة من طرف لطرف">
                🔒
              </Text>
              {item.isVerified && (
                <Text style={styles.verifiedIcon} title="توقيع رقمي موثق">
                  ✓
                </Text>
              )}
              {isMine && (
                <Text style={[styles.checkmarks, { color: 'rgba(255, 255, 255, 0.9)' }]}>
                  ✓✓
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // معالجة تباعد الترويسة مع شريط الإشعارات والـ Notch
  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 28) : 12;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bgPage }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

        {/* 1. Header with exact status bar safe spacing */}
        <View style={[styles.header, { backgroundColor: colors.bgPrimary, paddingTop: statusBarOffset }]}>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={[styles.backText, { color: colors.textHeader }]}>✕</Text>
            </TouchableOpacity>

            {/* Group Selector button */}
            <TouchableOpacity
              onPress={() => setIsGroupPickerVisible(!isGroupPickerVisible)}
              style={styles.groupSelectorBtn}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarEmoji}>{activeGroup.isDefault ? '📖' : '👥'}</Text>
                <View style={[styles.onlineDot, { backgroundColor: colors.accent }]} />
              </View>

              <View style={styles.headerInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.groupTitle, { color: colors.textHeader }]} numberOfLines={1}>
                    {activeGroup.name}
                  </Text>
                  <Text style={{ color: colors.gold, fontSize: 12 }}>▼</Text>
                </View>
                <Text style={[styles.groupSub, { color: 'rgba(255, 255, 255, 0.7)' }]} numberOfLines={1}>
                  {activeGroup.memberIds?.length ? `${activeGroup.memberIds.length} عضواً` : 'جميع الأعضاء'} • 🔒 E2EE
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Action buttons on header left */}
          <View style={styles.headerActions}>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => {
                  setEditingGroup(null);
                  setCreateGroupModalVisible(true);
                }}
                style={styles.newGroupBtn}
                activeOpacity={0.7}
                title="إنشاء مجموعة جديدة"
              >
                <Text style={styles.newGroupBtnText}>➕ مجموعة</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setSecurityModalVisible(true)}
              style={styles.securityBtn}
              activeOpacity={0.7}
              title="فحص أمان التشفير"
            >
              <Text style={styles.securityBtnIcon}>🛡️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Group Selection Drawer / Dropdown if toggled */}
        {isGroupPickerVisible && (
          <View style={[styles.groupDropdown, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.groupDropdownHeader}>
              <Text style={[styles.groupDropdownTitle, { color: colors.textPrimary }]}>
                اختر مجموعة المحادثة ({groups.length})
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => {
                    setIsGroupPickerVisible(false);
                    setEditingGroup(null);
                    setCreateGroupModalVisible(true);
                  }}
                  style={[styles.smallAddBtn, { backgroundColor: colors.accentLight }]}
                >
                  <Text style={[styles.smallAddBtnText, { color: colors.accent }]}>➕ مجموعة جديدة</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => {
                const isSelected = item.id === activeGroup.id;
                return (
                  <View style={[styles.groupRowItem, isSelected && { backgroundColor: isDark ? '#064E3B30' : '#ECFDF5' }]}>
                    <TouchableOpacity
                      style={styles.groupSelectTouch}
                      onPress={() => handleSwitchGroup(item)}
                    >
                      <Text style={{ fontSize: 16 }}>{item.isDefault ? '📖' : '👥'}</Text>
                      <View style={{ flex: 1, alignItems: 'flex-end', marginHorizontal: 8 }}>
                        <Text style={[styles.groupItemName, { color: isSelected ? colors.accent : colors.textPrimary }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.groupItemSub, { color: colors.textSecondary }]}>
                          {item.isDefault ? 'مجموعة عامة للجميع' : `${item.memberIds?.length || 0} عضواً`}
                        </Text>
                      </View>
                      {isSelected && <Text style={{ color: colors.accent, fontWeight: 'bold' }}>✓</Text>}
                    </TouchableOpacity>

                    {/* Admin actions for custom group */}
                    {isAdmin && !item.isDefault && (
                      <View style={styles.groupItemActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setIsGroupPickerVisible(false);
                            setEditingGroup(item);
                            setCreateGroupModalVisible(true);
                          }}
                          style={styles.iconMiniBtn}
                        >
                          <Text style={{ fontSize: 13 }}>⚙️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteGroup(item)}
                          style={styles.iconMiniBtn}
                        >
                          <Text style={{ fontSize: 13 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* 3. Security Status Banner */}
        <View style={[styles.encryptionBanner, { backgroundColor: isDark ? '#04221A' : '#ECFDF5', borderBottomColor: colors.cardBorder }]}>
          <Text style={[styles.bannerText, { color: colors.accent }]}>
            🔐 رسائل «{activeGroup.name}» مشفرة بنظام RSA / AES بين أعضائها فقط
          </Text>
        </View>

        {/* 4. Keyboard Avoiding View wrapping messages and input to prevent overlap */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                جاري تهيئة مفاتيح التشفير وفك تشفير الرسائل...
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                مرحباً بك في {activeGroup.name}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                ابدأ المحادثة مع إخوانك؛ جميع الرسائل مشفرة من طرف لطرف ولا يمكن قراءتها من أي خادم.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* 5. Chat Input Bar */}
          <View style={[styles.inputBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder={`اكتب رسالة مشفرة لـ ${activeGroup.name}...`}
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                textAlign="right"
              />
              <Text style={styles.inputLockIcon}>🔒</Text>
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !inputText.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: inputText.trim() && !sending ? colors.accent : colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendIcon}>➤</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* 6. Security Details Modal */}
        <ChatSecurityModal
          visible={securityModalVisible}
          onClose={() => setSecurityModalVisible(false)}
          currentUser={currentUser}
        />

        {/* 7. Create/Edit Group Modal */}
        <CreateGroupModal
          visible={createGroupModalVisible}
          onClose={() => {
            setCreateGroupModalVisible(false);
            setEditingGroup(null);
          }}
          currentUser={currentUser}
          existingGroup={editingGroup}
          onGroupSaved={handleGroupSaved}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  backBtn: {
    padding: 8,
  },
  backText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  groupSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    maxWidth: 160,
  },
  groupSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newGroupBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  newGroupBtnText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: 'bold',
  },
  securityBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  securityBtnIcon: {
    fontSize: 16,
  },
  groupDropdown: {
    borderBottomWidth: 1.5,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  groupDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupDropdownTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  smallAddBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smallAddBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  groupRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  groupSelectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupItemName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  groupItemSub: {
    fontSize: 10,
  },
  groupItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  iconMiniBtn: {
    padding: 4,
  },
  encryptionBanner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatArea: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  myMessageRow: {
    justifyContent: 'flex-start',
  },
  otherMessageRow: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  myBubble: {
    borderTopLeftRadius: 4,
  },
  otherBubble: {
    borderTopRightRadius: 4,
    borderWidth: 1,
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  senderName: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  adminBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {},
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  timeText: {
    fontSize: 10,
  },
  securityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockIcon: {
    fontSize: 10,
  },
  verifiedIcon: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: 'bold',
  },
  checkmarks: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  inputLockIcon: {
    fontSize: 12,
    marginLeft: 6,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    transform: [{ rotate: '180deg' }],
  },
});
