import { create } from 'zustand';
import type { WorkoutTemplate, WorkoutSession, SessionExercise, SessionSet } from '@/types';
import {
  createSessionFromTemplate,
  getActiveSession,
  getWorkoutSessionById,
  updateSession,
  updateSessionSet,
  updateSessionExercise,
  deleteSession,
} from '@/db/sessionRepository';

interface RestTimer {
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
}

interface SessionStore {
  // State
  activeSession: WorkoutSession | null;
  currentExerciseIndex: number;
  currentSetIndex: number;
  restTimer: RestTimer | null;
  isLoading: boolean;
  error: string | null;

  // Session Lifecycle
  startWorkout: (template: WorkoutTemplate) => Promise<void>;
  resumeSession: () => Promise<void>;
  pauseSession: () => Promise<void>;
  completeWorkout: () => Promise<void>;
  cancelWorkout: () => Promise<void>;
  checkForActiveSession: () => Promise<boolean>;

  // Set Actions
  updateSetValues: (setId: string, values: Partial<SessionSet>) => void;
  completeSet: (setId: string, actualValues?: Partial<SessionSet>) => Promise<void>;
  skipSet: (setId: string) => Promise<void>;

  // Navigation
  goToNextSet: () => void;
  goToPreviousSet: () => void;
  goToExercise: (index: number) => void;

  // Rest Timer
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;

  // Utilities
  clearError: () => void;
  getCurrentExercise: () => SessionExercise | null;
  getCurrentSet: () => SessionSet | null;
  getProgress: () => { completed: number; total: number };
  getTrackableExercises: () => SessionExercise[];
}

/**
 * Get exercises that have sets to track (excluding superset parent headers)
 */
function getTrackableExercisesFromSession(session: WorkoutSession | null): SessionExercise[] {
  if (!session) return [];
  return session.exercises.filter((ex) => ex.sets.length > 0);
}

/**
 * Find the first pending set position
 */
function findFirstPendingPosition(
  exercises: SessionExercise[]
): { exerciseIndex: number; setIndex: number } {
  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const exercise = exercises[exIdx];
    for (let setIdx = 0; setIdx < exercise.sets.length; setIdx++) {
      if (exercise.sets[setIdx].status === 'pending') {
        return { exerciseIndex: exIdx, setIndex: setIdx };
      }
    }
  }
  // All sets completed
  return { exerciseIndex: 0, setIndex: 0 };
}

/**
 * Calculate progress from session
 */
