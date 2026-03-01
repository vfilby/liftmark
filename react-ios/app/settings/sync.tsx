/**
 * iCloud Sync Settings Screen
 * CloudKit sync configuration with safe error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { cloudKitService, type SyncResult } from '@/services/cloudKitService';

// Simple icon component (no external deps)
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => {
  const iconMap: Record<string, string> = {
    'cloud-offline': '☁️',
    'cloud-outline': '☁️',
    'flask': '🧪',
    'warning': '⚠️',
  };
  return <Text style={{ fontSize: size, color }}>{iconMap[name] || '•'}</Text>;
};

export default function SyncSettingsScreen() {
  const [accountStatus, setAccountStatus] = useState<string>('not_checked');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const checkCloudKitStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const statusPromise = new Promise<string>(async (resolve) => {
        try {
          const status = await cloudKitService.getAccountStatus();
          resolve(status);
        } catch {
          resolve('error');
        }
      });

      const timeoutPromise = new Promise<string>(resolve =>
        setTimeout(() => resolve('timeout'), 3000)
      );

      const status = await Promise.race([statusPromise, timeoutPromise]);
      setAccountStatus(status || 'unknown');
    } catch {
      setAccountStatus('error');
    }
    setIsChecking(false);
  }, []);

  useEffect(() => {
    checkCloudKitStatus();
  }, [checkCloudKitStatus]);

  const handleToggleSync = (enabled: boolean) => {
    setSyncEnabled(enabled);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setLastSyncResult(null);
    try {
      const result = await cloudKitService.syncAll();
      setLastSyncResult(result);
      if (result.success) {
        setLastSynced(result.timestamp);
      } else if (result.errors.length > 0) {
        Alert.alert('Sync Issues', result.errors.join('\n'));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Sync Failed', msg);
    }
    setIsSyncing(false);
  };

  const handleTestCloudKit = () => {
    try {
      router.push('/cloudkit-test');
    } catch (error) {
      console.error('[SyncScreen] Navigation error:', error);
      Alert.alert('Error', 'Failed to open CloudKit test screen');
    }
  };

  const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleString();
  };

  const getStatusColor = () => {
    switch (accountStatus) {
      case 'available':
        return '#2e7d32';
      case 'noAccount':
      case 'restricted':
      case 'error':
      case 'unavailable':
        return '#d32f2f';
      case 'not_configured':
      case 'temporarilyUnavailable':
      case 'timeout':
        return '#ff9800';
      default:
        return '#666666';
    }
  };

  const getStatusText = () => {
    switch (accountStatus) {
      case 'available':
        return 'iCloud Available';
      case 'noAccount':
        return 'No iCloud Account';
      case 'restricted':
        return 'iCloud Restricted';
      case 'temporarilyUnavailable':
        return 'Temporarily Unavailable';
      case 'timeout':
        return 'Status Check Timeout';
      case 'error':
        return 'Error';
      case 'unavailable':
        return 'Not Available';
      case 'not_checked':
        return 'Not Checked';
      case 'not_configured':
        return 'Not Configured';
      default:
        return 'Unknown';
    }
  };

  return (
    <View testID="sync-settings-screen" style={styles.container}>
      <ScrollView>
        {/* CloudKit Status */}
        <Text style={styles.sectionTitle}>ICLOUD STATUS</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text testID="sync-status-label" style={styles.rowTitle}>Account Status</Text>
              <Text testID="sync-status-description" style={styles.rowSubtitle}>
                {accountStatus === 'available'
                  ? 'Your iCloud account is connected and ready for sync.'
                  : accountStatus === 'noAccount'
                  ? 'Sign in to iCloud in your device Settings to enable sync.'
                  : accountStatus === 'restricted'
                  ? 'iCloud access is restricted on this device (e.g., parental controls).'
                  : accountStatus === 'not_checked'
                  ? 'Checking iCloud status...'
                  : accountStatus === 'error'
                  ? 'An error occurred checking iCloud status.'
                  : 'Could not determine iCloud status. Try again later.'}
              </Text>
            </View>
            <View testID="sync-status-badge" style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>
        </View>

        {/* Check Status Button */}
        <TouchableOpacity
          testID="sync-check-status"
          style={[styles.testButton, isChecking && { opacity: 0.6 }]}
          onPress={checkCloudKitStatus}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Icon name="cloud-outline" size={20} color="#ffffff" />
          )}
          <Text style={styles.testButtonText}>
            {isChecking ? 'Checking...' : 'Check Status'}
          </Text>
        </TouchableOpacity>

        {/* Sync Settings */}
        <Text style={styles.sectionTitle}>SYNC SETTINGS</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Enable Sync</Text>
              <Text style={styles.rowSubtitle}>
                Sync workouts across all your devices
              </Text>
            </View>
            <Switch
              testID="switch-enable-sync"
              value={syncEnabled}
              onValueChange={handleToggleSync}
              disabled={accountStatus !== 'available'}
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Last Synced</Text>
              <Text testID="sync-last-synced" style={styles.rowSubtitle}>
                {lastSynced ? formatTimestamp(lastSynced) : 'Never'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Now Button */}
        <TouchableOpacity
          testID="sync-now-button"
          style={[styles.testButton, (isSyncing || !syncEnabled || accountStatus !== 'available') && { opacity: 0.6 }]}
          onPress={handleSyncNow}
          disabled={isSyncing || !syncEnabled || accountStatus !== 'available'}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Icon name="cloud-outline" size={20} color="#ffffff" />
          )}
          <Text style={styles.testButtonText}>
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>

        {/* Sync Result */}
        {lastSyncResult && (
          <>
            <Text style={styles.sectionTitle}>LAST SYNC RESULT</Text>
            <View style={styles.section}>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Status</Text>
                <Text style={[styles.statusText, { color: lastSyncResult.success ? '#2e7d32' : '#d32f2f' }]}>
                  {lastSyncResult.success ? 'Success' : 'Failed'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Uploaded</Text>
                <Text style={styles.rowSubtitle}>{lastSyncResult.uploaded} records</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Downloaded</Text>
                <Text style={styles.rowSubtitle}>{lastSyncResult.downloaded} records</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Conflicts</Text>
                <Text style={styles.rowSubtitle}>{lastSyncResult.conflicts} resolved</Text>
              </View>
              {lastSyncResult.errors.length > 0 && (
                <View style={[styles.row, styles.rowLast]}>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: '#d32f2f' }]}>Errors</Text>
                    {lastSyncResult.errors.map((err, i) => (
                      <Text key={i} style={[styles.rowSubtitle, { color: '#d32f2f' }]}>{err}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* Sync Info */}
        <View style={[styles.infoBox, { marginTop: 24 }]}>
          <Text testID="sync-info-text" style={styles.infoText}>
            iCloud Sync keeps your workout plans, session history, and settings in sync across all your devices signed into the same iCloud account.
          </Text>
        </View>

        {/* Test CloudKit */}
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: '#666666' }]}
          onPress={handleTestCloudKit}
        >
          <Icon name="flask" size={20} color="#ffffff" />
          <Text style={styles.testButtonText}>CloudKit Test Screen</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    color: '#007AFF',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testButton: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
