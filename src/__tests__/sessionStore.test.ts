import { useSessionStore } from '../stores/sessionStore';
import type {
  WorkoutTemplate,
  TemplateExercise,
  TemplateSet,
  WorkoutSession,
  SessionExercise,
  SessionSet,
} from '@/types';

// Mock the sessionRepository module
jest.mock('@/db/sessionRepository', () => ({
  createSessionFromTemplate: jest.fn(),
  getActiveSession: jest.fn(),
  getWorkoutSessionById: jest.fn(),
  updateSession: jest.fn(),
  updateSessionSet: jest.fn(),
  updateSessionExercise: jest.fn(),
  deleteSession: jest.fn(),
}));

// Mock the healthKitService module
jest.mock('@/services/healthKitService', () => ({
  saveWorkoutToHealthKit: jest.fn(),
  isHealthKitAvailable: jest.fn(),
}));

// Mock the settingsStore module
jest.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: jest.fn(),
  },
}));

import {
  createSessionFromTemplate,
  getActiveSession,
  updateSession,
  updateSessionSet,
  updateSessionExercise,
} from '@/db/sessionRepository';
import { saveWorkoutToHealthKit, isHealthKitAvailable } from '@/services/healthKitService';
import { useSettingsStore } from '../stores/settingsStore';

const mockedCreateSessionFromTemplate = createSessionFromTemplate as jest.MockedFunction<
  typeof createSessionFromTemplate
>;
const mockedGetActiveSession = getActiveSession as jest.MockedFunction<typeof getActiveSession>;
const mockedUpdateSession = updateSession as jest.MockedFunction<typeof updateSession>;
const mockedUpdateSessionSet = updateSessionSet as jest.MockedFunction<typeof updateSessionSet>;
const mockedUpdateSessionExercise = updateSessionExercise as jest.MockedFunction<
  typeof updateSessionExercise
>;
const mockedSaveWorkoutToHealthKit = saveWorkoutToHealthKit as jest.MockedFunction<
  typeof saveWorkoutToHealthKit
>;
const mockedIsHealthKitAvailable = isHealthKitAvailable as jest.MockedFunction<
  typeof isHealthKitAvailable
>;
const mockedUseSettingsStore = useSettingsStore as jest.Mocked<typeof useSettingsStore>;

// ============================================================================
// Helper Factory Functions - Templates
// ============================================================================

function createTemplateSet(overrides: Partial<TemplateSet> = {}): TemplateSet {
  return {
    id: 'template-set-1',
    templateExerciseId: 'template-exercise-1',
    orderIndex: 0,
    targetWeight: 185,
    targetWeightUnit: 'lbs',
    targetReps: 8,
    isDropset: false,
    isPerSide: false,
    ...overrides,
  };
}

function createTemplateExercise(overrides: Partial<TemplateExercise> = {}): TemplateExercise {
  return {
    id: 'template-exercise-1',
    workoutTemplateId: 'template-1',
    exerciseName: 'Bench Press',
    orderIndex: 0,
    sets: [],
    ...overrides,
  };
}

function createWorkoutTemplate(overrides: Partial<WorkoutTemplate> = {}): WorkoutTemplate {
  return {
    id: 'template-1',
    name: 'Test Workout',
    tags: ['strength'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    exercises: [],
    ...overrides,
  };
}

// ============================================================================
// Helper Factory Functions - Session Objects
// ============================================================================

function createSessionSet(overrides: Partial<SessionSet> = {}): SessionSet {
  return {
    id: 'session-set-1',
    sessionExerciseId: 'session-exercise-1',
    orderIndex: 0,
    targetWeight: 185,
    targetWeightUnit: 'lbs',
    targetReps: 8,
    status: 'pending',
    isDropset: false,
    isPerSide: false,
    ...overrides,
  };
}

function createSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'session-exercise-1',
    workoutSessionId: 'session-1',
    exerciseName: 'Bench Press',
    orderIndex: 0,
    sets: [],
    status: 'pending',
    ...overrides,
  };
}

function createWorkoutSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    workoutTemplateId: 'template-1',
    name: 'Test Session',
    date: '2024-01-15',
    startTime: '2024-01-15T10:00:00Z',
    exercises: [],
    status: 'in_progress',
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

describe('sessionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset zustand store state
    useSessionStore.setState({
      activeSession: null,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      restTimer: null,
      isLoading: false,
      error: null,
    });

    // Default mock for settings
    mockedUseSettingsStore.getState.mockReturnValue({
      settings: {
        id: 'settings-1',
        defaultWeightUnit: 'lbs',
        enableWorkoutTimer: true,
        autoStartRestTimer: true,
        theme: 'auto',
        notificationsEnabled: true,
        healthKitEnabled: false,
        liveActivitiesEnabled: false,
        keepScreenAwake: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
      error: null,
      loadSettings: jest.fn(),
      updateSettings: jest.fn(),
      clearError: jest.fn(),
    });
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useSessionStore.getState();

      expect(state.activeSession).toBeNull();
      expect(state.currentExerciseIndex).toBe(0);
      expect(state.currentSetIndex).toBe(0);
      expect(state.restTimer).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ============================================================================
  // startWorkout Tests
  // ============================================================================

  describe('startWorkout', () => {
    it('creates a session from template', async () => {
      const template = createWorkoutTemplate({ name: 'Push Day' });
      const session = createWorkoutSession({ name: 'Push Day' });

      mockedGetActiveSession.mockResolvedValue(null);
      mockedCreateSessionFromTemplate.mockResolvedValue(session);

      await useSessionStore.getState().startWorkout(template);

      const state = useSessionStore.getState();
      expect(state.activeSession).toEqual(session);
      expect(state.currentExerciseIndex).toBe(0);
      expect(state.currentSetIndex).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(mockedCreateSessionFromTemplate).toHaveBeenCalledWith(template);
    });

    it('throws error if another workout is in progress', async () => {
      const template = createWorkoutTemplate();
      const existingSession = createWorkoutSession();

      mockedGetActiveSession.mockResolvedValue(existingSession);

      await expect(useSessionStore.getState().startWorkout(template)).rejects.toThrow(
        'Another workout is already in progress'
      );

      const state = useSessionStore.getState();
      expect(state.error).toBe('Another workout is already in progress');
      expect(mockedCreateSessionFromTemplate).not.toHaveBeenCalled();
    });

    it('sets loading state during operation', async () => {
      const template = createWorkoutTemplate();
      const session = createWorkoutSession();

      mockedGetActiveSession.mockResolvedValue(null);
      mockedCreateSessionFromTemplate.mockImplementation(async () => {
        expect(useSessionStore.getState().isLoading).toBe(true);
        return session;
      });

      await useSessionStore.getState().startWorkout(template);

      expect(useSessionStore.getState().isLoading).toBe(false);
    });

    it('handles errors and sets error state', async () => {
      const template = createWorkoutTemplate();

      mockedGetActiveSession.mockResolvedValue(null);
      mockedCreateSessionFromTemplate.mockRejectedValue(new Error('Database error'));

      await expect(useSessionStore.getState().startWorkout(template)).rejects.toThrow(
        'Database error'
      );

      const state = useSessionStore.getState();
      expect(state.error).toBe('Database error');
      expect(state.isLoading).toBe(false);
    });

    it('clears rest timer when starting new workout', async () => {
      const template = createWorkoutTemplate();
      const session = createWorkoutSession();

      useSessionStore.setState({
        restTimer: { isRunning: true, remainingSeconds: 60, totalSeconds: 60 },
      });

      mockedGetActiveSession.mockResolvedValue(null);
      mockedCreateSessionFromTemplate.mockResolvedValue(session);

      await useSessionStore.getState().startWorkout(template);

      expect(useSessionStore.getState().restTimer).toBeNull();
    });
  });

  // ============================================================================
  // resumeSession Tests
  // ============================================================================

  describe('resumeSession', () => {
    it('resumes an active session', async () => {
      const set1 = createSessionSet({ id: 'set-1', status: 'completed' });
      const set2 = createSessionSet({ id: 'set-2', status: 'pending', orderIndex: 1 });
      const exercise = createSessionExercise({ sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      mockedGetActiveSession.mockResolvedValue(session);

      await useSessionStore.getState().resumeSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toEqual(session);
      expect(state.currentExerciseIndex).toBe(0);
      expect(state.currentSetIndex).toBe(1); // First pending set
    });

    it('clears state when no active session', async () => {
      mockedGetActiveSession.mockResolvedValue(null);

      await useSessionStore.getState().resumeSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('handles errors during resume', async () => {
      mockedGetActiveSession.mockRejectedValue(new Error('Failed to fetch'));

      await useSessionStore.getState().resumeSession();

      const state = useSessionStore.getState();
      expect(state.error).toBe('Failed to fetch');
      expect(state.isLoading).toBe(false);
    });

    it('finds first pending set across multiple exercises', async () => {
      const completedSet = createSessionSet({ id: 'set-1', status: 'completed' });
      const exercise1 = createSessionExercise({
        id: 'ex-1',
        sets: [completedSet],
      });

      const pendingSet = createSessionSet({ id: 'set-2', status: 'pending' });
      const exercise2 = createSessionExercise({
        id: 'ex-2',
        orderIndex: 1,
        sets: [pendingSet],
      });

      const session = createWorkoutSession({ exercises: [exercise1, exercise2] });
      mockedGetActiveSession.mockResolvedValue(session);

      await useSessionStore.getState().resumeSession();

      const state = useSessionStore.getState();
      expect(state.currentExerciseIndex).toBe(1);
      expect(state.currentSetIndex).toBe(0);
    });
  });

  // ============================================================================
  // pauseSession Tests
  // ============================================================================

  describe('pauseSession', () => {
    it('clears local state', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 2,
        currentSetIndex: 3,
        restTimer: { isRunning: true, remainingSeconds: 30, totalSeconds: 60 },
      });

      await useSessionStore.getState().pauseSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.currentExerciseIndex).toBe(0);
      expect(state.currentSetIndex).toBe(0);
      expect(state.restTimer).toBeNull();
    });
  });

  // ============================================================================
  // completeWorkout Tests
  // ============================================================================

  describe('completeWorkout', () => {
    it('marks workout as completed', async () => {
      const session = createWorkoutSession({
        startTime: '2024-01-15T10:00:00Z',
      });
      useSessionStore.setState({ activeSession: session });

      mockedUpdateSession.mockResolvedValue(undefined);

      await useSessionStore.getState().completeWorkout();

      expect(mockedUpdateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          endTime: expect.any(String),
          duration: expect.any(Number),
        })
      );

      const state = useSessionStore.getState();
      expect(state.activeSession?.status).toBe('completed');
    });

    it('does nothing when no active session', async () => {
      await useSessionStore.getState().completeWorkout();

      expect(mockedUpdateSession).not.toHaveBeenCalled();
    });

    it('saves to HealthKit when enabled', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({ activeSession: session });

      mockedUseSettingsStore.getState.mockReturnValue({
        settings: {
          id: 'settings-1',
          defaultWeightUnit: 'lbs',
          enableWorkoutTimer: true,
          autoStartRestTimer: true,
          theme: 'auto',
          notificationsEnabled: true,
          healthKitEnabled: true,
          liveActivitiesEnabled: false,
          keepScreenAwake: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        error: null,
        loadSettings: jest.fn(),
        updateSettings: jest.fn(),
        clearError: jest.fn(),
      });

      mockedIsHealthKitAvailable.mockReturnValue(true);
      mockedSaveWorkoutToHealthKit.mockResolvedValue({ success: true, healthKitId: 'hk-123' });
      mockedUpdateSession.mockResolvedValue(undefined);

      await useSessionStore.getState().completeWorkout();

      expect(mockedSaveWorkoutToHealthKit).toHaveBeenCalled();
    });

    it('does not save to HealthKit when disabled', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({ activeSession: session });

      mockedUpdateSession.mockResolvedValue(undefined);

      await useSessionStore.getState().completeWorkout();

      expect(mockedSaveWorkoutToHealthKit).not.toHaveBeenCalled();
    });

    it('handles HealthKit errors without failing workout completion', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({ activeSession: session });

      mockedUseSettingsStore.getState.mockReturnValue({
        settings: {
          id: 'settings-1',
          defaultWeightUnit: 'lbs',
          enableWorkoutTimer: true,
          autoStartRestTimer: true,
          theme: 'auto',
          notificationsEnabled: true,
          healthKitEnabled: true,
          liveActivitiesEnabled: false,
          keepScreenAwake: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        error: null,
        loadSettings: jest.fn(),
        updateSettings: jest.fn(),
        clearError: jest.fn(),
      });

      mockedIsHealthKitAvailable.mockReturnValue(true);
      mockedSaveWorkoutToHealthKit.mockResolvedValue({ success: false, error: 'HealthKit error' });
      mockedUpdateSession.mockResolvedValue(undefined);

      await useSessionStore.getState().completeWorkout();

      expect(useSessionStore.getState().activeSession?.status).toBe('completed');
      expect(useSessionStore.getState().error).toBeNull();
    });

    it('handles database errors', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({ activeSession: session });

      mockedUpdateSession.mockRejectedValue(new Error('Database error'));

      await useSessionStore.getState().completeWorkout();

      const state = useSessionStore.getState();
      expect(state.error).toBe('Database error');
    });
  });

  // ============================================================================
  // cancelWorkout Tests
  // ============================================================================

  describe('cancelWorkout', () => {
    it('marks workout as canceled and clears state', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 2,
        currentSetIndex: 1,
        restTimer: { isRunning: true, remainingSeconds: 30, totalSeconds: 60 },
      });

      mockedUpdateSession.mockResolvedValue(undefined);

      await useSessionStore.getState().cancelWorkout();

      expect(mockedUpdateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
        })
      );

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.currentExerciseIndex).toBe(0);
      expect(state.currentSetIndex).toBe(0);
      expect(state.restTimer).toBeNull();
    });

    it('does nothing when no active session', async () => {
      await useSessionStore.getState().cancelWorkout();

      expect(mockedUpdateSession).not.toHaveBeenCalled();
    });

    it('handles errors', async () => {
      const session = createWorkoutSession();
      useSessionStore.setState({ activeSession: session });

      mockedUpdateSession.mockRejectedValue(new Error('Cancel failed'));

      await useSessionStore.getState().cancelWorkout();

      expect(useSessionStore.getState().error).toBe('Cancel failed');
    });
  });

  // ============================================================================
  // checkForActiveSession Tests
  // ============================================================================

  describe('checkForActiveSession', () => {
    it('returns true when active session exists', async () => {
      const session = createWorkoutSession();
      mockedGetActiveSession.mockResolvedValue(session);

      const result = await useSessionStore.getState().checkForActiveSession();

      expect(result).toBe(true);
    });

    it('returns false when no active session', async () => {
      mockedGetActiveSession.mockResolvedValue(null);

      const result = await useSessionStore.getState().checkForActiveSession();

      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockedGetActiveSession.mockRejectedValue(new Error('Error'));

      const result = await useSessionStore.getState().checkForActiveSession();

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // updateSetValues Tests
  // ============================================================================

  describe('updateSetValues', () => {
    it('updates set values locally', () => {
      const set = createSessionSet({ id: 'set-1', targetWeight: 185, targetReps: 8 });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });

      useSessionStore.getState().updateSetValues('set-1', { actualWeight: 190, actualReps: 10 });

      const state = useSessionStore.getState();
      expect(state.activeSession?.exercises[0].sets[0].actualWeight).toBe(190);
      expect(state.activeSession?.exercises[0].sets[0].actualReps).toBe(10);
    });

    it('does nothing when no active session', () => {
      useSessionStore.getState().updateSetValues('set-1', { actualWeight: 190 });

      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it('does nothing when set not found', () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });

      useSessionStore.getState().updateSetValues('non-existent', { actualWeight: 190 });

      expect(
        useSessionStore.getState().activeSession?.exercises[0].sets[0].actualWeight
      ).toBeUndefined();
    });
  });

  // ============================================================================
  // completeSet Tests
  // ============================================================================

  describe('completeSet', () => {
    it('completes a set with actual values', async () => {
      const set = createSessionSet({ id: 'set-1', targetWeight: 185, targetReps: 8 });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });
      mockedUpdateSessionSet.mockResolvedValue(undefined);

      await useSessionStore.getState().completeSet('set-1', { actualWeight: 190, actualReps: 10 });

      expect(mockedUpdateSessionSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'set-1',
          actualWeight: 190,
          actualReps: 10,
          status: 'completed',
          completedAt: expect.any(String),
        })
      );

      const state = useSessionStore.getState();
      expect(state.activeSession?.exercises[0].sets[0].status).toBe('completed');
    });

    it('uses target values when no actual values provided', async () => {
      const set = createSessionSet({
        id: 'set-1',
        targetWeight: 185,
        targetReps: 8,
        targetRpe: 7,
      });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });
      mockedUpdateSessionSet.mockResolvedValue(undefined);

      await useSessionStore.getState().completeSet('set-1');

      expect(mockedUpdateSessionSet).toHaveBeenCalledWith(
        expect.objectContaining({
          actualWeight: 185,
          actualReps: 8,
          actualRpe: 7,
        })
      );
    });

    it('marks exercise as completed when all sets are done', async () => {
      const set1 = createSessionSet({ id: 'set-1', status: 'completed' });
      const set2 = createSessionSet({ id: 'set-2', status: 'pending', orderIndex: 1 });
      const exercise = createSessionExercise({ id: 'ex-1', sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentSetIndex: 1 });
      mockedUpdateSessionSet.mockResolvedValue(undefined);
      mockedUpdateSessionExercise.mockResolvedValue(undefined);

      await useSessionStore.getState().completeSet('set-2');

      expect(mockedUpdateSessionExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ex-1',
          status: 'completed',
        })
      );
    });

    it('auto-advances to next set', async () => {
      const set1 = createSessionSet({ id: 'set-1', status: 'pending' });
      const set2 = createSessionSet({ id: 'set-2', status: 'pending', orderIndex: 1 });
      const exercise = createSessionExercise({ sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentSetIndex: 0 });
      mockedUpdateSessionSet.mockResolvedValue(undefined);

      await useSessionStore.getState().completeSet('set-1');

      expect(useSessionStore.getState().currentSetIndex).toBe(1);
    });

    it('does nothing when no active session', async () => {
      await useSessionStore.getState().completeSet('set-1');

      expect(mockedUpdateSessionSet).not.toHaveBeenCalled();
    });

    it('handles errors', async () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });
      mockedUpdateSessionSet.mockRejectedValue(new Error('Update failed'));

      await useSessionStore.getState().completeSet('set-1');

      expect(useSessionStore.getState().error).toBe('Update failed');
    });
  });

  // ============================================================================
  // skipSet Tests
  // ============================================================================

  describe('skipSet', () => {
    it('marks set as skipped', async () => {
      const set = createSessionSet({ id: 'set-1', status: 'pending' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });
      mockedUpdateSessionSet.mockResolvedValue(undefined);

      await useSessionStore.getState().skipSet('set-1');

      expect(mockedUpdateSessionSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'set-1',
          status: 'skipped',
        })
      );

      expect(useSessionStore.getState().activeSession?.exercises[0].sets[0].status).toBe('skipped');
    });

    it('marks exercise as completed when all sets are skipped/completed', async () => {
      const set1 = createSessionSet({ id: 'set-1', status: 'completed' });
      const set2 = createSessionSet({ id: 'set-2', status: 'pending', orderIndex: 1 });
      const exercise = createSessionExercise({ id: 'ex-1', sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentSetIndex: 1 });
      mockedUpdateSessionSet.mockResolvedValue(undefined);
      mockedUpdateSessionExercise.mockResolvedValue(undefined);

      await useSessionStore.getState().skipSet('set-2');

      expect(mockedUpdateSessionExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('auto-advances to next set', async () => {
      const set1 = createSessionSet({ id: 'set-1', status: 'pending' });
      const set2 = createSessionSet({ id: 'set-2', status: 'pending', orderIndex: 1 });
      const exercise = createSessionExercise({ sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentSetIndex: 0 });
      mockedUpdateSessionSet.mockResolvedValue(undefined);

      await useSessionStore.getState().skipSet('set-1');

      expect(useSessionStore.getState().currentSetIndex).toBe(1);
    });

    it('does nothing when no active session', async () => {
      await useSessionStore.getState().skipSet('set-1');

      expect(mockedUpdateSessionSet).not.toHaveBeenCalled();
    });

    it('handles errors', async () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });
      mockedUpdateSessionSet.mockRejectedValue(new Error('Skip failed'));

      await useSessionStore.getState().skipSet('set-1');

      expect(useSessionStore.getState().error).toBe('Skip failed');
    });
  });

  // ============================================================================
  // goToNextSet Tests
  // ============================================================================

  describe('goToNextSet', () => {
    it('advances to next set in same exercise', () => {
      const set1 = createSessionSet({ id: 'set-1' });
      const set2 = createSessionSet({ id: 'set-2', orderIndex: 1 });
      const exercise = createSessionExercise({ sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentSetIndex: 0 });

      useSessionStore.getState().goToNextSet();

      expect(useSessionStore.getState().currentSetIndex).toBe(1);
      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
    });

    it('advances to next exercise when at last set', () => {
      const set1 = createSessionSet({ id: 'set-1' });
      const exercise1 = createSessionExercise({ id: 'ex-1', sets: [set1] });

      const set2 = createSessionSet({ id: 'set-2' });
      const exercise2 = createSessionExercise({ id: 'ex-2', orderIndex: 1, sets: [set2] });

      const session = createWorkoutSession({ exercises: [exercise1, exercise2] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToNextSet();

      expect(useSessionStore.getState().currentExerciseIndex).toBe(1);
      expect(useSessionStore.getState().currentSetIndex).toBe(0);
    });

    it('stays at last set when at end of workout', () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToNextSet();

      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
      expect(useSessionStore.getState().currentSetIndex).toBe(0);
    });

    it('does nothing when no active session', () => {
      useSessionStore.getState().goToNextSet();

      expect(useSessionStore.getState().currentSetIndex).toBe(0);
    });

    it('skips exercises with no sets', () => {
      const set1 = createSessionSet({ id: 'set-1' });
      const exercise1 = createSessionExercise({ id: 'ex-1', sets: [set1] });

      const exerciseHeader = createSessionExercise({
        id: 'ex-header',
        orderIndex: 1,
        sets: [],
        groupType: 'superset',
      });

      const set2 = createSessionSet({ id: 'set-2' });
      const exercise2 = createSessionExercise({ id: 'ex-2', orderIndex: 2, sets: [set2] });

      const session = createWorkoutSession({
        exercises: [exercise1, exerciseHeader, exercise2],
      });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToNextSet();

      expect(useSessionStore.getState().currentExerciseIndex).toBe(1);
    });
  });

  // ============================================================================
  // goToPreviousSet Tests
  // ============================================================================

  describe('goToPreviousSet', () => {
    it('goes to previous set in same exercise', () => {
      const set1 = createSessionSet({ id: 'set-1' });
      const set2 = createSessionSet({ id: 'set-2', orderIndex: 1 });
      const exercise = createSessionExercise({ sets: [set1, set2] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentSetIndex: 1 });

      useSessionStore.getState().goToPreviousSet();

      expect(useSessionStore.getState().currentSetIndex).toBe(0);
    });

    it('goes to last set of previous exercise when at first set', () => {
      const set1 = createSessionSet({ id: 'set-1' });
      const set2 = createSessionSet({ id: 'set-2', orderIndex: 1 });
      const exercise1 = createSessionExercise({ id: 'ex-1', sets: [set1, set2] });

      const set3 = createSessionSet({ id: 'set-3' });
      const exercise2 = createSessionExercise({ id: 'ex-2', orderIndex: 1, sets: [set3] });

      const session = createWorkoutSession({ exercises: [exercise1, exercise2] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 1,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToPreviousSet();

      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
      expect(useSessionStore.getState().currentSetIndex).toBe(1);
    });

    it('stays at first set when at beginning of workout', () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToPreviousSet();

      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
      expect(useSessionStore.getState().currentSetIndex).toBe(0);
    });

    it('does nothing when no active session', () => {
      useSessionStore.setState({ currentSetIndex: 2 });

      useSessionStore.getState().goToPreviousSet();

      expect(useSessionStore.getState().currentSetIndex).toBe(2);
    });
  });

  // ============================================================================
  // goToExercise Tests
  // ============================================================================

  describe('goToExercise', () => {
    it('navigates to specified exercise', () => {
      const set1 = createSessionSet({ id: 'set-1' });
      const exercise1 = createSessionExercise({ id: 'ex-1', sets: [set1] });

      const set2 = createSessionSet({ id: 'set-2' });
      const exercise2 = createSessionExercise({ id: 'ex-2', orderIndex: 1, sets: [set2] });

      const session = createWorkoutSession({ exercises: [exercise1, exercise2] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToExercise(1);

      expect(useSessionStore.getState().currentExerciseIndex).toBe(1);
      expect(useSessionStore.getState().currentSetIndex).toBe(0);
    });

    it('does not navigate to invalid index', () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      useSessionStore.getState().goToExercise(5);

      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
    });

    it('does not navigate to negative index', () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
      });

      useSessionStore.getState().goToExercise(-1);

      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
    });

    it('does nothing when no active session', () => {
      useSessionStore.setState({ currentExerciseIndex: 0 });

      useSessionStore.getState().goToExercise(1);

      expect(useSessionStore.getState().currentExerciseIndex).toBe(0);
    });
  });

  // ============================================================================
  // Rest Timer Tests
  // ============================================================================

  describe('startRestTimer', () => {
    it('starts timer with specified seconds', () => {
      useSessionStore.getState().startRestTimer(90);

      const state = useSessionStore.getState();
      expect(state.restTimer).toEqual({
        isRunning: true,
        remainingSeconds: 90,
        totalSeconds: 90,
      });
    });
  });

  describe('stopRestTimer', () => {
    it('clears the rest timer', () => {
      useSessionStore.setState({
        restTimer: { isRunning: true, remainingSeconds: 30, totalSeconds: 60 },
      });

      useSessionStore.getState().stopRestTimer();

      expect(useSessionStore.getState().restTimer).toBeNull();
    });
  });

  describe('tickRestTimer', () => {
    it('decrements remaining seconds', () => {
      useSessionStore.setState({
        restTimer: { isRunning: true, remainingSeconds: 30, totalSeconds: 60 },
      });

      useSessionStore.getState().tickRestTimer();

      expect(useSessionStore.getState().restTimer?.remainingSeconds).toBe(29);
    });

    it('clears timer when reaching zero', () => {
      useSessionStore.setState({
        restTimer: { isRunning: true, remainingSeconds: 1, totalSeconds: 60 },
      });

      useSessionStore.getState().tickRestTimer();

      expect(useSessionStore.getState().restTimer).toBeNull();
    });

    it('does nothing when timer is not running', () => {
      useSessionStore.setState({
        restTimer: { isRunning: false, remainingSeconds: 30, totalSeconds: 60 },
      });

      useSessionStore.getState().tickRestTimer();

      expect(useSessionStore.getState().restTimer?.remainingSeconds).toBe(30);
    });

    it('does nothing when no timer', () => {
      useSessionStore.getState().tickRestTimer();

      expect(useSessionStore.getState().restTimer).toBeNull();
    });
  });

  // ============================================================================
  // Utility Methods Tests
  // ============================================================================

  describe('clearError', () => {
    it('clears error state', () => {
      useSessionStore.setState({ error: 'Some error' });

      useSessionStore.getState().clearError();

      expect(useSessionStore.getState().error).toBeNull();
    });
  });

  describe('getCurrentExercise', () => {
    it('returns current exercise', () => {
      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({ id: 'ex-1', exerciseName: 'Squat', sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session, currentExerciseIndex: 0 });

      const current = useSessionStore.getState().getCurrentExercise();

      expect(current).not.toBeNull();
      expect(current?.exerciseName).toBe('Squat');
    });

    it('returns null when no active session', () => {
      const current = useSessionStore.getState().getCurrentExercise();

      expect(current).toBeNull();
    });

    it('skips exercises with no sets (superset headers)', () => {
      const header = createSessionExercise({
        id: 'ex-header',
        orderIndex: 0,
        sets: [],
        groupType: 'superset',
        exerciseName: 'Arms Superset',
      });

      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({
        id: 'ex-1',
        orderIndex: 1,
        exerciseName: 'Squat',
        sets: [set],
      });

      const session = createWorkoutSession({ exercises: [header, exercise] });

      useSessionStore.setState({ activeSession: session, currentExerciseIndex: 0 });

      const current = useSessionStore.getState().getCurrentExercise();

      expect(current?.exerciseName).toBe('Squat');
    });
  });

  describe('getCurrentSet', () => {
    it('returns current set', () => {
      const set = createSessionSet({ id: 'set-1', targetWeight: 225 });
      const exercise = createSessionExercise({ sets: [set] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({
        activeSession: session,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
      });

      const current = useSessionStore.getState().getCurrentSet();

      expect(current).not.toBeNull();
      expect(current?.targetWeight).toBe(225);
    });

    it('returns null when no active session', () => {
      const current = useSessionStore.getState().getCurrentSet();

      expect(current).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('calculates progress correctly', () => {
      const set1 = createSessionSet({ id: 'set-1', status: 'completed' });
      const set2 = createSessionSet({ id: 'set-2', status: 'pending', orderIndex: 1 });
      const set3 = createSessionSet({ id: 'set-3', status: 'skipped', orderIndex: 2 });
      const exercise = createSessionExercise({ sets: [set1, set2, set3] });
      const session = createWorkoutSession({ exercises: [exercise] });

      useSessionStore.setState({ activeSession: session });

      const progress = useSessionStore.getState().getProgress();

      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(3);
    });

    it('returns zero progress when no active session', () => {
      const progress = useSessionStore.getState().getProgress();

      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(0);
    });

    it('excludes exercises with no sets from total', () => {
      const header = createSessionExercise({
        id: 'ex-header',
        orderIndex: 0,
        sets: [],
        groupType: 'superset',
      });

      const set = createSessionSet({ id: 'set-1', status: 'pending' });
      const exercise = createSessionExercise({ id: 'ex-1', orderIndex: 1, sets: [set] });

      const session = createWorkoutSession({ exercises: [header, exercise] });

      useSessionStore.setState({ activeSession: session });

      const progress = useSessionStore.getState().getProgress();

      expect(progress.total).toBe(1);
    });
  });

  describe('getTrackableExercises', () => {
    it('returns exercises with sets', () => {
      const header = createSessionExercise({
        id: 'ex-header',
        orderIndex: 0,
        sets: [],
        groupType: 'superset',
        exerciseName: 'Arms Superset',
      });

      const set = createSessionSet({ id: 'set-1' });
      const exercise = createSessionExercise({
        id: 'ex-1',
        orderIndex: 1,
        exerciseName: 'Bicep Curl',
        sets: [set],
      });

      const session = createWorkoutSession({ exercises: [header, exercise] });

      useSessionStore.setState({ activeSession: session });

      const trackable = useSessionStore.getState().getTrackableExercises();

      expect(trackable).toHaveLength(1);
      expect(trackable[0].exerciseName).toBe('Bicep Curl');
    });

    it('returns empty array when no active session', () => {
      const trackable = useSessionStore.getState().getTrackableExercises();

      expect(trackable).toEqual([]);
    });
  });
});
