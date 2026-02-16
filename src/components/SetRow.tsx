import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/theme';
import RestTimer from '@/components/RestTimer';
import ExerciseTimer from '@/components/ExerciseTimer';
import type { SessionExercise, SessionSet } from '@/types';
import {
  isBarbellExercise,
  calculatePlates,
  formatCompletePlateSetup,
} from '@/utils/plateCalculator';

export const formatSetTarget = (set: SessionSet): string => {
  const parts: string[] = [];
  const unit = set.targetWeightUnit || 'lbs';

  if (set.targetReps !== undefined) {
    const weight = set.targetWeight ?? 0;
    parts.push(`${weight} ${unit}`);
    parts.push(`${set.targetReps} reps`);
  }
  if (set.targetTime !== undefined) {
    parts.push(`${set.targetTime}s`);
  }
  if (set.targetRpe !== undefined) {
    parts.push(`RPE ${set.targetRpe}`);
  }
  return parts.join(' × ') || 'Bodyweight';
};

export const formatSetActual = (set: SessionSet): string => {
  const parts: string[] = [];
  const unit = set.actualWeightUnit || set.targetWeightUnit || 'lbs';
  const reps = set.actualReps ?? set.targetReps;
  const rpe = set.actualRpe ?? set.targetRpe;

  if (reps !== undefined) {
    const weight = set.actualWeight ?? set.targetWeight ?? 0;
    parts.push(`${weight} ${unit}`);
    parts.push(`${reps} reps`);
  }
  if (set.actualTime ?? set.targetTime) {
    parts.push(`${set.actualTime ?? set.targetTime}s`);
  }
  if (rpe !== undefined) {
    parts.push(`RPE ${rpe}`);
  }
  return parts.join(' × ') || 'Bodyweight';
};

interface SetRowProps {
  set: SessionSet;
  setIndex: number;
  exercise: SessionExercise;
  isCurrentSet: boolean;
  isEditing: boolean;
  showUpNextPreview: boolean;
  editValues: { weight: string; reps: string; time: string };
  isLoading: boolean;
  showExerciseName: boolean;
  // Rest timer state
  lastCompletedSetId: string | null;
  restTimer: { remainingSeconds: number; totalSeconds: number; isRunning: boolean } | null;
  suggestedRestSeconds: number | null;
  // Exercise timer state
  exerciseTimer: { setId: string; elapsedSeconds: number; isRunning: boolean; targetSeconds: number } | null;
  // Next set for rest placeholder
  nextSet: SessionSet | undefined;
  // Callbacks
  onSetPress: (set: SessionSet) => void;
  onCompleteSet: (set: SessionSet) => void;
  onSkipSet: (set: SessionSet) => void;
  onUpdateSet: (set: SessionSet) => void;
  onUpdateEditValue: (setId: string, field: 'weight' | 'reps' | 'time', value: string) => void;
  onStartExerciseTimer: (setId: string, targetTime: number) => void;
  onStopExerciseTimer: () => void;
  onStopRest: () => void;
  onStartRest: () => void;
  onDismissRest: () => void;
}

