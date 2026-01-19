import {
  getAllWorkoutTemplates,
  getWorkoutTemplateById,
  createWorkoutTemplate as createWorkoutTemplateInDb,
  updateWorkoutTemplate as updateWorkoutTemplateInDb,
  deleteWorkoutTemplate,
  searchWorkoutTemplates,
  getWorkoutTemplatesByTag,
} from '../db/repository';
import type {
  WorkoutTemplate,
  TemplateExercise,
  TemplateSet,
  WorkoutTemplateRow,
  TemplateExerciseRow,
  TemplateSetRow,
} from '@/types';

// Mock the database module
jest.mock('@/db/index', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/db/index';

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

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
// Helper Factory Functions
// ============================================================================

function createWorkoutTemplateRow(overrides: Partial<WorkoutTemplateRow> = {}): WorkoutTemplateRow {
  return {
    id: 'template-1',
    name: 'Test Workout',
    description: null,
    tags: '["strength"]',
    default_weight_unit: 'lbs',
    source_markdown: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

function createTemplateExerciseRow(overrides: Partial<TemplateExerciseRow> = {}): TemplateExerciseRow {
  return {
    id: 'exercise-1',
    workout_template_id: 'template-1',
    exercise_name: 'Bench Press',
    order_index: 0,
    notes: null,
    equipment_type: null,
    group_type: null,
    group_name: null,
    parent_exercise_id: null,
    ...overrides,
  };
}

function createTemplateSetRow(overrides: Partial<TemplateSetRow> = {}): TemplateSetRow {
  return {
    id: 'set-1',
    template_exercise_id: 'exercise-1',
    order_index: 0,
    target_weight: 185,
    target_weight_unit: 'lbs',
    target_reps: 8,
    target_time: null,
    target_rpe: null,
    rest_seconds: null,
    tempo: null,
    is_dropset: 0,
    is_per_side: 0,
    is_amrap: 0,
    notes: null,
    ...overrides,
  };
}

function createTemplateSet(overrides: Partial<TemplateSet> = {}): TemplateSet {
  return {
    id: 'set-1',
    templateExerciseId: 'exercise-1',
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
    id: 'exercise-1',
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
// getAllWorkoutTemplates Tests
// ============================================================================

describe('getAllWorkoutTemplates', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('returns empty array when no templates exist', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await getAllWorkoutTemplates();

    expect(result).toEqual([]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM workout_templates ORDER BY created_at DESC'
    );
  });

  it('returns templates with their exercises and sets', async () => {
    const templateRow = createWorkoutTemplateRow();
    const exerciseRow = createTemplateExerciseRow();
    const setRow = createTemplateSetRow();

    // First call: get templates
    // Subsequent calls: get exercises for template, then sets for exercise
    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow]) // templates
      .mockResolvedValueOnce([exerciseRow]) // exercises for template-1
      .mockResolvedValueOnce([setRow]); // sets for exercise-1

    const result = await getAllWorkoutTemplates();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('template-1');
    expect(result[0].name).toBe('Test Workout');
    expect(result[0].exercises).toHaveLength(1);
    expect(result[0].exercises[0].id).toBe('exercise-1');
    expect(result[0].exercises[0].sets).toHaveLength(1);
    expect(result[0].exercises[0].sets[0].id).toBe('set-1');
  });

  it('exercises are ordered by order_index', async () => {
    const templateRow = createWorkoutTemplateRow();
    const exerciseRow1 = createTemplateExerciseRow({ id: 'exercise-1', order_index: 0 });
    const exerciseRow2 = createTemplateExerciseRow({ id: 'exercise-2', order_index: 1, exercise_name: 'Squat' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([exerciseRow1, exerciseRow2])
      .mockResolvedValueOnce([]) // sets for exercise-1
      .mockResolvedValueOnce([]); // sets for exercise-2

    const result = await getAllWorkoutTemplates();

    // Verify exercises query includes ORDER BY order_index
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM template_exercises WHERE workout_template_id = ? ORDER BY order_index',
      ['template-1']
    );
    expect(result[0].exercises[0].id).toBe('exercise-1');
    expect(result[0].exercises[1].id).toBe('exercise-2');
  });

  it('converts database rows to proper types with tags JSON parsing', async () => {
    const templateRow = createWorkoutTemplateRow({
      tags: '["push", "upper body", "strength"]',
      description: 'A test workout',
      default_weight_unit: 'kg',
      source_markdown: '# Test Workout',
    });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([]);

    const result = await getAllWorkoutTemplates();

    expect(result[0].tags).toEqual(['push', 'upper body', 'strength']);
    expect(result[0].description).toBe('A test workout');
    expect(result[0].defaultWeightUnit).toBe('kg');
    expect(result[0].sourceMarkdown).toBe('# Test Workout');
  });

  it('handles null values correctly by converting to undefined', async () => {
    const templateRow = createWorkoutTemplateRow({
      description: null,
      default_weight_unit: null,
      source_markdown: null,
      tags: '', // empty tags
    });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([]);

    const result = await getAllWorkoutTemplates();

    expect(result[0].description).toBeUndefined();
    expect(result[0].defaultWeightUnit).toBeUndefined();
    expect(result[0].sourceMarkdown).toBeUndefined();
    expect(result[0].tags).toEqual([]);
  });

  it('returns multiple templates with all their data', async () => {
    const templateRow1 = createWorkoutTemplateRow({ id: 'template-1', name: 'Push Day' });
    const templateRow2 = createWorkoutTemplateRow({ id: 'template-2', name: 'Pull Day' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow1, templateRow2])
      .mockResolvedValueOnce([]) // exercises for template-1
      .mockResolvedValueOnce([]); // exercises for template-2

    const result = await getAllWorkoutTemplates();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Push Day');
    expect(result[1].name).toBe('Pull Day');
  });
});

// ============================================================================
// getWorkoutTemplateById Tests
// ============================================================================

describe('getWorkoutTemplateById', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('returns null when template not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const result = await getWorkoutTemplateById('non-existent-id');

    expect(result).toBeNull();
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM workout_templates WHERE id = ?',
      ['non-existent-id']
    );
  });

  it('returns complete template with exercises and sets', async () => {
    const templateRow = createWorkoutTemplateRow();
    const exerciseRow = createTemplateExerciseRow();
    const setRow = createTemplateSetRow();

    mockDb.getFirstAsync.mockResolvedValue(templateRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getWorkoutTemplateById('template-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('template-1');
    expect(result!.exercises).toHaveLength(1);
    expect(result!.exercises[0].sets).toHaveLength(1);
  });

  it('proper type conversion for all fields', async () => {
    const templateRow = createWorkoutTemplateRow({
      tags: '["strength", "legs"]',
      description: 'Leg workout',
      default_weight_unit: 'kg',
    });
    const exerciseRow = createTemplateExerciseRow({
      notes: 'Focus on form',
      equipment_type: 'barbell',
      group_type: 'superset',
      group_name: 'Leg Complex',
      parent_exercise_id: 'parent-1',
    });
    const setRow = createTemplateSetRow({
      target_weight: 225,
      target_weight_unit: 'lbs',
      target_reps: 5,
      target_time: 60,
      target_rpe: 8,
      rest_seconds: 120,
      tempo: '3-0-1-0',
      is_dropset: 1,
      is_per_side: 1,
    });

    mockDb.getFirstAsync.mockResolvedValue(templateRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getWorkoutTemplateById('template-1');

    expect(result!.tags).toEqual(['strength', 'legs']);
    expect(result!.defaultWeightUnit).toBe('kg');

    const exercise = result!.exercises[0];
    expect(exercise.notes).toBe('Focus on form');
    expect(exercise.equipmentType).toBe('barbell');
    expect(exercise.groupType).toBe('superset');
    expect(exercise.groupName).toBe('Leg Complex');
    expect(exercise.parentExerciseId).toBe('parent-1');

    const set = exercise.sets[0];
    expect(set.targetWeight).toBe(225);
    expect(set.targetWeightUnit).toBe('lbs');
    expect(set.targetReps).toBe(5);
    expect(set.targetTime).toBe(60);
    expect(set.targetRpe).toBe(8);
    expect(set.restSeconds).toBe(120);
    expect(set.tempo).toBe('3-0-1-0');
    expect(set.isDropset).toBe(true);
    expect(set.isPerSide).toBe(true);
  });

  it('handles null optional fields correctly', async () => {
    const templateRow = createWorkoutTemplateRow();
    const exerciseRow = createTemplateExerciseRow({
      notes: null,
      equipment_type: null,
      group_type: null,
      group_name: null,
      parent_exercise_id: null,
    });
    const setRow = createTemplateSetRow({
      target_weight: null,
      target_weight_unit: null,
      target_reps: null,
      target_time: null,
      target_rpe: null,
      rest_seconds: null,
      tempo: null,
      is_dropset: 0,
      is_per_side: 0,
    });

    mockDb.getFirstAsync.mockResolvedValue(templateRow);
    mockDb.getAllAsync
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getWorkoutTemplateById('template-1');

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
    expect(set.tempo).toBeUndefined();
    expect(set.isDropset).toBe(false);
    expect(set.isPerSide).toBe(false);
  });
});

// ============================================================================
// createWorkoutTemplate Tests
// ============================================================================

describe('createWorkoutTemplate', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('inserts template, exercises, and sets', async () => {
    const set = createTemplateSet();
    const exercise = createTemplateExercise({ sets: [set] });
    const template = createWorkoutTemplate({ exercises: [exercise] });

    await createWorkoutTemplateInDb(template);

    // Should call runAsync for template insert
    // Note: undefined values are converted to null by the repository
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_templates'),
      [
        template.id,
        template.name,
        null, // description (undefined -> null)
        '["strength"]', // tags JSON
        null, // defaultWeightUnit (undefined -> null)
        null, // sourceMarkdown (undefined -> null)
        template.createdAt,
        template.updatedAt,
      ]
    );

    // Should call runAsync for exercise insert
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO template_exercises'),
      [
        exercise.id,
        exercise.workoutTemplateId,
        exercise.exerciseName,
        exercise.orderIndex,
        null, // notes
        null, // equipmentType
        null, // groupType
        null, // groupName
        null, // parentExerciseId
      ]
    );

    // Should call runAsync for set insert
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO template_sets'),
      [
        set.id,
        set.templateExerciseId,
        set.orderIndex,
        set.targetWeight,
        set.targetWeightUnit,
        set.targetReps,
        null, // targetTime
        null, // targetRpe
        null, // restSeconds
        null, // tempo
        0, // isDropset as 0/1
        0, // isPerSide as 0/1
      ]
    );
  });

  it('uses transaction (BEGIN/COMMIT)', async () => {
    const template = createWorkoutTemplate();

    await createWorkoutTemplateInDb(template);

    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('rolls back on error', async () => {
    const template = createWorkoutTemplate();
    const error = new Error('Database error');

    mockDb.runAsync.mockRejectedValueOnce(error);

    await expect(createWorkoutTemplateInDb(template)).rejects.toThrow('Database error');

    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockDb.execAsync).not.toHaveBeenCalledWith('COMMIT');
  });

  it('proper parameter mapping for all fields', async () => {
    const set = createTemplateSet({
      targetWeight: 225,
      targetWeightUnit: 'kg',
      targetReps: 10,
      targetTime: 45,
      targetRpe: 9,
      restSeconds: 90,
      tempo: '2-0-2-0',
      isDropset: true,
      isPerSide: true,
    });
    const exercise = createTemplateExercise({
      notes: 'Exercise notes',
      equipmentType: 'dumbbell',
      groupType: 'section',
      groupName: 'Main Work',
      parentExerciseId: 'parent-id',
      sets: [set],
    });
    const template = createWorkoutTemplate({
      description: 'Full workout',
      defaultWeightUnit: 'kg',
      sourceMarkdown: '# Workout',
      tags: ['push', 'chest'],
      exercises: [exercise],
    });

    await createWorkoutTemplateInDb(template);

    // Verify template parameters
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_templates'),
      expect.arrayContaining([
        template.id,
        template.name,
        'Full workout',
        '["push","chest"]',
        'kg',
        '# Workout',
      ])
    );

    // Verify exercise parameters
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO template_exercises'),
      [
        exercise.id,
        exercise.workoutTemplateId,
        exercise.exerciseName,
        exercise.orderIndex,
        'Exercise notes',
        'dumbbell',
        'section',
        'Main Work',
        'parent-id',
      ]
    );

    // Verify set parameters with boolean conversion
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO template_sets'),
      [
        set.id,
        set.templateExerciseId,
        set.orderIndex,
        225,
        'kg',
        10,
        45,
        9,
        90,
        '2-0-2-0',
        1, // isDropset = true -> 1
        1, // isPerSide = true -> 1
      ]
    );
  });

  it('handles multiple exercises with multiple sets', async () => {
    const set1 = createTemplateSet({ id: 'set-1' });
    const set2 = createTemplateSet({ id: 'set-2', orderIndex: 1 });
    const exercise1 = createTemplateExercise({ id: 'exercise-1', sets: [set1, set2] });
    const set3 = createTemplateSet({ id: 'set-3', templateExerciseId: 'exercise-2' });
    const exercise2 = createTemplateExercise({
      id: 'exercise-2',
      orderIndex: 1,
      exerciseName: 'Squat',
      sets: [set3],
    });
    const template = createWorkoutTemplate({ exercises: [exercise1, exercise2] });

    await createWorkoutTemplateInDb(template);

    // Count runAsync calls: 1 template + 2 exercises + 3 sets + 1 sync_metadata = 7
    expect(mockDb.runAsync).toHaveBeenCalledTimes(7);
  });
});

