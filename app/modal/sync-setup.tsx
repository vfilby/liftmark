/**
 * Sync Setup Modal
 * First-time CloudKit sync onboarding
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { initializeCloudKit } from '@/services/cloudKitService';
import { setSyncEnabled } from '@/db/syncMetadataRepository';
import { performFullSync } from '@/services/syncService';
import { startBackgroundSync } from '@/services/backgroundSyncService';
import { useSyncStore } from '@/stores/syncStore';

type SetupStep = 'intro' | 'checking' | 'ready' | 'syncing' | 'complete';

export default function SyncSetupModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setSyncEnabled: updateSyncStore, loadSyncState } = useSyncStore();

  const [step, setStep] = useState<SetupStep>('intro');
  const [cloudKitAvailable, setCloudKitAvailable] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    pushed: number;
    pulled: number;
  } | null>(null);

  const checkCloudKit = async () => {
    setStep('checking');

    try {
      const result = await initializeCloudKit();

      if (result?.isAvailable) {
        setCloudKitAvailable(true);
        setStep('ready');
      } else {
        Alert.alert(
          'iCloud Not Available',
          'Please ensure you are signed in to iCloud and have an internet connection.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check iCloud status', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  const handleEnableSync = async () => {
    setStep('syncing');

    try {
      // Enable sync in database
      await setSyncEnabled(true);
      updateSyncStore(true);

      // Start background sync
      await startBackgroundSync();

      // Perform initial sync
      const result = await performFullSync();

      if (result.success) {
        setSyncResult({
          pushed: result.pushedCount || 0,
          pulled: result.pulledCount || 0,
        });
        setStep('complete');

        // Reload sync state
        await loadSyncState();
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync setup error:', error);
      Alert.alert(
        'Sync Error',
        'Failed to complete initial sync. You can try again from Settings.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 24,
    },
    closeButton: {
      alignSelf: 'flex-end',
      padding: 8,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
      paddingHorizontal: 16,
    },
    featureList: {
      width: '100%',
      marginBottom: 32,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    featureIcon: {
      marginRight: 12,
    },
    featureText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    button: {
      width: '100%',
      paddingVertical: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    skipButton: {
      marginTop: 16,
      paddingVertical: 12,
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    resultText: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
  });

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud" size={40} color={colors.primary} />
            </View>

            <Text style={styles.title}>Enable iCloud Sync</Text>

            <Text style={styles.description}>
              Keep your workouts synchronized across all your Apple devices.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.feature}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.primary}
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>Plan workouts on iPad or Mac</Text>
              </View>

              <View style={styles.feature}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.primary}
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>Track workouts on iPhone or Apple Watch</Text>
              </View>

              <View style={styles.feature}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.primary}
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>Automatic background synchronization</Text>
              </View>

              <View style={styles.feature}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.primary}
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>Works offline, syncs when online</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={checkCloudKit}>
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={() => router.back()}>
              <Text style={styles.skipButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </>
        );

      case 'checking':
        return (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.description, { marginTop: 24 }]}>
              Checking iCloud availability...
            </Text>
          </>
        );

      case 'ready':
        return (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-done" size={40} color={colors.primary} />
            </View>

            <Text style={styles.title}>Ready to Sync</Text>

            <Text style={styles.description}>
              iCloud is available and ready. We'll sync your existing workouts and keep
              everything up to date automatically.
            </Text>

            <TouchableOpacity style={styles.button} onPress={handleEnableSync}>
              <Text style={styles.buttonText}>Enable Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={() => router.back()}>
              <Text style={styles.skipButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        );

      case 'syncing':
        return (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.description, { marginTop: 24 }]}>
              Syncing your workouts...{'\n'}This may take a moment.
            </Text>
          </>
        );

      case 'complete':
        return (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={40} color="#2e7d32" />
            </View>

            <Text style={styles.title}>Sync Complete!</Text>

            {syncResult && (
              <>
                <Text style={styles.resultText}>
                  Uploaded {syncResult.pushed} workout{syncResult.pushed !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.resultText}>
                  Downloaded {syncResult.pulled} workout{syncResult.pulled !== 1 ? 's' : ''}
                </Text>
              </>
            )}

            <Text style={[styles.description, { marginTop: 16 }]}>
              Your workouts are now syncing across all your devices automatically.
            </Text>

            <TouchableOpacity style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      {step !== 'checking' && step !== 'syncing' && (
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}
