/**
 * iCloud Sync Settings Screen
 * CloudKit sync configuration with safe error handling
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  console.log('[SyncScreen] Component rendering...');

  const [isLoading, setIsLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<string>('unknown');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSimulator, setIsSimulator] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[SyncScreen] Initializing...');

        // Check if simulator
        try {
          const Constants = require('expo-constants').default;
          setIsSimulator(Platform.OS === 'ios' && !Constants.isDevice);
        } catch (e) {
          console.log('[SyncScreen] Could not check simulator status');
        }

        // Small delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 300));

        // TEMPORARY: CloudKit disabled until entitlements are configured
        // CloudKit requires proper configuration in Xcode:
        // 1. Enable CloudKit capability in Signing & Capabilities
        // 2. Create a CloudKit container
        // 3. Configure app identifier with CloudKit enabled
        console.log('[SyncScreen] CloudKit checks disabled - entitlements not configured');
        setAccountStatus('not_configured');

        setIsLoading(false);
      } catch (error) {
        console.error('[SyncScreen] Initialization error:', error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to initialize');
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

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
      case 'not_configured':
        return 'Not Configured';
      default:
        return 'Checking...';
    }
  };

  // Error state
  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="cloud-offline" size={64} color="#666666" />
          <Text style={styles.errorTitle}>Unable to Load Sync Settings</Text>
          <Text style={styles.errorText}>{errorMessage || 'An unexpected error occurred'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              setErrorMessage('');
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading sync settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main content
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {accountStatus === 'not_configured'
              ? 'CloudKit sync requires proper Xcode configuration. Enable CloudKit capability in Signing & Capabilities to use this feature.'
              : 'This is a basic CloudKit implementation for testing. Full sync functionality is not yet implemented.'}
          </Text>
        </View>

        {/* Simulator Warning */}
        {isSimulator && (
          <View style={[styles.infoBox, styles.warningBox]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={16} color="#f39c12" />
              <Text style={styles.warningText}>
                CloudKit features are limited in iOS Simulator. Test on a physical device for full functionality.
              </Text>
            </View>
          </View>
        )}

        {/* CloudKit Status */}
        <Text style={styles.sectionTitle}>ICLOUD STATUS</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Account Status</Text>
              <Text style={styles.rowSubtitle}>
                {accountStatus === 'available'
                  ? 'Signed in to iCloud'
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
          style={styles.testButton}
          onPress={handleTestCloudKit}
        >
          <Icon name="flask" size={20} color="#ffffff" />
          <Text style={styles.testButtonText}>Test CloudKit Module</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  warningBox: {
    backgroundColor: '#FFF3CD',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    flex: 1,
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
    marginBottom: 32,
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
