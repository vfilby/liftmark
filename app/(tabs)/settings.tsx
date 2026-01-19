import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGymStore } from '@/stores/gymStore';
import { useTheme } from '@/theme';
import {
  isHealthKitAvailable,
  requestHealthKitAuthorization,
} from '@/services/healthKitService';
import { isLiveActivityAvailable } from '@/services/liveActivityService';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loadSettings, updateSettings, error: settingsError, clearError: clearSettingsError } =
    useSettingsStore();
  const {
    gyms,
    loadGyms,
    addGym,
    setDefaultGym,
    error: gymError,
    clearError: clearGymError,
  } = useGymStore();

  const [promptText, setPromptText] = useState('');

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadGyms();
  }, []);

  // Sync local prompt state with settings
  useEffect(() => {
    if (settings?.customPromptAddition !== undefined) {
      setPromptText(settings.customPromptAddition || '');
    }
  }, [settings?.customPromptAddition]);

  // Handle errors
  useEffect(() => {
    const error = settingsError || gymError;
    if (error) {
      Alert.alert('Error', error, [{
        text: 'OK',
        onPress: () => {
          clearSettingsError();
          clearGymError();
        }
      }]);
    }
  }, [settingsError, gymError]);

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateSettings({ theme });
  };

  const handlePromptBlur = () => {
    if (promptText !== (settings?.customPromptAddition || '')) {
      updateSettings({ customPromptAddition: promptText });
    }
  };

  const handleHealthKitToggle = async (enabled: boolean) => {
    if (enabled) {
      const authorized = await requestHealthKitAuthorization();
      if (authorized) {
        updateSettings({ healthKitEnabled: true });
      } else {
        Alert.alert(
          'Authorization Required',
          'Please enable HealthKit access in Settings > Privacy > Health to sync your workouts.',
          [{ text: 'OK' }]
        );
      }
    } else {
      updateSettings({ healthKitEnabled: false });
    }
  };

  // Gym management
  const handleAddGym = () => {
    Alert.prompt(
      'Add Gym',
      'Enter a name for your new gym',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (gymName: string | undefined) => {
            const trimmedName = gymName?.trim();
            if (!trimmedName) {
              Alert.alert('Error', 'Please enter a gym name');
              return;
            }

            const isFirst = gyms.length === 0;
            const newGym = await addGym(trimmedName, isFirst);
            router.push(`/gym/${newGym.id}`);
          },
        },
      ],
      'plain-text'
    );
  };

  const handleSetDefaultGym = async (gymId: string) => {
    await setDefaultGym(gymId);
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
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 24,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    sectionGroup: {
      marginTop: 32,
    },
    sectionGroupHeader: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      marginTop: 8,
    },
    sectionGroupTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    section: {
      backgroundColor: colors.card,
      marginTop: 8,
      marginHorizontal: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    sectionFirst: {
      marginTop: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    settingRowLast: {
      borderBottomWidth: 0,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 2,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    segmentLeft: {
      borderTopLeftRadius: 6,
      borderBottomLeftRadius: 6,
    },
    segmentRight: {
      borderTopRightRadius: 6,
      borderBottomRightRadius: 6,
    },
    segmentActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: '#ffffff',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 16,
      color: colors.text,
    },
    infoValue: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    textInput: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    // Gym styles
    gymSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    gymSelectorText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    gymSelectorActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    gymBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    gymBadgeText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '600',
    },
    gymListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    gymListItemText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    gymListItemActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    addGymButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 8,
      marginTop: 4,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addGymButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    // Navigation section styles
    navigationSection: {
      paddingVertical: 0,
    },
    navigationContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 12,
    },
    navigationIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navigationInfo: {
      flex: 1,
    },
    navigationLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    navigationDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  if (!settings) {
    return (
      <View style={styles.container} testID="settings-loading">
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      testID="settings-screen"
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Customize your workout experience</Text>
      </View>

      {/* Preferences Group */}
      <View style={styles.sectionGroup}>
        <View style={styles.sectionGroupHeader}>
          <Text style={styles.sectionGroupTitle}>Preferences</Text>
        </View>

        <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={20} color="#9B59B6" />
            <Text style={styles.sectionTitle}>Appearance</Text>
          </View>

        <View style={[styles.settingRow, styles.settingRowLast]}>
          <Text style={styles.settingLabel}>Theme</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentLeft,
                settings.theme === 'light' && styles.segmentActive,
              ]}
              onPress={() => handleThemeChange('light')}
              testID="button-theme-light"
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.theme === 'light' && styles.segmentTextActive,
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                settings.theme === 'dark' && styles.segmentActive,
              ]}
              onPress={() => handleThemeChange('dark')}
              testID="button-theme-dark"
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.theme === 'dark' && styles.segmentTextActive,
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentRight,
                settings.theme === 'auto' && styles.segmentActive,
              ]}
              onPress={() => handleThemeChange('auto')}
              testID="button-theme-auto"
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.theme === 'auto' && styles.segmentTextActive,
                ]}
              >
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </View>

      {/* Workout Group */}
      <View style={styles.sectionGroup}>
        <View style={styles.sectionGroupHeader}>
          <Text style={styles.sectionGroupTitle}>Workout</Text>
        </View>

        <TouchableOpacity
          style={[styles.section, styles.sectionFirst, styles.navigationSection]}
          onPress={() => router.push('/settings/workout')}
          testID="workout-settings-button"
        >
          <View style={styles.navigationContent}>
            <View style={styles.navigationIcon}>
              <Ionicons name="barbell-outline" size={24} color="#FF6B35" />
            </View>
            <View style={styles.navigationInfo}>
              <Text style={styles.navigationLabel}>Workout Settings</Text>
              <Text style={styles.navigationDescription}>
                Units, timers, and screen preferences
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Gym Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={20} color="#E67E22" />
            <Text style={styles.sectionTitle}>My Gyms</Text>
          </View>
        <Text style={styles.settingDescription}>
          Manage your gym locations and their equipment
        </Text>

        {gyms.map((gym) => (
          <TouchableOpacity
            key={gym.id}
            style={styles.gymListItem}
            onPress={() => router.push(`/gym/${gym.id}`)}
            testID={`gym-item-${gym.id}`}
          >
            <Text style={styles.gymListItemText}>{gym.name}</Text>
            <View style={styles.gymListItemActions}>
              {gym.isDefault && (
                <View style={styles.gymBadge}>
                  <Text style={styles.gymBadgeText}>DEFAULT</Text>
                </View>
              )}
              {!gym.isDefault && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleSetDefaultGym(gym.id);
                  }}
                  testID={`set-default-${gym.id}`}
                >
                  <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.addGymButton}
          onPress={handleAddGym}
          testID="add-gym-button"
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.addGymButtonText}>Add Gym</Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* Integrations Group */}
      {Platform.OS === 'ios' && (
        <View style={styles.sectionGroup}>
          <View style={styles.sectionGroupHeader}>
            <Text style={styles.sectionGroupTitle}>Integrations</Text>
          </View>

          {/* iCloud Sync */}
          <TouchableOpacity
            style={[styles.section, styles.sectionFirst, styles.navigationSection]}
            onPress={() => router.push('/settings/sync')}
            testID="sync-settings-button"
          >
            <View style={styles.navigationContent}>
              <View style={styles.navigationIcon}>
                <Ionicons name="cloud-outline" size={24} color="#007AFF" />
              </View>
              <View style={styles.navigationInfo}>
                <Text style={styles.navigationLabel}>iCloud Sync</Text>
                <Text style={styles.navigationDescription}>
                  Sync workouts across all your devices
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Only show HealthKit settings on iOS */}
          {isHealthKitAvailable() && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart-outline" size={20} color="#E74C3C" />
              <Text style={styles.sectionTitle}>Apple Health</Text>
            </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sync to Apple Health</Text>
              <Text style={styles.settingDescription}>
                Automatically save completed workouts to Apple Health
              </Text>
            </View>
            <Switch
              value={settings.healthKitEnabled}
              onValueChange={handleHealthKitToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              testID="switch-healthkit"
            />
          </View>
          </View>
          )}

          {/* Only show Live Activities settings on iOS */}
          {isLiveActivityAvailable() && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="phone-portrait-outline" size={20} color="#3498DB" />
              <Text style={styles.sectionTitle}>Live Activities</Text>
            </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Lock Screen Widget</Text>
              <Text style={styles.settingDescription}>
                Show workout progress on lock screen and Dynamic Island
              </Text>
            </View>
            <Switch
              value={settings.liveActivitiesEnabled}
              onValueChange={(value) =>
                updateSettings({ liveActivitiesEnabled: value })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              testID="switch-live-activities"
            />
          </View>
          </View>
          )}
        </View>
      )}

      {/* AI Group */}
      <View style={styles.sectionGroup}>
        <View style={styles.sectionGroupHeader}>
          <Text style={styles.sectionGroupTitle}>AI Assistance</Text>
        </View>

        <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles-outline" size={20} color="#9B59B6" />
            <Text style={styles.sectionTitle}>Workout Prompts</Text>
          </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Custom Prompt Addition</Text>
          <Text style={styles.settingDescription}>
            This text will be appended to AI workout prompts
          </Text>
        </View>
        <TextInput
          style={styles.textInput}
          multiline
          placeholder="e.g., Focus on compound movements. Keep rest periods under 90 seconds."
          placeholderTextColor={colors.textMuted}
          value={promptText}
          onChangeText={setPromptText}
          onBlur={handlePromptBlur}
          testID="input-custom-prompt"
        />
        </View>
      </View>

      {/* About Group */}
      <View style={styles.sectionGroup}>
        <View style={styles.sectionGroupHeader}>
          <Text style={styles.sectionGroupTitle}>About</Text>
        </View>

        <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#95A5A6" />
            <Text style={styles.sectionTitle}>App Information</Text>
          </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>

        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>Build</Text>
          <Text style={styles.infoValue}>MVP</Text>
        </View>
        </View>
      </View>

    </ScrollView>
  );
}