// ============================================================================
// updateWorkoutTemplate Tests
// ============================================================================

describe('updateWorkoutTemplate', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('updates template fields', async () => {
    const template = createWorkoutTemplate({
      name: 'Updated Workout',
      description: 'Updated description',
      tags: ['updated', 'tags'],
      defaultWeightUnit: 'kg',
      sourceMarkdown: '# Updated',
    });

    await updateWorkoutTemplateInDb(template);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workout_templates'),
      [
        'Updated Workout',
        'Updated description',
        '["updated","tags"]',
        'kg',
        '# Updated',
        template.updatedAt,
        template.id,
      ]
    );
  });

  it('deletes old exercises before inserting new', async () => {
    const exercise = createTemplateExercise();
    const template = createWorkoutTemplate({ exercises: [exercise] });

    await updateWorkoutTemplateInDb(template);

    // Check delete was called before inserts
    const runAsyncCalls = mockDb.runAsync.mock.calls;

    // Find the delete call
    const deleteCallIndex = runAsyncCalls.findIndex(
      (call) => typeof call[0] === 'string' && call[0].includes('DELETE FROM template_exercises')
    );

    // Find the insert exercise call
    const insertCallIndex = runAsyncCalls.findIndex(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO template_exercises')
    );

    expect(deleteCallIndex).toBeLessThan(insertCallIndex);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM template_exercises WHERE workout_template_id = ?',
      [template.id]
    );
  });

  it('uses transaction', async () => {
    const template = createWorkoutTemplate();

    await updateWorkoutTemplateInDb(template);

    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('rolls back on error', async () => {
    const template = createWorkoutTemplate();
    const error = new Error('Update failed');

    mockDb.runAsync.mockRejectedValueOnce(error);

    await expect(updateWorkoutTemplateInDb(template)).rejects.toThrow('Update failed');

    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockDb.execAsync).not.toHaveBeenCalledWith('COMMIT');
  });

  it('handles null optional fields', async () => {
    const template = createWorkoutTemplate({
      description: undefined,
      defaultWeightUnit: undefined,
      sourceMarkdown: undefined,
    });

    await updateWorkoutTemplateInDb(template);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workout_templates'),
      expect.arrayContaining([null, null, null])
    );
  });
});

