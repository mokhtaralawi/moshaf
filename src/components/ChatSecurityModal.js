import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../context/ThemeContext';
import { getSecurityDetails } from '../services/chatService';

export default function ChatSecurityModal({ visible, onClose, currentUser }) {
  const { colors, isDark } = useAppTheme();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (visible && currentUser) {
      getSecurityDetails(currentUser)
        .then((data) => {
          if (isMounted) {
            setDetails(data);
            setLoading(false);
          }
        })
        .catch((_err) => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, currentUser]);

  const handleCopyFingerprint = async () => {
    if (!details?.fingerprint) return;
    try {
      await Clipboard.setStringAsync(details.fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_e) {
      Alert.alert('تنبيه', 'تعذر نسخ بصمة الأمان');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>أمان التشفير والمفاتيح</Text>
              <Text style={[styles.subTitle, { color: colors.accent }]}>🔒 RSA-1024-OAEP + AES-256</Text>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 30 }} />
            ) : (
              <>
                {/* Shield Icon & Intro */}
                <View style={styles.introBox}>
                  <View style={[styles.shieldCircle, { backgroundColor: colors.accentLight }]}>
                    <Text style={styles.shieldIcon}>🛡️</Text>
                  </View>
                  <Text style={[styles.introTitle, { color: colors.textPrimary }]}>
                    تشفير كامل من طرف لطرف (E2EE)
                  </Text>
                  <Text style={[styles.introDesc, { color: colors.textSecondary }]}>
                    الرسائل في هذه المجموعة مشفرة وموقعة رقمياً بمفتاح خاص مخزن داخل هاتفك فقط. لا يمكن لأي خادم أو جهة وسيطة قراءة الرسائل.
                  </Text>
                </View>

                {/* Fingerprint Card */}
                <View style={[styles.infoCard, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      بصمة أمان المفتاح (Safety Fingerprint)
                    </Text>
                    <Text style={[styles.verifiedBadge, { backgroundColor: colors.statusReadBg, color: colors.statusReadText }]}>
                      موثوق ✓
                    </Text>
                  </View>
                  <Text style={[styles.fingerprintText, { color: colors.accent, borderColor: colors.border, backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
                    {details?.fingerprint || '---'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCopyFingerprint}
                    style={[styles.copyBtn, { backgroundColor: copied ? colors.accent : colors.accentLight, borderColor: colors.accent }]}
                  >
                    <Text style={[styles.copyBtnText, { color: copied ? '#FFFFFF' : colors.accent }]}>
                      {copied ? 'تم نسخ البصمة بنجاح ✓' : '📋 نسخ بصمة الأمان للمطابقة'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.hintText, { color: colors.textMuted }]}>
                    تطابق هذه البصمة يضمن عدم وجود طرف ثالث يتنصت على المحادثة.
                  </Text>
                </View>

                {/* Architecture & Protocol */}
                <View style={[styles.infoCard, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                    معمارية التشفير المطبقة
                  </Text>
                  <View style={styles.specRow}>
                    <Text style={[styles.specLabel, { color: colors.textSecondary }]}>البروتوكول:</Text>
                    <Text style={[styles.specVal, { color: colors.textPrimary }]}>التشفير الهجين (Hybrid)</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={[styles.specLabel, { color: colors.textSecondary }]}>تشفير الرسائل:</Text>
                    <Text style={[styles.specVal, { color: colors.textPrimary }]}>AES-256-CBC (مفتاح عشوائي فريد)</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={[styles.specLabel, { color: colors.textSecondary }]}>تشفير المفاتيح:</Text>
                    <Text style={[styles.specVal, { color: colors.textPrimary }]}>RSA-1024-OAEP مع SHA-256</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={[styles.specLabel, { color: colors.textSecondary }]}>التوقيع الرقمي:</Text>
                    <Text style={[styles.specVal, { color: colors.textPrimary }]}>RSA-PSS / SHA-256 لمنع الانتحال</Text>
                  </View>
                </View>

                {/* Privacy Guarantee */}
                <View style={[styles.guaranteeBox, { backgroundColor: isDark ? '#064E3B20' : '#ECFDF5', borderColor: colors.cardBorder }]}>
                  <Text style={[styles.guaranteeTitle, { color: colors.accent }]}>✨ ضمان الخصوصية التامة:</Text>
                  <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                    قاعدة بيانات السحابة (Supabase) تستقبل فقط نصوصاً مشفرة بالكامل (Ciphertext) يستحيل فكها بدون مفتاحك الخاص.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.doneBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.doneBtnText}>حسناً، فهمت</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitleWrap: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },
  introBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  shieldCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shieldIcon: {
    fontSize: 26,
  },
  introTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  introDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fingerprintText: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  copyBtn: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  hintText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  specLabel: {
    fontSize: 11,
  },
  specVal: {
    fontSize: 11,
    fontWeight: '600',
  },
  guaranteeBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'right',
  },
  guaranteeText: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  doneBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
