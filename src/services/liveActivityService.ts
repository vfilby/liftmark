import { Platform } from 'react-native';
import type { WorkoutSession, SessionExercise } from '@/types';

// Lazy load the native module to avoid crashes when not available
let LiveActivityModule: typeof import('expo-live-activity') | undefined;
let moduleLoadAttempted = false;
let currentActivityId: string | undefined;

function getLiveActivityModule() {
  if (!moduleLoadAttempted && Platform.OS === 'ios') {
    moduleLoadAttempted = true;
    try {
      LiveActivityModule = require('expo-live-activity');
      console.log('LiveActivity: Module loaded successfully');
    } catch (e) {
      console.log('LiveActivity module not available:', e);
    }
  }
  return LiveActivityModule;
}

/**
 * Check if Live Activities are available on this device
 * Requires iOS 16.2+ and a development build
 */
export function isLiveActivityAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const module = getLiveActivityModule();
    return module !== undefined;
  } catch {
    return false;
  }
}

/**
 * Format elapsed time as MM:SS or HH:MM:SS
 */
function formatElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format weight with unit
 */
function formatWeight(weight: number | undefined, unit: string | undefined): string {
  if (!weight) return 'BW';
  return `${weight} ${unit || 'lbs'}`;
}

/**
 * Build the display state for an active set
 */
function buildActiveSetState(
  session: WorkoutSession,
  exercise: SessionExercise,
  setIndex: number,
  progress: { completed: number; total: number }
): { title: string; subtitle: string } {
  const set = exercise.sets[setIndex];
  const setNumber = setIndex + 1;
  const totalSets = exercise.sets.length;

  const weight = formatWeight(set.targetWeight, set.targetWeightUnit);
  const reps = set.targetReps || '?';

  return {
    title: exercise.exerciseName,
    subtitle: `Set ${setNumber}/${totalSets} \u2022 ${weight} \u00D7 ${reps}`,
  };
}

/**
 * Build the display state for rest period
 */
function buildRestState(
  restSeconds: number,
  nextExercise: SessionExercise | null
): { title: string; subtitle: string; timerEndDate: number } {
  const timerEndDate = Date.now() + restSeconds * 1000;
  const nextPreview = nextExercise ? `Next: ${nextExercise.exerciseName}` : 'Finishing up';

  return {
    title: 'Rest',
    subtitle: nextPreview,
    timerEndDate,
  };
}

/**
 * Start a Live Activity for a workout session
 */
export function startWorkoutLiveActivity(
  session: WorkoutSession,
  exercise: SessionExercise | null,
  setIndex: number,
  progress: { completed: number; total: number }
): void {
  if (!isLiveActivityAvailable()) return;

  const module = getLiveActivityModule();
  if (!module) return;

  try {
    // End any existing activity first
    if (currentActivityId) {
      endWorkoutLiveActivity();
    }

    const state = exercise
      ? buildActiveSetState(session, exercise, setIndex, progress)
      : { title: session.name, subtitle: 'Starting workout...' };

    const activityId = module.startActivity(
      {
        title: state.title,
        subtitle: state.subtitle,
        progressBar: { progress: progress.total > 0 ? progress.completed / progress.total : 0 },
      },
      {
        backgroundColor: '#1a1a1a',
        titleColor: '#ffffff',
        subtitleColor: '#a0a0a0',
        progressViewTint: '#4CAF50',
      }
    );

    if (activityId) {
      currentActivityId = activityId;
      console.log('LiveActivity: Started with ID:', activityId);
    }
  } catch (error) {
    console.log('LiveActivity: Failed to start:', error);
  }
}

/**
 * Update the Live Activity with current workout state
 */
export function updateWorkoutLiveActivity(
  session: WorkoutSession,
  exercise: SessionExercise | null,
  setIndex: number,
  progress: { completed: number; total: number },
  restTimer?: { remainingSeconds: number; nextExercise: SessionExercise | null }
): void {
  if (!isLiveActivityAvailable() || !currentActivityId) return;

  const module = getLiveActivityModule();
  if (!module) return;

  try {
    let state: { title: string; subtitle: string };

    if (restTimer && restTimer.remainingSeconds > 0) {
      // Rest state - show countdown
      const restState = buildRestState(restTimer.remainingSeconds, restTimer.nextExercise);
      state = { title: restState.title, subtitle: restState.subtitle };

      module.updateActivity(currentActivityId, {
        title: state.title,
        subtitle: state.subtitle,
        progressBar: { date: restState.timerEndDate },
      });
    } else if (exercise) {
      // Active set state
      state = buildActiveSetState(session, exercise, setIndex, progress);

      module.updateActivity(currentActivityId, {
        title: state.title,
        subtitle: state.subtitle,
        progressBar: { progress: progress.total > 0 ? progress.completed / progress.total : 0 },
      });
    }

    console.log('LiveActivity: Updated');
  } catch (error) {
    console.log('LiveActivity: Failed to update:', error);
  }
}

/**
 * End the Live Activity with a completion message
 */
export function endWorkoutLiveActivity(message?: string): void {
  if (!isLiveActivityAvailable() || !currentActivityId) return;

  const module = getLiveActivityModule();
  if (!module) return;

  try {
    module.stopActivity(currentActivityId, {
      title: message || 'Workout Complete',
      subtitle: 'Great job!',
    });

    console.log('LiveActivity: Ended');
    currentActivityId = undefined;
  } catch (error) {
    console.log('LiveActivity: Failed to end:', error);
  }
}
