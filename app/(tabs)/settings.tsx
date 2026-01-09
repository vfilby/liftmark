import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, loadSettings, updateSettings, error, clearError } =
    useSettingsStore();
  const [promptText, setPromptText] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  // Sync local prompt state with settings
  useEffect(() => {
    if (settings?.customPromptAddition !== undefined) {
      setPromptText(settings.customPromptAddition || '');
    }
  }, [settings?.customPromptAddition]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

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
    section: {
      backgroundColor: colors.card,
      marginTop: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
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
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.borderLight,
      borderRadius: 8,
      padding: 2,
    },
    segment: {
      paddingHorizontal: 16,
      paddingVertical: 8,
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
      paddingVertical: 12,
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
  });

  if (!settings) {
    return (
      <View style={styles.container} testID="settings-loading">
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="settings-screen">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Units</Text>

        <View style={styles.settingRow}>
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
        <Text style={styles.sectionTitle}>Appearance</Text>

        <View style={styles.settingRow}>
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
        <Text style={styles.sectionTitle}>Workout</Text>

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

        <View style={styles.settingRow}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Prompt</Text>

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
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Build</Text>
          <Text style={styles.infoValue}>MVP</Text>
        </View>
      </View>
    </ScrollView>
  );
}
