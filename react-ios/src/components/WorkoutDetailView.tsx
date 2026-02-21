import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { WorkoutTemplate, TemplateExercise, TemplateSet } from '@/types';

const openYouTubeSearch = (exerciseName: string) => {
  const query = encodeURIComponent(exerciseName + ' exercise');
  Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
};

// Represents either a single exercise or a superset group
interface ExerciseGroup {
  type: 'single' | 'superset';
  exercises: TemplateExercise[];
  groupName?: string;
  sectionName?: string;
}

// Represents a section containing exercise groups
interface WorkoutSection {
  name: string | null;
  exerciseGroups: ExerciseGroup[];
}

// Interleaved set with exercise context
interface InterleavedSet {
  exerciseName: string;
  set: TemplateSet;
  setIndex: number;
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

interface WorkoutDetailViewProps {
  workout: WorkoutTemplate;
  onStartWorkout?: () => void;
  onReprocess?: () => void;
  onToggleFavorite?: () => void;
  isStarting?: boolean;
  isReprocessing?: boolean;
  showBackButton?: boolean;
}

export function WorkoutDetailView({
  workout,
  onStartWorkout,
  onReprocess,
  onToggleFavorite,
  isStarting = false,
  isReprocessing = false,
  showBackButton = false,
}: WorkoutDetailViewProps) {
  const { colors } = useTheme();

  // Group exercises by sections, then by superset/single within each section
  const workoutSections = useMemo((): WorkoutSection[] => {
    if (!workout) return [];

    const sections: WorkoutSection[] = [];
    const processedIds = new Set<string>();
    const exercises = workout.exercises;

    let currentSectionName: string | null = null;
    let currentSection: WorkoutSection | null = null;

    for (const exercise of exercises) {
      if (processedIds.has(exercise.id)) continue;

      if (exercise.groupType === 'section' && !exercise.parentExerciseId && exercise.sets.length === 0) {
        processedIds.add(exercise.id);
        currentSectionName = exercise.groupName || exercise.exerciseName;
        currentSection = { name: currentSectionName, exerciseGroups: [] };
        sections.push(currentSection);
        continue;
      }

      if (exercise.groupType === 'superset' && exercise.sets.length === 0) {
        const children = exercises.filter(
          (ex) => ex.parentExerciseId === exercise.id
        );

        processedIds.add(exercise.id);
        children.forEach((child) => processedIds.add(child.id));

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
            if (sections.length === 0 || sections[sections.length - 1].name !== null) {
              sections.push({ name: null, exerciseGroups: [] });
            }
            sections[sections.length - 1].exerciseGroups.push(group);
          }
        }
      } else {
        if (exercise.parentExerciseId) {
          const parent = exercises.find(ex => ex.id === exercise.parentExerciseId);
          if (parent?.groupType === 'superset') {
            continue;
          }
        }

        processedIds.add(exercise.id);

        const exerciseSectionName = exercise.groupType === 'section' ? exercise.groupName : currentSectionName;

        const group: ExerciseGroup = {
          type: 'single',
          exercises: [exercise],
          sectionName: exerciseSectionName || undefined,
        };

        if (currentSection) {
          currentSection.exerciseGroups.push(group);
        } else {
          if (sections.length === 0 || sections[sections.length - 1].name !== null) {
            sections.push({ name: null, exerciseGroups: [] });
          }
          sections[sections.length - 1].exerciseGroups.push(group);
        }
      }
    }

    return sections;
  }, [workout]);

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

  const formatSet = (set: TemplateSet, index: number, exerciseName?: string): string => {
    const parts: string[] = [];

    if (exerciseName) {
      parts.push(`Set ${index + 1} - ${exerciseName}:`);
    } else {
      parts.push(`Set ${index + 1}:`);
    }

    if (set.targetWeight !== undefined && set.targetReps !== undefined) {
      parts.push(`${set.targetReps} reps @ ${set.targetWeight} ${set.targetWeightUnit || 'lbs'}`);
    } else if (set.targetReps !== undefined) {
      parts.push(`${set.targetReps} reps`);
    } else if (set.targetWeight !== undefined) {
      parts.push(`${set.targetWeight} ${set.targetWeightUnit || 'lbs'}`);
    }

    if (set.targetTime !== undefined) {
      const minutes = Math.floor(set.targetTime / 60);
      const seconds = set.targetTime % 60;
      if (minutes > 0) {
        parts.push(`${minutes}m ${seconds}s`);
      } else {
        parts.push(`${seconds}s`);
      }
    }

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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.card,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    favoriteButton: {
      padding: 8,
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
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    youtubeLink: {
      color: colors.textMuted,
      marginLeft: 8,
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
    supersetCard: {},
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
    warmupSetRow: {
      borderLeftColor: colors.sectionWarmup,
    },
    cooldownSetRow: {
      borderLeftColor: colors.sectionCooldown,
    },
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

  return (
    <ScrollView style={styles.container} testID="workout-detail-view">
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{workout.name}</Text>
          {onToggleFavorite && (
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={onToggleFavorite}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="favorite-button-detail"
            >
              <Ionicons
                name={workout.isFavorite ? 'heart' : 'heart-outline'}
                size={28}
                color={workout.isFavorite ? colors.error : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {workout.description && (
          <Text style={styles.description}>{workout.description}</Text>
        )}

        {workout.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {workout.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Exercises</Text>
            <Text style={styles.metaValue}>{workout.exercises.length}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Total Sets</Text>
            <Text style={styles.metaValue}>
              {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}
            </Text>
          </View>
          {workout.defaultWeightUnit && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Units</Text>
              <Text style={styles.metaValue}>
                {workout.defaultWeightUnit.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {onStartWorkout && (
          <TouchableOpacity
            style={[styles.startWorkoutButton, isStarting && styles.startWorkoutButtonDisabled]}
            onPress={onStartWorkout}
            disabled={isStarting}
            testID="start-workout-button"
          >
            <Text style={styles.startWorkoutButtonText}>
              {isStarting ? 'Starting...' : 'Start Workout'}
            </Text>
          </TouchableOpacity>
        )}

        {onReprocess && workout.sourceMarkdown && (
          <TouchableOpacity
            style={[styles.reprocessButton, isReprocessing && styles.reprocessButtonDisabled]}
            onPress={onReprocess}
            disabled={isReprocessing}
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

          let globalIndexOffset = 0;
          for (let i = 0; i < sectionIndex; i++) {
            globalIndexOffset += workoutSections[i].exerciseGroups.length;
          }

          return (
            <View key={`section-${sectionIndex}`}>
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
                  const interleavedSets = interleavesets(group.exercises);

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
                          <View style={styles.exerciseNameRow}>
                            {group.exercises.map((ex, idx) => (
                              <View key={ex.id} style={styles.exerciseNameRow}>
                                {idx > 0 && <Text style={styles.exerciseName}> & </Text>}
                                <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                                <TouchableOpacity onPress={() => openYouTubeSearch(ex.exerciseName)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                  <Ionicons name="open-outline" size={16} style={styles.youtubeLink} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>

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
                          <View style={styles.exerciseNameRow}>
                            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                            <TouchableOpacity onPress={() => openYouTubeSearch(exercise.exerciseName)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <Ionicons name="open-outline" size={16} style={styles.youtubeLink} />
                            </TouchableOpacity>
                          </View>

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
