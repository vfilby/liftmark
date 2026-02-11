import { getDatabase } from './index';
import { generateId } from '@/utils/id';
import type {
  WorkoutPlan,
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
 * Create a new workout session from a plan
 * Copies the plan structure with target values, initializes status as pending
 */
export async function createSessionFromPlan(
  plan: WorkoutPlan
): Promise<WorkoutSession> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Generate session ID
  const sessionId = generateId();

  // Map old exercise IDs to new session exercise IDs (for parent references)
  const exerciseIdMap = new Map<string, string>();

  // Build session structure
  const sessionExercises: SessionExercise[] = plan.exercises.map((plannedEx) => {
    const sessionExerciseId = generateId();
    exerciseIdMap.set(plannedEx.id, sessionExerciseId);

    return {
      id: sessionExerciseId,
      workoutSessionId: sessionId,
      exerciseName: plannedEx.exerciseName,
      orderIndex: plannedEx.orderIndex,
      notes: plannedEx.notes,
      equipmentType: plannedEx.equipmentType,
      groupType: plannedEx.groupType,
      groupName: plannedEx.groupName,
      parentExerciseId: undefined, // Will be set after all IDs are mapped
      sets: plannedEx.sets.map((plannedSet, setIndex) => ({
        id: generateId(),
        sessionExerciseId: sessionExerciseId,
        orderIndex: setIndex,
        // Copy target values from plan
        targetWeight: plannedSet.targetWeight,
        targetWeightUnit: plannedSet.targetWeightUnit,
        targetReps: plannedSet.targetReps,
        targetTime: plannedSet.targetTime,
        targetRpe: plannedSet.targetRpe,
        restSeconds: plannedSet.restSeconds,
        tempo: plannedSet.tempo,
        isDropset: plannedSet.isDropset,
        // Actual values start undefined
        status: 'pending' as const,
      })),
      status: 'pending' as const,
    };
  });

  // Now set parent exercise IDs using the map
  for (let i = 0; i < plan.exercises.length; i++) {
    const plannedEx = plan.exercises[i];
    if (plannedEx.parentExerciseId) {
      const newParentId = exerciseIdMap.get(plannedEx.parentExerciseId);
      if (newParentId) {
        sessionExercises[i].parentExerciseId = newParentId;
      }
    }
  }

  const session: WorkoutSession = {
    id: sessionId,
    workoutPlanId: plan.id,
    name: plan.name,
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
        session.workoutPlanId || null,
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

  const exercisesBySession = await batchLoadSessionExercisesWithSets([id]);
  return rowToWorkoutSession(sessionRow, exercisesBySession.get(id) || []);
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

  const exercisesBySession = await batchLoadSessionExercisesWithSets([sessionRow.id]);
  return rowToWorkoutSession(sessionRow, exercisesBySession.get(sessionRow.id) || []);
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
 * Update target values for a set (used when editing exercise)
 */
export async function updateSessionSetTarget(
  setId: string,
  updates: {
    targetWeight?: number | null;
    targetWeightUnit?: 'lbs' | 'kg' | null;
    targetReps?: number | null;
    targetTime?: number | null;
    targetRpe?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDatabase();

  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = [];
  const values: any[] = [];

  if ('targetWeight' in updates) {
    fields.push('target_weight = ?');
    values.push(updates.targetWeight ?? null);
  }
  if ('targetWeightUnit' in updates) {
    fields.push('target_weight_unit = ?');
    values.push(updates.targetWeightUnit || null);
  }
  if ('targetReps' in updates) {
    fields.push('target_reps = ?');
    values.push(updates.targetReps ?? null);
  }
  if ('targetTime' in updates) {
    fields.push('target_time = ?');
    values.push(updates.targetTime ?? null);
  }
  if ('targetRpe' in updates) {
    fields.push('target_rpe = ?');
    values.push(updates.targetRpe ?? null);
  }
  if ('restSeconds' in updates) {
    fields.push('rest_seconds = ?');
    values.push(updates.restSeconds ?? null);
  }
  if ('notes' in updates) {
    fields.push('notes = ?');
    values.push(updates.notes || null);
  }

  if (fields.length === 0) return; // No updates

  values.push(setId);
  await db.runAsync(
    `UPDATE session_sets SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Delete a set from an exercise
 */
export async function deleteSessionSet(setId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM session_sets WHERE id = ?', [setId]);
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
     SET status = ?, notes = ?, exercise_name = ?, equipment_type = ?
     WHERE id = ?`,
    [exercise.status, exercise.notes || null, exercise.exerciseName, exercise.equipmentType || null, exercise.id]
  );
}

/**
 * Insert a new exercise into an active workout session
 */
export async function insertSessionExercise(
  sessionId: string,
  exercise: Omit<SessionExercise, 'id' | 'workoutSessionId' | 'sets'>
): Promise<SessionExercise> {
  const db = await getDatabase();
  const exerciseId = generateId();

  await db.runAsync(
    `INSERT INTO session_exercises (
      id, workout_session_id, exercise_name, order_index, notes, equipment_type,
      group_type, group_name, parent_exercise_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exerciseId,
      sessionId,
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

  return {
    ...exercise,
    id: exerciseId,
    workoutSessionId: sessionId,
    sets: [],
  };
}

/**
 * Insert a new set into an existing exercise
 */
export async function insertSessionSet(
  exerciseId: string,
  set: Omit<SessionSet, 'id' | 'sessionExerciseId'>
): Promise<SessionSet> {
  const db = await getDatabase();
  const setId = generateId();

  await db.runAsync(
    `INSERT INTO session_sets (
      id, session_exercise_id, order_index, parent_set_id, drop_sequence,
      target_weight, target_weight_unit, target_reps, target_time, target_rpe,
      rest_seconds, actual_weight, actual_weight_unit, actual_reps, actual_time,
      actual_rpe, completed_at, status, notes, tempo, is_dropset, is_per_side
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      setId,
      exerciseId,
      set.orderIndex,
      set.parentSetId || null,
      set.dropSequence || null,
      set.targetWeight || null,
      set.targetWeightUnit || null,
      set.targetReps || null,
      set.targetTime || null,
      set.targetRpe || null,
      set.restSeconds || null,
      set.actualWeight || null,
      set.actualWeightUnit || null,
      set.actualReps || null,
      set.actualTime || null,
      set.actualRpe || null,
      set.completedAt || null,
      set.status,
      set.notes || null,
      set.tempo || null,
      set.isDropset ? 1 : 0,
      set.isPerSide ? 1 : 0,
    ]
  );

  return {
    ...set,
    id: setId,
    sessionExerciseId: exerciseId,
  };
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

  const sessionIds = sessionRows.map(r => r.id);
  const exercisesBySession = await batchLoadSessionExercisesWithSets(sessionIds);

  return sessionRows.map(row =>
    rowToWorkoutSession(row, exercisesBySession.get(row.id) || [])
  );
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

  const sessionIds = sessionRows.map(r => r.id);
  const exercisesBySession = await batchLoadSessionExercisesWithSets(sessionIds);

  return sessionRows.map(row =>
    rowToWorkoutSession(row, exercisesBySession.get(row.id) || [])
  );
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

/**
 * Get historical performance data for a specific exercise
 * Returns the last N completed sessions where this exercise was performed
 */
export async function getExerciseHistory(
  exerciseName: string,
  limit: number = 10
): Promise<Array<{
  sessionId: string;
  sessionDate: string;
  workoutName: string;
  sets: Array<{
    weight: number | null;
    reps: number | null;
    time: number | null;
    rpe: number | null;
    unit: string;
  }>;
}>> {
  const db = await getDatabase();

  // Get all completed sessions where this exercise was performed
  const rows = await db.getAllAsync<{
    session_id: string;
    session_date: string;
    workout_name: string;
    set_id: string;
    actual_weight: number | null;
    actual_reps: number | null;
    actual_time: number | null;
    actual_rpe: number | null;
    weight_unit: string;
    order_index: number;
  }>(`
    SELECT
      ws.id as session_id,
      ws.date as session_date,
      ws.name as workout_name,
      ss.id as set_id,
      ss.actual_weight,
      ss.actual_reps,
      ss.actual_time,
      ss.actual_rpe,
      COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as weight_unit,
      ss.order_index
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND se.exercise_name = ?
    ORDER BY ws.date DESC, ws.start_time DESC, ss.order_index ASC
  `, [exerciseName]);

  // Group sets by session
  const sessionMap = new Map<string, {
    sessionId: string;
    sessionDate: string;
    workoutName: string;
    sets: Array<{
      weight: number | null;
      reps: number | null;
      time: number | null;
      rpe: number | null;
      unit: string;
    }>;
  }>();

  for (const row of rows) {
    if (!sessionMap.has(row.session_id)) {
      sessionMap.set(row.session_id, {
        sessionId: row.session_id,
        sessionDate: row.session_date,
        workoutName: row.workout_name,
        sets: [],
      });
    }

    sessionMap.get(row.session_id)!.sets.push({
      weight: row.actual_weight,
      reps: row.actual_reps,
      time: row.actual_time,
      rpe: row.actual_rpe,
      unit: row.weight_unit,
    });
  }

  // Convert to array and limit
  return Array.from(sessionMap.values()).slice(0, limit);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Batch load all exercises and their sets for multiple sessions.
 * Uses 2 queries (exercises + sets) instead of N+1 per-exercise queries.
 */
async function batchLoadSessionExercisesWithSets(
  sessionIds: string[]
): Promise<Map<string, SessionExercise[]>> {
  const result = new Map<string, SessionExercise[]>();
  if (sessionIds.length === 0) return result;

  const db = await getDatabase();
  const placeholders = sessionIds.map(() => '?').join(',');

  const exerciseRows = await db.getAllAsync<SessionExerciseRow>(
    `SELECT * FROM session_exercises WHERE workout_session_id IN (${placeholders}) ORDER BY order_index`,
    sessionIds
  );

  const exerciseIds = exerciseRows.map(r => r.id);
  const setsByExercise = new Map<string, SessionSet[]>();

  if (exerciseIds.length > 0) {
    const setPlaceholders = exerciseIds.map(() => '?').join(',');
    const setRows = await db.getAllAsync<SessionSetRow>(
      `SELECT * FROM session_sets WHERE session_exercise_id IN (${setPlaceholders}) ORDER BY order_index`,
      exerciseIds
    );

    for (const setRow of setRows) {
      const eid = setRow.session_exercise_id;
      if (!setsByExercise.has(eid)) {
        setsByExercise.set(eid, []);
      }
      setsByExercise.get(eid)!.push(rowToSessionSet(setRow));
    }
  }

  for (const sessionId of sessionIds) {
    result.set(sessionId, []);
  }

  for (const exerciseRow of exerciseRows) {
    const sets = setsByExercise.get(exerciseRow.id) || [];
    result.get(exerciseRow.workout_session_id)!.push(
      rowToSessionExercise(exerciseRow, sets)
    );
  }

  return result;
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
    workoutPlanId: row.workout_template_id || undefined,
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
  // Sync functionality removed
}

/**
 * Hook called after updating a session
 */
async function afterUpdateSessionHook(session: WorkoutSession): Promise<void> {
  // Sync functionality removed
}

/**
 * Hook called after deleting a session
 */
async function afterDeleteSessionHook(sessionId: string): Promise<void> {
  // Sync functionality removed
}

// ============================================================================
// Legacy Function Aliases (for backward compatibility - will be removed)
// ============================================================================

/** @deprecated Use createSessionFromPlan instead */
export const createSessionFromTemplate = createSessionFromPlan;
