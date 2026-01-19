import { getDatabase } from './index';
import { generateId } from '@/utils/id';
import type {
  WorkoutTemplate,
  WorkoutSession,
  SessionExercise,
  SessionSet,
  WorkoutSessionRow,
  SessionExerciseRow,
  SessionSetRow,
} from '@/types';

/**
 * Repository for WorkoutSession CRUD operations
 * Handles conversion between application types and database rows
 */

/**
 * Create a new workout session from a template
 * Copies the template structure with target values, initializes status as pending
 */
export async function createSessionFromTemplate(
  template: WorkoutTemplate
): Promise<WorkoutSession> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Generate session ID
  const sessionId = generateId();

  // Map old exercise IDs to new session exercise IDs (for parent references)
  const exerciseIdMap = new Map<string, string>();

  // Build session structure
  const sessionExercises: SessionExercise[] = template.exercises.map((templateEx) => {
    const sessionExerciseId = generateId();
    exerciseIdMap.set(templateEx.id, sessionExerciseId);

    return {
      id: sessionExerciseId,
      workoutSessionId: sessionId,
      exerciseName: templateEx.exerciseName,
      orderIndex: templateEx.orderIndex,
      notes: templateEx.notes,
      equipmentType: templateEx.equipmentType,
      groupType: templateEx.groupType,
      groupName: templateEx.groupName,
      parentExerciseId: undefined, // Will be set after all IDs are mapped
      sets: templateEx.sets.map((templateSet, setIndex) => ({
        id: generateId(),
        sessionExerciseId: sessionExerciseId,
        orderIndex: setIndex,
        // Copy target values from template
        targetWeight: templateSet.targetWeight,
        targetWeightUnit: templateSet.targetWeightUnit,
        targetReps: templateSet.targetReps,
        targetTime: templateSet.targetTime,
        targetRpe: templateSet.targetRpe,
        restSeconds: templateSet.restSeconds,
        tempo: templateSet.tempo,
        isDropset: templateSet.isDropset,
        // Actual values start undefined
        status: 'pending' as const,
      })),
      status: 'pending' as const,
    };
  });

  // Now set parent exercise IDs using the map
  for (let i = 0; i < template.exercises.length; i++) {
    const templateEx = template.exercises[i];
    if (templateEx.parentExerciseId) {
      const newParentId = exerciseIdMap.get(templateEx.parentExerciseId);
      if (newParentId) {
        sessionExercises[i].parentExerciseId = newParentId;
      }
    }
  }

  const session: WorkoutSession = {
    id: sessionId,
    workoutTemplateId: template.id,
    name: template.name,
    date: today,
    startTime: now,
    exercises: sessionExercises,
    status: 'in_progress',
  };

  // Persist to database
  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert session
    await db.runAsync(
      `INSERT INTO workout_sessions (
        id, workout_template_id, name, date, start_time, end_time, duration, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.workoutTemplateId || null,
        session.name,
        session.date,
        session.startTime || null,
        session.endTime || null,
        session.duration ?? null,
        session.notes || null,
        session.status,
      ]
    );

    // Insert exercises and sets
    for (const exercise of session.exercises) {
      await db.runAsync(
        `INSERT INTO session_exercises (
          id, workout_session_id, exercise_name, order_index, notes,
          equipment_type, group_type, group_name, parent_exercise_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exercise.id,
          exercise.workoutSessionId,
          exercise.exerciseName,
          exercise.orderIndex,
          exercise.notes || null,
          exercise.equipmentType || null,
          exercise.groupType || null,
          exercise.groupName || null,
          exercise.parentExerciseId || null,
          exercise.status,
        ]
      );

      for (const set of exercise.sets) {
        await db.runAsync(
          `INSERT INTO session_sets (
            id, session_exercise_id, order_index, parent_set_id, drop_sequence,
            target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds,
            actual_weight, actual_weight_unit, actual_reps, actual_time, actual_rpe,
            completed_at, status, notes, tempo, is_dropset, is_per_side
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            set.id,
            set.sessionExerciseId,
            set.orderIndex,
            set.parentSetId || null,
            set.dropSequence ?? null,
            set.targetWeight ?? null,
            set.targetWeightUnit || null,
            set.targetReps ?? null,
            set.targetTime ?? null,
            set.targetRpe ?? null,
            set.restSeconds ?? null,
            set.actualWeight ?? null,
            set.actualWeightUnit || null,
            set.actualReps ?? null,
            set.actualTime ?? null,
            set.actualRpe ?? null,
            set.completedAt || null,
            set.status,
            set.notes || null,
            set.tempo || null,
            set.isDropset ? 1 : 0,
            set.isPerSide ? 1 : 0,
          ]
        );
      }
    }

    await db.execAsync('COMMIT');

    // Sync hook: Add to sync queue
    await afterCreateSessionHook(session);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  return session;
}

/**
 * Get a workout session by ID with all exercises and sets
 */
export async function getWorkoutSessionById(
  id: string
): Promise<WorkoutSession | null> {
  const db = await getDatabase();

  const sessionRow = await db.getFirstAsync<WorkoutSessionRow>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    [id]
  );

  if (!sessionRow) {
    return null;
  }

  const exercises = await getSessionExercises(id);
  return rowToWorkoutSession(sessionRow, exercises);
}

/**
 * Get the active (in_progress) session, if any
 */
export async function getActiveSession(): Promise<WorkoutSession | null> {
  const db = await getDatabase();

  const sessionRow = await db.getFirstAsync<WorkoutSessionRow>(
    "SELECT * FROM workout_sessions WHERE status = 'in_progress' ORDER BY start_time DESC LIMIT 1"
  );

  if (!sessionRow) {
    return null;
  }

  const exercises = await getSessionExercises(sessionRow.id);
  return rowToWorkoutSession(sessionRow, exercises);
}

/**
 * Update a workout session (status, end_time, duration, notes)
 */
export async function updateSession(session: WorkoutSession): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE workout_sessions
     SET name = ?, date = ?, start_time = ?, end_time = ?, duration = ?, notes = ?, status = ?
     WHERE id = ?`,
    [
      session.name,
      session.date,
      session.startTime || null,
      session.endTime || null,
      session.duration ?? null,
      session.notes || null,
      session.status,
      session.id,
    ]
  );

  // Sync hook: Add to sync queue
  await afterUpdateSessionHook(session);
}

