import {
  createSessionFromTemplate,
  getWorkoutSessionById,
  getActiveSession,
  updateSession,
  updateSessionSet,
  updateSessionExercise,
  deleteSession,
  getCompletedSessions,
  getRecentSessions,
  getExerciseBestWeights,
} from '../db/sessionRepository';
import type {
  WorkoutTemplate,
  TemplateExercise,
  TemplateSet,
  WorkoutSession,
  SessionExercise,
  SessionSet,
  WorkoutSessionRow,
  SessionExerciseRow,
  SessionSetRow,
} from '@/types';

// Mock the database module
jest.mock('@/db/index', () => ({
  getDatabase: jest.fn(),
}));

// Mock the id utility
jest.mock('@/utils/id', () => ({
  generateId: jest.fn(),
}));

import { getDatabase } from '@/db/index';
import { generateId } from '@/utils/id';

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockedGenerateId = generateId as jest.MockedFunction<typeof generateId>;

// ============================================================================
// Mock Database Setup
// ============================================================================

interface MockDatabase {
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
  execAsync: jest.Mock;
}

function createMockDatabase(): MockDatabase {
  return {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

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
// Helper Factory Functions - Session Rows
// ============================================================================

function createWorkoutSessionRow(overrides: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow {
  return {
    id: 'session-1',
    workout_template_id: 'template-1',
    name: 'Test Session',
    date: '2024-01-15',
    start_time: '2024-01-15T10:00:00Z',
    end_time: null,
    duration: null,
    notes: null,
    status: 'in_progress',
    ...overrides,
  };
}

function createSessionExerciseRow(overrides: Partial<SessionExerciseRow> = {}): SessionExerciseRow {
  return {
    id: 'session-exercise-1',
    workout_session_id: 'session-1',
    exercise_name: 'Bench Press',
    order_index: 0,
    notes: null,
    equipment_type: null,
    group_type: null,
    group_name: null,
    parent_exercise_id: null,
    status: 'pending',
    ...overrides,
  };
}

function createSessionSetRow(overrides: Partial<SessionSetRow> = {}): SessionSetRow {
  return {
    id: 'session-set-1',
    session_exercise_id: 'session-exercise-1',
    order_index: 0,
    parent_set_id: null,
    drop_sequence: null,
    target_weight: 185,
    target_weight_unit: 'lbs',
    target_reps: 8,
    target_time: null,
    target_rpe: null,
    rest_seconds: null,
    actual_weight: null,
    actual_weight_unit: null,
    actual_reps: null,
    actual_time: null,
    actual_rpe: null,
    completed_at: null,
    status: 'pending',
    notes: null,
    tempo: null,
    is_dropset: 0,
    is_per_side: 0,
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
// createSessionFromTemplate Tests
// ============================================================================

describe('createSessionFromTemplate', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);

    // Setup predictable ID generation
    let idCounter = 0;
    mockedGenerateId.mockImplementation(() => `generated-id-${++idCounter}`);
  });

  it('creates session with correct structure from template', async () => {
    const set = createTemplateSet({ targetWeight: 200, targetReps: 10 });
    const exercise = createTemplateExercise({ exerciseName: 'Squat', sets: [set] });
    const template = createWorkoutTemplate({
      name: 'Leg Day',
      exercises: [exercise],
    });

    const result = await createSessionFromTemplate(template);

    expect(result.name).toBe('Leg Day');
    expect(result.workoutTemplateId).toBe('template-1');
    expect(result.status).toBe('in_progress');
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].exerciseName).toBe('Squat');
    expect(result.exercises[0].sets).toHaveLength(1);
    expect(result.exercises[0].sets[0].targetWeight).toBe(200);
    expect(result.exercises[0].sets[0].targetReps).toBe(10);
  });

  it('maps template exercise/set IDs to new session IDs', async () => {
    const set = createTemplateSet({ id: 'old-set-id' });
    const exercise = createTemplateExercise({ id: 'old-exercise-id', sets: [set] });
    const template = createWorkoutTemplate({ exercises: [exercise] });

    const result = await createSessionFromTemplate(template);

    // New IDs should be generated, not reused from template
    expect(result.id).toBe('generated-id-1'); // Session ID
    expect(result.exercises[0].id).toBe('generated-id-2'); // Exercise ID
    expect(result.exercises[0].sets[0].id).toBe('generated-id-3'); // Set ID

    // IDs should be different from template IDs
    expect(result.exercises[0].id).not.toBe('old-exercise-id');
    expect(result.exercises[0].sets[0].id).not.toBe('old-set-id');
  });

  it('correctly maps parent exercise IDs for supersets', async () => {
    const parentExercise = createTemplateExercise({
      id: 'parent-template-exercise',
      exerciseName: 'Bicep Curl',
      orderIndex: 0,
      groupType: 'superset',
      groupName: 'Arms',
      sets: [],
    });

    const childExercise = createTemplateExercise({
      id: 'child-template-exercise',
      exerciseName: 'Tricep Extension',
      orderIndex: 1,
      parentExerciseId: 'parent-template-exercise',
      groupType: 'superset',
      groupName: 'Arms',
      sets: [],
    });

    const template = createWorkoutTemplate({
      exercises: [parentExercise, childExercise],
    });

    const result = await createSessionFromTemplate(template);

    // Parent exercise should have new ID (generated-id-2)
    expect(result.exercises[0].id).toBe('generated-id-2');
    expect(result.exercises[0].parentExerciseId).toBeUndefined();

    // Child exercise should reference the NEW parent ID
    expect(result.exercises[1].id).toBe('generated-id-3');
    expect(result.exercises[1].parentExerciseId).toBe('generated-id-2');
  });

  it('uses transaction (BEGIN/COMMIT)', async () => {
    const template = createWorkoutTemplate();

    await createSessionFromTemplate(template);

    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('rolls back transaction on error', async () => {
    const template = createWorkoutTemplate();
    const error = new Error('Database error');

    mockDb.runAsync.mockRejectedValueOnce(error);

    await expect(createSessionFromTemplate(template)).rejects.toThrow('Database error');

    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockDb.execAsync).not.toHaveBeenCalledWith('COMMIT');
  });

  it('initializes all sets with pending status', async () => {
    const set1 = createTemplateSet({ orderIndex: 0 });
    const set2 = createTemplateSet({ orderIndex: 1 });
    const exercise = createTemplateExercise({ sets: [set1, set2] });
    const template = createWorkoutTemplate({ exercises: [exercise] });

    const result = await createSessionFromTemplate(template);

    expect(result.exercises[0].sets[0].status).toBe('pending');
    expect(result.exercises[0].sets[1].status).toBe('pending');
  });

  it('sets session status to in_progress', async () => {
    const template = createWorkoutTemplate();

    const result = await createSessionFromTemplate(template);

    expect(result.status).toBe('in_progress');
  });

  it('properly inserts session into database', async () => {
    const template = createWorkoutTemplate({ name: 'Chest Day' });

    await createSessionFromTemplate(template);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_sessions'),
      expect.arrayContaining([
        'generated-id-1', // session ID
        'template-1', // template ID
        'Chest Day', // name
        expect.any(String), // date
        expect.any(String), // start_time
        null, // end_time
        null, // duration
        null, // notes
        'in_progress', // status
      ])
    );
  });

  it('properly inserts exercises into database', async () => {
    const exercise = createTemplateExercise({
      exerciseName: 'Deadlift',
      notes: 'Focus on form',
      equipmentType: 'barbell',
      groupType: 'section',
      groupName: 'Main Lifts',
      sets: [],
    });
    const template = createWorkoutTemplate({ exercises: [exercise] });

    await createSessionFromTemplate(template);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO session_exercises'),
      expect.arrayContaining([
        'generated-id-2', // exercise ID
        'generated-id-1', // session ID
        'Deadlift',
        0, // orderIndex
        'Focus on form',
        'barbell',
        'section',
        'Main Lifts',
        null, // parentExerciseId
        'pending', // status
      ])
    );
  });

  it('properly inserts sets into database with all fields', async () => {
    const set = createTemplateSet({
      targetWeight: 225,
      targetWeightUnit: 'lbs',
      targetReps: 5,
      targetTime: 60,
      targetRpe: 8,
      restSeconds: 120,
      tempo: '3-0-1-0',
      isDropset: true,
      isPerSide: true,
    });
    const exercise = createTemplateExercise({ sets: [set] });
    const template = createWorkoutTemplate({ exercises: [exercise] });

    await createSessionFromTemplate(template);

    // Note: isPerSide is not currently copied from template to session in the implementation
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO session_sets'),
      [
        'generated-id-3', // set ID
        'generated-id-2', // exercise ID
        0, // orderIndex
        null, // parentSetId
        null, // dropSequence
        225, // targetWeight
        'lbs', // targetWeightUnit
        5, // targetReps
        60, // targetTime
        8, // targetRpe
        120, // restSeconds
        null, // actualWeight
        null, // actualWeightUnit
        null, // actualReps
        null, // actualTime
        null, // actualRpe
        null, // completedAt
        'pending', // status
        null, // notes
        '3-0-1-0', // tempo
        1, // isDropset (boolean -> 1)
        0, // isPerSide (not copied from template, defaults to false -> 0)
      ]
    );
  });

  it('handles multiple exercises with multiple sets', async () => {
    const set1 = createTemplateSet({ orderIndex: 0 });
    const set2 = createTemplateSet({ orderIndex: 1 });
    const exercise1 = createTemplateExercise({ exerciseName: 'Squat', sets: [set1, set2] });

    const set3 = createTemplateSet({ orderIndex: 0 });
    const exercise2 = createTemplateExercise({
      id: 'template-exercise-2',
      exerciseName: 'Leg Press',
      orderIndex: 1,
      sets: [set3],
    });

    const template = createWorkoutTemplate({ exercises: [exercise1, exercise2] });

    const result = await createSessionFromTemplate(template);

    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[0].sets).toHaveLength(2);
    expect(result.exercises[1].sets).toHaveLength(1);

    // Count runAsync calls: 1 session + 2 exercises + 3 sets + 1 sync_metadata = 7
    expect(mockDb.runAsync).toHaveBeenCalledTimes(7);
  });
});

