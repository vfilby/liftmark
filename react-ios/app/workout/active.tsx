import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  BackHandler,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';

const openYouTubeSearch = (exerciseName: string) => {
  const query = encodeURIComponent(exerciseName + ' exercise');
  Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
};
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme';
import { useResponsivePadding, useResponsiveFontSizes } from '@/utils/responsive';
import { audioService } from '@/services/audioService';
import { LoadingView } from '@/components/LoadingView';
import SetRow from '@/components/SetRow';
import EditExerciseModal from '@/components/EditExerciseModal';
import AddExerciseModal from '@/components/AddExerciseModal';
import type { SessionExercise, SessionSet } from '@/types';
import { interleaveSupersetSets } from '@/utils/supersetHelpers';

// Represents either a single exercise or a superset group
interface ExerciseGroup {
  type: 'single' | 'superset';
  exercises: SessionExercise[];
  groupName?: string;
  sectionName?: string;
}

// Represents a section containing exercise groups
interface WorkoutSection {
  name: string | null;
  exerciseGroups: ExerciseGroup[];
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

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    activeSession,
    restTimer,
    exerciseTimer,
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
    startExerciseTimer,
    stopExerciseTimer,
    clearExerciseTimer,
    tickExerciseTimer,
    clearError,
    getProgress,
    getTrackableExercises,
    updateExercise,
    addExercise,
    addSetToExercise,
    deleteSetFromExercise,
    updateSetTarget,
  } = useSessionStore();

  const { settings } = useSettingsStore();
  const { colors } = useTheme();
  const padding = useResponsivePadding();
  const fonts = useResponsiveFontSizes();

  // Keep screen awake during workout if setting is enabled
  if (settings?.keepScreenAwake) {
    useKeepAwake();
  }

  // Track which non-current set is being edited (when user taps on another set)
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { weight: string; reps: string; time: string }>>({});
  // Track suggested rest time from last completed set
  const [suggestedRestSeconds, setSuggestedRestSeconds] = useState<number | null>(null);

  // Track exercise editing
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editExerciseValues, setEditExerciseValues] = useState<{
    exerciseName: string;
    equipmentType: string;
    notes: string;
  }>({ exerciseName: '', equipmentType: '', notes: '' });
  // Track set edits within the exercise edit modal
  const [editingExerciseSets, setEditingExerciseSets] = useState<SessionSet[]>([]);

  // Track add exercise modal
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [newExerciseMarkdown, setNewExerciseMarkdown] = useState('');
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

  // Group exercises by sections, then by superset/single within each section
  const workoutSections = useMemo((): WorkoutSection[] => {
    if (!activeSession) return [];

    const sections: WorkoutSection[] = [];
    const processedIds = new Set<string>();
    const exercises = activeSession.exercises;

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
  }, [activeSession]);

  // Load session on mount if not already loaded
  useEffect(() => {
    if (!activeSession) {
      resumeSession();
    }
  }, []);

  // Preload audio for timer sounds
  useEffect(() => {
    audioService.preloadSounds();
    return () => {
      audioService.unloadSounds();
    };
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
    setEditValues((prev) => {
      // If this set already has edit values (from propagation), use them
      if (prev[set.id]?.weight !== undefined) {
        return prev;
      }

      // For completed sets, use actual values; for pending, use target as default
      const weight = set.status === 'completed'
        ? (set.actualWeight ?? set.targetWeight)
        : (set.actualWeight ?? set.targetWeight);
      const reps = set.status === 'completed'
        ? (set.actualReps ?? set.targetReps)
        : (set.actualReps ?? set.targetReps);
      const time = set.status === 'completed'
        ? (set.actualTime ?? set.targetTime)
        : (set.actualTime ?? set.targetTime);

      return {
        ...prev,
        [set.id]: {
          weight: weight !== undefined ? String(weight) : '',
          reps: reps !== undefined ? String(reps) : '',
          time: time !== undefined ? String(time) : '',
        },
      };
    });
  };

  // Update a completed set's values
  const handleUpdateSet = useCallback(async (set: SessionSet) => {
    const values = editValues[set.id];

    // Parse values, falling back to undefined if invalid or empty
    const parsedWeight = values?.weight ? parseFloat(values.weight) : NaN;
    const parsedReps = values?.reps ? parseInt(values.reps, 10) : NaN;
    const parsedTime = values?.time ? parseInt(values.time, 10) : NaN;

    // Only update fields that have valid parsed values
    // This prevents data loss when editing individual fields
    const updates: Partial<SessionSet> = {};
    if (!isNaN(parsedWeight)) {
      updates.actualWeight = parsedWeight;
    }
    if (!isNaN(parsedReps)) {
      updates.actualReps = parsedReps;
    }
    if (!isNaN(parsedTime)) {
      updates.actualTime = parsedTime;
    }

    // Update the set in the store
    await completeSet(set.id, updates);

    // Close the editing form
    setEditingSetId(null);
  }, [editValues, completeSet]);

  // Handle back button - allow navigation without pausing
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => backHandler.remove();
  }, [router]);

  // Rest timer tick with audio cues
  useEffect(() => {
    if (restTimer?.isRunning) {
      const interval = setInterval(() => {
        const currentTimer = useSessionStore.getState().restTimer;
        // Play countdown beeps at 3, 2, 1 seconds
        if (currentTimer && currentTimer.remainingSeconds <= 3 && currentTimer.remainingSeconds > 0) {
          audioService.playTick();
        }
        tickRestTimer();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [restTimer?.isRunning, tickRestTimer]);

  // Track if timer was running to detect when it finishes
  const wasTimerRunning = useRef(false);

  // When rest timer finishes (goes from running to null), clear preview state and play sound
  useEffect(() => {
    if (restTimer?.isRunning) {
      wasTimerRunning.current = true;
    } else if (wasTimerRunning.current && !restTimer) {
      // Timer just finished (was running, now null)
      wasTimerRunning.current = false;
      setShowUpNextPreview(false);
      setLastCompletedSetId(null);
      // Play completion sound
      audioService.playComplete();
    }
  }, [restTimer]);

  // Exercise timer tick
  useEffect(() => {
    if (exerciseTimer?.isRunning) {
      const interval = setInterval(() => {
        const currentTimer = useSessionStore.getState().exerciseTimer;
        tickExerciseTimer();

        // Play sound when target time is reached
        if (currentTimer && currentTimer.elapsedSeconds + 1 === currentTimer.targetSeconds) {
          audioService.playComplete();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [exerciseTimer?.isRunning, tickExerciseTimer]);

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
            if (exerciseTimer) {
              clearExerciseTimer();
            }
            await pauseSession();
            router.back();
          },
        },
      ]
    );
  }, [pauseSession, router, exerciseTimer, clearExerciseTimer]);

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
          {
            text: 'Discard Workout',
            style: 'destructive',
            onPress: async () => {
              await cancelWorkout();
              router.back();
            },
          },
        ]
      );
    } else {
      completeWorkout().then(() => {
        router.replace('/workout/summary');
      });
    }
  }, [getProgress, completeWorkout, cancelWorkout, router]);

  const handleCompleteSet = useCallback(async (set: SessionSet) => {
    const values = editValues[set.id];
    const weight = values?.weight ? parseFloat(values.weight) : undefined;
    const reps = values?.reps ? parseInt(values.reps, 10) : undefined;

    // For timed exercises, use timer elapsed time if available, otherwise use manual input
    let time: number | undefined;
    if (exerciseTimer && exerciseTimer.setId === set.id) {
      time = exerciseTimer.elapsedSeconds;
      clearExerciseTimer();
    } else {
      time = values?.time ? parseInt(values.time, 10) : undefined;
    }

    // Stop any existing rest timer before completing the set
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
      actualTime: time,
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
  }, [editValues, completeSet, getProgress, handleFinish, restTimer, stopRestTimer, exerciseTimer, clearExerciseTimer, settings, startRestTimer, editingSetId]);

  const handleSkipSet = useCallback(async (set: SessionSet) => {
    // Clear exercise timer if running for this set
    if (exerciseTimer && exerciseTimer.setId === set.id) {
      clearExerciseTimer();
    }

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
  }, [skipSet, getProgress, handleFinish, editingSetId, exerciseTimer, clearExerciseTimer]);

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

  const updateEditValue = (setId: string, field: 'weight' | 'reps' | 'time', value: string) => {
    setEditValues((prev) => {
      // Ensure we always have a complete object with all fields, defaulting to empty strings
      const currentValues = prev[setId] || { weight: '', reps: '', time: '' };

      const updated = {
        ...prev,
        [setId]: {
          ...currentValues,
          [field]: value,
        },
      };

      // Propagate weight changes to remaining sets in the same exercise
      if (field === 'weight' && activeSession) {
        // Find the exercise containing this set
        for (const exercise of activeSession.exercises) {
          const setIndex = exercise.sets.findIndex(s => s.id === setId);
          if (setIndex !== -1) {
            const currentSet = exercise.sets[setIndex];
            // Update all remaining (pending) sets in this exercise
            for (let i = setIndex + 1; i < exercise.sets.length; i++) {
              const remainingSet = exercise.sets[i];
              if (remainingSet.status === 'pending') {
                // Ensure remaining sets also have all fields preserved
                const remainingValues = prev[remainingSet.id] || { weight: '', reps: '', time: '' };
                updated[remainingSet.id] = {
                  ...remainingValues,
                  weight: value,
                };
              }
            }
            break;
          }
        }
      }

      return updated;
    });
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

  // Exercise editing handlers
  const handleEditExercisePress = useCallback((exercise: SessionExercise) => {
    setEditingExerciseId(exercise.id);
    setEditExerciseValues({
      exerciseName: exercise.exerciseName,
      equipmentType: exercise.equipmentType || '',
      notes: exercise.notes || '',
    });
    // Load sets for editing
    setEditingExerciseSets([...exercise.sets]);
  }, []);

  const handleSaveExercise = useCallback(async () => {
    if (!editingExerciseId) return;

    try {
      // Update exercise details
      await updateExercise(editingExerciseId, {
        exerciseName: editExerciseValues.exerciseName,
        equipmentType: editExerciseValues.equipmentType || undefined,
        notes: editExerciseValues.notes || undefined,
      });

      // Get the original exercise to find which sets were added/deleted
      const originalExercise = activeSession?.exercises.find((e) => e.id === editingExerciseId);
      if (!originalExercise) return;

      const originalSetIds = new Set(originalExercise.sets.map((s) => s.id));
      const editedSetIds = new Set(editingExerciseSets.map((s) => s.id));

      // Delete removed sets
      for (const originalSet of originalExercise.sets) {
        if (!editedSetIds.has(originalSet.id)) {
          await deleteSetFromExercise(originalSet.id);
        }
      }

      // Add new sets (those with temp IDs)
      for (const set of editingExerciseSets) {
        if (set.id.startsWith('temp-')) {
          await addSetToExercise(editingExerciseId, {
            orderIndex: set.orderIndex,
            status: 'pending',
            targetWeight: set.targetWeight,
            targetWeightUnit: set.targetWeightUnit,
            targetReps: set.targetReps,
            targetTime: set.targetTime,
            targetRpe: set.targetRpe,
            restSeconds: set.restSeconds,
            notes: set.notes,
          });
        } else {
          // Update existing set
          await updateSetTarget(set.id, {
            targetWeight: set.targetWeight,
            targetWeightUnit: set.targetWeightUnit,
            targetReps: set.targetReps,
            targetTime: set.targetTime,
            targetRpe: set.targetRpe,
            restSeconds: set.restSeconds,
            notes: set.notes,
          });
        }
      }

      setEditingExerciseId(null);
      setEditingExerciseSets([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save exercise changes');
    }
  }, [editingExerciseId, editExerciseValues, editingExerciseSets, activeSession, updateExercise, updateSetTarget, addSetToExercise, deleteSetFromExercise]);

  const handleCancelEditExercise = useCallback(() => {
    setEditingExerciseId(null);
    setEditingExerciseSets([]);
  }, []);

  const handleAddSetInModal = useCallback(() => {
    if (!editingExerciseId) return;

    // Create a new set based on the last set's values
    const lastSet = editingExerciseSets[editingExerciseSets.length - 1];
    const newSet: SessionSet = {
      id: `temp-${Date.now()}`, // Temporary ID, will be replaced when saved
      sessionExerciseId: editingExerciseId,
      orderIndex: editingExerciseSets.length,
      status: 'pending',
      targetWeight: lastSet?.targetWeight,
      targetWeightUnit: lastSet?.targetWeightUnit,
      targetReps: lastSet?.targetReps,
      targetTime: lastSet?.targetTime,
      targetRpe: lastSet?.targetRpe,
      restSeconds: lastSet?.restSeconds,
    };

    setEditingExerciseSets([...editingExerciseSets, newSet]);
  }, [editingExerciseId, editingExerciseSets]);

  const handleDeleteSetInModal = useCallback((setId: string) => {
    if (editingExerciseSets.length <= 1) {
      Alert.alert('Cannot Delete', 'An exercise must have at least one set');
      return;
    }
    setEditingExerciseSets(editingExerciseSets.filter((s) => s.id !== setId));
  }, [editingExerciseSets]);

  const handleUpdateSetInModal = useCallback((setId: string, field: keyof SessionSet, value: any) => {
    setEditingExerciseSets(editingExerciseSets.map((s) =>
      s.id === setId ? { ...s, [field]: value } : s
    ));
  }, [editingExerciseSets]);

  const handleAddExercisePress = useCallback(() => {
    setShowAddExerciseModal(true);
    setNewExerciseMarkdown('### Exercise Name\n\n- Rep\n- Rep\n- Rep');
  }, []);

  const handleSaveNewExercise = useCallback(async () => {
    // Simple markdown parser for the template
    const lines = newExerciseMarkdown.trim().split('\n');
    if (lines.length < 2) {
      Alert.alert('Error', 'Please provide exercise name and at least one set');
      return;
    }

    // Parse exercise name from first line (removing ### prefix)
    const exerciseName = lines[0].replace(/^#+\s*/, '').trim();
    if (!exerciseName) {
      Alert.alert('Error', 'Please provide an exercise name');
      return;
    }

    // Parse sets from lines starting with '-'
    const sets: Array<Omit<SessionSet, 'id' | 'sessionExerciseId'>> = [];
    for (const line of lines) {
      if (line.trim().startsWith('-')) {
        // Simple set parsing - just create a pending set
        // User can fill in details after adding
        sets.push({
          orderIndex: sets.length,
          status: 'pending',
        });
      }
    }

    if (sets.length === 0) {
      Alert.alert('Error', 'Please provide at least one set (lines starting with -)');
      return;
    }

    await addExercise({
      exerciseName,
      sets,
    });

    setShowAddExerciseModal(false);
    setNewExerciseMarkdown('');
  }, [newExerciseMarkdown, addExercise]);

  const handleCancelAddExercise = useCallback(() => {
    setShowAddExerciseModal(false);
    setNewExerciseMarkdown('');
  }, []);

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
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: padding.horizontal,
      paddingTop: 50,
      paddingBottom: padding.small,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    headerButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '500',
    },
    finishText: {
      color: colors.success,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    // Progress
    progressContainer: {
      backgroundColor: colors.card,
      paddingHorizontal: padding.horizontal,
      paddingBottom: padding.small,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    progressText: {
      marginTop: 6,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Content
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: padding.container,
    },
    // Section header styles
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
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
    // Superset styles
    supersetBadge: {
      backgroundColor: '#8b5cf6',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    supersetBadgeText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    supersetExerciseNames: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
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
    },
    equipmentType: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    exerciseNotes: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    youtubeLink: {
      fontSize: 12,
      color: colors.textMuted,
      marginLeft: 8,
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    // Sets Container
    setsContainer: {
      marginLeft: 36,
    },
    exerciseEditButton: {
      padding: 8,
      marginLeft: 8,
    },
  });

  // Loading/empty states
  if (!activeSession) {
    return (
      <View style={styles.container} testID="active-workout-screen">
        <LoadingView message="Loading workout..." />
      </View>
    );
  }

  const { completed, total } = getProgress();

  // Common props for SetRow components
  const setRowSharedProps = {
    isLoading,
    lastCompletedSetId,
    restTimer,
    suggestedRestSeconds,
    exerciseTimer,
    onSetPress: handleSetPress,
    onCompleteSet: handleCompleteSet,
    onSkipSet: handleSkipSet,
    onUpdateSet: handleUpdateSet,
    onUpdateEditValue: updateEditValue,
    onStartExerciseTimer: startExerciseTimer,
    onStopExerciseTimer: stopExerciseTimer,
    onStopRest: handleStopRest,
    onStartRest: handleStartRest,
    onDismissRest: handleDismissRest,
  };

  return (
    <View style={styles.container} testID="active-workout-screen">
      {/* Header */}
      <View style={styles.header} testID="active-workout-header">
        <TouchableOpacity
          onPress={handlePause}
          style={styles.headerButton}
          testID="active-workout-pause-button"
        >
          <Text style={styles.headerButtonText}>Pause</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeSession.name}
        </Text>
        <TouchableOpacity
          onPress={handleAddExercisePress}
          style={styles.headerButton}
          testID="active-workout-add-exercise-button"
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleFinish}
          style={styles.headerButton}
          testID="active-workout-finish-button"
        >
          <Text style={[styles.headerButtonText, styles.finishText]}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer} testID="active-workout-progress">
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
        testID="active-workout-scroll"
      >
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

                if (group.type === 'superset') {
                  return (
                    <View key={`superset-${globalIndex}`} style={styles.exerciseSection}>
                      {/* Superset Header */}
                      <View style={styles.exerciseHeader}>
                        <Text style={[styles.exerciseNumber, { color: numberColor }]}>{globalIndex + 1}</Text>
                        <View style={styles.exerciseInfo}>
                          <View style={styles.supersetBadge}>
                            <Text style={styles.supersetBadgeText}>SUPERSET</Text>
                          </View>
                          <Text style={styles.exerciseName}>{group.groupName}</Text>
                          <View style={styles.exerciseNameRow}>
                            {group.exercises.map((ex, idx) => (
                              <View key={ex.id} style={styles.exerciseNameRow}>
                                {idx > 0 && <Text style={styles.supersetExerciseNames}> & </Text>}
                                <Text style={styles.supersetExerciseNames}>{ex.exerciseName}</Text>
                                <TouchableOpacity onPress={() => openYouTubeSearch(ex.exerciseName)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                  <Ionicons name="open-outline" size={14} style={styles.youtubeLink} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleEditExercisePress(ex)} style={styles.exerciseEditButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>

                      {/* Render sets from all exercises in superset - interleaved */}
                      <View style={styles.setsContainer}>
                        {interleaveSupersetSets(group.exercises).map(({ exercise, set, setIndex }) => (
                          <SetRow
                            key={set.id}
                            set={set}
                            setIndex={setIndex}
                            exercise={exercise}
                            isCurrentSet={set.id === currentSetId}
                            isEditing={set.id === editingSetId}
                            showUpNextPreview={showUpNextPreview}
                            editValues={editValues[set.id] || { weight: '', reps: '', time: '' }}
                            showExerciseName={true}
                            nextSet={exercise.sets[setIndex + 1]}
                            {...setRowSharedProps}
                          />
                        ))}
                      </View>
                    </View>
                  );
                } else {
                  // Render single exercise
                  const exercise = group.exercises[0];

                  return (
                    <View key={exercise.id} style={styles.exerciseSection}>
                      <View style={styles.exerciseHeader}>
                        <Text style={[styles.exerciseNumber, { color: numberColor }]}>{globalIndex + 1}</Text>
                        <View style={styles.exerciseInfo}>
                          <View style={styles.exerciseNameRow}>
                            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                            <TouchableOpacity onPress={() => openYouTubeSearch(exercise.exerciseName)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <Ionicons name="open-outline" size={14} style={styles.youtubeLink} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEditExercisePress(exercise)} style={styles.exerciseEditButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <Ionicons name="create-outline" size={16} color={colors.primary} />
                            </TouchableOpacity>
                          </View>
                          {exercise.equipmentType && (
                            <Text style={styles.equipmentType}>{exercise.equipmentType}</Text>
                          )}
                          {exercise.notes && (
                            <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.setsContainer}>
                        {exercise.sets.map((set, setIndex) => (
                          <SetRow
                            key={set.id}
                            set={set}
                            setIndex={setIndex}
                            exercise={exercise}
                            isCurrentSet={set.id === currentSetId}
                            isEditing={set.id === editingSetId}
                            showUpNextPreview={showUpNextPreview}
                            editValues={editValues[set.id] || { weight: '', reps: '', time: '' }}
                            showExerciseName={false}
                            nextSet={exercise.sets[setIndex + 1]}
                            {...setRowSharedProps}
                          />
                        ))}
                      </View>
                    </View>
                  );
                }
              })}
            </View>
          );
        })}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Exercise Modal */}
      <EditExerciseModal
        visible={editingExerciseId !== null}
        exerciseValues={editExerciseValues}
        sets={editingExerciseSets}
        onChangeExerciseValues={setEditExerciseValues}
        onUpdateSet={handleUpdateSetInModal}
        onAddSet={handleAddSetInModal}
        onDeleteSet={handleDeleteSetInModal}
        onSave={handleSaveExercise}
        onCancel={handleCancelEditExercise}
      />

      {/* Add Exercise Modal */}
      <AddExerciseModal
        visible={showAddExerciseModal}
        markdown={newExerciseMarkdown}
        onChangeMarkdown={setNewExerciseMarkdown}
        onSave={handleSaveNewExercise}
        onCancel={handleCancelAddExercise}
      />
    </View>
  );
}
