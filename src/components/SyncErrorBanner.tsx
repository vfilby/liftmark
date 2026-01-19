/**
 * Sync Error Banner Component
 * Displays sync errors with retry and dismiss options
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/theme';
import { useSyncStore } from '@/stores/syncStore';
import { performFullSync } from '@/services/syncService';

export default function SyncErrorBanner() {
  const { colors } = useTheme();
  const { syncError, clearError } = useSyncStore();

  if (!syncError) {
    return null;
  }

  const handleRetry = async () => {
    clearError();
    await performFullSync();
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.error || '#ff4444',
      padding: 12,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    contentContainer: {
      flex: 1,
      marginRight: 12,
    },
    title: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    message: {
      color: '#ffffff',
      fontSize: 12,
      opacity: 0.9,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    button: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Sync Error</Text>
        <Text style={styles.message} numberOfLines={2}>
          {syncError}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={clearError}>
          <Text style={styles.buttonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