/**
 * Update a session set (actual values, status, completedAt)
 */
export async function updateSessionSet(set: SessionSet): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE session_sets
     SET actual_weight = ?, actual_weight_unit = ?, actual_reps = ?,
         actual_time = ?, actual_rpe = ?, completed_at = ?, status = ?, notes = ?
     WHERE id = ?`,
    [
      set.actualWeight ?? null,
      set.actualWeightUnit || null,
      set.actualReps ?? null,
      set.actualTime ?? null,
      set.actualRpe ?? null,
      set.completedAt || null,
      set.status,
      set.notes || null,
      set.id,
    ]
  );
}

/**
 * Update a session exercise (status)
 */
export async function updateSessionExercise(
  exercise: SessionExercise
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE session_exercises
     SET status = ?, notes = ?
     WHERE id = ?`,
    [exercise.status, exercise.notes || null, exercise.id]
  );
}

/**
 * Delete a workout session (CASCADE will delete exercises and sets)
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);

  // Sync hook: Add to sync queue
  await afterDeleteSessionHook(id);
}

/**
 * Get all completed sessions (for future history feature)
 */
export async function getCompletedSessions(): Promise<WorkoutSession[]> {
  const db = await getDatabase();

  const sessionRows = await db.getAllAsync<WorkoutSessionRow>(
    "SELECT * FROM workout_sessions WHERE status = 'completed' ORDER BY date DESC, start_time DESC"
  );

  const sessions: WorkoutSession[] = [];

  for (const sessionRow of sessionRows) {
    const exercises = await getSessionExercises(sessionRow.id);
    sessions.push(rowToWorkoutSession(sessionRow, exercises));
  }

  return sessions;
}

