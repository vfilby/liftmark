import { getDatabase } from './index';
import type {
  WorkoutPlan,
  PlannedExercise,
  PlannedSet,
  WorkoutPlanRow,
  PlannedExerciseRow,
  PlannedSetRow,
} from '@/types';

/**
 * Repository for WorkoutPlan CRUD operations
 * Handles conversion between application types and database rows
 * Note: Database tables remain as workout_templates, template_exercises, template_sets
 */

/**
 * Get all workout plans with their exercises and sets
 * @param favoritesOnly - If true, only returns favorited plans
 */
export async function getAllWorkoutPlans(favoritesOnly: boolean = false): Promise<WorkoutPlan[]> {
  const db = await getDatabase();

  // Get all templates (optionally filtered by favorites)
  const query = favoritesOnly
    ? 'SELECT * FROM workout_templates WHERE is_favorite = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM workout_templates ORDER BY created_at DESC';

  const templateRows = await db.getAllAsync<WorkoutPlanRow>(query);

  const planIds = templateRows.map(r => r.id);
  const exercisesByPlan = await batchLoadExercisesWithSets(planIds);

  return templateRows.map(row =>
    rowToWorkoutPlan(row, exercisesByPlan.get(row.id) || [])
  );
}

/**
 * Get a single workout plan by ID with all exercises and sets
 */
export async function getWorkoutPlanById(
  id: string
): Promise<WorkoutPlan | null> {
  const db = await getDatabase();

  const templateRow = await db.getFirstAsync<WorkoutPlanRow>(
    'SELECT * FROM workout_templates WHERE id = ?',
    [id]
  );

  if (!templateRow) {
    return null;
  }

  const exercisesByPlan = await batchLoadExercisesWithSets([id]);
  return rowToWorkoutPlan(templateRow, exercisesByPlan.get(id) || []);
}

/**
 * Create a new workout plan with all exercises and sets
 */
