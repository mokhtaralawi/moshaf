import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator, View } from 'react-native';
import { subscribeSyncStatus, processSyncQueue } from '../services/syncService';

export default function SyncStatusBadge({ compact = false }) {
  const [syncState, setSyncState] = useState({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  const handlePress = () => {
    const statusText = syncState.isOnline
      ? '🟢 متصل بالإنترنت'
      : '🔴 غير متصل بالإنترنت (وضع أوفلاين)';

    const syncInfo = syncState.lastSyncedAt
      ? new Date(syncState.lastSyncedAt).toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'لم تتم مزامنة سابقة';

    const message = `${statusText}\n• العمليات بانتظار المزامنة: ${syncState.pendingCount}\n• آخر مزامنة: ${syncInfo}\n\nيعمل التطبيق بكفاءة 100% بدون اتصال، وتتم المزامنة تلقائياً بمجرد عودة الإنترنت.`;

    Alert.alert(
      'حالة المزامنة والاتصال',
      message,
      [
        syncState.isOnline
          ? {
              text: '🔄 مزامنة يدوية الآن',
              onPress: () => processSyncQueue(),
            }
          : null,
        { text: 'حسناً', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  if (syncState.isSyncing) {
    return (
      <TouchableOpacity
        style={[styles.badge, styles.syncingBadge]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <ActivityIndicator size="small" color="#FDE68A" style={styles.spinner} />
        <Text style={[styles.text, styles.syncingText]}>جاري المزامنة...</Text>
      </TouchableOpacity>
    );
  }

  if (!syncState.isOnline) {
    return (
      <TouchableOpacity
        style={[styles.badge, styles.offlineBadge]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.dot}>🔴</Text>
        <Text style={[styles.text, styles.offlineText]}>
          {syncState.pendingCount > 0 ? `أوفلاين (${syncState.pendingCount})` : 'أوفلاين (محلي)'}
        </Text>
      </TouchableOpacity>
    );
  }

  if (syncState.pendingCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.badge, styles.pendingBadge]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.dot}>🟠</Text>
        <Text style={[styles.text, styles.pendingText]}>
          بانتظار المزامنة ({syncState.pendingCount})
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.badge, styles.onlineBadge]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={styles.dot}>🟢</Text>
      <Text style={[styles.text, styles.onlineText]}>
        {compact ? 'متزامن' : 'متزامن سحابياً'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  text: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  dot: {
    fontSize: 8,
  },
  spinner: {
    marginRight: 2,
    transform: [{ scale: 0.7 }],
  },
  onlineBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  onlineText: {
    color: '#D1FAE5',
  },
  offlineBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  offlineText: {
    color: '#FECACA',
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  pendingText: {
    color: '#FDE68A',
  },
  syncingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: 'rgba(96, 165, 250, 0.5)',
  },
  syncingText: {
    color: '#BFDBFE',
  },
});