// ============================================================================
// getWorkoutSessionById Tests
// ============================================================================

describe('getWorkoutSessionById', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('returns null when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const result = await getWorkoutSessionById('non-existent-id');

    expect(result).toBeNull();
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM workout_sessions WHERE id = ?',
      ['non-existent-id']
    );
  });

  it('returns session with exercises and sets', async () => {
    const sessionRow = createWorkoutSessionRow();
    const exerciseRow = createSessionExerciseRow();
    const setRow = createSessionSetRow();

    mockDb.getFirstAsync.mockResolvedValue(sessionRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow]) // exercises
      .mockResolvedValueOnce([setRow]); // sets

    const result = await getWorkoutSessionById('session-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('session-1');
    expect(result!.exercises).toHaveLength(1);
    expect(result!.exercises[0].id).toBe('session-exercise-1');
    expect(result!.exercises[0].sets).toHaveLength(1);
    expect(result!.exercises[0].sets[0].id).toBe('session-set-1');
  });

  it('proper type conversion for all fields', async () => {
    const sessionRow = createWorkoutSessionRow({
      workout_template_id: 'template-1',
      name: 'Full Workout',
      date: '2024-01-15',
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z',
      duration: 3600,
      notes: 'Great workout',
      status: 'completed',
    });

    const exerciseRow = createSessionExerciseRow({
      notes: 'Exercise notes',
      equipment_type: 'barbell',
      group_type: 'superset',
      group_name: 'Arms',
      parent_exercise_id: 'parent-id',
      status: 'completed',
    });

    const setRow = createSessionSetRow({
      target_weight: 200,
      target_weight_unit: 'lbs',
      target_reps: 10,
      target_time: 45,
      target_rpe: 8,
      rest_seconds: 90,
      actual_weight: 205,
      actual_weight_unit: 'lbs',
      actual_reps: 9,
      actual_time: 50,
      actual_rpe: 9,
      completed_at: '2024-01-15T10:30:00Z',
      status: 'completed',
      notes: 'Set notes',
      tempo: '3-0-1-0',
      is_dropset: 1,
      is_per_side: 1,
      parent_set_id: 'parent-set',
      drop_sequence: 1,
    });

    mockDb.getFirstAsync.mockResolvedValue(sessionRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getWorkoutSessionById('session-1');

    // Session fields
    expect(result!.workoutTemplateId).toBe('template-1');
    expect(result!.name).toBe('Full Workout');
    expect(result!.date).toBe('2024-01-15');
    expect(result!.startTime).toBe('2024-01-15T10:00:00Z');
    expect(result!.endTime).toBe('2024-01-15T11:00:00Z');
    expect(result!.duration).toBe(3600);
    expect(result!.notes).toBe('Great workout');
    expect(result!.status).toBe('completed');

    // Exercise fields
    const exercise = result!.exercises[0];
    expect(exercise.notes).toBe('Exercise notes');
    expect(exercise.equipmentType).toBe('barbell');
    expect(exercise.groupType).toBe('superset');
    expect(exercise.groupName).toBe('Arms');
    expect(exercise.parentExerciseId).toBe('parent-id');
    expect(exercise.status).toBe('completed');

    // Set fields
    const set = exercise.sets[0];
    expect(set.targetWeight).toBe(200);
    expect(set.targetWeightUnit).toBe('lbs');
    expect(set.targetReps).toBe(10);
    expect(set.targetTime).toBe(45);
    expect(set.targetRpe).toBe(8);
    expect(set.restSeconds).toBe(90);
    expect(set.actualWeight).toBe(205);
    expect(set.actualWeightUnit).toBe('lbs');
    expect(set.actualReps).toBe(9);
    expect(set.actualTime).toBe(50);
    expect(set.actualRpe).toBe(9);
    expect(set.completedAt).toBe('2024-01-15T10:30:00Z');
    expect(set.status).toBe('completed');
    expect(set.notes).toBe('Set notes');
    expect(set.tempo).toBe('3-0-1-0');
    expect(set.isDropset).toBe(true);
    expect(set.isPerSide).toBe(true);
    expect(set.parentSetId).toBe('parent-set');
    expect(set.dropSequence).toBe(1);
  });

  it('converts null values to undefined', async () => {
    const sessionRow = createWorkoutSessionRow({
      workout_template_id: null,
      start_time: null,
      end_time: null,
      duration: null,
      notes: null,
    });

    const exerciseRow = createSessionExerciseRow({
      notes: null,
      equipment_type: null,
      group_type: null,
      group_name: null,
      parent_exercise_id: null,
    });

    const setRow = createSessionSetRow({
      target_weight: null,
      target_weight_unit: null,
      target_reps: null,
      target_time: null,
      target_rpe: null,
      rest_seconds: null,
      actual_weight: null,
      actual_weight_unit: null,
      actual_reps: null,
      actual_time: null,
      actual_rpe: null,
      completed_at: null,
      notes: null,
      tempo: null,
      parent_set_id: null,
      drop_sequence: null,
    });

    mockDb.getFirstAsync.mockResolvedValue(sessionRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getWorkoutSessionById('session-1');

    expect(result!.workoutTemplateId).toBeUndefined();
    expect(result!.startTime).toBeUndefined();
    expect(result!.endTime).toBeUndefined();
    expect(result!.duration).toBeUndefined();
    expect(result!.notes).toBeUndefined();

    const exercise = result!.exercises[0];
    expect(exercise.notes).toBeUndefined();
    expect(exercise.equipmentType).toBeUndefined();
    expect(exercise.groupType).toBeUndefined();
    expect(exercise.groupName).toBeUndefined();
    expect(exercise.parentExerciseId).toBeUndefined();

    const set = exercise.sets[0];
    expect(set.targetWeight).toBeUndefined();
    expect(set.targetWeightUnit).toBeUndefined();
    expect(set.targetReps).toBeUndefined();
    expect(set.targetTime).toBeUndefined();
    expect(set.targetRpe).toBeUndefined();
    expect(set.restSeconds).toBeUndefined();
    expect(set.actualWeight).toBeUndefined();
    expect(set.actualWeightUnit).toBeUndefined();
    expect(set.actualReps).toBeUndefined();
    expect(set.actualTime).toBeUndefined();
    expect(set.actualRpe).toBeUndefined();
    expect(set.completedAt).toBeUndefined();
    expect(set.notes).toBeUndefined();
    expect(set.tempo).toBeUndefined();
    expect(set.parentSetId).toBeUndefined();
    expect(set.dropSequence).toBeUndefined();
  });
});