function calculateProgress(session: WorkoutSession | null): { completed: number; total: number } {
  if (!session) return { completed: 0, total: 0 };

  const trackable = getTrackableExercisesFromSession(session);
  let completed = 0;
  let total = 0;

  for (const exercise of trackable) {
    for (const set of exercise.sets) {
      total++;
      if (set.status === 'completed' || set.status === 'skipped') {
        completed++;
      }
    }
  }

  return { completed, total };
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  activeSession: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  restTimer: null,
  isLoading: false,
  error: null,

  // Start a new workout from a template
  startWorkout: async (template: WorkoutTemplate) => {
    set({ isLoading: true, error: null });
    try {
      // Check for existing active session
      const existing = await getActiveSession();
      if (existing) {
        throw new Error('Another workout is already in progress');
      }

      // Create new session from template
      const session = await createSessionFromTemplate(template);

      set({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        restTimer: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start workout',
        isLoading: false,
      });
      throw error;
    }
  },

  // Resume an existing active session
  resumeSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await getActiveSession();
      if (!session) {
        set({ activeSession: null, isLoading: false });
        return;
      }

      // Find first pending set to resume from
      const trackable = getTrackableExercisesFromSession(session);
      const { exerciseIndex, setIndex } = findFirstPendingPosition(trackable);

      set({
        activeSession: session,
        currentExerciseIndex: exerciseIndex,
        currentSetIndex: setIndex,
        restTimer: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to resume workout',
        isLoading: false,
      });
    }
  },

  // Pause the current session (just clears local state, data is already persisted)
  pauseSession: async () => {
    set({
      activeSession: null,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      restTimer: null,
    });
  },

  // Complete the workout
  completeWorkout: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    set({ isLoading: true, error: null });
    try {
      const now = new Date().toISOString();
      const startTime = activeSession.startTime
        ? new Date(activeSession.startTime).getTime()
        : Date.now();
      const duration = Math.floor((Date.now() - startTime) / 1000);

      const updatedSession: WorkoutSession = {
        ...activeSession,
        endTime: now,
        duration,
        status: 'completed',
      };

      await updateSession(updatedSession);

      set({
        activeSession: updatedSession,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to complete workout',
        isLoading: false,
      });
    }
  },

  // Cancel the workout
  cancelWorkout: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    set({ isLoading: true, error: null });
    try {
      const updatedSession: WorkoutSession = {
        ...activeSession,
        status: 'canceled',
      };

      await updateSession(updatedSession);

      set({
        activeSession: null,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        restTimer: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel workout',
        isLoading: false,
      });
    }
  },

  // Check if there's an active session (for home screen banner)
  checkForActiveSession: async () => {
    try {
      const session = await getActiveSession();
      return session !== null;
    } catch {
      return false;
    }
  },

  // Update set values locally (for editing before completing)
  updateSetValues: (setId: string, values: Partial<SessionSet>) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const updatedExercises = activeSession.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((s) => (s.id === setId ? { ...s, ...values } : s)),
    }));

    set({
      activeSession: {
        ...activeSession,
        exercises: updatedExercises,
      },
    });
  },

  // Complete a set with actual values
  completeSet: async (setId: string, actualValues?: Partial<SessionSet>) => {
    const { activeSession, currentExerciseIndex, currentSetIndex } = get();
    if (!activeSession) return;

    try {
      // Find the set
      let targetSet: SessionSet | null = null;
      let targetExercise: SessionExercise | null = null;

      for (const exercise of activeSession.exercises) {
        const foundSet = exercise.sets.find((s) => s.id === setId);
        if (foundSet) {
          targetSet = foundSet;
          targetExercise = exercise;
          break;
        }
      }

      if (!targetSet || !targetExercise) return;

      // Update set with actual values and completed status
      const completedSet: SessionSet = {
        ...targetSet,
        // Use provided actual values, or copy from target if not specified
        actualWeight: actualValues?.actualWeight ?? targetSet.actualWeight ?? targetSet.targetWeight,
        actualWeightUnit: actualValues?.actualWeightUnit ?? targetSet.actualWeightUnit ?? targetSet.targetWeightUnit,
        actualReps: actualValues?.actualReps ?? targetSet.actualReps ?? targetSet.targetReps,
        actualTime: actualValues?.actualTime ?? targetSet.actualTime ?? targetSet.targetTime,
        actualRpe: actualValues?.actualRpe ?? targetSet.actualRpe ?? targetSet.targetRpe,
        completedAt: new Date().toISOString(),
        status: 'completed',
      };

      // Persist to database
      await updateSessionSet(completedSet);

      // Update local state
      const updatedExercises = activeSession.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((s) => (s.id === setId ? completedSet : s)),
      }));

      // Check if all sets in the exercise are complete
      const updatedExercise = updatedExercises.find((e) => e.id === targetExercise!.id);
      if (updatedExercise) {
        const allSetsComplete = updatedExercise.sets.every(
          (s) => s.status === 'completed' || s.status === 'skipped'
        );
        if (allSetsComplete) {
          updatedExercise.status = 'completed';
          await updateSessionExercise(updatedExercise);
        }
      }

      set({
        activeSession: {
          ...activeSession,
          exercises: updatedExercises,
        },
      });

      // Auto-advance to next set
      get().goToNextSet();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to complete set',
      });
    }
  },

  // Skip a set
  skipSet: async (setId: string) => {
    const { activeSession } = get();
    if (!activeSession) return;

    try {
      // Find the set
      let targetSet: SessionSet | null = null;
      let targetExercise: SessionExercise | null = null;

      for (const exercise of activeSession.exercises) {
        const foundSet = exercise.sets.find((s) => s.id === setId);
        if (foundSet) {
          targetSet = foundSet;
          targetExercise = exercise;
          break;
        }
      }

      if (!targetSet || !targetExercise) return;

      // Update set as skipped
      const skippedSet: SessionSet = {
        ...targetSet,
        status: 'skipped',
      };

      await updateSessionSet(skippedSet);

      // Update local state
      const updatedExercises = activeSession.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((s) => (s.id === setId ? skippedSet : s)),
      }));

      // Check if all sets in the exercise are complete/skipped
      const updatedExercise = updatedExercises.find((e) => e.id === targetExercise!.id);
      if (updatedExercise) {
        const allSetsComplete = updatedExercise.sets.every(
          (s) => s.status === 'completed' || s.status === 'skipped'
        );
        if (allSetsComplete) {
          updatedExercise.status = 'completed';
          await updateSessionExercise(updatedExercise);
        }
      }

      set({
        activeSession: {
          ...activeSession,
          exercises: updatedExercises,
        },
      });

      // Auto-advance to next set
      get().goToNextSet();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to skip set',
      });
    }
  },

  // Navigate to next set
  goToNextSet: () => {
    const { activeSession, currentExerciseIndex, currentSetIndex } = get();
    if (!activeSession) return;

    const trackable = getTrackableExercisesFromSession(activeSession);
    if (trackable.length === 0) return;

    const currentExercise = trackable[currentExerciseIndex];
    if (!currentExercise) return;

    // Try next set in current exercise
    if (currentSetIndex < currentExercise.sets.length - 1) {
      set({ currentSetIndex: currentSetIndex + 1 });
      return;
    }

    // Try next exercise
    if (currentExerciseIndex < trackable.length - 1) {
      set({
        currentExerciseIndex: currentExerciseIndex + 1,
        currentSetIndex: 0,
      });
      return;
    }

    // Already at last set - stay there
  },

  // Navigate to previous set
  goToPreviousSet: () => {
    const { activeSession, currentExerciseIndex, currentSetIndex } = get();
    if (!activeSession) return;

    const trackable = getTrackableExercisesFromSession(activeSession);
    if (trackable.length === 0) return;

    // Try previous set in current exercise
    if (currentSetIndex > 0) {
      set({ currentSetIndex: currentSetIndex - 1 });
      return;
    }

    // Try previous exercise
    if (currentExerciseIndex > 0) {
      const prevExercise = trackable[currentExerciseIndex - 1];
      set({
        currentExerciseIndex: currentExerciseIndex - 1,
        currentSetIndex: prevExercise.sets.length - 1,
      });
      return;
    }

    // Already at first set - stay there
  },

  // Navigate to specific exercise
  goToExercise: (index: number) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const trackable = getTrackableExercisesFromSession(activeSession);
    if (index >= 0 && index < trackable.length) {
      set({
        currentExerciseIndex: index,
        currentSetIndex: 0,
      });
    }
  },

  // Start the rest timer
  startRestTimer: (seconds: number) => {
    set({
      restTimer: {
        isRunning: true,
        remainingSeconds: seconds,
        totalSeconds: seconds,
      },
    });
  },

  // Stop the rest timer
  stopRestTimer: () => {
    set({ restTimer: null });
  },

  // Tick the rest timer (called every second)
  tickRestTimer: () => {
    const { restTimer } = get();
    if (!restTimer || !restTimer.isRunning) return;

    if (restTimer.remainingSeconds <= 1) {
      set({ restTimer: null });
    } else {
      set({
        restTimer: {
          ...restTimer,
          remainingSeconds: restTimer.remainingSeconds - 1,
        },
      });
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Get current exercise
  getCurrentExercise: () => {
    const { activeSession, currentExerciseIndex } = get();
    if (!activeSession) return null;

    const trackable = getTrackableExercisesFromSession(activeSession);
    return trackable[currentExerciseIndex] || null;
  },

  // Get current set
  getCurrentSet: () => {
    const { activeSession, currentExerciseIndex, currentSetIndex } = get();
    if (!activeSession) return null;

    const trackable = getTrackableExercisesFromSession(activeSession);
    const exercise = trackable[currentExerciseIndex];
    return exercise?.sets[currentSetIndex] || null;
  },

  // Get progress
  getProgress: () => {
    const { activeSession } = get();
    return calculateProgress(activeSession);
  },

  // Get trackable exercises (for progress display)
  getTrackableExercises: () => {
    const { activeSession } = get();
    return getTrackableExercisesFromSession(activeSession);
  },
}));
