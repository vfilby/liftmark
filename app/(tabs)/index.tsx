import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWorkoutPlanStore } from '@/stores/workoutPlanStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme';
import { useResponsivePadding, useResponsiveFontSizes, useDeviceLayout } from '@/utils/responsive';
import { getExerciseBestWeights } from '@/db/sessionRepository';
import ExercisePickerModal from '@/components/ExercisePickerModal';

const DEFAULT_TILES = ['Squat', 'Deadlift', 'Bench Press', 'Overhead Press'];

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const padding = useResponsivePadding();
  const fonts = useResponsiveFontSizes();
  const { isTablet } = useDeviceLayout();
  const { plans, loadPlans } = useWorkoutPlanStore();
  const { activeSession, resumeSession, getProgress } = useSessionStore();
  const { settings, updateSettings } = useSettingsStore();
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [bestWeights, setBestWeights] = useState<Map<string, { weight: number; reps: number; unit: string }>>(new Map());
  const [editingTileIndex, setEditingTileIndex] = useState<number | null>(null);

  const homeTiles = settings?.homeTiles ?? DEFAULT_TILES;

  useEffect(() => {
    loadPlans();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const checkSession = async () => {
        await resumeSession();
        const session = useSessionStore.getState().activeSession;
        setHasActiveSession(session !== null);
      };
      checkSession();

      getExerciseBestWeights().then(setBestWeights);
    }, [])
  );

  const handleTileLongPress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEditingTileIndex(index);
  };

  const handleExerciseSelected = (exerciseName: string) => {
    if (editingTileIndex === null) return;
    const newTiles = [...homeTiles];
    newTiles[editingTileIndex] = exerciseName;
    updateSettings({ homeTiles: newTiles });
    setEditingTileIndex(null);
  };

  const formatTileWeight = (exerciseName: string) => {
    // Case-insensitive exact match
    const lower = exerciseName.toLowerCase();
    for (const [name, data] of bestWeights) {
      if (name.toLowerCase() === lower) {
        return `${data.weight} ${data.unit}`;
      }
    }
    return '\u2014';
  };

  const handleResumeWorkout = () => {
    router.push('/workout/active');
  };

  const styles = StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    // Resume Banner
    resumeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    resumeContent: {
      flex: 1,
    },
    resumeTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.successLight,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    resumeWorkoutName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 4,
    },
    resumeProgress: {
      fontSize: 14,
      color: colors.successLight,
    },
    resumeArrow: {
      fontSize: 24,
      color: '#ffffff',
      marginLeft: 12,
    },
    // Max Lifts
    maxLiftsSection: {
      padding: padding.container,
    },
    sectionTitle: {
      fontSize: fonts.lg,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: padding.small,
    },
    quadrantGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: padding.small,
    },
    quadrantCard: {
      flex: 1,
      minWidth: '45%' as unknown as number,
      backgroundColor: colors.card,
      padding: padding.card,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    quadrantWeight: {
      fontSize: isTablet ? 28 : 22,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 2,
    },
    quadrantLabel: {
      fontSize: fonts.sm,
      color: colors.textSecondary,
    },
    // Recent Plans
    recentSection: {
      padding: padding.container,
      paddingTop: 0,
    },
    emptyState: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    workoutCard: {
      backgroundColor: colors.card,
      padding: padding.container,
      borderRadius: 12,
      marginBottom: padding.small,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    workoutName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    workoutMeta: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Fixed button
    fixedButtonContainer: {
      padding: padding.container,
      paddingBottom: padding.small,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    createButton: {
      padding: padding.container,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    createButtonText: {
      fontSize: fonts.md,
      fontWeight: '600',
      color: '#ffffff',
    },
  });

  return (
    <View style={styles.outerContainer} testID="home-screen">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Resume Workout Banner */}
        {hasActiveSession && activeSession && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={handleResumeWorkout}
            testID="resume-workout-banner"
          >
            <View style={styles.resumeContent}>
              <Text style={styles.resumeTitle}>Workout In Progress</Text>
              <Text style={styles.resumeWorkoutName}>{activeSession.name}</Text>
              <Text style={styles.resumeProgress}>
                {getProgress().completed} / {getProgress().total} sets completed
              </Text>
            </View>
            <Text style={styles.resumeArrow}>{'\u2192'}</Text>
          </TouchableOpacity>
        )}

        {/* Max Lifts Quadrant */}
        <View style={styles.maxLiftsSection}>
          <Text style={styles.sectionTitle}>Max Lifts</Text>
          <View style={styles.quadrantGrid}>
            {homeTiles.map((tileName, index) => (
              <TouchableOpacity
                key={`tile-${index}`}
                style={styles.quadrantCard}
                onLongPress={() => handleTileLongPress(index)}
                delayLongPress={400}
                activeOpacity={0.7}
                testID={`max-lift-tile-${index}`}
              >
                <Text style={styles.quadrantWeight}>
                  {formatTileWeight(tileName)}
                </Text>
                <Text style={styles.quadrantLabel}>{tileName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Plans */}
        <View style={styles.recentSection} testID="recent-plans">
          <Text style={styles.sectionTitle}>Recent Plans</Text>
          {plans.length === 0 ? (
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyText}>No plans yet</Text>
              <Text style={styles.emptySubtext}>
                Import your first workout plan to get started
              </Text>
            </View>
          ) : (
            <View>
              {plans.slice(0, 3).map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.workoutCard}
                  onPress={() => router.push(`/workout/${plan.id}`)}
                  testID={`workout-card-${plan.id}`}
                >
                  <Text style={styles.workoutName}>{plan.name}</Text>
                  <Text style={styles.workoutMeta}>
                    {plan.exercises.length} exercises
                    {plan.tags.length > 0 && ` \u2022 ${plan.tags.join(', ')}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Create Plan Button */}
      <View style={styles.fixedButtonContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/modal/import')}
          testID="button-import-workout"
        >
          <Text style={styles.createButtonText}>Create Plan</Text>
        </TouchableOpacity>
      </View>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={editingTileIndex !== null}
        onSelect={handleExerciseSelected}
        onCancel={() => setEditingTileIndex(null)}
      />
    </View>
  );
}
