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
  sectionName?: string; // The section this exercise belongs to (Warmup, Cool Down, etc.)
}

// Represents a section containing exercise groups
interface WorkoutSection {
  name: string | null; // null for exercises not in a section
  exerciseGroups: ExerciseGroup[];
}

// Interleaved set with exercise context
interface InterleavedSet {
  exerciseName: string;
  set: TemplateSet;
  setIndex: number; // 0-based index within the exercise
}

// Detect section type from name for styling
type SectionType = 'warmup' | 'cooldown' | 'default';

function getSectionType(sectionName: string | null): SectionType {
  if (!sectionName) return 'default';
  const lower = sectionName.toLowerCase();
  if (lower.includes('warm') || lower.includes('mobility') || lower.includes('activation')) {
    return 'warmup';
  }
  if (lower.includes('cool') || lower.includes('stretch') || lower.includes('recovery')) {
    return 'cooldown';
  }
  return 'default';
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

  // Group exercises by sections, then by superset/single within each section
  const workoutSections = useMemo((): WorkoutSection[] => {
    if (!selectedWorkout) return [];

    const sections: WorkoutSection[] = [];
    const processedIds = new Set<string>();
    const exercises = selectedWorkout.exercises;

    // Track current section as we iterate
    let currentSectionName: string | null = null;
    let currentSection: WorkoutSection | null = null;

    for (const exercise of exercises) {
      if (processedIds.has(exercise.id)) continue;

      // Check if this is a section parent (groupType 'section', no parent, no sets)
      if (exercise.groupType === 'section' && !exercise.parentExerciseId && exercise.sets.length === 0) {
        // This is a section header - start a new section
        processedIds.add(exercise.id);
        currentSectionName = exercise.groupName || exercise.exerciseName;
        currentSection = { name: currentSectionName, exerciseGroups: [] };
        sections.push(currentSection);
        continue;
      }

      // Check if this is a superset parent (has groupType 'superset' and no sets)
      // Note: superset parents inside sections will have parentExerciseId pointing to the section
      if (exercise.groupType === 'superset' && exercise.sets.length === 0) {
        // Find all children of this superset
        const children = exercises.filter(
          (ex) => ex.parentExerciseId === exercise.id
        );

        // Mark all as processed
        processedIds.add(exercise.id);
        children.forEach((child) => processedIds.add(child.id));

        // Only add if there are actual child exercises with sets
        if (children.length > 0) {
          const group: ExerciseGroup = {
            type: 'superset',
            exercises: children,
            groupName: exercise.groupName || exercise.exerciseName,
            sectionName: currentSectionName || undefined,
          };

          if (currentSection) {
            currentSection.exerciseGroups.push(group);
          } else {
            // No section yet - create a default section
            if (sections.length === 0 || sections[sections.length - 1].name !== null) {
              sections.push({ name: null, exerciseGroups: [] });
            }
            sections[sections.length - 1].exerciseGroups.push(group);
          }
        }
      } else {
        // Check if this is a superset child (skip - handled when processing superset parent)
        if (exercise.parentExerciseId) {
          const parent = exercises.find(ex => ex.id === exercise.parentExerciseId);
          if (parent?.groupType === 'superset') {
            // Skip superset children - they're handled when we process the parent
            continue;
          }
        }

        // Regular exercise or section child
        processedIds.add(exercise.id);

        // Check if this exercise belongs to a section (has groupName from being a section child)
        const exerciseSectionName = exercise.groupType === 'section' ? exercise.groupName : currentSectionName;

        const group: ExerciseGroup = {
          type: 'single',
          exercises: [exercise],
          sectionName: exerciseSectionName || undefined,
        };

        if (currentSection) {
          currentSection.exerciseGroups.push(group);
        } else {
          // No section yet - create a default section
          if (sections.length === 0 || sections[sections.length - 1].name !== null) {
            sections.push({ name: null, exerciseGroups: [] });
          }
          sections[sections.length - 1].exerciseGroups.push(group);
        }
      }
    }

    return sections;
  }, [selectedWorkout]);

  // Flatten for exercise numbering (global index across all sections)
  const allExerciseGroups = useMemo(() => {
    return workoutSections.flatMap(section => section.exerciseGroups);
  }, [workoutSections]);

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
      // No outer border - sets will match section color
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
    setRowGroupStart: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    // Section header styles
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sectionHeaderLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    sectionHeaderTextContainer: {
      paddingHorizontal: 12,
    },
    sectionHeaderText: {
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    // Section-specific styles
    warmupSetRow: {
      borderLeftColor: colors.sectionWarmup,
    },
    cooldownSetRow: {
      borderLeftColor: colors.sectionCooldown,
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
    if (set.isPerSide) {
      parts.push('(per side)');
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

        {workoutSections.map((section, sectionIndex) => {
          const sectionType = getSectionType(section.name);
          const sectionColor = sectionType === 'warmup'
            ? colors.sectionWarmup
            : sectionType === 'cooldown'
              ? colors.sectionCooldown
              : colors.primary;

          // Calculate global exercise index for numbering
          let globalIndexOffset = 0;
          for (let i = 0; i < sectionIndex; i++) {
            globalIndexOffset += workoutSections[i].exerciseGroups.length;
          }

          return (
            <View key={`section-${sectionIndex}`}>
              {/* Section header - only show if section has a name */}
              {section.name && (
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionHeaderLine, { backgroundColor: sectionColor }]} />
                  <View style={styles.sectionHeaderTextContainer}>
                    <Text style={[styles.sectionHeaderText, { color: sectionColor }]}>
                      {section.name}
                    </Text>
                  </View>
                  <View style={[styles.sectionHeaderLine, { backgroundColor: sectionColor }]} />
                </View>
              )}

              {section.exerciseGroups.map((group, groupIndex) => {
                const globalIndex = globalIndexOffset + groupIndex;
                const numberColor = sectionColor;
                const setRowSectionStyle = sectionType === 'warmup'
                  ? styles.warmupSetRow
                  : sectionType === 'cooldown'
                    ? styles.cooldownSetRow
                    : null;

                if (group.type === 'superset') {
                  // Render superset with interleaved sets
                  const interleavedSets = interleavesets(group.exercises);
                  const exerciseNames = group.exercises.map((ex) => ex.exerciseName).join(' & ');

                  return (
                    <View
                      key={`superset-${globalIndex}`}
                      style={[styles.exerciseCard, styles.supersetCard]}
                      testID={`superset-${globalIndex}`}
                    >
                      <View style={styles.exerciseHeader}>
                        <Text style={[styles.exerciseNumber, { color: numberColor }]}>{globalIndex + 1}</Text>
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
                              setRowSectionStyle,
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
                        <Text style={[styles.exerciseNumber, { color: numberColor }]}>{globalIndex + 1}</Text>
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
                            style={[styles.setRow, setRowSectionStyle]}
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
          );
        })}
      </View>
    </ScrollView>
  );
}