export async function createWorkoutPlan(
  plan: WorkoutPlan
): Promise<void> {
  const db = await getDatabase();

  // Start transaction
  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert plan (into workout_templates table)
    await db.runAsync(
      `INSERT INTO workout_templates (
        id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.id,
        plan.name,
        plan.description || null,
        JSON.stringify(plan.tags),
        plan.defaultWeightUnit || null,
        plan.sourceMarkdown || null,
        plan.createdAt,
        plan.updatedAt,
      ]
    );

    // Insert exercises and sets
    for (const exercise of plan.exercises) {
      await insertPlannedExercise(exercise);

      for (const set of exercise.sets) {
        await insertPlannedSet(set);
      }
    }

    await db.execAsync('COMMIT');

    // Sync hook: Add to sync queue
    await afterCreateHook('WorkoutPlan', plan);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Update an existing workout plan
 */
export async function updateWorkoutPlan(
  plan: WorkoutPlan
): Promise<void> {
  const db = await getDatabase();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Update plan (in workout_templates table)
    await db.runAsync(
      `UPDATE workout_templates
       SET name = ?, description = ?, tags = ?, default_weight_unit = ?,
           source_markdown = ?, updated_at = ?
       WHERE id = ?`,
      [
        plan.name,
        plan.description || null,
        JSON.stringify(plan.tags),
        plan.defaultWeightUnit || null,
        plan.sourceMarkdown || null,
        plan.updatedAt,
        plan.id,
      ]
    );

    // Delete existing exercises and sets (CASCADE will handle sets)
    await db.runAsync(
      'DELETE FROM template_exercises WHERE workout_template_id = ?',
      [plan.id]
    );

    // Insert new exercises and sets
    for (const exercise of plan.exercises) {
      await insertPlannedExercise(exercise);

      for (const set of exercise.sets) {
        await insertPlannedSet(set);
      }
    }

    await db.execAsync('COMMIT');

    // Sync hook: Add to sync queue
    await afterUpdateHook('WorkoutPlan', plan);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Delete a workout plan (CASCADE will delete exercises and sets)
 */
export async function deleteWorkoutPlan(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);

  // Sync hook: Add to sync queue
  await afterDeleteHook('WorkoutPlan', id);
}

/**
 * Search workout plans by name or tags
 */
export async function searchWorkoutPlans(
  query: string
): Promise<WorkoutPlan[]> {
  const db = await getDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;

  const templateRows = await db.getAllAsync<WorkoutPlanRow>(
    `SELECT * FROM workout_templates
     WHERE LOWER(name) LIKE ? OR LOWER(tags) LIKE ?
     ORDER BY created_at DESC`,
    [searchTerm, searchTerm]
  );

  const planIds = templateRows.map(r => r.id);
  const exercisesByPlan = await batchLoadExercisesWithSets(planIds);

  return templateRows.map(row =>
    rowToWorkoutPlan(row, exercisesByPlan.get(row.id) || [])
  );
}

/**
 * Get plans by tag
 */
export async function getWorkoutPlansByTag(
  tag: string
): Promise<WorkoutPlan[]> {
  const db = await getDatabase();
  const searchTerm = `%"${tag}"%`;

  const templateRows = await db.getAllAsync<WorkoutPlanRow>(
    'SELECT * FROM workout_templates WHERE tags LIKE ? ORDER BY created_at DESC',
    [searchTerm]
  );

  const planIds = templateRows.map(r => r.id);
  const exercisesByPlan = await batchLoadExercisesWithSets(planIds);

  return templateRows.map(row =>
    rowToWorkoutPlan(row, exercisesByPlan.get(row.id) || [])
  );
}

/**
 * Toggle favorite status for a workout plan
 */
export async function toggleFavoritePlan(id: string): Promise<boolean> {
  const db = await getDatabase();

  // Get current status
  const plan = await db.getFirstAsync<{ is_favorite: number }>(
    'SELECT is_favorite FROM workout_templates WHERE id = ?',
    [id]
  );

  if (!plan) {
    throw new Error('Plan not found');
  }

  const newStatus = plan.is_favorite === 1 ? 0 : 1;

  await db.runAsync(
    'UPDATE workout_templates SET is_favorite = ?, updated_at = ? WHERE id = ?',
    [newStatus, new Date().toISOString(), id]
  );

  return newStatus === 1;
}

/**
 * Set favorite status for a workout plan
 */
export async function setFavoritePlan(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    'UPDATE workout_templates SET is_favorite = ?, updated_at = ? WHERE id = ?',
    [isFavorite ? 1 : 0, new Date().toISOString(), id]
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Batch load all exercises and their sets for multiple plans.
 * Uses 2 queries (exercises + sets) instead of N+1 per-exercise queries.
 */
async function batchLoadExercisesWithSets(
  planIds: string[]
): Promise<Map<string, PlannedExercise[]>> {
  const result = new Map<string, PlannedExercise[]>();
  if (planIds.length === 0) return result;

  const db = await getDatabase();
  const placeholders = planIds.map(() => '?').join(',');

  const exerciseRows = await db.getAllAsync<PlannedExerciseRow>(
    `SELECT * FROM template_exercises WHERE workout_template_id IN (${placeholders}) ORDER BY order_index`,
    planIds
  );

  const exerciseIds = exerciseRows.map(r => r.id);
  const setsByExercise = new Map<string, PlannedSet[]>();

  if (exerciseIds.length > 0) {
    const setPlaceholders = exerciseIds.map(() => '?').join(',');
    const setRows = await db.getAllAsync<PlannedSetRow>(
      `SELECT * FROM template_sets WHERE template_exercise_id IN (${setPlaceholders}) ORDER BY order_index`,
      exerciseIds
    );

    for (const setRow of setRows) {
      const eid = setRow.template_exercise_id;
      if (!setsByExercise.has(eid)) {
        setsByExercise.set(eid, []);
      }
      setsByExercise.get(eid)!.push(rowToPlannedSet(setRow));
    }
  }

  for (const planId of planIds) {
    result.set(planId, []);
  }

  for (const exerciseRow of exerciseRows) {
    const sets = setsByExercise.get(exerciseRow.id) || [];
    result.get(exerciseRow.workout_template_id)!.push(
      rowToPlannedExercise(exerciseRow, sets)
    );
  }

  return result;
}

/**
 * Insert a planned exercise
 */
async function insertPlannedExercise(
  exercise: PlannedExercise
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO template_exercises (
      id, workout_template_id, exercise_name, order_index, notes,
      equipment_type, group_type, group_name, parent_exercise_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.workoutPlanId,
      exercise.exerciseName,
      exercise.orderIndex,
      exercise.notes || null,
      exercise.equipmentType || null,
      exercise.groupType || null,
      exercise.groupName || null,
      exercise.parentExerciseId || null,
    ]
  );
}

/**
 * Insert a planned set
 */
async function insertPlannedSet(set: PlannedSet): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO template_sets (
      id, template_exercise_id, order_index, target_weight, target_weight_unit,
      target_reps, target_time, target_rpe, rest_seconds, tempo, is_dropset, is_per_side
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      set.id,
      set.plannedExerciseId,
      set.orderIndex,
      set.targetWeight ?? null,
      set.targetWeightUnit || null,
      set.targetReps ?? null,
      set.targetTime ?? null,
      set.targetRpe ?? null,
      set.restSeconds ?? null,
      set.tempo || null,
      set.isDropset ? 1 : 0,
      set.isPerSide ? 1 : 0,
    ]
  );
}

/**
 * Convert database row to WorkoutPlan
 */
function rowToWorkoutPlan(
  row: WorkoutPlanRow,
  exercises: PlannedExercise[]
): WorkoutPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    defaultWeightUnit: (row.default_weight_unit as 'lbs' | 'kg') || undefined,
    sourceMarkdown: row.source_markdown || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite: row.is_favorite === 1,
    exercises,
  };
}

/**
 * Convert database row to PlannedExercise
 */
function rowToPlannedExercise(
  row: PlannedExerciseRow,
  sets: PlannedSet[]
): PlannedExercise {
  return {
    id: row.id,
    workoutPlanId: row.workout_template_id,
    exerciseName: row.exercise_name,
    orderIndex: row.order_index,
    notes: row.notes || undefined,
    equipmentType: row.equipment_type || undefined,
    groupType: (row.group_type as 'superset' | 'section') || undefined,
    groupName: row.group_name || undefined,
    parentExerciseId: row.parent_exercise_id || undefined,
    sets,
  };
}

/**
 * Convert database row to PlannedSet
 */
function rowToPlannedSet(row: PlannedSetRow): PlannedSet {
  return {
    id: row.id,
    plannedExerciseId: row.template_exercise_id,
    orderIndex: row.order_index,
    targetWeight: row.target_weight ?? undefined,
    targetWeightUnit: (row.target_weight_unit as 'lbs' | 'kg') || undefined,
    targetReps: row.target_reps ?? undefined,
    targetTime: row.target_time ?? undefined,
    targetRpe: row.target_rpe ?? undefined,
    restSeconds: row.rest_seconds ?? undefined,
    tempo: row.tempo || undefined,
    isDropset: row.is_dropset === 1,
    isPerSide: row.is_per_side === 1,
  };
}

// ============================================================================
// Sync Hooks
// ============================================================================

/**
 * Hook called after creating a plan
 */
async function afterCreateHook(
  entityType: 'WorkoutPlan',
  entity: WorkoutPlan
): Promise<void> {
  // Sync functionality removed
}

/**
 * Hook called after updating a plan
 */
async function afterUpdateHook(
  entityType: 'WorkoutPlan',
  entity: WorkoutPlan
): Promise<void> {
  // Sync functionality removed
}

/**
 * Hook called after deleting a plan
 */
async function afterDeleteHook(
  entityType: 'WorkoutPlan',
  entityId: string
): Promise<void> {
  // Sync functionality removed
}

// ============================================================================
// Legacy Function Aliases (for backward compatibility - will be removed)
// ============================================================================

/** @deprecated Use getAllWorkoutPlans instead */
export const getAllWorkoutTemplates = getAllWorkoutPlans;
/** @deprecated Use getWorkoutPlanById instead */
export const getWorkoutTemplateById = getWorkoutPlanById;
/** @deprecated Use createWorkoutPlan instead */
export const createWorkoutTemplate = createWorkoutPlan;
/** @deprecated Use updateWorkoutPlan instead */
export const updateWorkoutTemplate = updateWorkoutPlan;
/** @deprecated Use deleteWorkoutPlan instead */
export const deleteWorkoutTemplate = deleteWorkoutPlan;
/** @deprecated Use searchWorkoutPlans instead */
export const searchWorkoutTemplates = searchWorkoutPlans;
/** @deprecated Use getWorkoutPlansByTag instead */
export const getWorkoutTemplatesByTag = getWorkoutPlansByTag;
/** @deprecated Use toggleFavoritePlan instead */
export const toggleFavoriteTemplate = toggleFavoritePlan;
/** @deprecated Use setFavoritePlan instead */
export const setFavoriteTemplate = setFavoritePlan;
