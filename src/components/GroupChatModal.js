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
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import {
  loadChatMessages,
  sendGroupMessage,
  subscribeChatMessages,
  setChatActiveState,
} from '../services/chatService';
import ChatSecurityModal from './ChatSecurityModal';

export default function GroupChatModal({ visible, onClose, currentUser }) {
  const { colors, isDark } = useAppTheme();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const flatListRef = useRef(null);

  const currentUserId = String(currentUser?.id || currentUser?.readerId || currentUser?.username || '');

  useEffect(() => {
    let unsubscribe = null;

    if (visible && currentUser) {
      setChatActiveState(true);

      loadChatMessages(currentUser).then((msgs) => {
        setMessages(msgs);
        setLoading(false);
      });

      unsubscribe = subscribeChatMessages((newMsgs) => {
        setMessages(newMsgs);
      });
    }

    return () => {
      if (visible) {
        setChatActiveState(false);
      }
      if (unsubscribe) unsubscribe();
    };
  }, [visible, currentUser]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await sendGroupMessage({ text: textToSend, currentUser });
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
    const isAdmin = item.senderRole === 'admin';
    const isUndecryptable = item.isUndecryptable;

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
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
              <Text style={[styles.senderName, { color: isAdmin ? colors.gold : colors.accent }]}>
                {item.senderName || 'قارئ'}
              </Text>
              {isAdmin && (
                <View style={[styles.adminBadge, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                  <Text style={[styles.adminBadgeText, { color: colors.gold }]}>المشرف ⭐️</Text>
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPage }]}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={[styles.backText, { color: colors.textHeader }]}>✕</Text>
            </TouchableOpacity>

            <View style={styles.avatarWrap}>
              <Text style={styles.avatarEmoji}>📖</Text>
              <View style={[styles.onlineDot, { backgroundColor: colors.accent }]} />
            </View>

            <View style={styles.headerInfo}>
              <View style={styles.titleRow}>
                <Text style={[styles.groupTitle, { color: colors.textHeader }]}>
                  ملتقى أهل القرآن
                </Text>
                <View style={[styles.e2eeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={styles.e2eeBadgeText}>🔒 E2EE</Text>
                </View>
              </View>
              <Text style={[styles.groupSub, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                حلقة التلاوة • مشفرة بمفتاح RSA
              </Text>
            </View>
          </View>

          {/* Security details button */}
          <TouchableOpacity
            onPress={() => setSecurityModalVisible(true)}
            style={styles.securityBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.securityBtnIcon}>🛡️</Text>
          </TouchableOpacity>
        </View>

        {/* Security Banner */}
        <View style={[styles.encryptionBanner, { backgroundColor: isDark ? '#04221A' : '#ECFDF5', borderBottomColor: colors.cardBorder }]}>
          <Text style={[styles.bannerText, { color: colors.accent }]}>
            🔐 الرسائل مشفرة بنظام RSA-1024-OAEP و AES-256 من هاتف إلى هاتف
          </Text>
        </View>

        {/* Messages FlatList */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.chatArea}
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
                مرحباً بك في ملتقى الحلقة القرآني
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                ابدأ المحادثة مع إخوانك في الحلقة؛ جميع الرسائل مشفرة تماماً ولا يمكن لأي خادم قراءتها.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* Input Bar */}
          <View style={[styles.inputBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder="اكتب رسالة مشفرة..."
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

        {/* Security Details Modal */}
        <ChatSecurityModal
          visible={securityModalVisible}
          onClose={() => setSecurityModalVisible(false)}
          currentUser={currentUser}
        />
      </SafeAreaView>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    padding: 6,
  },
  backText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    gap: 6,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  e2eeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  e2eeBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: 'bold',
  },
  groupSub: {
    fontSize: 11,
    marginTop: 2,
  },
  securityBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  securityBtnIcon: {
    fontSize: 18,
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
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
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
    justifyContent: 'flex-start', // RTL: own messages on left or right as preferred
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
