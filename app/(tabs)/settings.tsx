import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';

export default function SettingsScreen() {
  const { settings, loadSettings, updateSettings, error, clearError } =
    useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, []);

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
            testID="switch-notifications"
          />
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 100,
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
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
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#2563eb',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
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
    color: '#111827',
  },
  infoValue: {
    fontSize: 16,
    color: '#6b7280',
  },
});