// ============================================================================
// getActiveSession Tests
// ============================================================================

describe('getActiveSession', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('returns null when no active session', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const result = await getActiveSession();

    expect(result).toBeNull();
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      "SELECT * FROM workout_sessions WHERE status = 'in_progress' ORDER BY start_time DESC LIMIT 1"
    );
  });

  it('returns the in_progress session', async () => {
    const sessionRow = createWorkoutSessionRow({ status: 'in_progress' });
    const exerciseRow = createSessionExerciseRow();
    const setRow = createSessionSetRow();

    mockDb.getFirstAsync.mockResolvedValue(sessionRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getActiveSession();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('in_progress');
    expect(result!.id).toBe('session-1');
  });

  it('returns session with exercises and sets populated', async () => {
    const sessionRow = createWorkoutSessionRow();
    const exerciseRow1 = createSessionExerciseRow({ id: 'ex-1' });
    const exerciseRow2 = createSessionExerciseRow({ id: 'ex-2', order_index: 1 });
    const setRow1 = createSessionSetRow({ id: 'set-1', session_exercise_id: 'ex-1' });
    const setRow2 = createSessionSetRow({ id: 'set-2', session_exercise_id: 'ex-2' });

    mockDb.getFirstAsync.mockResolvedValue(sessionRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow1, exerciseRow2])
      .mockResolvedValueOnce([setRow1])
      .mockResolvedValueOnce([setRow2]);

    const result = await getActiveSession();

    expect(result!.exercises).toHaveLength(2);
    expect(result!.exercises[0].sets).toHaveLength(1);
    expect(result!.exercises[1].sets).toHaveLength(1);
  });
});

