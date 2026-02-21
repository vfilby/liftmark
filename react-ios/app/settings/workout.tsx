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
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme';

export default function WorkoutSettingsScreen() {
  const { colors } = useTheme();
  const { settings, loadSettings, updateSettings, error, clearError } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{
        text: 'OK',
        onPress: clearError
      }]);
    }
  }, [error]);

  const handleWeightUnitChange = (unit: 'lbs' | 'kg') => {
    updateSettings({ defaultWeightUnit: unit });
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
      marginTop: 16,
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
      marginTop: 20,
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
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
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
  });

  if (!settings) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Workout Settings' }} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="workout-settings-screen">
      <Stack.Screen
        options={{
          title: 'Workout Settings',
          headerBackTitle: 'Settings',
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Units Section */}
        <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="barbell-outline" size={20} color="#FF6B35" />
            <Text style={styles.sectionTitle}>Units</Text>
          </View>
          <Text style={styles.settingDescription}>
            Choose your preferred weight measurement unit
          </Text>

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

        {/* Timer Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="timer-outline" size={20} color="#3498DB" />
            <Text style={styles.sectionTitle}>Rest Timer</Text>
          </View>
          <Text style={styles.settingDescription}>
            Configure how rest timers work during your workouts
          </Text>

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

        {/* Screen Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="phone-portrait-outline" size={20} color="#9B59B6" />
            <Text style={styles.sectionTitle}>Screen</Text>
          </View>
          <Text style={styles.settingDescription}>
            Control screen behavior during workouts
          </Text>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Keep Screen Awake</Text>
              <Text style={styles.settingDescription}>
                Prevent screen from sleeping during active workouts
              </Text>
            </View>
            <Switch
              value={settings.keepScreenAwake}
              onValueChange={(value) =>
                updateSettings({ keepScreenAwake: value })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              testID="switch-keep-screen-awake"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
