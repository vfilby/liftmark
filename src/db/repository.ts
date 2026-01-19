import { getDatabase } from './index';
import type {
  WorkoutTemplate,
  TemplateExercise,
  TemplateSet,
  WorkoutTemplateRow,
  TemplateExerciseRow,
  TemplateSetRow,
} from '@/types';

/**
 * Repository for WorkoutTemplate CRUD operations
 * Handles conversion between application types and database rows
 */

/**
 * Get all workout templates with their exercises and sets
 */
export async function getAllWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();

  // Get all templates
  const templateRows = await db.getAllAsync<WorkoutTemplateRow>(
    'SELECT * FROM workout_templates ORDER BY created_at DESC'
  );

  // For each template, get its exercises and sets
  const templates: WorkoutTemplate[] = [];

  for (const templateRow of templateRows) {
    const exercises = await getTemplateExercises(templateRow.id);
    templates.push(rowToWorkoutTemplate(templateRow, exercises));
  }

  return templates;
}

/**
 * Get a single workout template by ID with all exercises and sets
 */
export async function getWorkoutTemplateById(
  id: string
): Promise<WorkoutTemplate | null> {
  const db = await getDatabase();

  const templateRow = await db.getFirstAsync<WorkoutTemplateRow>(
    'SELECT * FROM workout_templates WHERE id = ?',
    [id]
  );

  if (!templateRow) {
    return null;
  }

  const exercises = await getTemplateExercises(id);
  return rowToWorkoutTemplate(templateRow, exercises);
}

/**
 * Create a new workout template with all exercises and sets
 */
