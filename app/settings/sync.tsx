/**
 * Simple iCloud Sync Settings Screen
 * Basic CloudKit sync configuration
 */

import { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/theme';
import { logger } from '@/services/logger';

// Safe CloudKit service import with fallback
console.log('[SyncScreen] Loading CloudKit service module');
let cloudKitService: any = null;
try {
  const cloudKitModule = require('@/services/cloudKitService');
  console.log('[SyncScreen] CloudKit module loaded:', !!cloudKitModule);
  cloudKitService = cloudKitModule.cloudKitService;
  console.log('[SyncScreen] CloudKit service:', !!cloudKitService);
} catch (error) {
  console.error('[SyncScreen] Failed to load CloudKit service:', error);
}

export default function SyncSettingsScreen() {
  const { colors } = useTheme();
  const [accountStatus, setAccountStatus] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check if running in simulator - use try-catch in case Constants isn't available
  let isSimulator = false;
  try {
    const Constants = require('expo-constants').default;
    isSimulator = Platform.OS === 'ios' && !Constants.isDevice;
  } catch (error) {
    console.warn('Failed to check if running in simulator:', error);
  }

  useEffect(() => {
    try {
      logger.info('app', 'Initializing sync screen', {
        platform: Platform.OS,
        hasCloudKit: !!cloudKitService,
      });
      initializeScreen();
    } catch (error) {
      console.error('Failed to initialize sync screen:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  const initializeScreen = async () => {
    console.log('[SyncScreen] initializeScreen called');
    setIsLoading(true);
    setHasError(false);

    try {
      // If CloudKit service isn't available, show error state
      if (!cloudKitService) {
        console.log('[SyncScreen] CloudKit service not available');
        setAccountStatus('error');
        setSyncEnabled(false);
        setIsLoading(false);
        return;
      }

      console.log('[SyncScreen] CloudKit service available');
      logger.debug('app', 'Starting CloudKit account status check');

      // Check CloudKit account status with timeout to prevent hanging
      console.log('[SyncScreen] Creating status promise');
      const statusPromise = cloudKitService.getAccountStatus().catch((error: Error) => {
        console.log('[SyncScreen] Status promise caught error:', error);
        logger.error('app', 'CloudKit status check failed', error);
        // Return error status instead of throwing
        return 'error';
      });

      console.log('[SyncScreen] Creating timeout promise');
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          console.log('[SyncScreen] Timeout promise fired');
          logger.warn('app', 'CloudKit account status check timed out');
          resolve('couldNotDetermine');
        }, 10000); // 10 second timeout
      });

      console.log('[SyncScreen] Racing promises');
      const status = await Promise.race([statusPromise, timeoutPromise]);
      console.log('[SyncScreen] Race completed with status:', status);
      logger.info('app', 'CloudKit account status determined', { status });
      setAccountStatus(status || 'couldNotDetermine');

      // For now, sync is always disabled since we have a basic implementation
      setSyncEnabled(false);
      console.log('[SyncScreen] Initialization complete');
    } catch (error) {
      console.log('[SyncScreen] Caught error in initializeScreen:', error);
      logger.error('app', 'Failed to initialize sync screen', error as Error);
      setAccountStatus('error');
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      console.log('[SyncScreen] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        'CloudKit Sync',
        'CloudKit sync is available but not fully implemented yet. This is a basic CloudKit module for testing.',
        [{ text: 'OK' }]
      );
    }
    // Keep it disabled for now
    setSyncEnabled(false);
  };

  const handleTestCloudKit = () => {
    try {
      router.push('/cloudkit-test');
    } catch (error) {
      console.error('Failed to navigate to CloudKit test:', error);
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
        return '#d32f2f';
      case 'temporarilyUnavailable':
        return '#ff9800';
      case 'couldNotDetermine':
      case 'unknown':
      default:
        return colors.textSecondary;
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
      case 'couldNotDetermine':
        return 'Status Unknown';
      case 'error':
        return 'Error';
      default:
        return 'Checking...';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    section: {
      backgroundColor: colors.card,
      marginTop: 16,
      paddingVertical: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 16,
      marginTop: 16,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowContent: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 2,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 4,
      backgroundColor: '#f5f5f5',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    testButton: {
      marginHorizontal: 16,
      marginTop: 16,
      paddingVertical: 12,
      backgroundColor: colors.primary,
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
    infoBox: {
      backgroundColor: colors.primaryLight || '#e3f2fd',
      marginHorizontal: 16,
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
    },
    infoText: {
      color: colors.primary,
      fontSize: 14,
      lineHeight: 20,
    },
    chevron: {
      marginLeft: 8,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  // Error state
  if (hasError) {
    return (
      <View style={styles.container} testID="sync-settings-error">
        <Stack.Screen options={{ title: 'iCloud Sync' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={64} color={colors.textSecondary} />
          <Text style={styles.errorTitle}>Unable to Load Sync Settings</Text>
          <Text style={styles.errorText}>{errorMessage || 'An unexpected error occurred'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setErrorMessage('');
              initializeScreen();
            }}
            testID="sync-settings-retry-button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container} testID="sync-settings-loading">
        <Stack.Screen options={{ title: 'iCloud Sync' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Main content
  return (
    <View style={styles.container} testID="sync-settings-screen">
      <Stack.Screen options={{ title: 'iCloud Sync' }} />

      <ScrollView testID="sync-settings-content">
        {/* Info Box */}
        <View style={styles.infoBox} testID="sync-settings-info">
          <Text style={styles.infoText}>
            This is a basic CloudKit implementation for testing. Full sync functionality is not yet implemented.
          </Text>
        </View>

        {/* Simulator Warning */}
        {isSimulator && (
          <View
            style={[styles.infoBox, { backgroundColor: '#fff3cd', borderColor: '#f39c12' }]}
            testID="sync-settings-simulator-warning"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="warning" size={16} color="#f39c12" />
              <Text style={[styles.infoText, { color: '#856404' }]}>
                CloudKit features are limited in iOS Simulator. Test on a physical device for full functionality.
              </Text>
            </View>
          </View>
        )}

        {/* CloudKit Status */}
        <Text style={styles.sectionTitle}>iCloud Status</Text>
        <View style={styles.section} testID="sync-settings-status-section">
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
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor() }
                ]}
                testID="sync-settings-status-text"
              >
                {getStatusText()}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Settings */}
        <Text style={styles.sectionTitle}>Sync Settings</Text>
        <View style={styles.section} testID="sync-settings-toggle-section">
          <View style={styles.row}>
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
              testID="sync-settings-toggle"
            />
          </View>
        </View>

        {/* Test CloudKit */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestCloudKit}
          testID="sync-settings-test-button"
        >
          <Ionicons name="flask" size={20} color="#ffffff" />
          <Text style={styles.testButtonText}>Test CloudKit Module</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
