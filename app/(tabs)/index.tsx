import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { workouts, loadWorkouts } = useWorkoutStore();
  const { loadSettings } = useSettingsStore();
  const { activeSession, resumeSession, getProgress } = useSessionStore();
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    // Load data on mount
    loadWorkouts();
    loadSettings();
  }, []);

  // Check for active session when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const checkSession = async () => {
        await resumeSession();
        const session = useSessionStore.getState().activeSession;
        setHasActiveSession(session !== null);
      };
      checkSession();
    }, [])
  );

  const handleResumeWorkout = () => {
    router.push('/workout/active');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    stats: {
      flexDirection: 'row',
      padding: 16,
      gap: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statNumber: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actions: {
      padding: 16,
      gap: 12,
    },
    button: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    secondaryButton: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    recentSection: {
      flex: 1,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    emptyState: {
      flex: 1,
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
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
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
  });

  return (
    <View style={styles.container} testID="home-screen">
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
          <Text style={styles.resumeArrow}>→</Text>
        </TouchableOpacity>
      )}

      <View style={styles.stats}>
        <View style={styles.statCard} testID="stat-workouts">
          <Text style={styles.statNumber}>{workouts.length}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.push('/modal/import')}
          testID="button-import-workout"
        >
          <Text style={styles.primaryButtonText}>Import Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push('/(tabs)/workouts')}
          testID="button-view-workouts"
        >
          <Text style={styles.secondaryButtonText}>View Workouts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        {workouts.length === 0 ? (
          <View style={styles.emptyState} testID="empty-state">
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>
              Import your first workout to get started
            </Text>
          </View>
        ) : (
          <View>
            {workouts.slice(0, 3).map((workout) => (
              <TouchableOpacity
                key={workout.id}
                style={styles.workoutCard}
                onPress={() => router.push(`/workout/${workout.id}`)}
                testID={`workout-card-${workout.id}`}
              >
                <Text style={styles.workoutName}>{workout.name}</Text>
                <Text style={styles.workoutMeta}>
                  {workout.exercises.length} exercises
                  {workout.tags.length > 0 && ` • ${workout.tags.join(', ')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
