import { getDatabase } from './index';
import type {
  ExerciseHistoryPoint,
  ExerciseSessionData,
  ExerciseProgressMetrics,
} from '@/types';

/**
 * Repository for exercise history and analytics
 * Provides aggregated data for charting and progress tracking
 */

/**
 * Get chronological exercise history for charting
 * Returns one data point per completed workout session
 * Grouped and aggregated by workout session
 */
export async function getExerciseHistory(
  exerciseName: string,
  limit: number = 10
): Promise<ExerciseHistoryPoint[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    date: string;
    start_time: string | null;
    workout_name: string;
    max_weight: number | null;
    avg_reps: number | null;
    total_volume: number | null;
    sets_count: number;
    avg_time: number | null;
    max_time: number | null;
    unit: string;
  }>(`
    SELECT
      ws.date,
      ws.start_time,
      ws.name as workout_name,
      MAX(ss.actual_weight) as max_weight,
      AVG(ss.actual_reps) as avg_reps,
      SUM(ss.actual_weight * ss.actual_reps) as total_volume,
      COUNT(ss.id) as sets_count,
      AVG(ss.actual_time) as avg_time,
      MAX(ss.actual_time) as max_time,
      COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND se.exercise_name = ?
    GROUP BY ws.id, ws.date
    ORDER BY ws.date DESC
    LIMIT ?
  `, [exerciseName, limit]);

  return rows
    .reverse() // Return oldest to newest for charting
    .map(row => ({
      date: row.date,
      startTime: row.start_time || undefined,
      workoutName: row.workout_name,
      maxWeight: row.max_weight ?? 0,
      avgReps: Math.round((row.avg_reps ?? 0) * 10) / 10, // Round to 1 decimal - fixed operator precedence
      totalVolume: Math.round(row.total_volume ?? 0),
      setsCount: row.sets_count,
      avgTime: Math.round(row.avg_time ?? 0),
      maxTime: Math.round(row.max_time ?? 0),
      unit: (row.unit as 'lbs' | 'kg') || 'lbs',
    }));
}

/**
 * Get detailed session-by-session history for bottom sheet
 * Returns full set-level data for each session
 */
export async function getExerciseSessionHistory(
  exerciseName: string,
  limit: number = 30
): Promise<ExerciseSessionData[]> {
  const db = await getDatabase();

  // First, get all sessions for this exercise
  const sessionRows = await db.getAllAsync<{
    session_id: string;
    workout_name: string;
    date: string;
    start_time: string | null;
  }>(`
    SELECT DISTINCT
      ws.id as session_id,
      ws.name as workout_name,
      ws.date,
      ws.start_time
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    WHERE ws.status = 'completed'
      AND se.exercise_name = ?
    ORDER BY ws.date DESC, ws.start_time DESC
    LIMIT ?
  `, [exerciseName, limit]);

  const sessions: ExerciseSessionData[] = [];

  for (const sessionRow of sessionRows) {
    // Get all sets for this exercise in this session
    const setRows = await db.getAllAsync<{
      order_index: number;
      target_weight: number | null;
      target_reps: number | null;
      actual_weight: number | null;
      actual_reps: number | null;
      actual_weight_unit: string | null;
      notes: string | null;
    }>(`
      SELECT
        ss.order_index,
        ss.target_weight,
        ss.target_reps,
        ss.actual_weight,
        ss.actual_reps,
        ss.actual_weight_unit,
        ss.notes
      FROM session_sets ss
      JOIN session_exercises se ON ss.session_exercise_id = se.id
      WHERE se.workout_session_id = ?
        AND se.exercise_name = ?
        AND ss.status = 'completed'
      ORDER BY ss.order_index
    `, [sessionRow.session_id, exerciseName]);

    sessions.push({
      sessionId: sessionRow.session_id,
      workoutName: sessionRow.workout_name,
      date: sessionRow.date,
      startTime: sessionRow.start_time || undefined,
      sets: setRows.map(row => ({
        setIndex: row.order_index,
        targetWeight: row.target_weight ?? undefined,
        targetReps: row.target_reps ?? undefined,
        actualWeight: row.actual_weight ?? undefined,
        actualReps: row.actual_reps ?? undefined,
        actualWeightUnit: (row.actual_weight_unit as 'lbs' | 'kg') || undefined,
        notes: row.notes || undefined,
      })),
    });
  }

  return sessions;
}

