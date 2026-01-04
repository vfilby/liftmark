import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import RestTimer from '@/components/RestTimer';
import type { SessionExercise, SessionSet } from '@/types';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    activeSession,
    restTimer,
    isLoading,
    error,
    resumeSession,
    pauseSession,
    completeWorkout,
    cancelWorkout,
    completeSet,
    skipSet,
    startRestTimer,
    stopRestTimer,
    tickRestTimer,
    clearError,
    getProgress,
    getTrackableExercises,
  } = useSessionStore();

  const { settings } = useSettingsStore();

  // Track which non-current set is being edited (when user taps on another set)
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { weight: string; reps: string }>>({});
  // Track suggested rest time from last completed set
  const [suggestedRestSeconds, setSuggestedRestSeconds] = useState<number | null>(null);
  // When true, show the current set as "Up Next" preview instead of full form
  const [showUpNextPreview, setShowUpNextPreview] = useState(false);
  // Track the last completed set for positioning the rest timer after it
  const [lastCompletedSetId, setLastCompletedSetId] = useState<string | null>(null);

  // Compute the current set (first pending set) - always shows expanded
  const currentSetId = useMemo(() => {
    if (!activeSession) return null;
    const trackable = getTrackableExercises();
    for (const exercise of trackable) {
      for (const set of exercise.sets) {
        if (set.status === 'pending') {
          return set.id;
        }
      }
    }
    return null;
  }, [activeSession, getTrackableExercises]);

  // Load session on mount if not already loaded
  useEffect(() => {
    if (!activeSession) {
      resumeSession();
    }
  }, []);

  // Initialize edit values for the current set when it changes
  useEffect(() => {
    if (currentSetId && activeSession) {
      const trackable = getTrackableExercises();
      for (const exercise of trackable) {
        for (const set of exercise.sets) {
          if (set.id === currentSetId) {
            initializeSetValues(set);
            return;
          }
        }
      }
    }
  }, [currentSetId, activeSession]);

  // Initialize edit values for a set
  const initializeSetValues = (set: SessionSet) => {
    // For completed sets, use actual values; for pending, use target as default
    const weight = set.status === 'completed'
      ? (set.actualWeight ?? set.targetWeight)
      : (set.actualWeight ?? set.targetWeight);
    const reps = set.status === 'completed'
      ? (set.actualReps ?? set.targetReps)
      : (set.actualReps ?? set.targetReps);
    setEditValues((prev) => ({
      ...prev,
      [set.id]: {
        weight: weight !== undefined ? String(weight) : '',
        reps: reps !== undefined ? String(reps) : '',
      },
    }));
  };

  // Update a completed set's values
  const handleUpdateSet = useCallback(async (set: SessionSet) => {
    const values = editValues[set.id];
    const weight = values?.weight ? parseFloat(values.weight) : undefined;
    const reps = values?.reps ? parseInt(values.reps, 10) : undefined;

    // Update the set in the store
    await completeSet(set.id, {
      actualWeight: weight,
      actualReps: reps,
    });

    // Close the editing form
    setEditingSetId(null);
  }, [editValues, completeSet]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handlePause();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  // Rest timer tick
  useEffect(() => {
    if (restTimer?.isRunning) {
      const interval = setInterval(() => {
        tickRestTimer();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [restTimer?.isRunning]);

  // Track if timer was running to detect when it finishes
  const wasTimerRunning = useRef(false);

  // When rest timer finishes (goes from running to null), clear preview state
  useEffect(() => {
    if (restTimer?.isRunning) {
      wasTimerRunning.current = true;
    } else if (wasTimerRunning.current && !restTimer) {
      // Timer just finished (was running, now null)
      wasTimerRunning.current = false;
      setShowUpNextPreview(false);
      setLastCompletedSetId(null);
    }
  }, [restTimer]);

  // Handle errors
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handlePause = useCallback(() => {
    Alert.alert(
      'Pause Workout',
      'Your progress is saved. You can resume this workout later.',
      [
        { text: 'Continue Workout', style: 'cancel' },
        {
          text: 'Pause',
          onPress: async () => {
            await pauseSession();
            router.back();
          },
        },
      ]
    );
  }, [pauseSession, router]);

  const handleFinish = useCallback(() => {
    const { completed, total } = getProgress();
    const remaining = total - completed;

    if (remaining > 0) {
      Alert.alert(
        'Finish Workout?',
        `You have ${remaining} set${remaining > 1 ? 's' : ''} remaining. Are you sure you want to finish?`,
        [
          { text: 'Continue', style: 'cancel' },
          {
            text: 'Finish Anyway',
            onPress: async () => {
              await completeWorkout();
              router.replace('/workout/summary');
            },
          },
        ]
      );
    } else {
      completeWorkout().then(() => {
        router.replace('/workout/summary');
      });
    }
  }, [getProgress, completeWorkout, router]);

  const handleCompleteSet = useCallback(async (set: SessionSet) => {
    const values = editValues[set.id];
    const weight = values?.weight ? parseFloat(values.weight) : undefined;
    const reps = values?.reps ? parseInt(values.reps, 10) : undefined;

    // Stop any existing timer before completing the set
    if (restTimer) {
      stopRestTimer();
    }

    // Clear editing state if this was the set being edited
    if (editingSetId === set.id) {
      setEditingSetId(null);
    }

    await completeSet(set.id, {
      actualWeight: weight,
      actualReps: reps,
    });

    // Check if workout is complete
    const { completed, total } = getProgress();
    if (completed === total) {
      handleFinish();
    } else if (set.restSeconds) {
      // Set up rest timer state
      setLastCompletedSetId(set.id);
      setShowUpNextPreview(true);

      // Auto-start timer if setting enabled, otherwise show Start/Skip buttons
      if (settings?.autoStartRestTimer) {
        startRestTimer(set.restSeconds);
        setSuggestedRestSeconds(null);
      } else {
        setSuggestedRestSeconds(set.restSeconds);
      }
    } else {
      // No rest for this set, clear any previous rest state
      setSuggestedRestSeconds(null);
      setShowUpNextPreview(false);
      setLastCompletedSetId(null);
    }
  }, [editValues, completeSet, getProgress, handleFinish, restTimer, stopRestTimer, settings, startRestTimer, editingSetId]);

  const handleSkipSet = useCallback(async (set: SessionSet) => {
    // Clear editing state if this was the set being edited
    if (editingSetId === set.id) {
      setEditingSetId(null);
    }

    await skipSet(set.id);

    // Check if workout is complete
    const { completed, total } = getProgress();
    if (completed === total) {
      handleFinish();
    }
  }, [skipSet, getProgress, handleFinish, editingSetId]);

  const handleSetPress = useCallback((set: SessionSet) => {
    // Clear preview state when user taps any set, but keep timer running
    setShowUpNextPreview(false);
    // Only clear rest suggestion if not already timing (user can still dismiss manually)
    if (!restTimer) {
      setSuggestedRestSeconds(null);
      setLastCompletedSetId(null);
    }

    // If tapping the current set, nothing to do (it's always expanded)
    if (set.id === currentSetId) {
      return;
    }

    // Toggle editing for non-current sets
    if (editingSetId === set.id) {
      // Close the editing form
      setEditingSetId(null);
    } else {
      // Open editing form for this set
      setEditingSetId(set.id);
      initializeSetValues(set);
    }
  }, [currentSetId, editingSetId, restTimer]);

  const updateEditValue = (setId: string, field: 'weight' | 'reps', value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [setId]: {
        ...prev[setId],
        [field]: value,
      },
    }));
  };

  const handleStartRest = useCallback(() => {
    if (suggestedRestSeconds) {
      startRestTimer(suggestedRestSeconds);
      setSuggestedRestSeconds(null);
    }
  }, [suggestedRestSeconds, startRestTimer]);

  const handleDismissRest = useCallback(() => {
    setSuggestedRestSeconds(null);
    setShowUpNextPreview(false);
    setLastCompletedSetId(null);
  }, []);

  const handleStopRest = useCallback(() => {
    stopRestTimer();
    setShowUpNextPreview(false);
    setLastCompletedSetId(null);
  }, [stopRestTimer]);

  // Loading/empty states
  if (!activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </View>
    );
  }

  const { completed, total } = getProgress();
  const trackableExercises = getTrackableExercises();

  const formatSetTarget = (set: SessionSet): string => {
    const parts: string[] = [];
    const unit = set.targetWeightUnit || 'lbs';

    // Always show weight for rep-based exercises
    if (set.targetReps !== undefined) {
      const weight = set.targetWeight ?? 0;
      parts.push(`${weight}${unit}`);
      parts.push(`${set.targetReps} reps`);
    }
    // Time-based sets (like planks)
    if (set.targetTime !== undefined) {
      parts.push(`${set.targetTime}s`);
    }
    if (set.targetRpe !== undefined) {
      parts.push(`RPE ${set.targetRpe}`);
    }
    return parts.join(' × ') || 'Bodyweight';
  };

  const formatSetActual = (set: SessionSet): string => {
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePause} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Pause</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeSession.name}
        </Text>
        <TouchableOpacity onPress={handleFinish} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.finishText]}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${total > 0 ? (completed / total) * 100 : 0}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {completed} / {total} sets completed
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {trackableExercises.map((exercise, exerciseIndex) => (
          <View key={exercise.id} style={styles.exerciseSection}>
            {/* Exercise Header */}
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>{exerciseIndex + 1}</Text>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                {exercise.equipmentType && (
                  <Text style={styles.equipmentType}>{exercise.equipmentType}</Text>
                )}
                {exercise.notes && (
                  <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                )}
              </View>
            </View>

            {/* Sets */}
            <View style={styles.setsContainer}>
              {exercise.sets.map((set, setIndex) => {
                const isCurrentSet = set.id === currentSetId;
                const isEditing = set.id === editingSetId;
                const isCompleted = set.status === 'completed';
                const isSkipped = set.status === 'skipped';
                const isPending = set.status === 'pending';
                const values = editValues[set.id] || { weight: '', reps: '' };

                // Current set shows as "Up Next" during rest, otherwise shows full form
                const isUpNext = isCurrentSet && showUpNextPreview;
                // Show active form for: current set (when not in preview) OR any set being edited
                const isActiveForm = (isCurrentSet && !showUpNextPreview) || isEditing;
                // Highlight styling for current or editing sets
                const isHighlighted = isCurrentSet || isEditing;

                // Show rest timer/suggestion AFTER the last completed set
                const showRestAfterThis = set.id === lastCompletedSetId && (restTimer || suggestedRestSeconds);

                // Show rest placeholder for pending sets that have rest defined
                const nextSet = exercise.sets[setIndex + 1];
                const showRestPlaceholder = isPending && set.restSeconds &&
                  nextSet && nextSet.status === 'pending' &&
                  // Don't show if we're showing the active form for this set
                  !isActiveForm &&
                  // Don't show if rest timer is active after this set
                  !showRestAfterThis;

                // Determine row style based on status and whether form is shown
                const getRowStyle = () => {
                  if (isCurrentSet && !isEditing) {
                    return styles.setRowActive; // Blue for current set
                  }
                  if (isActiveForm && isCompleted) {
                    return styles.setRowCompletedActive; // Green highlight for editing completed
                  }
                  if (isActiveForm && isSkipped) {
                    return styles.setRowSkippedActive; // Yellow highlight for editing skipped
                  }
                  if (isActiveForm && isPending) {
                    return styles.setRowPendingActive; // Gray highlight for editing future
                  }
                  if (isCompleted) {
                    return styles.setRowCompleted;
                  }
                  if (isSkipped) {
                    return styles.setRowSkipped;
                  }
                  return null;
                };

                return (
                  <View key={set.id}>
                    <TouchableOpacity
                      style={[
                        styles.setRow,
                        getRowStyle(),
                      ]}
                      onPress={() => handleSetPress(set)}
                      activeOpacity={0.7}
                    >
                    {/* Set Number */}
                    <View style={[
                      styles.setNumberContainer,
                      isCurrentSet && styles.setNumberContainerActive,
                      isEditing && isCompleted && styles.setNumberContainerCompleted,
                      isEditing && isSkipped && styles.setNumberContainerSkipped,
                      isEditing && isPending && styles.setNumberContainerPending,
                    ]}>
                      <Text
                        style={[
                          styles.setNumber,
                          !isActiveForm && isCompleted && styles.setNumberCompleted,
                          !isActiveForm && isSkipped && styles.setNumberSkipped,
                        ]}
                      >
                        {!isActiveForm && isCompleted ? '✓' : !isActiveForm && isSkipped ? '−' : setIndex + 1}
                      </Text>
                    </View>

                    {/* Set Content */}
                    <View style={styles.setContent}>
                      {isUpNext ? (
                        // "Up Next" preview - shown while resting
                        <View style={styles.upNextContent}>
                          <Text style={styles.upNextLabel}>UP NEXT</Text>
                          <Text style={styles.upNextTarget}>{formatSetTarget(set)}</Text>
                        </View>
                      ) : isActiveForm ? (
                        // Active set - show inputs
                        <View style={styles.activeSetContent}>
                          <Text style={styles.targetLabel}>
                            Target: {formatSetTarget(set)}
                          </Text>
                          <View style={styles.inputRow}>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Weight</Text>
                              <TextInput
                                style={styles.input}
                                value={values.weight}
                                onChangeText={(v) => updateEditValue(set.id, 'weight', v)}
                                keyboardType="numeric"
                                placeholder="0"
                              />
                              <Text style={styles.inputUnit}>
                                {set.targetWeightUnit || 'lbs'}
                              </Text>
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Reps</Text>
                              <TextInput
                                style={styles.input}
                                value={values.reps}
                                onChangeText={(v) => updateEditValue(set.id, 'reps', v)}
                                keyboardType="numeric"
                                placeholder="0"
                              />
                            </View>
                          </View>
                          <View style={styles.setActions}>
                            {isPending ? (
                              // Pending set: Complete / Skip
                              <>
                                <TouchableOpacity
                                  style={styles.completeButton}
                                  onPress={() => handleCompleteSet(set)}
                                  disabled={isLoading}
                                >
                                  <Text style={styles.completeButtonText}>Complete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.skipButtonInline}
                                  onPress={() => handleSkipSet(set)}
                                  disabled={isLoading}
                                >
                                  <Text style={styles.skipButtonText}>Skip</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              // Completed or skipped set: Update
                              <TouchableOpacity
                                style={styles.updateButton}
                                onPress={() => handleUpdateSet(set)}
                                disabled={isLoading}
                              >
                                <Text style={styles.updateButtonText}>Update</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ) : isCompleted ? (
                        // Completed set (collapsed) - show what was done
                        <View style={styles.completedSetContent}>
                          <Text style={styles.completedText}>
                            {formatSetActual(set) || formatSetTarget(set)}
                          </Text>
                          <Text style={styles.tapToEdit}>Tap to edit</Text>
                        </View>
                      ) : isSkipped ? (
                        // Skipped set (collapsed)
                        <View style={styles.skippedSetContent}>
                          <Text style={styles.skippedText}>Skipped</Text>
                          <Text style={styles.tapToEdit}>Tap to edit</Text>
                        </View>
                      ) : (
                        // Pending set (collapsed, not selected)
                        <View style={styles.pendingSetContent}>
                          <Text style={styles.pendingText}>{formatSetTarget(set)}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                    {/* Rest Timer - shown after the last completed set */}
                    {showRestAfterThis && restTimer && (
                      <View style={styles.restTimerInline}>
                        <RestTimer
                          remainingSeconds={restTimer.remainingSeconds}
                          totalSeconds={restTimer.totalSeconds}
                          isRunning={restTimer.isRunning}
                          onStop={handleStopRest}
                        />
                      </View>
                    )}
                    {showRestAfterThis && !restTimer && suggestedRestSeconds && (
                      <View style={styles.restSuggestionInline}>
                        <Text style={styles.restSuggestionText}>
                          Rest: {suggestedRestSeconds}s
                        </Text>
                        <View style={styles.restSuggestionButtons}>
                          <TouchableOpacity style={styles.startRestButton} onPress={handleStartRest}>
                            <Text style={styles.startRestButtonText}>Start</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.dismissRestButton} onPress={handleDismissRest}>
                            <Text style={styles.dismissRestButtonText}>Skip</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Rest placeholder between pending sets */}
                    {showRestPlaceholder && (
                      <View style={styles.restPlaceholder}>
                        <View style={styles.restPlaceholderLine} />
                        <Text style={styles.restPlaceholderText}>Rest {set.restSeconds}s</Text>
                        <View style={styles.restPlaceholderLine} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
  },
  finishText: {
    color: '#16a34a',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  // Progress
  progressContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  progressText: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Rest Timer (inline)
  restTimerInline: {
    marginBottom: 16,
  },
  restSuggestionInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  restSuggestionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  restSuggestionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  startRestButton: {
    backgroundColor: '#2563eb',
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
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dismissRestButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  // Exercise Section
  exerciseSection: {
    marginBottom: 20,
  },
  exerciseHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  exerciseNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginRight: 12,
    minWidth: 24,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  equipmentType: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  exerciseNotes: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Sets Container
  setsContainer: {
    marginLeft: 36,
  },
  // Set Row
  setRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  setRowActive: {
    borderColor: '#2563eb',
    borderWidth: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setRowCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  setRowSkipped: {
    backgroundColor: '#fefce8',
    borderColor: '#fde047',
  },
  // Active editing states with colored borders
  setRowCompletedActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
    borderWidth: 2,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setRowSkippedActive: {
    backgroundColor: '#fefce8',
    borderColor: '#ca8a04',
    borderWidth: 2,
    shadowColor: '#ca8a04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setRowPendingActive: {
    backgroundColor: '#f9fafb',
    borderColor: '#9ca3af',
    borderWidth: 2,
    shadowColor: '#9ca3af',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Set Number
  setNumberContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  setNumberContainerActive: {
    backgroundColor: '#eff6ff',
    borderRightColor: '#bfdbfe',
  },
  setNumberContainerCompleted: {
    backgroundColor: '#dcfce7',
    borderRightColor: '#86efac',
  },
  setNumberContainerSkipped: {
    backgroundColor: '#fef9c3',
    borderRightColor: '#fde047',
  },
  setNumberContainerPending: {
    backgroundColor: '#f3f4f6',
    borderRightColor: '#d1d5db',
  },
  setNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  setNumberCompleted: {
    color: '#16a34a',
    fontSize: 18,
  },
  setNumberSkipped: {
    color: '#ca8a04',
    fontSize: 20,
  },
  // Set Content
  setContent: {
    flex: 1,
    padding: 12,
  },
  // Active Set
  activeSetContent: {},
  targetLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
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
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    height: 44,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
  },
  inputUnit: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  setActions: {
    flexDirection: 'row',
    gap: 10,
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#2563eb',
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
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Completed Set
  completedSetContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedText: {
    fontSize: 15,
    color: '#16a34a',
    fontWeight: '500',
  },
  tapToEdit: {
    fontSize: 12,
    color: '#9ca3af',
  },
  // Skipped Set
  skippedSetContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skippedText: {
    fontSize: 14,
    color: '#ca8a04',
    fontStyle: 'italic',
  },
  // Pending Set
  pendingSetContent: {},
  pendingText: {
    fontSize: 15,
    color: '#374151',
  },
  // Up Next Preview
  upNextContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upNextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  upNextTarget: {
    fontSize: 15,
    color: '#374151',
  },
  // Rest Placeholder
  restPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  restPlaceholderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  restPlaceholderText: {
    fontSize: 10,
    color: '#c0c0c0',
    marginHorizontal: 8,
  },
});
