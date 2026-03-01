import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

// Mock expo-file-system
const mockWrite = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: {
    cache: '/mock/cache',
  },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({
    uri: `/mock/cache/${name}`,
    write: mockWrite,
  })),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3' },
  },
}));

// Mock the session repository
jest.mock('@/db/sessionRepository', () => ({
  getCompletedSessions: jest.fn(),
}));

// Mock the plan repository
jest.mock('@/db/repository', () => ({
  getAllWorkoutPlans: jest.fn(),
}));

// Mock the database
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
jest.mock('@/db/index', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
  }),
}));

import { exportSessionsAsJson, exportSingleSessionAsJson, exportUnifiedJson, buildSessionFileName, ExportError } from '../services/workoutExportService';
import { getCompletedSessions } from '@/db/sessionRepository';
import { getAllWorkoutPlans } from '@/db/repository';

const mockedGetCompletedSessions = getCompletedSessions as jest.MockedFunction<typeof getCompletedSessions>;
const mockedGetAllWorkoutPlans = getAllWorkoutPlans as jest.MockedFunction<typeof getAllWorkoutPlans>;

// ============================================================================
// Helper Factories
// ============================================================================

function createSet(overrides: Partial<SessionSet> = {}): SessionSet {
  return {
    id: 'set-1',
    sessionExerciseId: 'exercise-1',
    orderIndex: 0,
    status: 'completed',
    actualWeight: 135,
    actualWeightUnit: 'lbs',
    actualReps: 10,
    ...overrides,
  };
}

function createExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'exercise-1',
    workoutSessionId: 'session-1',
    exerciseName: 'Bench Press',
    orderIndex: 0,
    sets: [createSet()],
    status: 'completed',
    ...overrides,
  };
}

function createSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    workoutPlanId: 'plan-1',
    name: 'Push Day',
    date: '2024-06-15',
    startTime: '2024-06-15T10:00:00Z',
    endTime: '2024-06-15T11:00:00Z',
    duration: 3600,
    exercises: [createExercise()],
    status: 'completed',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('exportSessionsAsJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws ExportError when no completed sessions exist', async () => {
    mockedGetCompletedSessions.mockResolvedValue([]);

    await expect(exportSessionsAsJson()).rejects.toThrow(ExportError);
    await expect(exportSessionsAsJson()).rejects.toThrow('No completed workouts to export.');
  });

  it('writes JSON to a temp file and returns the URI', async () => {
    mockedGetCompletedSessions.mockResolvedValue([createSession()]);

    const uri = await exportSessionsAsJson();

    expect(uri).toMatch(/^\/mock\/cache\/liftmark_workouts_.+\.json$/);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it('includes envelope with exportedAt and appVersion', async () => {
    mockedGetCompletedSessions.mockResolvedValue([createSession()]);

    await exportSessionsAsJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(written).toHaveProperty('exportedAt');
    expect(written.appVersion).toBe('1.2.3');
    expect(written.sessions).toHaveLength(1);
  });

  it('strips internal IDs from sessions', async () => {
    mockedGetCompletedSessions.mockResolvedValue([createSession()]);

    await exportSessionsAsJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    const session = written.sessions[0];

    // Session-level IDs stripped
    expect(session).not.toHaveProperty('id');
    expect(session).not.toHaveProperty('workoutPlanId');

    // Preserve user-facing data
    expect(session.name).toBe('Push Day');
    expect(session.date).toBe('2024-06-15');
    expect(session.startTime).toBe('2024-06-15T10:00:00Z');
    expect(session.endTime).toBe('2024-06-15T11:00:00Z');
    expect(session.duration).toBe(3600);
    expect(session.status).toBe('completed');
  });

  it('strips internal IDs from exercises', async () => {
    mockedGetCompletedSessions.mockResolvedValue([createSession()]);

    await exportSessionsAsJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    const exercise = written.sessions[0].exercises[0];

    expect(exercise).not.toHaveProperty('id');
    expect(exercise).not.toHaveProperty('workoutSessionId');
    expect(exercise).not.toHaveProperty('parentExerciseId');

    expect(exercise.exerciseName).toBe('Bench Press');
    expect(exercise.orderIndex).toBe(0);
    expect(exercise.status).toBe('completed');
  });

  it('strips internal IDs from sets', async () => {
    mockedGetCompletedSessions.mockResolvedValue([createSession()]);

    await exportSessionsAsJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    const set = written.sessions[0].exercises[0].sets[0];

    expect(set).not.toHaveProperty('id');
    expect(set).not.toHaveProperty('sessionExerciseId');
    expect(set).not.toHaveProperty('parentSetId');
    expect(set).not.toHaveProperty('dropSequence');

    expect(set.actualWeight).toBe(135);
    expect(set.actualWeightUnit).toBe('lbs');
    expect(set.actualReps).toBe(10);
    expect(set.status).toBe('completed');
  });

  it('preserves all set performance fields', async () => {
    const fullSet = createSet({
      targetWeight: 140,
      targetWeightUnit: 'lbs',
      targetReps: 8,
      targetTime: 60,
      targetRpe: 7,
      restSeconds: 90,
      actualWeight: 135,
      actualWeightUnit: 'lbs',
      actualReps: 10,
      actualTime: 55,
      actualRpe: 8,
      completedAt: '2024-06-15T10:05:00Z',
      notes: 'Felt good',
      tempo: '3010',
      isDropset: true,
      isPerSide: false,
    });

    mockedGetCompletedSessions.mockResolvedValue([
      createSession({
        exercises: [createExercise({ sets: [fullSet] })],
      }),
    ]);

    await exportSessionsAsJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    const set = written.sessions[0].exercises[0].sets[0];

    expect(set.targetWeight).toBe(140);
    expect(set.targetWeightUnit).toBe('lbs');
    expect(set.targetReps).toBe(8);
    expect(set.targetTime).toBe(60);
    expect(set.targetRpe).toBe(7);
    expect(set.restSeconds).toBe(90);
    expect(set.actualWeight).toBe(135);
    expect(set.actualReps).toBe(10);
    expect(set.actualTime).toBe(55);
    expect(set.actualRpe).toBe(8);
    expect(set.completedAt).toBe('2024-06-15T10:05:00Z');
    expect(set.notes).toBe('Felt good');
    expect(set.tempo).toBe('3010');
    expect(set.isDropset).toBe(true);
    expect(set.isPerSide).toBe(false);
  });

  it('exports a single session via exportSingleSessionAsJson', async () => {
    const session = createSession();

    const uri = await exportSingleSessionAsJson(session);

    expect(uri).toMatch(/^\/mock\/cache\/workout-push-day-2024-06-15\.json$/);
    expect(mockWrite).toHaveBeenCalledTimes(1);

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(written).toHaveProperty('exportedAt');
    expect(written.appVersion).toBe('1.2.3');
    expect(written.session.name).toBe('Push Day');
    expect(written.session).not.toHaveProperty('id');
    expect(written).not.toHaveProperty('sessions'); // single session, not array
  });

  it('handles multiple sessions with multiple exercises', async () => {
    mockedGetCompletedSessions.mockResolvedValue([
      createSession({
        id: 's1',
        name: 'Push Day',
        exercises: [
          createExercise({ id: 'e1', exerciseName: 'Bench Press' }),
          createExercise({ id: 'e2', exerciseName: 'OHP', orderIndex: 1, sets: [createSet({ id: 'set-2' })] }),
        ],
      }),
      createSession({
        id: 's2',
        name: 'Pull Day',
        exercises: [
          createExercise({ id: 'e3', exerciseName: 'Deadlift' }),
        ],
      }),
    ]);

    await exportSessionsAsJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(written.sessions).toHaveLength(2);
    expect(written.sessions[0].exercises).toHaveLength(2);
    expect(written.sessions[0].exercises[0].exerciseName).toBe('Bench Press');
    expect(written.sessions[0].exercises[1].exerciseName).toBe('OHP');
    expect(written.sessions[1].exercises[0].exerciseName).toBe('Deadlift');
  });
});