// ============================================================================
// updateSession Tests
// ============================================================================

describe('updateSession', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('updates all session fields correctly', async () => {
    const session = createWorkoutSession({
      id: 'session-123',
      name: 'Updated Workout',
      date: '2024-01-20',
      startTime: '2024-01-20T09:00:00Z',
      endTime: '2024-01-20T10:30:00Z',
      duration: 5400,
      notes: 'Great session!',
      status: 'completed',
    });

    await updateSession(session);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workout_sessions'),
      [
        'Updated Workout', // name
        '2024-01-20', // date
        '2024-01-20T09:00:00Z', // startTime
        '2024-01-20T10:30:00Z', // endTime
        5400, // duration
        'Great session!', // notes
        'completed', // status
        'session-123', // id (WHERE clause)
      ]
    );
  });

  it('handles null optional fields', async () => {
    const session = createWorkoutSession({
      id: 'session-123',
      startTime: undefined,
      endTime: undefined,
      duration: undefined,
      notes: undefined,
    });

    await updateSession(session);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workout_sessions'),
      expect.arrayContaining([
        null, // startTime (undefined -> null)
        null, // endTime (undefined -> null)
        null, // duration (undefined -> null)
        null, // notes (undefined -> null)
      ])
    );
  });
});

// ============================================================================
// updateSessionSet Tests
// ============================================================================