// ============================================================================
// deleteWorkoutTemplate Tests
// ============================================================================

describe('deleteWorkoutTemplate', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('calls delete with correct ID', async () => {
    await deleteWorkoutTemplate('template-to-delete');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM workout_templates WHERE id = ?',
      ['template-to-delete']
    );
  });

  it('handles different ID formats', async () => {
    await deleteWorkoutTemplate('uuid-123-456-789');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM workout_templates WHERE id = ?',
      ['uuid-123-456-789']
    );
  });
});

// ============================================================================
// searchWorkoutTemplates Tests
// ============================================================================

describe('searchWorkoutTemplates', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('searches by name (case insensitive)', async () => {
    const templateRow = createWorkoutTemplateRow({ name: 'Push Day Workout' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([]); // exercises

    const result = await searchWorkoutTemplates('push');

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE LOWER(name) LIKE ? OR LOWER(tags) LIKE ?'),
      ['%push%', '%push%']
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Push Day Workout');
  });

  it('searches by tags', async () => {
    const templateRow = createWorkoutTemplateRow({
      name: 'Leg Workout',
      tags: '["strength", "lower body"]',
    });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([]);

    const result = await searchWorkoutTemplates('strength');

    expect(result).toHaveLength(1);
    expect(result[0].tags).toContain('strength');
  });

  it('returns empty for no matches', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await searchWorkoutTemplates('nonexistent');

    expect(result).toEqual([]);
  });

  it('converts search query to lowercase', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    await searchWorkoutTemplates('UPPER CASE QUERY');

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.any(String),
      ['%upper case query%', '%upper case query%']
    );
  });

  it('returns templates with exercises and sets', async () => {
    const templateRow = createWorkoutTemplateRow();
    const exerciseRow = createTemplateExerciseRow();
    const setRow = createTemplateSetRow();

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await searchWorkoutTemplates('test');

    expect(result[0].exercises).toHaveLength(1);
    expect(result[0].exercises[0].sets).toHaveLength(1);
  });
});