/**
 * Get recent completed sessions with a limit
 */
export async function getRecentSessions(limit: number = 5): Promise<WorkoutSession[]> {
  const db = await getDatabase();

  const sessionRows = await db.getAllAsync<WorkoutSessionRow>(
    "SELECT * FROM workout_sessions WHERE status = 'completed' ORDER BY date DESC, start_time DESC LIMIT ?",
    [limit]
  );

  const sessions: WorkoutSession[] = [];

  for (const sessionRow of sessionRows) {
    const exercises = await getSessionExercises(sessionRow.id);
    sessions.push(rowToWorkoutSession(sessionRow, exercises));
  }

  return sessions;
}

/**
 * Get best weights for each exercise across all completed sessions
 * Returns a map of exercise name -> { weight, reps, unit }
 */
export async function getExerciseBestWeights(): Promise<Map<string, { weight: number; reps: number; unit: string }>> {
  const db = await getDatabase();

  // Get max weight per exercise from all completed sets
  const rows = await db.getAllAsync<{
    exercise_name: string;
    max_weight: number;
    reps: number;
    unit: string;
  }>(`
    SELECT
      se.exercise_name,
      MAX(ss.actual_weight) as max_weight,
      ss.actual_reps as reps,
      COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit
    FROM session_sets ss
    JOIN session_exercises se ON ss.session_exercise_id = se.id
    JOIN workout_sessions ws ON se.workout_session_id = ws.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND ss.actual_weight IS NOT NULL
      AND ss.actual_weight > 0
    GROUP BY se.exercise_name
    ORDER BY se.exercise_name
  `);

  const bestWeights = new Map<string, { weight: number; reps: number; unit: string }>();
  for (const row of rows) {
    bestWeights.set(row.exercise_name, {
      weight: row.max_weight,
      reps: row.reps || 0,
      unit: row.unit,
    });
  }

  return bestWeights;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all exercises for a session with their sets
 */
async function getSessionExercises(
  workoutSessionId: string
): Promise<SessionExercise[]> {
  const db = await getDatabase();

  const exerciseRows = await db.getAllAsync<SessionExerciseRow>(
    'SELECT * FROM session_exercises WHERE workout_session_id = ? ORDER BY order_index',
    [workoutSessionId]
  );

  const exercises: SessionExercise[] = [];

  for (const exerciseRow of exerciseRows) {
    const sets = await getSessionSets(exerciseRow.id);
    exercises.push(rowToSessionExercise(exerciseRow, sets));
  }

  return exercises;
}

/**
 * Get all sets for an exercise
 */
async function getSessionSets(sessionExerciseId: string): Promise<SessionSet[]> {
  const db = await getDatabase();

  const setRows = await db.getAllAsync<SessionSetRow>(
    'SELECT * FROM session_sets WHERE session_exercise_id = ? ORDER BY order_index',
    [sessionExerciseId]
  );

  return setRows.map(rowToSessionSet);
}

/**
 * Convert database row to WorkoutSession
 */
function rowToWorkoutSession(
  row: WorkoutSessionRow,
  exercises: SessionExercise[]
): WorkoutSession {
  return {
    id: row.id,
    workoutTemplateId: row.workout_template_id || undefined,
    name: row.name,
    date: row.date,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    duration: row.duration ?? undefined,
    notes: row.notes || undefined,
    exercises,
    status: row.status as WorkoutSession['status'],
  };
}

/**
 * Convert database row to SessionExercise
 */
function rowToSessionExercise(
  row: SessionExerciseRow,
  sets: SessionSet[]
): SessionExercise {
  return {
    id: row.id,
    workoutSessionId: row.workout_session_id,
    exerciseName: row.exercise_name,
    orderIndex: row.order_index,
    notes: row.notes || undefined,
    equipmentType: row.equipment_type || undefined,
    groupType: (row.group_type as 'superset' | 'section') || undefined,
    groupName: row.group_name || undefined,
    parentExerciseId: row.parent_exercise_id || undefined,
    sets,
    status: row.status as SessionExercise['status'],
  };
}

/**
 * Convert database row to SessionSet
 */
function rowToSessionSet(row: SessionSetRow): SessionSet {
  return {
    id: row.id,
    sessionExerciseId: row.session_exercise_id,
    orderIndex: row.order_index,
    parentSetId: row.parent_set_id || undefined,
    dropSequence: row.drop_sequence ?? undefined,
    // Target values
    targetWeight: row.target_weight ?? undefined,
    targetWeightUnit: (row.target_weight_unit as 'lbs' | 'kg') || undefined,
    targetReps: row.target_reps ?? undefined,
    targetTime: row.target_time ?? undefined,
    targetRpe: row.target_rpe ?? undefined,
    restSeconds: row.rest_seconds ?? undefined,
    // Actual values
    actualWeight: row.actual_weight ?? undefined,
    actualWeightUnit: (row.actual_weight_unit as 'lbs' | 'kg') || undefined,
    actualReps: row.actual_reps ?? undefined,
    actualTime: row.actual_time ?? undefined,
    actualRpe: row.actual_rpe ?? undefined,
    // Metadata
    completedAt: row.completed_at || undefined,
    status: row.status as SessionSet['status'],
    notes: row.notes || undefined,
    tempo: row.tempo || undefined,
    isDropset: row.is_dropset === 1,
    isPerSide: row.is_per_side === 1,
  };
}

// ============================================================================
// Sync Hooks
// ============================================================================

/**
 * Hook called after creating a session
 */
async function afterCreateSessionHook(session: WorkoutSession): Promise<void> {
  try {
    const { getSyncMetadata, addToSyncQueue } = await import('./syncMetadataRepository');
    const { triggerSyncAfterChange } = await import('@/services/syncService');

    // Only queue if sync is enabled
    const metadata = await getSyncMetadata();
    if (!metadata.syncEnabled) {
      return;
    }

    await addToSyncQueue('WorkoutSession', session.id, 'create', session);
    triggerSyncAfterChange();
  } catch (error) {
    console.error('Sync hook failed (create session):', error);
  }
}

/**
 * Hook called after updating a session
 */
async function afterUpdateSessionHook(session: WorkoutSession): Promise<void> {
  try {
    const { getSyncMetadata, addToSyncQueue } = await import('./syncMetadataRepository');
    const { triggerSyncAfterChange } = await import('@/services/syncService');

    // Only queue if sync is enabled
    const metadata = await getSyncMetadata();
    if (!metadata.syncEnabled) {
      return;
    }

    await addToSyncQueue('WorkoutSession', session.id, 'update', session);
    triggerSyncAfterChange();
  } catch (error) {
    console.error('Sync hook failed (update session):', error);
  }
}

/**
 * Hook called after deleting a session
 */
async function afterDeleteSessionHook(sessionId: string): Promise<void> {
  try {
    const { getSyncMetadata, addToSyncQueue } = await import('./syncMetadataRepository');
    const { triggerSyncAfterChange } = await import('@/services/syncService');

    // Only queue if sync is enabled
    const metadata = await getSyncMetadata();
    if (!metadata.syncEnabled) {
      return;
    }

    await addToSyncQueue('WorkoutSession', sessionId, 'delete', { id: sessionId });
    triggerSyncAfterChange();
  } catch (error) {
    console.error('Sync hook failed (delete session):', error);
  }
}