describe('updateSessionSet', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('updates actual values and status', async () => {
    const set = createSessionSet({
      id: 'set-123',
      actualWeight: 210,
      actualWeightUnit: 'lbs',
      actualReps: 8,
      actualTime: 45,
      actualRpe: 9,
      completedAt: '2024-01-20T10:00:00Z',
      status: 'completed',
      notes: 'Felt strong',
    });

    await updateSessionSet(set);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE session_sets'),
      [
        210, // actualWeight
        'lbs', // actualWeightUnit
        8, // actualReps
        45, // actualTime
        9, // actualRpe
        '2024-01-20T10:00:00Z', // completedAt
        'completed', // status
        'Felt strong', // notes
        'set-123', // id (WHERE clause)
      ]
    );
  });

  it('handles null actual values', async () => {
    const set = createSessionSet({
      id: 'set-123',
      actualWeight: undefined,
      actualWeightUnit: undefined,
      actualReps: undefined,
      actualTime: undefined,
      actualRpe: undefined,
      completedAt: undefined,
      status: 'pending',
      notes: undefined,
    });

    await updateSessionSet(set);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE session_sets'),
      [
        null, // actualWeight
        null, // actualWeightUnit
        null, // actualReps
        null, // actualTime
        null, // actualRpe
        null, // completedAt
        'pending', // status
        null, // notes
        'set-123', // id
      ]
    );
  });
});

