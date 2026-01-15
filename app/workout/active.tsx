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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const openYouTubeSearch = (exerciseName: string) => {
  const query = encodeURIComponent(exerciseName + ' exercise');
  Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
};
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme';
import { audioService } from '@/services/audioService';
import RestTimer from '@/components/RestTimer';
import ExerciseTimer from '@/components/ExerciseTimer';
import type { SessionExercise, SessionSet } from '@/types';

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
    tickExerciseTimer,
    clearError,
    getProgress,
    getTrackableExercises,
  } = useSessionStore();

  const { settings } = useSettingsStore();
  const { colors } = useTheme();

  // Track which non-current set is being edited (when user taps on another set)
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { weight: string; reps: string; time: string }>>({});
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
    setEditValues((prev) => ({
      ...prev,
      [set.id]: {
        weight: weight !== undefined ? String(weight) : '',
        reps: reps !== undefined ? String(reps) : '',
        time: time !== undefined ? String(time) : '',
      },
    }));
  };

  // Update a completed set's values
  const handleUpdateSet = useCallback(async (set: SessionSet) => {
    const values = editValues[set.id];
    const weight = values?.weight ? parseFloat(values.weight) : undefined;
    const reps = values?.reps ? parseInt(values.reps, 10) : undefined;
    const time = values?.time ? parseInt(values.time, 10) : undefined;

    // Update the set in the store
    await completeSet(set.id, {
      actualWeight: weight,
      actualReps: reps,
      actualTime: time,
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

  // Rest timer tick with audio cues
  useEffect(() => {
    if (restTimer?.isRunning) {
      const interval = setInterval(() => {
        // Play countdown beeps at 3, 2, 1 seconds
        if (restTimer.remainingSeconds <= 3 && restTimer.remainingSeconds > 0) {
          audioService.playTick();
        }
        tickRestTimer();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [restTimer?.isRunning, restTimer?.remainingSeconds]);

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
        tickExerciseTimer();

        // Play sound when target time is reached
        if (exerciseTimer.elapsedSeconds + 1 === exerciseTimer.targetSeconds) {
          audioService.playComplete();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [exerciseTimer?.isRunning, exerciseTimer?.elapsedSeconds]);

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
              stopExerciseTimer();
            }
            await pauseSession();
            router.back();
          },
        },
      ]
    );
  }, [pauseSession, router, exerciseTimer, stopExerciseTimer]);

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
      stopExerciseTimer();
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
  }, [editValues, completeSet, getProgress, handleFinish, restTimer, stopRestTimer, exerciseTimer, stopExerciseTimer, settings, startRestTimer, editingSetId]);

  const handleSkipSet = useCallback(async (set: SessionSet) => {
    // Stop exercise timer if running for this set
    if (exerciseTimer && exerciseTimer.setId === set.id) {
      stopExerciseTimer();
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
  }, [skipSet, getProgress, handleFinish, editingSetId, exerciseTimer, stopExerciseTimer]);

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
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 12,
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
      paddingHorizontal: 16,
      paddingBottom: 12,
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
    // Rest Timer (inline)
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
    // Content
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
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
    // Set Row
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
    // Active editing states with colored borders
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
    // Set Number
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
    // Set Content
    setContent: {
      flex: 1,
      padding: 12,
    },
    // Active Set
    activeSetContent: {},
    targetLabel: {
      fontSize: 13,
      color: colors.textSecondary,
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
    // Completed Set
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
    // Skipped Set
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
    // Pending Set
    pendingSetContent: {},
    pendingText: {
      fontSize: 15,
      color: colors.textSecondary,
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
      color: colors.primary,
      letterSpacing: 0.5,
    },
    upNextTarget: {
      fontSize: 15,
      color: colors.textSecondary,
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
      backgroundColor: colors.border,
    },
    restPlaceholderText: {
      fontSize: 10,
      color: colors.textMuted,
      marginHorizontal: 8,
    },
  });

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
                  // Render superset with all exercises' sets
                  const exerciseNames = group.exercises.map(ex => ex.exerciseName).join(' & ');

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
                                <TouchableOpacity onPress={() => openYouTubeSearch(ex.exerciseName)}>
                                  <Ionicons name="open-outline" size={14} style={styles.youtubeLink} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>

                      {/* Render sets from all exercises in superset */}
                      <View style={styles.setsContainer}>
                        {group.exercises.map((exercise) => (
                          exercise.sets.map((set, setIndex) => {
                            const isCurrentSet = set.id === currentSetId;
                            const isEditing = set.id === editingSetId;
                            const isCompleted = set.status === 'completed';
                            const isSkipped = set.status === 'skipped';
                            const isPending = set.status === 'pending';
                            const values = editValues[set.id] || { weight: '', reps: '' };

                            const isUpNext = isCurrentSet && showUpNextPreview;
                            const isActiveForm = (isCurrentSet && !showUpNextPreview) || isEditing;
                            const showRestAfterThis = set.id === lastCompletedSetId && (restTimer || suggestedRestSeconds);

                            const nextSet = exercise.sets[setIndex + 1];
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

                            return (
                              <View key={set.id}>
                                <TouchableOpacity
                                  style={[styles.setRow, getRowStyle()]}
                                  onPress={() => handleSetPress(set)}
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
                                    {/* Show exercise name for superset sets */}
                                    <Text style={styles.supersetExerciseNames}>{exercise.exerciseName}</Text>
                                    {isUpNext ? (
                                      <View style={styles.upNextContent}>
                                        <Text style={styles.upNextLabel}>UP NEXT</Text>
                                        <Text style={styles.upNextTarget}>{formatSetTarget(set)}</Text>
                                      </View>
                                    ) : isActiveForm ? (
                                      <View style={styles.activeSetContent}>
                                        <Text style={styles.targetLabel}>Target: {formatSetTarget(set)}</Text>

                                        {/* Show exercise timer for timed exercises */}
                                        {set.targetTime !== undefined && (
                                          <ExerciseTimer
                                            elapsedSeconds={exerciseTimer?.setId === set.id ? exerciseTimer.elapsedSeconds : 0}
                                            targetSeconds={set.targetTime}
                                            isRunning={exerciseTimer?.setId === set.id && exerciseTimer.isRunning}
                                            onStart={() => startExerciseTimer(set.id, set.targetTime!)}
                                            onStop={stopExerciseTimer}
                                          />
                                        )}

                                        {/* Show weight/reps inputs for non-time-based exercises or mixed exercises */}
                                        {(set.targetReps !== undefined || set.targetWeight !== undefined) && (
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
                                              <Text style={styles.inputUnit}>{set.targetWeightUnit || 'lbs'}</Text>
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
                                        )}
                                        <View style={styles.setActions}>
                                          {isPending ? (
                                            <>
                                              <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteSet(set)} disabled={isLoading}>
                                                <Text style={styles.completeButtonText}>Complete</Text>
                                              </TouchableOpacity>
                                              <TouchableOpacity style={styles.skipButtonInline} onPress={() => handleSkipSet(set)} disabled={isLoading}>
                                                <Text style={styles.skipButtonText}>Skip</Text>
                                              </TouchableOpacity>
                                            </>
                                          ) : (
                                            <TouchableOpacity style={styles.updateButton} onPress={() => handleUpdateSet(set)} disabled={isLoading}>
                                              <Text style={styles.updateButtonText}>Update</Text>
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                      </View>
                                    ) : isCompleted ? (
                                      <View style={styles.completedSetContent}>
                                        <Text style={styles.completedText}>{formatSetActual(set) || formatSetTarget(set)}</Text>
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
                                      </View>
                                    )}
                                  </View>
                                </TouchableOpacity>

                                {showRestAfterThis && restTimer && (
                                  <View style={styles.restTimerInline}>
                                    <RestTimer remainingSeconds={restTimer.remainingSeconds} totalSeconds={restTimer.totalSeconds} isRunning={restTimer.isRunning} onStop={handleStopRest} />
                                  </View>
                                )}
                                {showRestAfterThis && !restTimer && suggestedRestSeconds && (
                                  <View style={styles.restSuggestionInline}>
                                    <Text style={styles.restSuggestionText}>Rest: {suggestedRestSeconds}s</Text>
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
                                {showRestPlaceholder && (
                                  <View style={styles.restPlaceholder}>
                                    <View style={styles.restPlaceholderLine} />
                                    <Text style={styles.restPlaceholderText}>Rest {set.restSeconds}s</Text>
                                    <View style={styles.restPlaceholderLine} />
                                  </View>
                                )}
                              </View>
                            );
                          })
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
                            <TouchableOpacity onPress={() => openYouTubeSearch(exercise.exerciseName)}>
                              <Ionicons name="open-outline" size={14} style={styles.youtubeLink} />
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
                        {exercise.sets.map((set, setIndex) => {
                          const isCurrentSet = set.id === currentSetId;
                          const isEditing = set.id === editingSetId;
                          const isCompleted = set.status === 'completed';
                          const isSkipped = set.status === 'skipped';
                          const isPending = set.status === 'pending';
                          const values = editValues[set.id] || { weight: '', reps: '' };

                          const isUpNext = isCurrentSet && showUpNextPreview;
                          const isActiveForm = (isCurrentSet && !showUpNextPreview) || isEditing;
                          const showRestAfterThis = set.id === lastCompletedSetId && (restTimer || suggestedRestSeconds);

                          const nextSet = exercise.sets[setIndex + 1];
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

                          return (
                            <View key={set.id}>
                              <TouchableOpacity
                                style={[styles.setRow, getRowStyle()]}
                                onPress={() => handleSetPress(set)}
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
                                  {isUpNext ? (
                                    <View style={styles.upNextContent}>
                                      <Text style={styles.upNextLabel}>UP NEXT</Text>
                                      <Text style={styles.upNextTarget}>{formatSetTarget(set)}</Text>
                                    </View>
                                  ) : isActiveForm ? (
                                    <View style={styles.activeSetContent}>
                                      <Text style={styles.targetLabel}>Target: {formatSetTarget(set)}</Text>

                                      {/* Show exercise timer for timed exercises */}
                                      {set.targetTime !== undefined && (
                                        <ExerciseTimer
                                          elapsedSeconds={exerciseTimer?.setId === set.id ? exerciseTimer.elapsedSeconds : 0}
                                          targetSeconds={set.targetTime}
                                          isRunning={exerciseTimer?.setId === set.id && exerciseTimer.isRunning}
                                          onStart={() => startExerciseTimer(set.id, set.targetTime!)}
                                          onStop={stopExerciseTimer}
                                        />
                                      )}

                                      {/* Show weight/reps inputs for non-time-based exercises or mixed exercises */}
                                      {(set.targetReps !== undefined || set.targetWeight !== undefined) && (
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
                                            <Text style={styles.inputUnit}>{set.targetWeightUnit || 'lbs'}</Text>
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
                                      )}
                                      <View style={styles.setActions}>
                                        {isPending ? (
                                          <>
                                            <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteSet(set)} disabled={isLoading}>
                                              <Text style={styles.completeButtonText}>Complete</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.skipButtonInline} onPress={() => handleSkipSet(set)} disabled={isLoading}>
                                              <Text style={styles.skipButtonText}>Skip</Text>
                                            </TouchableOpacity>
                                          </>
                                        ) : (
                                          <TouchableOpacity style={styles.updateButton} onPress={() => handleUpdateSet(set)} disabled={isLoading}>
                                            <Text style={styles.updateButtonText}>Update</Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    </View>
                                  ) : isCompleted ? (
                                    <View style={styles.completedSetContent}>
                                      <Text style={styles.completedText}>{formatSetActual(set) || formatSetTarget(set)}</Text>
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
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>

                              {showRestAfterThis && restTimer && (
                                <View style={styles.restTimerInline}>
                                  <RestTimer remainingSeconds={restTimer.remainingSeconds} totalSeconds={restTimer.totalSeconds} isRunning={restTimer.isRunning} onStop={handleStopRest} />
                                </View>
                              )}
                              {showRestAfterThis && !restTimer && suggestedRestSeconds && (
                                <View style={styles.restSuggestionInline}>
                                  <Text style={styles.restSuggestionText}>Rest: {suggestedRestSeconds}s</Text>
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
                  );
                }
              })}
            </View>
          );
        })}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
