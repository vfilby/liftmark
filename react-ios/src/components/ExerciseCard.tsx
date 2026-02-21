import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { SessionExercise, SessionSet, ExerciseHistoryPoint, ChartMetricType } from '@/types';
import type { ThemeColors } from '@/theme/colors';
import { getExerciseHistory } from '@/db/exerciseHistoryRepository';
import { ExerciseHistoryChart } from './ExerciseHistoryChart';

interface InterleavedSet {
  exerciseName: string;
  set: SessionSet;
  setIndex: number;
}

export interface ExerciseCardProps {
  exercise: SessionExercise | SessionExercise[]; // Single or superset
  exerciseNumber: number;
  sessionDate: string;
  isSuperset: boolean;
  groupName?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewHistory: () => void;
  colors: ThemeColors;
}

export const ExerciseCard = ({
  exercise,
  exerciseNumber,
  sessionDate,
  isSuperset,
  groupName,
  isExpanded,
  onToggleExpand,
  onViewHistory,
  colors,
}: ExerciseCardProps) => {
  const [historyData, setHistoryData] = useState<ExerciseHistoryPoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricType>('maxWeight');

  // Load exercise history when expanded
  useEffect(() => {
    if (isExpanded && historyData.length === 0) {
      loadExerciseHistory();
    }
  }, [isExpanded]);

  const loadExerciseHistory = async () => {
    const exercises = Array.isArray(exercise) ? exercise : [exercise];
    const exerciseName = exercises[0].exerciseName;

    setIsLoadingHistory(true);
    try {
      const data = await getExerciseHistory(exerciseName, 10);
      setHistoryData(data);
    } catch (error) {
      console.error('Failed to load exercise history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatSetResult = (set: SessionSet): string => {
    const parts: string[] = [];
    const unit = set.actualWeightUnit || set.targetWeightUnit || 'lbs';
    const reps = set.actualReps ?? set.targetReps;
    const rpe = set.actualRpe ?? set.targetRpe;

    // Always show weight for rep-based exercises
    if (reps !== undefined) {
      const weight = set.actualWeight ?? set.targetWeight ?? 0;
      parts.push(`${weight} ${unit}`);
      parts.push(`${reps} reps`);
    }
    // Time-based sets
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

  // Interleave sets from multiple exercises in a superset
  const interleaveSets = (exercises: SessionExercise[]): InterleavedSet[] => {
    const result: InterleavedSet[] = [];
    const maxSets = Math.max(...exercises.map((ex) => ex.sets.length));

    for (let setIdx = 0; setIdx < maxSets; setIdx++) {
      for (const ex of exercises) {
        if (setIdx < ex.sets.length) {
          result.push({
            exerciseName: ex.exerciseName,
            set: ex.sets[setIdx],
            setIndex: setIdx,
          });
        }
      }
    }

    return result;
  };

  // Get exercises array (handle both single and array inputs)
  const exercises = useMemo(() => {
    if (Array.isArray(exercise)) {
      return exercise;
    }
    return [exercise];
  }, [exercise]);

  // Get exercise name for display
  const exerciseName = useMemo(() => {
    if (isSuperset) {
      return groupName || exercises.map((ex) => ex.exerciseName).join(' + ');
    }
    return exercises[0].exerciseName;
  }, [isSuperset, groupName, exercises]);

  // Get secondary text (equipment or exercise list)
  const secondaryText = useMemo(() => {
    if (isSuperset) {
      return exercises.map((ex) => ex.exerciseName).join(' + ');
    }
    return exercises[0].equipmentType || '';
  }, [isSuperset, exercises]);

  // Get interleaved sets for superset
  const interleavedSets = useMemo(() => {
    if (isSuperset) {
      return interleaveSets(exercises);
    }
    return null;
  }, [isSuperset, exercises]);

  const styles = StyleSheet.create({
    container: {
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
    exerciseSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
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
    chartContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      minHeight: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartPlaceholder: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      marginTop: 8,
      gap: 4,
    },
    expandButtonText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      {/* Exercise Header */}
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseNumber}>{exerciseNumber}</Text>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
          {secondaryText && (
            <Text style={styles.exerciseSubtitle}>{secondaryText}</Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // Navigate to progress view
            // This would typically navigate to a progress screen
          }}
        >
          <Text style={styles.actionButtonText}>View Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onViewHistory}
        >
          <Text style={styles.actionButtonText}>📊 History</Text>
        </TouchableOpacity>
      </View>

      {/* Sets Display */}
      <View style={styles.setsContainer}>
        {isSuperset && interleavedSets ? (
          // Superset: Interleaved sets
          interleavedSets.map((item, idx) => (
            <View
              key={`${item.set.id}-${idx}`}
              style={[
                styles.setRow,
                item.set.status === 'skipped' && styles.setRowSkipped,
              ]}
            >
              <View
                style={[
                  styles.setNumber,
                  item.set.status === 'completed' && styles.setNumberCompleted,
                  item.set.status === 'skipped' && styles.setNumberSkipped,
                ]}
              >
                <Text
                  style={[
                    styles.setNumberText,
                    item.set.status === 'completed' &&
                      styles.setNumberTextCompleted,
                    item.set.status === 'skipped' &&
                      styles.setNumberTextSkipped,
                  ]}
                >
                  {item.set.status === 'completed'
                    ? '✓'
                    : item.set.status === 'skipped'
                      ? '−'
                      : item.setIndex + 1}
                </Text>
              </View>
              <View style={styles.setResultContainer}>
                <Text style={styles.setExerciseName}>{item.exerciseName}</Text>
                <Text
                  style={[
                    styles.setResult,
                    item.set.status === 'skipped' &&
                      styles.setResultSkipped,
                  ]}
                >
                  {item.set.status === 'skipped'
                    ? 'Skipped'
                    : formatSetResult(item.set)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          // Single exercise: Non-interleaved sets
          exercises[0].sets.map((set, setIndex) => (
            <View
              key={set.id}
              style={[
                styles.setRow,
                set.status === 'skipped' && styles.setRowSkipped,
              ]}
            >
              <View
                style={[
                  styles.setNumber,
                  set.status === 'completed' && styles.setNumberCompleted,
                  set.status === 'skipped' && styles.setNumberSkipped,
                ]}
              >
                <Text
                  style={[
                    styles.setNumberText,
                    set.status === 'completed' &&
                      styles.setNumberTextCompleted,
                    set.status === 'skipped' &&
                      styles.setNumberTextSkipped,
                  ]}
                >
                  {set.status === 'completed'
                    ? '✓'
                    : set.status === 'skipped'
                      ? '−'
                      : setIndex + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.setResult,
                  set.status === 'skipped' && styles.setResultSkipped,
                ]}
              >
                {set.status === 'skipped' ? 'Skipped' : formatSetResult(set)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Chart - Lazy loaded when expanded */}
      {isExpanded && (
        <View style={styles.chartContainer}>
          {isLoadingHistory ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <ExerciseHistoryChart
              exerciseName={exerciseName}
              historyData={historyData}
              selectedMetric={selectedMetric}
              onMetricChange={setSelectedMetric}
              colors={colors}
            />
          )}
        </View>
      )}

      {/* Expand/Collapse Button */}
      <TouchableOpacity
        style={styles.expandButton}
        onPress={onToggleExpand}
      >
        <Text style={styles.expandButtonText}>
          {isExpanded ? 'Hide Chart' : 'Show Chart'}
        </Text>
        <Text style={styles.expandButtonText}>
          {isExpanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
