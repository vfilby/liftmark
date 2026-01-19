/**
 * Sync Conflicts Screen (Debug)
 * Displays conflict history for debugging sync issues
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';
import {
  getAllSyncConflicts,
  clearOldSyncConflicts,
  type SyncConflict,
} from '@/db/syncMetadataRepository';

export default function SyncConflictsScreen() {
  const { colors } = useTheme();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    setIsLoading(true);
    try {
      const data = await getAllSyncConflicts();
      setConflicts(data);
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearOld = async () => {
    Alert.alert(
      'Clear Old Conflicts',
      'This will delete conflicts older than 30 days. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearOldSyncConflicts();
            loadConflicts();
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 100,
    },
    header: {
      padding: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    headerCount: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    clearButton: {
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    clearButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    conflictItem: {
      backgroundColor: colors.card,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    conflictHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    conflictType: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    resolutionBadge: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 4,
      backgroundColor: colors.primaryLight,
    },
    resolutionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    conflictId: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    conflictDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    dataSection: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 6,
    },
    dataTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    dataText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: 'monospace',
    },
    emptyState: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Sync Conflicts' }} />
        <Text style={styles.loadingText}>Loading conflicts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Sync Conflicts' }} />

      <View style={styles.header}>
        <Text style={styles.headerText}>Total Conflicts</Text>
        <Text style={styles.headerCount}>{conflicts.length}</Text>
        {conflicts.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearOld}>
            <Text style={styles.clearButtonText}>Clear Old (30+ days)</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView>
        {conflicts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No sync conflicts recorded.{'\n\n'}
              Conflicts occur when the same data is modified on multiple devices
              simultaneously.
            </Text>
          </View>
        ) : (
          conflicts.map((conflict) => (
            <View key={conflict.id} style={styles.conflictItem}>
              <View style={styles.conflictHeader}>
                <Text style={styles.conflictType}>{conflict.entityType}</Text>
                <View
                  style={[
                    styles.resolutionBadge,
                    {
                      backgroundColor:
                        conflict.resolution === 'local'
                          ? colors.primaryLight
                          : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.resolutionText}>
                    {conflict.resolution.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.conflictId} numberOfLines={1}>
                ID: {conflict.entityId}
              </Text>
              <Text style={styles.conflictDate}>
                {new Date(conflict.createdAt).toLocaleString()}
              </Text>

              <View style={styles.dataSection}>
                <Text style={styles.dataTitle}>Local Data:</Text>
                <Text style={styles.dataText} numberOfLines={3}>
                  {JSON.stringify(JSON.parse(conflict.localData), null, 2).substring(
                    0,
                    200
                  )}
                  ...
                </Text>
              </View>

              <View style={styles.dataSection}>
                <Text style={styles.dataTitle}>Remote Data:</Text>
                <Text style={styles.dataText} numberOfLines={3}>
                  {JSON.stringify(JSON.parse(conflict.remoteData), null, 2).substring(
                    0,
                    200
                  )}
                  ...
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
