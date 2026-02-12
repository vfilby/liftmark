import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWorkoutPlanStore } from '@/stores/workoutPlanStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';
import { useResponsivePadding, useResponsiveFontSizes, useDeviceLayout } from '@/utils/responsive';
import { getExerciseBestWeights, getMostFrequentExercise } from '@/db/sessionRepository';

type LiftData = { weight: number; unit: string } | null;

interface MaxLifts {
  squat: LiftData;
  deadlift: LiftData;
  bench: LiftData;
  frequent: { name: string; weight: number; unit: string } | null;
}

function matchExercise(
  bestWeights: Map<string, { weight: number; reps: number; unit: string }>,
  includes: string[],
  excludes: string[]
): { name: string; weight: number; unit: string } | null {
  for (const [name, data] of bestWeights) {
    const lower = name.toLowerCase();
    const matches = includes.some(term => lower.includes(term));
    const excluded = excludes.some(term => lower.includes(term));
    if (matches && !excluded) {
      return { name, weight: data.weight, unit: data.unit };
    }
  }
  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const padding = useResponsivePadding();
  const fonts = useResponsiveFontSizes();
  const { isTablet } = useDeviceLayout();
  const { plans, loadPlans } = useWorkoutPlanStore();
  const { activeSession, resumeSession, getProgress } = useSessionStore();
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [maxLifts, setMaxLifts] = useState<MaxLifts>({
    squat: null,
    deadlift: null,
    bench: null,
    frequent: null,
  });

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

      const loadMaxLifts = async () => {
        const bestWeights = await getExerciseBestWeights();

        const squat = matchExercise(bestWeights, ['squat'], ['front squat']);
        const deadlift = matchExercise(bestWeights, ['deadlift'], ['romanian', 'rdl']);
        const bench = matchExercise(bestWeights, ['bench press', 'chest press'], []);

        // Collect matched names to exclude from frequency query
        const excludeNames: string[] = [];
        if (squat) excludeNames.push(squat.name);
        if (deadlift) excludeNames.push(deadlift.name);
        if (bench) excludeNames.push(bench.name);

        const frequent = await getMostFrequentExercise(excludeNames);

        setMaxLifts({
          squat: squat ? { weight: squat.weight, unit: squat.unit } : null,
          deadlift: deadlift ? { weight: deadlift.weight, unit: deadlift.unit } : null,
          bench: bench ? { weight: bench.weight, unit: bench.unit } : null,
          frequent: frequent ? { name: frequent.name, weight: frequent.weight, unit: frequent.unit } : null,
        });
      };
      loadMaxLifts();
    }, [])
  );

  const handleResumeWorkout = () => {
    router.push('/workout/active');
  };

  const formatWeight = (data: LiftData) => {
    if (!data) return '\u2014';
    return `${data.weight} ${data.unit}`;
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
            <View style={styles.quadrantCard} testID="max-lift-squat">
              <Text style={styles.quadrantWeight}>{formatWeight(maxLifts.squat)}</Text>
              <Text style={styles.quadrantLabel}>Squat</Text>
            </View>
            <View style={styles.quadrantCard} testID="max-lift-deadlift">
              <Text style={styles.quadrantWeight}>{formatWeight(maxLifts.deadlift)}</Text>
              <Text style={styles.quadrantLabel}>Deadlift</Text>
            </View>
            <View style={styles.quadrantCard} testID="max-lift-bench">
              <Text style={styles.quadrantWeight}>{formatWeight(maxLifts.bench)}</Text>
              <Text style={styles.quadrantLabel}>Bench Press</Text>
            </View>
            <View style={styles.quadrantCard} testID="max-lift-frequent">
              <Text style={styles.quadrantWeight}>
                {maxLifts.frequent ? `${maxLifts.frequent.weight} ${maxLifts.frequent.unit}` : '\u2014'}
              </Text>
              <Text style={styles.quadrantLabel}>
                {maxLifts.frequent ? maxLifts.frequent.name : 'Other'}
              </Text>
            </View>
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
    </View>
  );
}