describe('buildSessionFileName', () => {
  it('creates a sanitized filename from name and date', () => {
    expect(buildSessionFileName('Push Day', '2026-02-14T10:30:00Z'))
      .toBe('workout-push-day-2026-02-14.json');
  });

  it('handles special characters and emojis', () => {
    expect(buildSessionFileName('🔥 MAX EFFORT LEG DAY 💪 (Heavy Singles)', '2026-02-14'))
      .toBe('workout-max-effort-leg-day-heavy-singles-2026-02-14.json');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(buildSessionFileName('Upper   Body -- A', '2026-02-15'))
      .toBe('workout-upper-body-a-2026-02-15.json');
  });

  it('truncates long names to 50 chars', () => {
    const longName = 'a'.repeat(100);
    const fileName = buildSessionFileName(longName, '2026-02-14');
    const namePart = fileName.replace('workout-', '').replace('-2026-02-14.json', '');
    expect(namePart.length).toBeLessThanOrEqual(50);
  });

  it('falls back to "workout" for empty name', () => {
    expect(buildSessionFileName('', '2026-02-14'))
      .toBe('workout-workout-2026-02-14.json');
  });

  it('falls back to "workout" for name with only special chars', () => {
    expect(buildSessionFileName('🔥💪', '2026-02-14'))
      .toBe('workout-workout-2026-02-14.json');
  });

  it('handles diacritics', () => {
    expect(buildSessionFileName('Séance Résistance', '2026-02-14'))
      .toBe('workout-seance-resistance-2026-02-14.json');
  });
});

// ============================================================================
// Unified Export Tests
// ============================================================================

