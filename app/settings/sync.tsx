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
import { cloudKitService } from '@/services/cloudKitService';
import Constants from 'expo-constants';

export default function SyncSettingsScreen() {
  const { colors } = useTheme();
  const [accountStatus, setAccountStatus] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  
  // Check if running in simulator
  const isSimulator = Platform.OS === 'ios' && Constants.appOwnership === null;

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    setIsLoading(true);
    try {
      // Check CloudKit account status with timeout to prevent hanging
      const statusPromise = cloudKitService.getAccountStatus();
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('error'), 10000); // 10 second timeout
      });
      
      const status = await Promise.race([statusPromise, timeoutPromise]);
      setAccountStatus(status || 'unknown');
      
      // For now, sync is always disabled since we have a basic implementation
      setSyncEnabled(false);
    } catch (error) {
      console.error('Failed to initialize sync screen:', error);
      setAccountStatus('error');
    } finally {
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
    router.push('/cloudkit-test');
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
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'iCloud Sync' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'iCloud Sync' }} />

      <ScrollView>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            This is a basic CloudKit implementation for testing. Full sync functionality is not yet implemented.
          </Text>
        </View>

        {/* Simulator Warning */}
        {isSimulator && (
          <View style={[styles.infoBox, { backgroundColor: '#fff3cd', borderColor: '#f39c12' }]}>
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
              <Text 
                style={[
                  styles.statusText, 
                  { color: getStatusColor() }
                ]}
              >
                {getStatusText()}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Settings */}
        <Text style={styles.sectionTitle}>Sync Settings</Text>
        <View style={styles.section}>
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
            />
          </View>
        </View>

        {/* Test CloudKit */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestCloudKit}
        >
          <Ionicons name="flask" size={20} color="#ffffff" />
          <Text style={styles.testButtonText}>Test CloudKit Module</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}