/**
 * Get aggregated progress metrics for an exercise
 * Computes comprehensive statistics for progress analysis
 */
export async function getExerciseProgressMetrics(
  exerciseName: string
): Promise<ExerciseProgressMetrics | null> {
  const db = await getDatabase();

  // Get overall statistics
  const statsRow = await db.getFirstAsync<{
    total_sessions: number;
    total_volume: number;
    max_weight: number;
    unit: string;
    first_date: string;
    last_date: string;
  }>(`
    SELECT
      COUNT(DISTINCT ws.id) as total_sessions,
      SUM(ss.actual_weight * ss.actual_reps) as total_volume,
      MAX(ss.actual_weight) as max_weight,
      COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit,
      MIN(ws.date) as first_date,
      MAX(ws.date) as last_date
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND se.exercise_name = ?
      AND ss.actual_weight IS NOT NULL
  `, [exerciseName]);

  if (!statsRow || statsRow.total_sessions === 0) {
    return null;
  }

  // Get average weight and reps per set
  const avgRow = await db.getFirstAsync<{
    avg_weight: number;
    avg_reps: number;
  }>(`
    SELECT
      AVG(ss.actual_weight) as avg_weight,
      AVG(ss.actual_reps) as avg_reps
    FROM session_sets ss
    JOIN session_exercises se ON ss.session_exercise_id = se.id
    JOIN workout_sessions ws ON se.workout_session_id = ws.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND se.exercise_name = ?
      AND ss.actual_weight IS NOT NULL
  `, [exerciseName]);

  // Calculate trend from last 5 sessions
  const recentRows = await db.getAllAsync<{
    total_weight: number;
  }>(`
    SELECT
      SUM(ss.actual_weight) as total_weight
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND se.exercise_name = ?
      AND ss.actual_weight IS NOT NULL
    GROUP BY ws.id
    ORDER BY ws.date DESC, ws.start_time DESC
    LIMIT 5
  `, [exerciseName]);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentRows.length >= 2) {
    const recent = recentRows[0]?.total_weight ?? 0;
    const older = recentRows[recentRows.length - 1]?.total_weight ?? 0;

    if (recent > older * 1.05) {
      trend = 'improving';
    } else if (recent < older * 0.95) {
      trend = 'declining';
    }
  }

  return {
    exerciseName,
    totalSessions: statsRow.total_sessions,
    totalVolume: Math.round(statsRow.total_volume ?? 0),
    maxWeight: Math.round(statsRow.max_weight ?? 0 * 100) / 100,
    maxWeightUnit: (statsRow.unit as 'lbs' | 'kg') || 'lbs',
    avgWeightPerSession: Math.round(
      ((statsRow.total_volume ?? 0) / (statsRow.total_sessions * 1)) * 100
    ) / 100,
    avgRepsPerSet: Math.round((avgRow?.avg_reps ?? 0) * 10) / 10,
    firstSessionDate: statsRow.first_date,
    lastSessionDate: statsRow.last_date,
    trend,
  };
}

/**
 * Get exercise statistics across all completed sessions
 * Used for dashboard overview
 */
export async function getExerciseStats(exerciseName: string): Promise<{
  count: number;
  lastDate: string | null;
  maxWeight: number | null;
  unit: string;
} | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    count: number;
    last_date: string | null;
    max_weight: number | null;
    unit: string;
  }>(`
    SELECT
      COUNT(DISTINCT ws.id) as count,
      MAX(ws.date) as last_date,
      MAX(ss.actual_weight) as max_weight,
      COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    WHERE ws.status = 'completed'
      AND ss.status = 'completed'
      AND se.exercise_name = ?
  `, [exerciseName]);

  if (!row || row.count === 0) {
    return null;
  }

  return {
    count: row.count,
    lastDate: row.last_date,
    maxWeight: row.max_weight,
    unit: row.unit,
  };
}

/**
 * Get all exercises that have been performed
 * Useful for exercise selection in history views
 */
export async function getAllExercisesWithHistory(): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ exercise_name: string }>(`
    SELECT DISTINCT se.exercise_name
    FROM session_exercises se
    JOIN workout_sessions ws ON se.workout_session_id = ws.id
    WHERE ws.status = 'completed'
    ORDER BY se.exercise_name
  `);

  return rows.map(row => row.exercise_name);
}