// ============================================================================
// updateSessionExercise Tests
// ============================================================================

describe('updateSessionExercise', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('updates exercise status', async () => {
    const exercise = createSessionExercise({
      id: 'exercise-123',
      status: 'completed',
      notes: 'All sets done',
    });

    await updateSessionExercise(exercise);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE session_exercises'),
      ['completed', 'All sets done', 'exercise-123']
    );
  });

  it('handles various status values', async () => {
    const statuses: SessionExercise['status'][] = ['pending', 'in_progress', 'completed', 'skipped'];

    for (const status of statuses) {
      jest.clearAllMocks();
      const exercise = createSessionExercise({ id: 'ex-1', status });

      await updateSessionExercise(exercise);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        [status, null, 'ex-1']
      );
    }
  });

  it('handles null notes', async () => {
    const exercise = createSessionExercise({
      id: 'exercise-123',
      status: 'pending',
      notes: undefined,
    });

    await updateSessionExercise(exercise);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE session_exercises'),
      ['pending', null, 'exercise-123']
    );
  });
});

// ============================================================================
// deleteSession Tests
// ============================================================================

describe('deleteSession', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('deletes with correct ID', async () => {
    await deleteSession('session-to-delete');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM workout_sessions WHERE id = ?',
      ['session-to-delete']
    );
  });

  it('handles different ID formats', async () => {
    await deleteSession('uuid-123-456-789-abc');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM workout_sessions WHERE id = ?',
      ['uuid-123-456-789-abc']
    );
  });
});

// ============================================================================
// getCompletedSessions Tests
// ============================================================================

describe('getCompletedSessions', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('returns completed sessions ordered by date', async () => {
    const sessionRow1 = createWorkoutSessionRow({
      id: 'session-1',
      date: '2024-01-20',
      status: 'completed',
    });
    const sessionRow2 = createWorkoutSessionRow({
      id: 'session-2',
      date: '2024-01-19',
      status: 'completed',
    });

    mockDb.getAllAsync
      .mockResolvedValueOnce([sessionRow1, sessionRow2]) // sessions
      .mockResolvedValueOnce([]) // exercises for session-1
      .mockResolvedValueOnce([]); // exercises for session-2

    const result = await getCompletedSessions();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('session-1');
    expect(result[1].id).toBe('session-2');

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      "SELECT * FROM workout_sessions WHERE status = 'completed' ORDER BY date DESC, start_time DESC"
    );
  });

  it('returns empty array when no sessions', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await getCompletedSessions();

    expect(result).toEqual([]);
  });

  it('returns sessions with exercises and sets', async () => {
    const sessionRow = createWorkoutSessionRow({ status: 'completed' });
    const exerciseRow = createSessionExerciseRow();
    const setRow = createSessionSetRow();

    mockDb.getAllAsync
      .mockResolvedValueOnce([sessionRow])
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getCompletedSessions();

    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(1);
    expect(result[0].exercises[0].sets).toHaveLength(1);
  });
});