export async function createWorkoutTemplate(
  template: WorkoutTemplate
): Promise<void> {
  const db = await getDatabase();

  // Start transaction
  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert template
    await db.runAsync(
      `INSERT INTO workout_templates (
        id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        template.id,
        template.name,
        template.description || null,
        JSON.stringify(template.tags),
        template.defaultWeightUnit || null,
        template.sourceMarkdown || null,
        template.createdAt,
        template.updatedAt,
      ]
    );

    // Insert exercises and sets
    for (const exercise of template.exercises) {
      await insertTemplateExercise(exercise);

      for (const set of exercise.sets) {
        await insertTemplateSet(set);
      }
    }

    await db.execAsync('COMMIT');

    // Sync hook: Add to sync queue
    await afterCreateHook('WorkoutTemplate', template);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Update an existing workout template
 */
export async function updateWorkoutTemplate(
  template: WorkoutTemplate
): Promise<void> {
  const db = await getDatabase();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Update template
    await db.runAsync(
      `UPDATE workout_templates
       SET name = ?, description = ?, tags = ?, default_weight_unit = ?,
           source_markdown = ?, updated_at = ?
       WHERE id = ?`,
      [
        template.name,
        template.description || null,
        JSON.stringify(template.tags),
        template.defaultWeightUnit || null,
        template.sourceMarkdown || null,
        template.updatedAt,
        template.id,
      ]
    );

    // Delete existing exercises and sets (CASCADE will handle sets)
    await db.runAsync(
      'DELETE FROM template_exercises WHERE workout_template_id = ?',
      [template.id]
    );

    // Insert new exercises and sets
    for (const exercise of template.exercises) {
      await insertTemplateExercise(exercise);

      for (const set of exercise.sets) {
        await insertTemplateSet(set);
      }
    }

    await db.execAsync('COMMIT');

    // Sync hook: Add to sync queue
    await afterUpdateHook('WorkoutTemplate', template);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Delete a workout template (CASCADE will delete exercises and sets)
 */
export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);

  // Sync hook: Add to sync queue
  await afterDeleteHook('WorkoutTemplate', id);
}

/**
 * Search workout templates by name or tags
 */
export async function searchWorkoutTemplates(
  query: string
): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;

  const templateRows = await db.getAllAsync<WorkoutTemplateRow>(
    `SELECT * FROM workout_templates
     WHERE LOWER(name) LIKE ? OR LOWER(tags) LIKE ?
     ORDER BY created_at DESC`,
    [searchTerm, searchTerm]
  );

  const templates: WorkoutTemplate[] = [];

  for (const templateRow of templateRows) {
    const exercises = await getTemplateExercises(templateRow.id);
    templates.push(rowToWorkoutTemplate(templateRow, exercises));
  }

  return templates;
}

/**
 * Get templates by tag
 */
export async function getWorkoutTemplatesByTag(
  tag: string
): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  const searchTerm = `%"${tag}"%`;

  const templateRows = await db.getAllAsync<WorkoutTemplateRow>(
    'SELECT * FROM workout_templates WHERE tags LIKE ? ORDER BY created_at DESC',
    [searchTerm]
  );

  const templates: WorkoutTemplate[] = [];

  for (const templateRow of templateRows) {
    const exercises = await getTemplateExercises(templateRow.id);
    templates.push(rowToWorkoutTemplate(templateRow, exercises));
  }

  return templates;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all exercises for a template with their sets
 */
async function getTemplateExercises(
  workoutTemplateId: string
): Promise<TemplateExercise[]> {
  const db = await getDatabase();

  const exerciseRows = await db.getAllAsync<TemplateExerciseRow>(
    'SELECT * FROM template_exercises WHERE workout_template_id = ? ORDER BY order_index',
    [workoutTemplateId]
  );

  const exercises: TemplateExercise[] = [];

  for (const exerciseRow of exerciseRows) {
    const sets = await getTemplateSets(exerciseRow.id);
    exercises.push(rowToTemplateExercise(exerciseRow, sets));
  }

  return exercises;
}

/**
 * Get all sets for an exercise
 */
async function getTemplateSets(
  templateExerciseId: string
): Promise<TemplateSet[]> {
  const db = await getDatabase();

  const setRows = await db.getAllAsync<TemplateSetRow>(
    'SELECT * FROM template_sets WHERE template_exercise_id = ? ORDER BY order_index',
    [templateExerciseId]
  );

  return setRows.map(rowToTemplateSet);
}

/**
 * Insert a template exercise
 */
async function insertTemplateExercise(
  exercise: TemplateExercise
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO template_exercises (
      id, workout_template_id, exercise_name, order_index, notes,
      equipment_type, group_type, group_name, parent_exercise_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.workoutTemplateId,
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
 * Insert a template set
 */
async function insertTemplateSet(set: TemplateSet): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO template_sets (
      id, template_exercise_id, order_index, target_weight, target_weight_unit,
      target_reps, target_time, target_rpe, rest_seconds, tempo, is_dropset, is_per_side
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      set.id,
      set.templateExerciseId,
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
 * Convert database row to WorkoutTemplate
 */
function rowToWorkoutTemplate(
  row: WorkoutTemplateRow,
  exercises: TemplateExercise[]
): WorkoutTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    defaultWeightUnit: (row.default_weight_unit as 'lbs' | 'kg') || undefined,
    sourceMarkdown: row.source_markdown || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exercises,
  };
}

/**
 * Convert database row to TemplateExercise
 */
function rowToTemplateExercise(
  row: TemplateExerciseRow,
  sets: TemplateSet[]
): TemplateExercise {
  return {
    id: row.id,
    workoutTemplateId: row.workout_template_id,
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
 * Convert database row to TemplateSet
 */
function rowToTemplateSet(row: TemplateSetRow): TemplateSet {
  return {
    id: row.id,
    templateExerciseId: row.template_exercise_id,
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
 * Hook called after creating a template
 */
async function afterCreateHook(
  entityType: 'WorkoutTemplate',
  entity: WorkoutTemplate
): Promise<void> {
  try {
    const { getSyncMetadata, addToSyncQueue } = await import('./syncMetadataRepository');
    const { triggerSyncAfterChange } = await import('@/services/syncService');

    // Only queue if sync is enabled
    const metadata = await getSyncMetadata();
    if (!metadata.syncEnabled) {
      return;
    }

    await addToSyncQueue(entityType, entity.id, 'create', entity);
    triggerSyncAfterChange();
  } catch (error) {
    console.error('Sync hook failed (create):', error);
  }
}

/**
 * Hook called after updating a template
 */
async function afterUpdateHook(
  entityType: 'WorkoutTemplate',
  entity: WorkoutTemplate
): Promise<void> {
  try {
    const { getSyncMetadata, addToSyncQueue } = await import('./syncMetadataRepository');
    const { triggerSyncAfterChange } = await import('@/services/syncService');

    // Only queue if sync is enabled
    const metadata = await getSyncMetadata();
    if (!metadata.syncEnabled) {
      return;
    }

    await addToSyncQueue(entityType, entity.id, 'update', entity);
    triggerSyncAfterChange();
  } catch (error) {
    console.error('Sync hook failed (update):', error);
  }
}

/**
 * Hook called after deleting a template
 */
async function afterDeleteHook(
  entityType: 'WorkoutTemplate',
  entityId: string
): Promise<void> {
  try {
    const { getSyncMetadata, addToSyncQueue } = await import('./syncMetadataRepository');
    const { triggerSyncAfterChange } = await import('@/services/syncService');

    // Only queue if sync is enabled
    const metadata = await getSyncMetadata();
    if (!metadata.syncEnabled) {
      return;
    }

    await addToSyncQueue(entityType, entityId, 'delete', { id: entityId });
    triggerSyncAfterChange();
  } catch (error) {
    console.error('Sync hook failed (delete):', error);
  }
}
