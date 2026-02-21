/**
 * iCloud Sync Settings Screen
 * CloudKit sync configuration with safe error handling
 */

import React, { useState } from 'react';
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

  const checkCloudKitStatus = async () => {
    setIsChecking(true);
    try {
      const cloudKitModule = require('@/services/cloudKitService');
      if (cloudKitModule?.cloudKitService) {
        const statusPromise = new Promise<string>(async (resolve) => {
          try {
            const status = await cloudKitModule.cloudKitService.getAccountStatus();
            resolve(status);
          } catch (error) {
            resolve('error');
          }
        });

        const timeoutPromise = new Promise<string>(resolve =>
          setTimeout(() => resolve('timeout'), 3000)
        );

        const status = await Promise.race([statusPromise, timeoutPromise]);
        setAccountStatus(status || 'unknown');
      } else {
        setAccountStatus('unavailable');
      }
    } catch (error) {
      setAccountStatus('error');
    }
    setIsChecking(false);
  };

  const handleToggleSync = (enabled: boolean) => {
    Alert.alert(
      'CloudKit Sync',
      'CloudKit sync is available but not fully implemented yet. This is a basic CloudKit module for testing.',
      [{ text: 'OK' }]
    );
    setSyncEnabled(false);
  };

  const handleTestCloudKit = () => {
    try {
      router.push('/cloudkit-test');
    } catch (error) {
      console.error('[SyncScreen] Navigation error:', error);
      Alert.alert('Error', 'Failed to open CloudKit test screen');
    }
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
    <View style={styles.container}>
      <ScrollView>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            iCloud sync is experimental. Tap "Check Status" below to test your iCloud connection.
          </Text>
        </View>

        {/* CloudKit Status */}
        <Text style={styles.sectionTitle}>ICLOUD STATUS</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Account Status</Text>
              <Text style={styles.rowSubtitle}>
                {accountStatus === 'available'
                  ? 'Signed in to iCloud'
                  : accountStatus === 'not_checked'
                  ? 'Tap Check Status to verify'
                  : 'iCloud account required for sync'}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>
        </View>

        {/* Check Status Button */}
        <TouchableOpacity
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
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Enable Sync</Text>
              <Text style={styles.rowSubtitle}>
                Sync workouts across all your devices
              </Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={handleToggleSync}
              disabled={accountStatus !== 'available'}
            />
          </View>
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
