import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { getWorkoutSessionById, deleteSession } from '@/db/sessionRepository';
import { useTheme } from '@/theme';
import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

interface ExerciseGroup {
  type: 'single' | 'superset';
  exercises: SessionExercise[];
  groupName?: string;
}

interface InterleavedSet {
  exerciseName: string;
  set: SessionSet;
  setIndex: number;
}

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDelete = () => {
    if (!session) return;

    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${session.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSession(session.id);
              router.back();
            } catch (error) {
              console.error('Failed to delete session:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    async function loadSession() {
      if (!id) return;
      try {
        const loadedSession = await getWorkoutSessionById(id);
        setSession(loadedSession);
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, [id]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatSetResult = (set: SessionSet): string => {
    const parts: string[] = [];
    const unit = set.actualWeightUnit || set.targetWeightUnit || 'lbs';
    const reps = set.actualReps ?? set.targetReps;
    const rpe = set.actualRpe ?? set.targetRpe;

    // Always show weight for rep-based exercises
    if (reps !== undefined) {
      const weight = set.actualWeight ?? set.targetWeight ?? 0;
      parts.push(`${weight}${unit}`);
      parts.push(`${reps} reps`);
    }
    // Time-based sets
    if (set.actualTime ?? set.targetTime) {
      parts.push(`${set.actualTime ?? set.targetTime}s`);
    }
    if (rpe !== undefined) {
      parts.push(`RPE ${rpe}`);
    }
    return parts.join(' × ') || 'Bodyweight';
  };

  const getSessionStats = (session: WorkoutSession) => {
    let completedSets = 0;
    let skippedSets = 0;
    let totalSets = 0;
    let totalVolume = 0;
    let totalReps = 0;

    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        totalSets++;
        if (set.status === 'completed') {
          completedSets++;
          const reps = set.actualReps ?? set.targetReps ?? 0;
          totalReps += reps;
          if (set.actualWeight && set.actualReps) {
            totalVolume += set.actualWeight * set.actualReps;
          }
        } else if (set.status === 'skipped') {
          skippedSets++;
        }
      }
    }

    return { completedSets, skippedSets, totalSets, totalVolume, totalReps };
  };

  // Group exercises: combine superset children, keep singles separate
  const exerciseGroups = useMemo((): ExerciseGroup[] => {
    if (!session) return [];

    const groups: ExerciseGroup[] = [];
    const processedIds = new Set<string>();
    const exercises = session.exercises;

    for (const exercise of exercises) {
      if (processedIds.has(exercise.id)) continue;

      // Check if this is a superset parent (has groupType 'superset', no parent, and no sets)
      if (exercise.groupType === 'superset' && !exercise.parentExerciseId && exercise.sets.length === 0) {
        // Find all children of this superset
        const children = exercises.filter(
          (ex) => ex.parentExerciseId === exercise.id
        );

        // Mark all as processed
        processedIds.add(exercise.id);
        children.forEach((child) => processedIds.add(child.id));

        // Only add if there are actual child exercises with sets
        if (children.length > 0) {
          groups.push({
            type: 'superset',
            exercises: children,
            groupName: exercise.groupName || exercise.exerciseName,
          });
        }
      } else if (!exercise.parentExerciseId) {
        // Regular exercise (not a superset child)
        processedIds.add(exercise.id);
        groups.push({
          type: 'single',
          exercises: [exercise],
        });
      }
      // Skip superset children - they're handled when we process the parent
    }

    return groups;
  }, [session]);

  // Interleave sets from multiple exercises in a superset
  const interleaveSets = (exercises: SessionExercise[]): InterleavedSet[] => {
    const result: InterleavedSet[] = [];
    const maxSets = Math.max(...exercises.map((ex) => ex.sets.length));

    for (let setIdx = 0; setIdx < maxSets; setIdx++) {
      for (const exercise of exercises) {
        if (setIdx < exercise.sets.length) {
          result.push({
            exerciseName: exercise.exerciseName,
            set: exercise.sets[setIdx],
            setIndex: setIdx,
          });
        }
      }
    }

    return result;
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
    errorText: {
      fontSize: 16,
      color: colors.error,
    },
    deleteButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    deleteButtonText: {
      fontSize: 16,
      color: colors.error,
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    // Header Card
    headerCard: {
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
    date: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    time: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    timeSeparator: {
      fontSize: 15,
      color: colors.borderLight,
      marginHorizontal: 8,
    },
    duration: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    // Stats Grid
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    // Exercises Section
    exercisesSection: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    exerciseCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    exerciseHeader: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    exerciseNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      marginRight: 12,
      minWidth: 20,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    equipmentType: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    setsContainer: {
      marginLeft: 32,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    setRowSkipped: {
      opacity: 0.6,
    },
    setNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.successLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    setNumberCompleted: {
      backgroundColor: colors.successLighter,
    },
    setNumberSkipped: {
      backgroundColor: colors.warningLighter,
    },
    setNumberText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    setNumberTextCompleted: {
      color: colors.success,
    },
    setNumberTextSkipped: {
      color: colors.warning,
    },
    setResult: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    setResultSkipped: {
      fontStyle: 'italic',
      color: colors.textMuted,
    },
    setResultContainer: {
      flex: 1,
    },
    setExerciseName: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    // Notes Section
    notesSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    notesText: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Workout not found</Text>
        </View>
      </View>
    );
  }

  const stats = getSessionStats(session);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: session.name,
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Header Info */}
        <View style={styles.headerCard}>
          <Text style={styles.date}>{formatDate(session.date)}</Text>
          <View style={styles.timeRow}>
            {session.startTime && (
              <Text style={styles.time}>{formatTime(session.startTime)}</Text>
            )}
            {session.startTime && session.duration && (
              <Text style={styles.timeSeparator}>•</Text>
            )}
            {session.duration && (
              <Text style={styles.duration}>{formatDuration(session.duration)}</Text>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completedSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalReps}</Text>
            <Text style={styles.statLabel}>Reps</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.totalVolume > 0 ? Math.round(stats.totalVolume).toLocaleString() : '-'}
            </Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
        </View>

        {/* Exercises */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>Exercises</Text>

          {exerciseGroups.map((group, groupIndex) => (
            <View key={group.exercises[0].id} style={styles.exerciseCard}>
              {group.type === 'superset' ? (
                <>
                  {/* Superset Header */}
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseNumber}>{groupIndex + 1}</Text>
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{group.groupName}</Text>
                      <Text style={styles.equipmentType}>
                        {group.exercises.map(ex => ex.exerciseName).join(' + ')}
                      </Text>
                    </View>
                  </View>

                  {/* Interleaved Sets */}
                  <View style={styles.setsContainer}>
                    {interleaveSets(group.exercises).map((item, idx) => (
                      <View
                        key={`${item.set.id}-${idx}`}
                        style={[
                          styles.setRow,
                          item.set.status === 'skipped' && styles.setRowSkipped,
                        ]}
                      >
                        <View style={[
                          styles.setNumber,
                          item.set.status === 'completed' && styles.setNumberCompleted,
                          item.set.status === 'skipped' && styles.setNumberSkipped,
                        ]}>
                          <Text style={[
                            styles.setNumberText,
                            item.set.status === 'completed' && styles.setNumberTextCompleted,
                            item.set.status === 'skipped' && styles.setNumberTextSkipped,
                          ]}>
                            {item.set.status === 'completed' ? '✓' : item.set.status === 'skipped' ? '−' : item.setIndex + 1}
                          </Text>
                        </View>
                        <View style={styles.setResultContainer}>
                          <Text style={styles.setExerciseName}>{item.exerciseName}</Text>
                          <Text style={[
                            styles.setResult,
                            item.set.status === 'skipped' && styles.setResultSkipped,
                          ]}>
                            {item.set.status === 'skipped' ? 'Skipped' : formatSetResult(item.set)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  {/* Single Exercise */}
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseNumber}>{groupIndex + 1}</Text>
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{group.exercises[0].exerciseName}</Text>
                      {group.exercises[0].equipmentType && (
                        <Text style={styles.equipmentType}>{group.exercises[0].equipmentType}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.setsContainer}>
                    {group.exercises[0].sets.map((set, setIndex) => (
                      <View
                        key={set.id}
                        style={[
                          styles.setRow,
                          set.status === 'skipped' && styles.setRowSkipped,
                        ]}
                      >
                        <View style={[
                          styles.setNumber,
                          set.status === 'completed' && styles.setNumberCompleted,
                          set.status === 'skipped' && styles.setNumberSkipped,
                        ]}>
                          <Text style={[
                            styles.setNumberText,
                            set.status === 'completed' && styles.setNumberTextCompleted,
                            set.status === 'skipped' && styles.setNumberTextSkipped,
                          ]}>
                            {set.status === 'completed' ? '✓' : set.status === 'skipped' ? '−' : setIndex + 1}
                          </Text>
                        </View>
                        <Text style={[
                          styles.setResult,
                          set.status === 'skipped' && styles.setResultSkipped,
                        ]}>
                          {set.status === 'skipped' ? 'Skipped' : formatSetResult(set)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Notes */}
        {session.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{session.notes}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
