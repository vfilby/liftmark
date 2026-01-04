import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';
import type { TemplateExercise, TemplateSet } from '@/types';

// Represents either a single exercise or a superset group
interface ExerciseGroup {
  type: 'single' | 'superset';
  exercises: TemplateExercise[];
  groupName?: string;
}

// Interleaved set with exercise context
interface InterleavedSet {
  exerciseName: string;
  set: TemplateSet;
  setIndex: number; // 0-based index within the exercise
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedWorkout, loadWorkout, reprocessWorkout, isLoading, error, clearError } = useWorkoutStore();
  const { startWorkout, checkForActiveSession } = useSessionStore();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartWorkout = async () => {
    if (!selectedWorkout || isStarting) return;

    // Check for existing active session
    const hasActive = await checkForActiveSession();
    if (hasActive) {
      Alert.alert(
        'Workout In Progress',
        'You have another workout in progress. Please finish or cancel it first.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Resume Workout',
            onPress: () => router.push('/workout/active'),
          },
        ]
      );
      return;
    }

    setIsStarting(true);
    try {
      await startWorkout(selectedWorkout);
      router.push('/workout/active');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setIsStarting(false);
    }
  };

  const handleReprocess = async () => {
    if (!id || isReprocessing) return;

    Alert.alert(
      'Reprocess Workout',
      'This will re-parse the workout from its original markdown. Any manual edits will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reprocess',
          onPress: async () => {
            setIsReprocessing(true);
            const result = await reprocessWorkout(id);
            setIsReprocessing(false);

            if (result.success) {
              Alert.alert('Success', 'Workout has been reprocessed.');
            } else {
              Alert.alert('Error', result.errors?.join('\n') || 'Failed to reprocess workout');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (id) {
      loadWorkout(id);
    }
  }, [id]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => { clearError(); router.back(); } },
      ]);
    }
  }, [error]);

  // Group exercises: combine superset children, keep singles separate
  const exerciseGroups = useMemo((): ExerciseGroup[] => {
    if (!selectedWorkout) return [];

    const groups: ExerciseGroup[] = [];
    const processedIds = new Set<string>();
    const exercises = selectedWorkout.exercises;

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
  }, [selectedWorkout]);

  // Interleave sets from multiple exercises in a superset
  const interleavesets = (exercises: TemplateExercise[]): InterleavedSet[] => {
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
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 100,
    },
    header: {
      backgroundColor: colors.card,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    tag: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    tagText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },
    metaContainer: {
      flexDirection: 'row',
      gap: 16,
    },
    metaItem: {
      flex: 1,
    },
    metaLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    metaValue: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.primary,
    },
    exercisesSection: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
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
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
      marginRight: 12,
      minWidth: 24,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    exerciseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    exerciseMetaText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    metaSeparator: {
      fontSize: 13,
      color: colors.borderLight,
      marginHorizontal: 6,
    },
    exerciseNotes: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    setsContainer: {
      gap: 8,
    },
    setRow: {
      backgroundColor: colors.backgroundSecondary,
      padding: 12,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    setText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Superset-specific styles
    supersetCard: {
      borderLeftWidth: 4,
      borderLeftColor: '#8b5cf6',
    },
    supersetBadge: {
      backgroundColor: '#8b5cf6',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 6,
    },
    supersetBadgeText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    supersetSetRow: {
      borderLeftColor: '#8b5cf6',
    },
    setRowGroupStart: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    // Start Workout button
    startWorkoutButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: 'center',
    },
    startWorkoutButtonDisabled: {
      opacity: 0.5,
    },
    startWorkoutButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Reprocess button
    reprocessButton: {
      marginTop: 12,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    reprocessButtonDisabled: {
      opacity: 0.5,
    },
    reprocessButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
  });

  if (!selectedWorkout) {
    return (
      <View style={styles.container} testID="workout-detail-loading">
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const formatSet = (set: TemplateSet, index: number, exerciseName?: string): string => {
    const parts: string[] = [];

    // Set number with optional exercise name for supersets
    if (exerciseName) {
      parts.push(`Set ${index + 1} - ${exerciseName}:`);
    } else {
      parts.push(`Set ${index + 1}:`);
    }

    // Weight and reps
    if (set.targetWeight !== undefined && set.targetReps !== undefined) {
      parts.push(`${set.targetReps} reps @ ${set.targetWeight}${set.targetWeightUnit || ''}`);
    } else if (set.targetReps !== undefined) {
      parts.push(`${set.targetReps} reps`);
    } else if (set.targetWeight !== undefined) {
      parts.push(`${set.targetWeight}${set.targetWeightUnit || ''}`);
    }

    // Time
    if (set.targetTime !== undefined) {
      const minutes = Math.floor(set.targetTime / 60);
      const seconds = set.targetTime % 60;
      if (minutes > 0) {
        parts.push(`${minutes}m ${seconds}s`);
      } else {
        parts.push(`${seconds}s`);
      }
    }

    // Modifiers
    if (set.targetRpe !== undefined) {
      parts.push(`RPE ${set.targetRpe}`);
    }
    if (set.restSeconds !== undefined) {
      parts.push(`Rest ${set.restSeconds}s`);
    }
    if (set.tempo) {
      parts.push(`Tempo ${set.tempo}`);
    }
    if (set.isDropset) {
      parts.push('(Dropset)');
    }

    return parts.join(' • ');
  };

  return (
    <ScrollView style={styles.container} testID="workout-detail-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{selectedWorkout.name}</Text>

        {selectedWorkout.description && (
          <Text style={styles.description}>{selectedWorkout.description}</Text>
        )}

        {selectedWorkout.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {selectedWorkout.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Exercises</Text>
            <Text style={styles.metaValue}>{selectedWorkout.exercises.length}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Total Sets</Text>
            <Text style={styles.metaValue}>
              {selectedWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}
            </Text>
          </View>
          {selectedWorkout.defaultWeightUnit && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Units</Text>
              <Text style={styles.metaValue}>
                {selectedWorkout.defaultWeightUnit.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.startWorkoutButton, isStarting && styles.startWorkoutButtonDisabled]}
          onPress={handleStartWorkout}
          disabled={isStarting || isLoading}
          testID="start-workout-button"
        >
          <Text style={styles.startWorkoutButtonText}>
            {isStarting ? 'Starting...' : 'Start Workout'}
          </Text>
        </TouchableOpacity>

        {selectedWorkout.sourceMarkdown && (
          <TouchableOpacity
            style={[styles.reprocessButton, isReprocessing && styles.reprocessButtonDisabled]}
            onPress={handleReprocess}
            disabled={isReprocessing || isLoading}
          >
            <Text style={styles.reprocessButtonText}>
              {isReprocessing ? 'Reprocessing...' : 'Reprocess from Markdown'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.exercisesSection}>
        <Text style={styles.sectionTitle}>Exercises</Text>

        {exerciseGroups.map((group, groupIndex) => {
          if (group.type === 'superset') {
            // Render superset with interleaved sets
            const interleavedSets = interleavesets(group.exercises);
            const exerciseNames = group.exercises.map((ex) => ex.exerciseName).join(' & ');

            return (
              <View
                key={`superset-${groupIndex}`}
                style={[styles.exerciseCard, styles.supersetCard]}
                testID={`superset-${groupIndex}`}
              >
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseNumber}>{groupIndex + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <View style={styles.supersetBadge}>
                      <Text style={styles.supersetBadgeText}>SUPERSET</Text>
                    </View>
                    <Text style={styles.exerciseName}>{exerciseNames}</Text>

                    {/* Show notes from child exercises */}
                    {group.exercises.map((ex) =>
                      ex.notes ? (
                        <Text key={ex.id} style={styles.exerciseNotes}>
                          {ex.exerciseName}: {ex.notes}
                        </Text>
                      ) : null
                    )}
                  </View>
                </View>

                <View style={styles.setsContainer}>
                  {interleavedSets.map((item, idx) => (
                    <View
                      key={`${item.set.id}-${idx}`}
                      style={[
                        styles.setRow,
                        styles.supersetSetRow,
                        idx % group.exercises.length === 0 && idx > 0
                          ? styles.setRowGroupStart
                          : null,
                      ]}
                      testID={`set-${item.set.id}`}
                    >
                      <Text style={styles.setText}>
                        {formatSet(item.set, item.setIndex, item.exerciseName)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          } else {
            // Render single exercise
            const exercise = group.exercises[0];
            return (
              <View
                key={exercise.id}
                style={styles.exerciseCard}
                testID={`exercise-${exercise.id}`}
              >
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseNumber}>{groupIndex + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>

                    {exercise.equipmentType && (
                      <View style={styles.exerciseMeta}>
                        <Text style={styles.exerciseMetaText}>
                          {exercise.equipmentType}
                        </Text>
                      </View>
                    )}

                    {exercise.notes && (
                      <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.setsContainer}>
                  {exercise.sets.map((set, setIndex) => (
                    <View
                      key={set.id}
                      style={styles.setRow}
                      testID={`set-${set.id}`}
                    >
                      <Text style={styles.setText}>{formatSet(set, setIndex)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          }
        })}
      </View>
    </ScrollView>
  );
}