// ============================================================================
// getRecentSessions Tests
// ============================================================================

describe('getRecentSessions', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('respects limit parameter', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    await getRecentSessions(10);

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      "SELECT * FROM workout_sessions WHERE status = 'completed' ORDER BY date DESC, start_time DESC LIMIT ?",
      [10]
    );
  });

  it('default limit is 5', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    await getRecentSessions();

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      "SELECT * FROM workout_sessions WHERE status = 'completed' ORDER BY date DESC, start_time DESC LIMIT ?",
      [5]
    );
  });

  it('returns limited sessions with exercises', async () => {
    const sessionRow1 = createWorkoutSessionRow({ id: 'session-1', status: 'completed' });
    const sessionRow2 = createWorkoutSessionRow({ id: 'session-2', status: 'completed' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([sessionRow1, sessionRow2])
      .mockResolvedValueOnce([]) // exercises for session-1
      .mockResolvedValueOnce([]); // exercises for session-2

    const result = await getRecentSessions(2);

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no sessions', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await getRecentSessions(5);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// getExerciseBestWeights Tests
// ============================================================================

describe('getExerciseBestWeights', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('returns map of exercise name to best weight', async () => {
    const rows = [
      { exercise_name: 'Bench Press', max_weight: 225, reps: 5, unit: 'lbs' },
      { exercise_name: 'Squat', max_weight: 315, reps: 3, unit: 'lbs' },
      { exercise_name: 'Deadlift', max_weight: 405, reps: 1, unit: 'lbs' },
    ];

    mockDb.getAllAsync.mockResolvedValueOnce(rows);

    const result = await getExerciseBestWeights();

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);

    expect(result.get('Bench Press')).toEqual({ weight: 225, reps: 5, unit: 'lbs' });
    expect(result.get('Squat')).toEqual({ weight: 315, reps: 3, unit: 'lbs' });
    expect(result.get('Deadlift')).toEqual({ weight: 405, reps: 1, unit: 'lbs' });
  });

  it('only includes completed sets with actual weight', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    await getExerciseBestWeights();

    // Verify the query filters for completed sessions/sets with actual_weight > 0
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE ws.status = 'completed'")
    );
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("AND ss.status = 'completed'")
    );
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('AND ss.actual_weight IS NOT NULL')
    );
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('AND ss.actual_weight > 0')
    );
  });

  it('returns empty map when no completed sets', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await getExerciseBestWeights();

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('handles null reps by defaulting to 0', async () => {
    const rows = [
      { exercise_name: 'Plank', max_weight: 45, reps: null, unit: 'lbs' },
    ];

    mockDb.getAllAsync.mockResolvedValueOnce(rows);

    const result = await getExerciseBestWeights();

    expect(result.get('Plank')).toEqual({ weight: 45, reps: 0, unit: 'lbs' });
  });

  it('uses proper unit fallback (actual -> target -> lbs)', async () => {
    // The query uses COALESCE for unit fallback
    const rows = [
      { exercise_name: 'Bench Press', max_weight: 100, reps: 10, unit: 'kg' },
    ];

    mockDb.getAllAsync.mockResolvedValueOnce(rows);

    const result = await getExerciseBestWeights();

    expect(result.get('Bench Press')?.unit).toBe('kg');
  });
});

// ============================================================================
// Row-to-Object Conversion Tests
// ============================================================================