export default function SetRow({
  set,
  setIndex,
  exercise,
  isCurrentSet,
  isEditing,
  showUpNextPreview,
  editValues: values,
  isLoading,
  showExerciseName,
  lastCompletedSetId,
  restTimer,
  suggestedRestSeconds,
  exerciseTimer,
  nextSet,
  onSetPress,
  onCompleteSet,
  onSkipSet,
  onUpdateSet,
  onUpdateEditValue,
  onStartExerciseTimer,
  onStopExerciseTimer,
  onStopRest,
  onStartRest,
  onDismissRest,
}: SetRowProps) {
  const { colors } = useTheme();

  const isCompleted = set.status === 'completed';
  const isSkipped = set.status === 'skipped';
  const isPending = set.status === 'pending';

  const isUpNext = isCurrentSet && showUpNextPreview;
  const isActiveForm = (isCurrentSet && !showUpNextPreview) || isEditing;
  const showRestAfterThis = set.id === lastCompletedSetId && (restTimer || suggestedRestSeconds);

  const showRestPlaceholder = isPending && set.restSeconds &&
    nextSet && nextSet.status === 'pending' &&
    !isActiveForm && !showRestAfterThis;

  const getRowStyle = () => {
    if (isCurrentSet && !isEditing) return styles.setRowActive;
    if (isActiveForm && isCompleted) return styles.setRowCompletedActive;
    if (isActiveForm && isSkipped) return styles.setRowSkippedActive;
    if (isActiveForm && isPending) return styles.setRowPendingActive;
    if (isCompleted) return styles.setRowCompleted;
    if (isSkipped) return styles.setRowSkipped;
    return null;
  };

  const styles = StyleSheet.create({
    setRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    setRowActive: {
      borderColor: colors.primary,
      borderWidth: 2,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    setRowCompleted: {
      backgroundColor: colors.successLight,
      borderColor: colors.successBorder,
    },
    setRowSkipped: {
      backgroundColor: colors.warningLight,
      borderColor: colors.warningBorder,
    },
    setRowCompletedActive: {
      backgroundColor: colors.successLight,
      borderColor: colors.success,
      borderWidth: 2,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    setRowSkippedActive: {
      backgroundColor: colors.warningLight,
      borderColor: colors.warning,
      borderWidth: 2,
      shadowColor: colors.warning,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    setRowPendingActive: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.textMuted,
      borderWidth: 2,
      shadowColor: colors.textMuted,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    setNumberContainer: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    setNumberContainerActive: {
      backgroundColor: colors.primaryLight,
      borderRightColor: colors.primaryLightBorder,
    },
    setNumberContainerCompleted: {
      backgroundColor: colors.successLighter,
      borderRightColor: colors.successBorder,
    },
    setNumberContainerSkipped: {
      backgroundColor: colors.warningLighter,
      borderRightColor: colors.warningBorder,
    },
    setNumberContainerPending: {
      backgroundColor: colors.backgroundTertiary,
      borderRightColor: colors.borderLight,
    },
    setNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    setNumberCompleted: {
      color: colors.success,
      fontSize: 18,
    },
    setNumberSkipped: {
      color: colors.warning,
      fontSize: 20,
    },
    setContent: {
      flex: 1,
      padding: 12,
    },
    supersetExerciseNames: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    upNextContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    upNextLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    upNextTarget: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    activeSetContent: {},
    targetLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    setNotes: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginTop: 4,
    },
    plateInfo: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    plateInfoText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    inputRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 12,
    },
    inputGroup: {
      flex: 1,
      alignItems: 'center',
    },
    inputLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    input: {
      width: '100%',
      height: 44,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.text,
    },
    inputUnit: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    setActions: {
      flexDirection: 'row',
      gap: 10,
    },
    completeButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    completeButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    skipButtonInline: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    updateButton: {
      flex: 1,
      backgroundColor: colors.success,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    updateButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    completedSetContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    completedText: {
      fontSize: 15,
      color: colors.success,
      fontWeight: '500',
    },
    tapToEdit: {
      fontSize: 12,
      color: colors.textMuted,
    },
    skippedSetContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    skippedText: {
      fontSize: 14,
      color: colors.warning,
      fontStyle: 'italic',
    },
    pendingSetContent: {},
    pendingText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    restTimerInline: {
      marginBottom: 16,
    },
    restSuggestionInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryLight,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.primaryLightBorder,
    },
    restSuggestionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    restSuggestionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    startRestButton: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
    },
    startRestButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    dismissRestButton: {
      backgroundColor: colors.card,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dismissRestButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    restPlaceholder: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      marginBottom: 4,
    },
    restPlaceholderLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    restPlaceholderText: {
      fontSize: 10,
      color: colors.textMuted,
      marginHorizontal: 8,
    },
  });

  return (
    <View>
      <TouchableOpacity
        style={[styles.setRow, getRowStyle()]}
        onPress={() => onSetPress(set)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.setNumberContainer,
          isCurrentSet && styles.setNumberContainerActive,
          isEditing && isCompleted && styles.setNumberContainerCompleted,
          isEditing && isSkipped && styles.setNumberContainerSkipped,
          isEditing && isPending && styles.setNumberContainerPending,
        ]}>
          <Text style={[
            styles.setNumber,
            !isActiveForm && isCompleted && styles.setNumberCompleted,
            !isActiveForm && isSkipped && styles.setNumberSkipped,
          ]}>
            {!isActiveForm && isCompleted ? '✓' : !isActiveForm && isSkipped ? '−' : setIndex + 1}
          </Text>
        </View>

        <View style={styles.setContent}>
          {showExerciseName && (
            <Text style={styles.supersetExerciseNames}>{exercise.exerciseName}</Text>
          )}
          {isUpNext ? (
            <View style={styles.upNextContent}>
              <Text style={styles.upNextLabel}>UP NEXT</Text>
              <Text style={styles.upNextTarget}>{formatSetTarget(set)}</Text>
            </View>
          ) : isActiveForm ? (
            <View style={styles.activeSetContent}>
              <Text style={styles.targetLabel}>Target: {formatSetTarget(set)}</Text>
              {set.notes && <Text style={styles.setNotes}>{set.notes}</Text>}

              {set.targetWeight && isBarbellExercise(exercise.exerciseName, exercise.equipmentType) && (
                <View style={styles.plateInfo}>
                  <Text style={styles.plateInfoText}>
                    {formatCompletePlateSetup(
                      calculatePlates(
                        parseFloat(values.weight) || set.targetWeight || 0,
                        (set.targetWeightUnit || 'lbs') as 'lbs' | 'kg'
                      )
                    )}
                  </Text>
                </View>
              )}

              {set.targetTime !== undefined && (
                <ExerciseTimer
                  elapsedSeconds={exerciseTimer?.setId === set.id ? exerciseTimer.elapsedSeconds : 0}
                  targetSeconds={set.targetTime}
                  isRunning={exerciseTimer?.setId === set.id && exerciseTimer.isRunning}
                  onStart={() => onStartExerciseTimer(set.id, set.targetTime!)}
                  onStop={onStopExerciseTimer}
                />
              )}

              {(set.targetReps !== undefined || set.targetWeight !== undefined) && (
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Weight</Text>
                    <TextInput
                      style={styles.input}
                      value={values.weight}
                      onChangeText={(v) => onUpdateEditValue(set.id, 'weight', v)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                    <Text style={styles.inputUnit}>{set.targetWeightUnit || 'lbs'}</Text>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Reps</Text>
                    <TextInput
                      style={styles.input}
                      value={values.reps}
                      onChangeText={(v) => onUpdateEditValue(set.id, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>
              )}

              {set.targetTime !== undefined && isEditing && (
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TextInput
                      style={styles.input}
                      value={values.time}
                      onChangeText={(v) => onUpdateEditValue(set.id, 'time', v)}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                    <Text style={styles.inputUnit}>seconds</Text>
                  </View>
                </View>
              )}
              <View style={styles.setActions}>
                {isPending ? (
                  <>
                    <TouchableOpacity style={styles.completeButton} onPress={() => onCompleteSet(set)} disabled={isLoading}>
                      <Text style={styles.completeButtonText}>Complete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.skipButtonInline} onPress={() => onSkipSet(set)} disabled={isLoading}>
                      <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.updateButton} onPress={() => onUpdateSet(set)} disabled={isLoading}>
                    <Text style={styles.updateButtonText}>Update</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : isCompleted ? (
            <View style={styles.completedSetContent}>
              <View>
                <Text style={styles.completedText}>{formatSetActual(set) || formatSetTarget(set)}</Text>
                {set.notes && <Text style={styles.setNotes}>{set.notes}</Text>}
              </View>
              <Text style={styles.tapToEdit}>Tap to edit</Text>
            </View>
          ) : isSkipped ? (
            <View style={styles.skippedSetContent}>
              <Text style={styles.skippedText}>Skipped</Text>
              <Text style={styles.tapToEdit}>Tap to edit</Text>
            </View>
          ) : (
            <View style={styles.pendingSetContent}>
              <Text style={styles.pendingText}>{formatSetTarget(set)}</Text>
              {set.notes && <Text style={styles.setNotes}>{set.notes}</Text>}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {showRestAfterThis && restTimer && (
        <View style={styles.restTimerInline}>
          <RestTimer remainingSeconds={restTimer.remainingSeconds} totalSeconds={restTimer.totalSeconds} isRunning={restTimer.isRunning} onStop={onStopRest} />
        </View>
      )}
      {showRestAfterThis && !restTimer && suggestedRestSeconds && (
        <View style={styles.restSuggestionInline}>
          <Text style={styles.restSuggestionText}>Rest: {suggestedRestSeconds}s</Text>
          <View style={styles.restSuggestionButtons}>
            <TouchableOpacity style={styles.startRestButton} onPress={onStartRest}>
              <Text style={styles.startRestButtonText}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissRestButton} onPress={onDismissRest}>
              <Text style={styles.dismissRestButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {showRestPlaceholder && (
        <View style={styles.restPlaceholder}>
          <View style={styles.restPlaceholderLine} />
          <Text style={styles.restPlaceholderText}>Rest {set.restSeconds}s</Text>
          <View style={styles.restPlaceholderLine} />
        </View>
      )}
    </View>
  );
}