describe('exportUnifiedJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync.mockResolvedValue([]);
    mockGetFirstAsync.mockResolvedValue(null);
  });

  it('writes a unified JSON file with all data sections', async () => {
    mockedGetAllWorkoutPlans.mockResolvedValue([]);
    mockedGetCompletedSessions.mockResolvedValue([]);

    const uri = await exportUnifiedJson();

    expect(uri).toMatch(/^\/mock\/cache\/liftmark_export_.+\.json$/);
    expect(mockWrite).toHaveBeenCalledTimes(1);

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(written.formatVersion).toBe('1.0');
    expect(written).toHaveProperty('exportedAt');
    expect(written.appVersion).toBe('1.2.3');
    expect(written.plans).toEqual([]);
    expect(written.sessions).toEqual([]);
    expect(written.gyms).toEqual([]);
    expect(written.settings).toEqual({});
  });

  it('exports plans with exercises and sets, stripping IDs', async () => {
    mockedGetAllWorkoutPlans.mockResolvedValue([{
      id: 'plan-1',
      name: 'Push Day',
      description: 'A push workout',
      tags: ['push', 'chest'],
      defaultWeightUnit: 'lbs',
      sourceMarkdown: '# Push Day',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      isFavorite: true,
      exercises: [{
        id: 'ex-1',
        workoutPlanId: 'plan-1',
        exerciseName: 'Bench Press',
        orderIndex: 0,
        notes: 'Go heavy',
        equipmentType: 'barbell',
        sets: [{
          id: 'set-1',
          plannedExerciseId: 'ex-1',
          orderIndex: 0,
          targetWeight: 225,
          targetWeightUnit: 'lbs',
          targetReps: 5,
          targetRpe: 8,
          restSeconds: 180,
          tempo: '3-0-1-0',
          isDropset: false,
          isPerSide: false,
        }],
      }],
    }]);
    mockedGetCompletedSessions.mockResolvedValue([]);

    await exportUnifiedJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    const plan = written.plans[0];

    // IDs stripped
    expect(plan).not.toHaveProperty('id');
    expect(plan).not.toHaveProperty('createdAt');
    expect(plan).not.toHaveProperty('updatedAt');

    // Data preserved
    expect(plan.name).toBe('Push Day');
    expect(plan.description).toBe('A push workout');
    expect(plan.tags).toEqual(['push', 'chest']);
    expect(plan.defaultWeightUnit).toBe('lbs');
    expect(plan.sourceMarkdown).toBe('# Push Day');
    expect(plan.isFavorite).toBe(true);

    // Exercise
    const exercise = plan.exercises[0];
    expect(exercise).not.toHaveProperty('id');
    expect(exercise).not.toHaveProperty('workoutPlanId');
    expect(exercise.exerciseName).toBe('Bench Press');
    expect(exercise.notes).toBe('Go heavy');
    expect(exercise.equipmentType).toBe('barbell');

    // Set
    const set = exercise.sets[0];
    expect(set).not.toHaveProperty('id');
    expect(set).not.toHaveProperty('plannedExerciseId');
    expect(set.targetWeight).toBe(225);
    expect(set.targetWeightUnit).toBe('lbs');
    expect(set.targetReps).toBe(5);
    expect(set.tempo).toBe('3-0-1-0');
    expect(set.isDropset).toBe(false);
    expect(set.isPerSide).toBe(false);
  });

  it('exports gyms from database', async () => {
    mockedGetAllWorkoutPlans.mockResolvedValue([]);
    mockedGetCompletedSessions.mockResolvedValue([]);
    mockGetAllAsync.mockResolvedValue([
      { id: 'gym-1', name: 'Home Gym', is_default: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'gym-2', name: 'LA Fitness', is_default: 0, created_at: '2026-01-02', updated_at: '2026-01-02' },
    ]);

    await exportUnifiedJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(written.gyms).toHaveLength(2);
    expect(written.gyms[0].name).toBe('Home Gym');
    expect(written.gyms[0].isDefault).toBe(true);
    expect(written.gyms[0]).not.toHaveProperty('id');
    expect(written.gyms[1].name).toBe('LA Fitness');
    expect(written.gyms[1].isDefault).toBe(false);
  });

  it('exports settings without API key', async () => {
    mockedGetAllWorkoutPlans.mockResolvedValue([]);
    mockedGetCompletedSessions.mockResolvedValue([]);
    mockGetFirstAsync.mockResolvedValue({
      default_weight_unit: 'kg',
      enable_workout_timer: 1,
      auto_start_rest_timer: 0,
      theme: 'dark',
      keep_screen_awake: 1,
      custom_prompt_addition: 'Focus on compounds',
      anthropic_api_key: 'sk-ant-secret-key',
    });

    await exportUnifiedJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(written.settings.defaultWeightUnit).toBe('kg');
    expect(written.settings.enableWorkoutTimer).toBe(true);
    expect(written.settings.autoStartRestTimer).toBe(false);
    expect(written.settings.theme).toBe('dark');
    expect(written.settings.keepScreenAwake).toBe(true);
    expect(written.settings.customPromptAddition).toBe('Focus on compounds');
    // API key must NOT be exported
    expect(written.settings).not.toHaveProperty('anthropicApiKey');
    expect(written.settings).not.toHaveProperty('anthropic_api_key');
  });

  it('filters out exercises with no sets and no group type', async () => {
    mockedGetAllWorkoutPlans.mockResolvedValue([{
      id: 'plan-1',
      name: 'Test',
      tags: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      exercises: [
        {
          id: 'ex-1',
          workoutPlanId: 'plan-1',
          exerciseName: 'Empty Exercise',
          orderIndex: 0,
          sets: [],
        },
        {
          id: 'ex-2',
          workoutPlanId: 'plan-1',
          exerciseName: 'Superset Header',
          orderIndex: 1,
          groupType: 'superset' as const,
          sets: [],
        },
      ],
    }]);
    mockedGetCompletedSessions.mockResolvedValue([]);

    await exportUnifiedJson();

    const written = JSON.parse(mockWrite.mock.calls[0][0]);
    // Empty exercise with no group type should be filtered out
    expect(written.plans[0].exercises).toHaveLength(1);
    expect(written.plans[0].exercises[0].exerciseName).toBe('Superset Header');
  });
});