// ============================================================================
// getWorkoutTemplatesByTag Tests
// ============================================================================

describe('getWorkoutTemplatesByTag', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('filters by tag correctly', async () => {
    const templateRow = createWorkoutTemplateRow({ tags: '["strength", "push"]' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([]);

    const result = await getWorkoutTemplatesByTag('strength');

    // The search uses %"tag"% pattern for exact JSON array element matching
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM workout_templates WHERE tags LIKE ? ORDER BY created_at DESC',
      ['%"strength"%']
    );
    expect(result).toHaveLength(1);
    expect(result[0].tags).toContain('strength');
  });

  it('returns empty for unknown tag', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await getWorkoutTemplatesByTag('unknown-tag');

    expect(result).toEqual([]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM workout_templates WHERE tags LIKE ? ORDER BY created_at DESC',
      ['%"unknown-tag"%']
    );
  });

  it('returns templates with exercises and sets', async () => {
    const templateRow = createWorkoutTemplateRow({ tags: '["cardio"]' });
    const exerciseRow = createTemplateExerciseRow();
    const setRow = createTemplateSetRow();

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([setRow]);

    const result = await getWorkoutTemplatesByTag('cardio');

    expect(result[0].exercises).toHaveLength(1);
    expect(result[0].exercises[0].sets).toHaveLength(1);
  });

  it('returns multiple matching templates', async () => {
    const templateRow1 = createWorkoutTemplateRow({ id: 'template-1', tags: '["strength"]' });
    const templateRow2 = createWorkoutTemplateRow({ id: 'template-2', tags: '["strength", "legs"]' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow1, templateRow2])
      .mockResolvedValueOnce([]) // exercises for template-1
      .mockResolvedValueOnce([]); // exercises for template-2

    const result = await getWorkoutTemplatesByTag('strength');

    expect(result).toHaveLength(2);
  });

  it('uses exact tag matching (not partial)', async () => {
    const templateRow = createWorkoutTemplateRow({ tags: '["strength"]' });

    mockDb.getAllAsync
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([]);

    await getWorkoutTemplatesByTag('strength');

    // Pattern should include quotes to match exact JSON string
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.any(String),
      ['%"strength"%']
    );
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

  describe('tags parsing', () => {
    it('parses valid JSON array tags', async () => {
      const templateRow = createWorkoutTemplateRow({ tags: '["tag1", "tag2", "tag3"]' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('returns empty array for empty tags string', async () => {
      const templateRow = createWorkoutTemplateRow({ tags: '' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.tags).toEqual([]);
    });

    it('parses empty JSON array', async () => {
      const templateRow = createWorkoutTemplateRow({ tags: '[]' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.tags).toEqual([]);
    });
  });

  describe('boolean conversion (is_dropset, is_per_side)', () => {
    it('converts 1 to true', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow();
      const setRow = createTemplateSetRow({ is_dropset: 1, is_per_side: 1 });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.exercises[0].sets[0].isDropset).toBe(true);
      expect(result!.exercises[0].sets[0].isPerSide).toBe(true);
    });

    it('converts 0 to false', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow();
      const setRow = createTemplateSetRow({ is_dropset: 0, is_per_side: 0 });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.exercises[0].sets[0].isDropset).toBe(false);
      expect(result!.exercises[0].sets[0].isPerSide).toBe(false);
    });
  });

  describe('null-to-undefined conversion', () => {
    it('converts null description to undefined', async () => {
      const templateRow = createWorkoutTemplateRow({ description: null });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.description).toBeUndefined();
    });

    it('converts null exercise notes to undefined', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow({ notes: null });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.exercises[0].notes).toBeUndefined();
    });

    it('converts null set values to undefined', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow();
      const setRow = createTemplateSetRow({
        target_weight: null,
        target_reps: null,
        target_time: null,
        target_rpe: null,
        rest_seconds: null,
        tempo: null,
      });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutTemplateById('template-1');

      const set = result!.exercises[0].sets[0];
      expect(set.targetWeight).toBeUndefined();
      expect(set.targetReps).toBeUndefined();
      expect(set.targetTime).toBeUndefined();
      expect(set.targetRpe).toBeUndefined();
      expect(set.restSeconds).toBeUndefined();
      expect(set.tempo).toBeUndefined();
    });
  });

  describe('weight unit type casting', () => {
    it('casts default_weight_unit to proper type', async () => {
      const templateRow = createWorkoutTemplateRow({ default_weight_unit: 'kg' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.defaultWeightUnit).toBe('kg');
    });

    it('casts target_weight_unit to proper type', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow();
      const setRow = createTemplateSetRow({ target_weight_unit: 'kg' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([setRow]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.exercises[0].sets[0].targetWeightUnit).toBe('kg');
    });
  });

  describe('group_type casting', () => {
    it('casts superset group_type correctly', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow({ group_type: 'superset' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.exercises[0].groupType).toBe('superset');
    });

    it('casts section group_type correctly', async () => {
      const templateRow = createWorkoutTemplateRow();
      const exerciseRow = createTemplateExerciseRow({ group_type: 'section' });

      mockDb.getFirstAsync.mockResolvedValue(templateRow);
      mockDb.getAllAsync
        .mockResolvedValueOnce([exerciseRow])
        .mockResolvedValueOnce([]);

      const result = await getWorkoutTemplateById('template-1');

      expect(result!.exercises[0].groupType).toBe('section');
    });
  });
});
