/**
 * Sync Settings Screen
 * Main CloudKit sync configuration and status
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSyncStore } from '@/stores/syncStore';
import { performFullSync } from '@/services/syncService';
import { setSyncEnabled, getSyncMetadata } from '@/db/syncMetadataRepository';
import { initializeCloudKit } from '@/services/cloudKitService';
import {
  startBackgroundSync,
  stopBackgroundSync,
} from '@/services/backgroundSyncService';

export default function SyncSettingsScreen() {
  const { colors } = useTheme();
  const {
    syncEnabled,
    isSyncing,
    lastSyncDate,
    syncError,
    pendingChanges,
    loadSyncState,
    setSyncEnabled: updateSyncEnabled,
  } = useSyncStore();

  const [cloudKitAvailable, setCloudKitAvailable] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    setIsInitializing(true);
    try {
      // Check CloudKit availability
      const result = await initializeCloudKit();
      setCloudKitAvailable(result?.isAvailable ?? false);

      // Load sync state
      await loadSyncState();
    } catch (error) {
      console.error('Failed to initialize sync screen:', error);
      setCloudKitAvailable(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    try {
      if (enabled && !cloudKitAvailable) {
        Alert.alert(
          'CloudKit Not Available',
          'Please ensure you are signed in to iCloud and have a network connection.',
          [{ text: 'OK' }]
        );
        return;
      }

      await setSyncEnabled(enabled);
      updateSyncEnabled(enabled);

      if (enabled) {
        // Start background sync
        await startBackgroundSync();

        // Trigger initial sync
        Alert.alert(
          'Enable Sync',
          'Would you like to sync your data now?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Sync Now',
              onPress: () => performFullSync(),
            },
          ]
        );
      } else {
        // Stop background sync
        await stopBackgroundSync();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle sync');
      console.error('Toggle sync error:', error);
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) return;

    const result = await performFullSync();

    if (result.success) {
      Alert.alert(
        'Sync Complete',
        `Pushed ${result.pushedCount || 0} changes, pulled ${result.pulledCount || 0} changes.`
      );
    } else {
      Alert.alert('Sync Failed', result.error || 'Unknown error');
    }
  };

  const handleViewConflicts = () => {
    router.push('/settings/sync-conflicts');
  };

  const formatLastSync = (): string => {
    if (!lastSyncDate) return 'Never';

    const now = new Date();
    const diff = now.getTime() - lastSyncDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    syncButton: {
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
    syncButtonDisabled: {
      opacity: 0.5,
    },
    syncButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    chevron: {
      marginLeft: 8,
    },
    warningBox: {
      backgroundColor: colors.error || '#ff4444',
      marginHorizontal: 16,
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
    },
    warningText: {
      color: '#ffffff',
      fontSize: 14,
      lineHeight: 20,
    },
  });

  if (isInitializing) {
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
        {/* CloudKit Status Warning */}
        {!cloudKitAvailable && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              iCloud is not available. Please ensure you are signed in to iCloud and have
              an internet connection.
            </Text>
          </View>
        )}

        {/* Enable/Disable Sync */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Enable iCloud Sync</Text>
              <Text style={styles.rowSubtitle}>
                Sync workouts across all your devices
              </Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={handleToggleSync}
              disabled={!cloudKitAvailable}
            />
          </View>
        </View>

        {/* Sync Status */}
        {syncEnabled && (
          <>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.section}>
              {/* Sync Status */}
              <View style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Sync Status</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isSyncing
                        ? colors.primaryLight
                        : syncError
                        ? '#ffebee'
                        : '#e8f5e9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: isSyncing
                          ? colors.primary
                          : syncError
                          ? '#d32f2f'
                          : '#2e7d32',
                      },
                    ]}
                  >
                    {isSyncing ? 'Syncing...' : syncError ? 'Error' : 'Up to date'}
                  </Text>
                </View>
              </View>

              {/* Last Sync */}
              <View style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Last Synced</Text>
                </View>
                <Text style={styles.rowSubtitle}>{formatLastSync()}</Text>
              </View>

              {/* Pending Changes */}
              <View style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Pending Changes</Text>
                </View>
                <Text style={styles.rowSubtitle}>{pendingChanges}</Text>
              </View>

              {/* View Conflicts */}
              <TouchableOpacity
                style={[styles.row, styles.rowLast]}
                onPress={handleViewConflicts}
              >
                <Text style={styles.rowTitle}>Sync Conflicts</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.chevron}
                />
              </TouchableOpacity>
            </View>

            {/* Manual Sync Button */}
            <TouchableOpacity
              style={[
                styles.syncButton,
                (isSyncing || !cloudKitAvailable) && styles.syncButtonDisabled,
              ]}
              onPress={handleManualSync}
              disabled={isSyncing || !cloudKitAvailable}
            >
              {isSyncing ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.syncButtonText}>Syncing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#ffffff" />
                  <Text style={styles.syncButtonText}>Sync Now</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
