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

import { exportSessionsAsJson, exportSingleSessionAsJson, buildSessionFileName, ExportError } from '../services/workoutExportService';
import { getCompletedSessions } from '@/db/sessionRepository';

const mockedGetCompletedSessions = getCompletedSessions as jest.MockedFunction<typeof getCompletedSessions>;

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