describe('Row-to-Object conversion', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  describe('boolean conversion (is_dropset, is_per_side)', () => {
    it('converts 1 to true', async () => {
      const sessionRow = createWorkoutSessionRow();
      const exerciseRow = createSessionExerciseRow();
      const setRow = createSessionSetRow({ is_dropset: 1, is_per_side: 1 });

      mockDb.getFirstAsync.mockResolvedValue(sessionRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutSessionById('session-1');

      expect(result!.exercises[0].sets[0].isDropset).toBe(true);
      expect(result!.exercises[0].sets[0].isPerSide).toBe(true);
    });

    it('converts 0 to false', async () => {
      const sessionRow = createWorkoutSessionRow();
      const exerciseRow = createSessionExerciseRow();
      const setRow = createSessionSetRow({ is_dropset: 0, is_per_side: 0 });

      mockDb.getFirstAsync.mockResolvedValue(sessionRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutSessionById('session-1');

      expect(result!.exercises[0].sets[0].isDropset).toBe(false);
      expect(result!.exercises[0].sets[0].isPerSide).toBe(false);
    });
  });

  describe('status type casting', () => {
    it('casts session status correctly', async () => {
      const statuses: WorkoutSession['status'][] = ['in_progress', 'completed', 'canceled'];

      for (const status of statuses) {
        jest.clearAllMocks();
        const sessionRow = createWorkoutSessionRow({ status });

        mockDb.getFirstAsync.mockResolvedValue(sessionRow);
        mockDb.getAllAsync.mockResolvedValueOnce([]);

        const result = await getWorkoutSessionById('session-1');
        expect(result!.status).toBe(status);
      }
    });

    it('casts exercise status correctly', async () => {
      const statuses: SessionExercise['status'][] = ['pending', 'in_progress', 'completed', 'skipped'];

      for (const status of statuses) {
        jest.clearAllMocks();
        const sessionRow = createWorkoutSessionRow();
        const exerciseRow = createSessionExerciseRow({ status });

        mockDb.getFirstAsync.mockResolvedValue(sessionRow);
        mockDb.getAllAsync
          .mockResolvedValueOnce([exerciseRow])
          .mockResolvedValueOnce([]);

        const result = await getWorkoutSessionById('session-1');
        expect(result!.exercises[0].status).toBe(status);
      }
    });

    it('casts set status correctly', async () => {
      const statuses: SessionSet['status'][] = ['pending', 'completed', 'skipped', 'failed'];

      for (const status of statuses) {
        jest.clearAllMocks();
        const sessionRow = createWorkoutSessionRow();
        const exerciseRow = createSessionExerciseRow();
        const setRow = createSessionSetRow({ status });

        mockDb.getFirstAsync.mockResolvedValue(sessionRow);
        mockDb.getAllAsync
          .mockResolvedValueOnce([exerciseRow])
          .mockResolvedValueOnce([setRow]);

        const result = await getWorkoutSessionById('session-1');
        expect(result!.exercises[0].sets[0].status).toBe(status);
      }
    });
  });

  describe('weight unit type casting', () => {
    it('casts target_weight_unit to proper type', async () => {
      const sessionRow = createWorkoutSessionRow();
      const exerciseRow = createSessionExerciseRow();
      const setRow = createSessionSetRow({ target_weight_unit: 'kg' });

      mockDb.getFirstAsync.mockResolvedValue(sessionRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutSessionById('session-1');

      expect(result!.exercises[0].sets[0].targetWeightUnit).toBe('kg');
    });

    it('casts actual_weight_unit to proper type', async () => {
      const sessionRow = createWorkoutSessionRow();
      const exerciseRow = createSessionExerciseRow();
      const setRow = createSessionSetRow({ actual_weight_unit: 'lbs' });

      mockDb.getFirstAsync.mockResolvedValue(sessionRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutSessionById('session-1');

      expect(result!.exercises[0].sets[0].actualWeightUnit).toBe('lbs');
    });
  });

  describe('group_type casting', () => {
    it('casts superset group_type correctly', async () => {
      const sessionRow = createWorkoutSessionRow();
      const exerciseRow = createSessionExerciseRow({ group_type: 'superset' });

      mockDb.getFirstAsync.mockResolvedValue(sessionRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([]);

      const result = await getWorkoutSessionById('session-1');

      expect(result!.exercises[0].groupType).toBe('superset');
    });

    it('casts section group_type correctly', async () => {
      const sessionRow = createWorkoutSessionRow();
      const exerciseRow = createSessionExerciseRow({ group_type: 'section' });

      mockDb.getFirstAsync.mockResolvedValue(sessionRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([]);

      const result = await getWorkoutSessionById('session-1');

      expect(result!.exercises[0].groupType).toBe('section');
    });
  });
});
