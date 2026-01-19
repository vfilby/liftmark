/**
 * Sync Status Indicator Component
 * Shows current sync status with icon and color
 */

import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSyncStore } from '@/stores/syncStore';

interface SyncStatusIndicatorProps {
  size?: number;
  onPress?: () => void;
}

export default function SyncStatusIndicator({
  size = 24,
  onPress,
}: SyncStatusIndicatorProps) {
  const { colors } = useTheme();
  const { syncEnabled, isSyncing, syncStatus, syncError } = useSyncStore();

  if (!syncEnabled) {
    return null; // Don't show indicator if sync is disabled
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/settings/sync');
    }
  };

  const getStatusIcon = (): keyof typeof Ionicons.glyphMap => {
    if (isSyncing) return 'cloud-upload-outline';
    if (syncError) return 'cloud-offline-outline';
    if (syncStatus === 'offline') return 'cloud-offline-outline';
    return 'cloud-done-outline';
  };

  const getStatusColor = (): string => {
    if (isSyncing) return colors.primary;
    if (syncError) return colors.error || '#ff4444';
    if (syncStatus === 'offline') return colors.textSecondary;
    return '#2e7d32'; // Green for success
  };

  const styles = StyleSheet.create({
    container: {
      padding: 4,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {isSyncing ? (
        <ActivityIndicator size={size} color={getStatusColor()} />
      ) : (
        <Ionicons name={getStatusIcon()} size={size} color={getStatusColor()} />
      )}
    </TouchableOpacity>
  );
}
