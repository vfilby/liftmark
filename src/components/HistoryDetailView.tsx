import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { WorkoutSession, SessionExercise, SessionSet, ExerciseHistoryPoint, ChartMetricType } from '@/types';
import { getExerciseHistory } from '@/db/exerciseHistoryRepository';
import { ExerciseHistoryChart } from './ExerciseHistoryChart';
import { ExerciseHistoryBottomSheet } from './ExerciseHistoryBottomSheet';

interface ExerciseGroup {
  type: 'single' | 'superset';
  exercises: SessionExercise[];
  groupName?: string;
  sectionName?: string;
}

interface WorkoutSection {
  name: string | null;
  exerciseGroups: ExerciseGroup[];
}

interface InterleavedSet {
  exerciseName: string;
  set: SessionSet;
  setIndex: number;
}

interface HistoryDetailViewProps {
  session: WorkoutSession;
  onDelete?: () => void;
}

export function HistoryDetailView({ session }: HistoryDetailViewProps) {
  const { colors } = useTheme();

  // Track expanded exercises for chart display
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [historyData, setHistoryData] = useState<Map<string, ExerciseHistoryPoint[]>>(new Map());
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set());
  const [selectedMetrics, setSelectedMetrics] = useState<Map<string, ChartMetricType>>(new Map());
  const [bottomSheetExercise, setBottomSheetExercise] = useState<string | null>(null);

  // Load history when an exercise is expanded
  const loadExerciseHistory = async (exerciseName: string) => {
    if (historyData.has(exerciseName) || loadingHistory.has(exerciseName)) return;

    setLoadingHistory(prev => new Set(prev).add(exerciseName));
    try {
      const data = await getExerciseHistory(exerciseName, 10);
      setHistoryData(prev => new Map(prev).set(exerciseName, data));
    } catch (error) {
      console.error('Failed to load exercise history:', error);
      setHistoryData(prev => new Map(prev).set(exerciseName, []));
    } finally {
      setLoadingHistory(prev => {
        const next = new Set(prev);
        next.delete(exerciseName);
        return next;
      });
    }
  };

  const toggleExerciseExpanded = (exerciseName: string) => {
    // Only toggle if there's data
    const data = historyData.get(exerciseName) || [];
    if (data.length === 0) return;

    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseName)) {
        next.delete(exerciseName);
      } else {
        next.add(exerciseName);
      }
      return next;
    });
  };

  const setMetricForExercise = (exerciseName: string, metric: ChartMetricType) => {
    setSelectedMetrics(prev => new Map(prev).set(exerciseName, metric));
  };

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

    if (reps !== undefined) {
      const weight = set.actualWeight ?? set.targetWeight ?? 0;
      parts.push(`${weight}${unit}`);
      parts.push(`${reps} reps`);
    }
    if (set.actualTime ?? set.targetTime) {
      parts.push(`${set.actualTime ?? set.targetTime}s`);
    }
    if (rpe !== undefined) {
      parts.push(`RPE ${rpe}`);
    }
    if (set.isPerSide) {
      parts.push('(per side)');
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

  // Load history data for all exercises on mount
  useEffect(() => {
    const exerciseNames = new Set<string>();
    session.exercises.forEach(exercise => {
      // Skip section/superset parents without sets
      if (exercise.sets.length > 0) {
        exerciseNames.add(exercise.exerciseName);
      }
    });

    // Load history for all unique exercise names
    exerciseNames.forEach(name => {
      if (!historyData.has(name) && !loadingHistory.has(name)) {
        loadExerciseHistory(name);
      }
    });
  }, [session]);

  const workoutSections = useMemo((): WorkoutSection[] => {
    if (!session) return [];

    const sections: WorkoutSection[] = [];
    const processedIds = new Set<string>();
    const exercises = session.exercises;

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
  }, [session]);

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

  const stats = getSessionStats(session);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      padding: 16,
    },
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
    exercisesSection: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 8,
    },
    sectionHeaderLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.primary,
    },
    sectionHeaderTextContainer: {
      paddingHorizontal: 12,
    },
    sectionHeaderText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    chartContainer: {
      marginTop: 8,
      marginHorizontal: 0,
      padding: 8,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      minHeight: 180,
      justifyContent: 'center',
      alignItems: 'center',
    },
    trendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundSecondary,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
    },
    trendHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    trendHeaderText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    trendHeaderDisabled: {
      opacity: 0.5,
    },
    trendHeaderTextDisabled: {
      color: colors.textMuted,
    },
    detailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginTop: 12,
      marginHorizontal: 0,
    },
    detailsButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#ffffff',
    },
  });

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      testID="history-detail-view"
    >
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

      <View style={styles.exercisesSection}>
        <Text style={styles.sectionTitle}>Exercises</Text>

        {workoutSections.map((section, sectionIndex) => {
          let globalIndexOffset = 0;
          for (let i = 0; i < sectionIndex; i++) {
            globalIndexOffset += workoutSections[i].exerciseGroups.length;
          }

          return (
            <View key={`section-${sectionIndex}`}>
              {section.name && (
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLine} />
                  <View style={styles.sectionHeaderTextContainer}>
                    <Text style={styles.sectionHeaderText}>
                      {section.name}
                    </Text>
                  </View>
                  <View style={styles.sectionHeaderLine} />
                </View>
              )}

              {section.exerciseGroups.map((group, groupIndex) => {
                const globalIndex = globalIndexOffset + groupIndex;

                return (
                  <View key={group.exercises[0].id} style={styles.exerciseCard}>
                    {group.type === 'superset' ? (
                      <>
                        <View style={styles.exerciseHeader}>
                          <Text style={styles.exerciseNumber}>{globalIndex + 1}</Text>
                          <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{group.groupName}</Text>
                            <Text style={styles.equipmentType}>
                              {group.exercises.map(ex => ex.exerciseName).join(' + ')}
                            </Text>
                          </View>
                        </View>

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

                        {group.exercises.map((exercise) => {
                          const isExpanded = expandedExercises.has(exercise.exerciseName);
                          const isLoading = loadingHistory.has(exercise.exerciseName);
                          const hasLoadedData = historyData.has(exercise.exerciseName);
                          const data = historyData.get(exercise.exerciseName) || [];
                          const hasData = data.length > 0;
                          const metric = selectedMetrics.get(exercise.exerciseName) || 'maxWeight';

                          return (
                            <View key={`chart-${exercise.id}`}>
                              {/* Trend Header - Title Bar Style */}
                              <TouchableOpacity
                                style={[styles.trendHeader, !hasLoadedData || !hasData ? styles.trendHeaderDisabled : null]}
                                onPress={() => toggleExerciseExpanded(exercise.exerciseName)}
                                disabled={isLoading || (hasLoadedData && !hasData)}
                              >
                                <View style={styles.trendHeaderLeft}>
                                  <Ionicons
                                    name="stats-chart"
                                    size={18}
                                    color={isLoading || (hasLoadedData && !hasData) ? colors.textMuted : colors.primary}
                                  />
                                  <Text style={[
                                    styles.trendHeaderText,
                                    (isLoading || (hasLoadedData && !hasData)) && styles.trendHeaderTextDisabled
                                  ]}>
                                    {isLoading ? 'Loading...' : (hasLoadedData && !hasData) ? 'No History' : 'Show trends'}
                                  </Text>
                                </View>
                                {hasData && (
                                  <Ionicons
                                    name={isExpanded ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={colors.textSecondary}
                                  />
                                )}
                              </TouchableOpacity>

                              {/* Chart Area */}
                              {isExpanded && (
                                <View>
                                  <View style={styles.chartContainer}>
                                    {isLoading ? (
                                      <ActivityIndicator size="large" color={colors.primary} />
                                    ) : (
                                      <ExerciseHistoryChart
                                        exerciseName={exercise.exerciseName}
                                        historyData={data}
                                        selectedMetric={metric}
                                        onMetricChange={(m) => setMetricForExercise(exercise.exerciseName, m)}
                                        colors={colors}
                                      />
                                    )}
                                  </View>

                                  {/* Details Button */}
                                  <TouchableOpacity
                                    style={styles.detailsButton}
                                    onPress={() => setBottomSheetExercise(exercise.exerciseName)}
                                  >
                                    <Ionicons name="list" size={16} color="#ffffff" />
                                    <Text style={styles.detailsButtonText}>Details</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <View style={styles.exerciseHeader}>
                          <Text style={styles.exerciseNumber}>{globalIndex + 1}</Text>
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

                        {(() => {
                          const exercise = group.exercises[0];
                          const isExpanded = expandedExercises.has(exercise.exerciseName);
                          const isLoading = loadingHistory.has(exercise.exerciseName);
                          const hasLoadedData = historyData.has(exercise.exerciseName);
                          const data = historyData.get(exercise.exerciseName) || [];
                          const hasData = data.length > 0;
                          const metric = selectedMetrics.get(exercise.exerciseName) || 'maxWeight';

                          return (
                            <View>
                              {/* Trend Header - Title Bar Style */}
                              <TouchableOpacity
                                style={[styles.trendHeader, !hasLoadedData || !hasData ? styles.trendHeaderDisabled : null]}
                                onPress={() => toggleExerciseExpanded(exercise.exerciseName)}
                                disabled={isLoading || (hasLoadedData && !hasData)}
                              >
                                <View style={styles.trendHeaderLeft}>
                                  <Ionicons
                                    name="stats-chart"
                                    size={18}
                                    color={isLoading || (hasLoadedData && !hasData) ? colors.textMuted : colors.primary}
                                  />
                                  <Text style={[
                                    styles.trendHeaderText,
                                    (isLoading || (hasLoadedData && !hasData)) && styles.trendHeaderTextDisabled
                                  ]}>
                                    {isLoading ? 'Loading...' : (hasLoadedData && !hasData) ? 'No History' : 'Show trends'}
                                  </Text>
                                </View>
                                {hasData && (
                                  <Ionicons
                                    name={isExpanded ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={colors.textSecondary}
                                  />
                                )}
                              </TouchableOpacity>

                              {/* Chart Area */}
                              {isExpanded && (
                                <View>
                                  <View style={styles.chartContainer}>
                                    {isLoading ? (
                                      <ActivityIndicator size="large" color={colors.primary} />
                                    ) : (
                                      <ExerciseHistoryChart
                                        exerciseName={exercise.exerciseName}
                                        historyData={data}
                                        selectedMetric={metric}
                                        onMetricChange={(m) => setMetricForExercise(exercise.exerciseName, m)}
                                        colors={colors}
                                      />
                                    )}
                                  </View>

                                  {/* Details Button */}
                                  <TouchableOpacity
                                    style={styles.detailsButton}
                                    onPress={() => setBottomSheetExercise(exercise.exerciseName)}
                                  >
                                    <Ionicons name="list" size={16} color="#ffffff" />
                                    <Text style={styles.detailsButtonText}>Details</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      {session.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{session.notes}</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* Exercise History Bottom Sheet */}
    {bottomSheetExercise && (
      <ExerciseHistoryBottomSheet
        exerciseName={bottomSheetExercise}
        isVisible={true}
        onClose={() => setBottomSheetExercise(null)}
        colors={colors}
      />
    )}
  </>
  );
}
