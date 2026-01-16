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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGymStore } from '@/stores/gymStore';
import { useTheme } from '@/theme';
import { type Gym } from '@/types';
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
    equipment,
    loadEquipment,
    error: equipmentError,
    clearError: clearEquipmentError,
  } = useEquipmentStore();
  const {
    gyms,
    defaultGym,
    loadGyms,
    addGym,
    updateGym,
    setDefaultGym,
    removeGym,
    error: gymError,
    clearError: clearGymError,
  } = useGymStore();

  const [promptText, setPromptText] = useState('');
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [showGymModal, setShowGymModal] = useState(false);
  const [newGymName, setNewGymName] = useState('');
  const [editingGym, setEditingGym] = useState<Gym | null>(null);

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadGyms();
  }, []);

  // Set initial selected gym when gyms load
  useEffect(() => {
    if (defaultGym && !selectedGymId) {
      setSelectedGymId(defaultGym.id);
    } else if (gyms.length > 0 && !selectedGymId) {
      setSelectedGymId(gyms[0].id);
    }
  }, [defaultGym, gyms, selectedGymId]);

  // Load equipment when selected gym changes (for equipment count)
  useEffect(() => {
    if (selectedGymId) {
      loadEquipment(selectedGymId);
    }
  }, [selectedGymId]);

  // Sync local prompt state with settings
  useEffect(() => {
    if (settings?.customPromptAddition !== undefined) {
      setPromptText(settings.customPromptAddition || '');
    }
  }, [settings?.customPromptAddition]);

  // Handle errors
  useEffect(() => {
    const error = settingsError || equipmentError || gymError;
    if (error) {
      Alert.alert('Error', error, [{
        text: 'OK',
        onPress: () => {
          clearSettingsError();
          clearEquipmentError();
          clearGymError();
        }
      }]);
    }
  }, [settingsError, equipmentError, gymError]);

  const handleWeightUnitChange = (unit: 'lbs' | 'kg') => {
    updateSettings({ defaultWeightUnit: unit });
  };

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
  const handleAddGym = async () => {
    const trimmedName = newGymName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a gym name');
      return;
    }

    const isFirst = gyms.length === 0;
    const newGym = await addGym(trimmedName, isFirst);
    setNewGymName('');
    setShowGymModal(false);
    setSelectedGymId(newGym.id);
  };

  const handleEditGym = async () => {
    if (!editingGym) return;
    const trimmedName = newGymName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a gym name');
      return;
    }

    await updateGym(editingGym.id, { name: trimmedName });
    setNewGymName('');
    setEditingGym(null);
    setShowGymModal(false);
  };

  const handleDeleteGym = (gym: Gym) => {
    if (gyms.length === 1) {
      Alert.alert('Cannot Delete', 'You must have at least one gym.');
      return;
    }

    Alert.alert(
      'Delete Gym',
      `Are you sure you want to delete "${gym.name}"? All equipment associated with this gym will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeGym(gym.id);
            if (selectedGymId === gym.id && gyms.length > 1) {
              const remainingGym = gyms.find(g => g.id !== gym.id);
              if (remainingGym) {
                setSelectedGymId(remainingGym.id);
              }
            }
          },
        },
      ]
    );
  };

  const handleSetDefaultGym = async (gymId: string) => {
    await setDefaultGym(gymId);
  };

  const selectedGym = gyms.find(g => g.id === selectedGymId);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
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
      backgroundColor: colors.backgroundSecondary,
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
    section: {
      backgroundColor: colors.card,
      marginTop: 16,
      marginHorizontal: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
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
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      padding: 3,
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
      backgroundColor: colors.background,
      borderWidth: 1,
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
    },
    gymListItemSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 2,
      borderColor: colors.primary,
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
    },
    addGymButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    // Navigation styles
    navigationRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      marginTop: 12,
    },
    navigationLabel: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    navigationMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalBody: {
      padding: 16,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
    },
    modalButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.error,
      marginTop: 12,
    },
    modalButtonSecondaryText: {
      color: colors.error,
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
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Customize your workout experience</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Units</Text>
        </View>

        <View style={[styles.settingRow, styles.settingRowLast]}>
          <Text style={styles.settingLabel}>Default Weight Unit</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentLeft,
                settings.defaultWeightUnit === 'lbs' && styles.segmentActive,
              ]}
              onPress={() => handleWeightUnitChange('lbs')}
              testID="button-unit-lbs"
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.defaultWeightUnit === 'lbs' &&
                    styles.segmentTextActive,
                ]}
              >
                LBS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentRight,
                settings.defaultWeightUnit === 'kg' && styles.segmentActive,
              ]}
              onPress={() => handleWeightUnitChange('kg')}
              testID="button-unit-kg"
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.defaultWeightUnit === 'kg' &&
                    styles.segmentTextActive,
                ]}
              >
                KG
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="timer-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Workout</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Workout Timer</Text>
            <Text style={styles.settingDescription}>
              Show rest timer during workouts
            </Text>
          </View>
          <Switch
            value={settings.enableWorkoutTimer}
            onValueChange={(value) =>
              updateSettings({ enableWorkoutTimer: value })
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            testID="switch-workout-timer"
          />
        </View>

        <View style={[styles.settingRow, styles.settingRowLast]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-Start Rest Timer</Text>
            <Text style={styles.settingDescription}>
              Automatically start rest timer after completing a set
            </Text>
          </View>
          <Switch
            value={settings.autoStartRestTimer}
            onValueChange={(value) =>
              updateSettings({ autoStartRestTimer: value })
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            testID="switch-auto-start-rest"
          />
        </View>
      </View>

      {/* Gym Management Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="business-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>My Gyms</Text>
        </View>
        <Text style={styles.settingDescription}>
          Manage your gym locations and their equipment
        </Text>

        {gyms.map((gym) => (
          <TouchableOpacity
            key={gym.id}
            style={[
              styles.gymListItem,
              selectedGymId === gym.id && styles.gymListItemSelected,
            ]}
            onPress={() => setSelectedGymId(gym.id)}
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
                  onPress={() => handleSetDefaultGym(gym.id)}
                  testID={`set-default-${gym.id}`}
                >
                  <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  setEditingGym(gym);
                  setNewGymName(gym.name);
                  setShowGymModal(true);
                }}
                testID={`edit-gym-${gym.id}`}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {gyms.length > 1 && (
                <TouchableOpacity
                  onPress={() => handleDeleteGym(gym)}
                  testID={`delete-gym-${gym.id}`}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.addGymButton}
          onPress={() => {
            setEditingGym(null);
            setNewGymName('');
            setShowGymModal(true);
          }}
          testID="add-gym-button"
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.addGymButtonText}>Add Gym</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navigationRow}
          onPress={() => router.push('/equipment')}
          testID="manage-equipment-button"
        >
          <Text style={styles.navigationLabel}>Manage Equipment</Text>
          <View style={styles.navigationMeta}>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>

        <View style={[styles.settingRow, styles.settingRowLast]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive workout reminders and rest alerts
            </Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(value) =>
              updateSettings({ notificationsEnabled: value })
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            testID="switch-notifications"
          />
        </View>
      </View>

      {/* Only show HealthKit settings on iOS */}
      {Platform.OS === 'ios' && isHealthKitAvailable() && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart-outline" size={20} color={colors.primary} />
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
      {Platform.OS === 'ios' && isLiveActivityAvailable() && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>AI Workout Prompts</Text>
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>About</Text>
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

      {/* Add/Edit Gym Modal */}
      <Modal
        visible={showGymModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGymModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGym ? 'Edit Gym' : 'Add Gym'}
              </Text>
              <TouchableOpacity onPress={() => setShowGymModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder="Gym name (e.g., Home Gym, LA Fitness)"
                placeholderTextColor={colors.textMuted}
                value={newGymName}
                onChangeText={setNewGymName}
                autoFocus
                testID="input-gym-name"
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={editingGym ? handleEditGym : handleAddGym}
                testID="save-gym-button"
              >
                <Text style={styles.modalButtonText}>
                  {editingGym ? 'Save Changes' : 'Add Gym'}
                </Text>
              </TouchableOpacity>
              {editingGym && gyms.length > 1 && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => {
                    setShowGymModal(false);
                    handleDeleteGym(editingGym);
                  }}
                  testID="delete-gym-modal-button"
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>
                    Delete Gym
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
