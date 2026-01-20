import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const openYouTubeSearch = (exerciseName: string) => {
  const query = encodeURIComponent(exerciseName + ' exercise');
  Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
};
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';
import { useResponsivePadding, useResponsiveFontSizes } from '@/utils/responsive';

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const padding = useResponsivePadding();
  const fonts = useResponsiveFontSizes();
  const { activeSession, pauseSession, getProgress, getTrackableExercises } = useSessionStore();

  // If no session, go back
  useEffect(() => {
    if (!activeSession) {
      router.replace('/');
    }
  }, [activeSession]);

  const handleDone = async () => {
    // Clear session from store (it's already saved as completed in DB)
    await pauseSession();
    router.replace('/');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: padding.container,
      paddingBottom: 100,
    },
    // Success Header
    successHeader: {
      alignItems: 'center',
      paddingVertical: padding.large,
      backgroundColor: colors.card,
      borderRadius: 16,
      marginBottom: padding.container,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    checkmark: {
      fontSize: 64,
      color: colors.success,
      marginBottom: 12,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    workoutName: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    // Stats Grid
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      width: '47%',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Completion Card
    completionCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    completionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    completionLabel: {
      fontSize: 15,
      color: colors.text,
    },
    completionValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    skippedValue: {
      color: colors.warning,
    },
    // Exercise Summary
    exerciseSummary: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseRowName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    youtubeLink: {
      fontSize: 12,
      color: colors.textMuted,
      marginLeft: 8,
    },
    exerciseRowMeta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    exerciseCheck: {
      fontSize: 18,
      color: colors.success,
      marginLeft: 8,
    },
    // Footer
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    doneButton: {
      backgroundColor: colors.success,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    doneButtonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
  });

  if (!activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const { completed, total } = getProgress();
  const trackableExercises = getTrackableExercises();

  // Calculate duration
  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Calculate totals
  let totalWeight = 0;
  let totalReps = 0;
  let completedSets = 0;
  let skippedSets = 0;

  for (const exercise of trackableExercises) {
    for (const set of exercise.sets) {
      if (set.status === 'completed') {
        completedSets++;
        if (set.actualWeight && set.actualReps) {
          totalWeight += set.actualWeight * set.actualReps;
          totalReps += set.actualReps;
        } else if (set.actualReps) {
          totalReps += set.actualReps;
        }
      } else if (set.status === 'skipped') {
        skippedSets++;
      }
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.successTitle}>Workout Complete!</Text>
          <Text style={styles.workoutName}>{activeSession.name}</Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDuration(activeSession.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedSets}</Text>
            <Text style={styles.statLabel}>Sets Completed</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalReps}</Text>
            <Text style={styles.statLabel}>Total Reps</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {totalWeight > 0 ? `${Math.round(totalWeight).toLocaleString()}` : '-'}
            </Text>
            <Text style={styles.statLabel}>Total Volume</Text>
          </View>
        </View>

        {/* Completion Summary */}
        <View style={styles.completionCard}>
          <View style={styles.completionRow}>
            <Text style={styles.completionLabel}>Sets Completed</Text>
            <Text style={styles.completionValue}>{completedSets}</Text>
          </View>
          {skippedSets > 0 && (
            <View style={styles.completionRow}>
              <Text style={styles.completionLabel}>Sets Skipped</Text>
              <Text style={[styles.completionValue, styles.skippedValue]}>{skippedSets}</Text>
            </View>
          )}
          <View style={styles.completionRow}>
            <Text style={styles.completionLabel}>Completion Rate</Text>
            <Text style={styles.completionValue}>
              {total > 0 ? Math.round((completedSets / total) * 100) : 0}%
            </Text>
          </View>
        </View>

        {/* Exercise Summary */}
        <View style={styles.exerciseSummary}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {trackableExercises.map((exercise) => {
            const exerciseCompletedSets = exercise.sets.filter(
              (s) => s.status === 'completed'
            ).length;
            const exerciseSkippedSets = exercise.sets.filter(
              (s) => s.status === 'skipped'
            ).length;

            return (
              <View key={exercise.id} style={styles.exerciseRow}>
                <View style={styles.exerciseInfo}>
                  <View style={styles.exerciseNameRow}>
                    <Text style={styles.exerciseRowName}>{exercise.exerciseName}</Text>
                    <TouchableOpacity onPress={() => openYouTubeSearch(exercise.exerciseName)}>
                      <Ionicons name="open-outline" size={14} style={styles.youtubeLink} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.exerciseRowMeta}>
                    {exerciseCompletedSets} / {exercise.sets.length} sets
                    {exerciseSkippedSets > 0 && ` (${exerciseSkippedSets} skipped)`}
                  </Text>
                </View>
                {exerciseCompletedSets === exercise.sets.length && (
                  <Text style={styles.exerciseCheck}>✓</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
