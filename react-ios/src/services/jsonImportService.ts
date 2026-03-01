import { getDatabase } from '@/db/index';
import { generateId } from '@/utils/id';

export class JsonImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonImportError';
  }
}

export interface ImportResult {
  plansImported: number;
  plansSkipped: number;
  sessionsImported: number;
  sessionsSkipped: number;
  gymsImported: number;
  gymsSkipped: number;
}

export function importResultSummary(result: ImportResult): string {
  const parts: string[] = [];
  if (result.plansImported > 0) parts.push(`${result.plansImported} plans imported`);
  if (result.plansSkipped > 0) parts.push(`${result.plansSkipped} plans skipped (duplicates)`);
  if (result.sessionsImported > 0) parts.push(`${result.sessionsImported} sessions imported`);
  if (result.sessionsSkipped > 0) parts.push(`${result.sessionsSkipped} sessions skipped (duplicates)`);
  if (result.gymsImported > 0) parts.push(`${result.gymsImported} gyms imported`);
  if (result.gymsSkipped > 0) parts.push(`${result.gymsSkipped} gyms skipped (duplicates)`);
  return parts.length === 0 ? 'No data to import.' : parts.join('\n');
}

/**
 * Preview what a unified JSON import contains without importing.
 */
export function previewUnifiedJson(jsonString: string): {
  planCount: number;
  sessionCount: number;
  gymCount: number;
  hasSettings: boolean;
} {
  const json = parseJsonString(jsonString);
  const plans = Array.isArray(json.plans) ? json.plans : [];
  const sessions = Array.isArray(json.sessions) ? json.sessions : [];
  const singleSession = json.session && typeof json.session === 'object' ? 1 : 0;
  const gyms = Array.isArray(json.gyms) ? json.gyms : [];
  const hasSettings = json.settings != null && typeof json.settings === 'object'
    && Object.keys(json.settings as Record<string, unknown>).length > 0;

  return {
    planCount: plans.length,
    sessionCount: sessions.length + singleSession,
    gymCount: gyms.length,
    hasSettings,
  };
}

/**
 * Validate and import a unified JSON string.
 * Uses merge semantics: skips duplicates by name+date for sessions, name for plans, name for gyms.
 */
export async function importUnifiedJson(jsonString: string): Promise<ImportResult> {
  const json = parseJsonString(jsonString);

  // Check format version if present
  if (json.formatVersion && json.formatVersion !== '1.0') {
    throw new JsonImportError(`Unsupported format version: ${json.formatVersion}`);
  }

  const result: ImportResult = {
    plansImported: 0,
    plansSkipped: 0,
    sessionsImported: 0,
    sessionsSkipped: 0,
    gymsImported: 0,
    gymsSkipped: 0,
  };

  const db = await getDatabase();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Import plans
    if (Array.isArray(json.plans)) {
      for (const planData of json.plans) {
        await importPlan(planData as Record<string, unknown>, result);
      }
    }

    // Import sessions (array format)
    if (Array.isArray(json.sessions)) {
      for (const sessionData of json.sessions) {
        await importSession(sessionData as Record<string, unknown>, result);
      }
    }

    // Also handle single session format (from single-session exports)
    if (json.session && typeof json.session === 'object' && !Array.isArray(json.session)) {
      await importSession(json.session as Record<string, unknown>, result);
    }

    // Import gyms
    if (Array.isArray(json.gyms)) {
      for (const gymData of json.gyms) {
        await importGym(gymData as Record<string, unknown>, result);
      }
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  return result;
}

// ============================================================================
// Private Helpers
// ============================================================================

function parseJsonString(jsonString: string): Record<string, unknown> {
  let json: unknown;
  try {
    json = JSON.parse(jsonString);
  } catch {
    throw new JsonImportError('File is not valid JSON.');
  }

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new JsonImportError('File is not a valid JSON object.');
  }

  const obj = json as Record<string, unknown>;

  // Must have at least one data section
  if (!obj.plans && !obj.sessions && !obj.session) {
    throw new JsonImportError('File does not contain any importable data (no plans, sessions, or session found).');
  }

  return obj;
}

async function importPlan(
  data: Record<string, unknown>,
  result: ImportResult
): Promise<void> {
  const name = data.name as string | undefined;
  if (!name) return;

  const db = await getDatabase();

  // Check for duplicate by name
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workout_templates WHERE name = ?',
    [name]
  );
  if (existing && existing.count > 0) {
    result.plansSkipped += 1;
    return;
  }

  const planId = generateId();
  const now = new Date().toISOString();
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const tagsJson = JSON.stringify(tags);

  await db.runAsync(
    `INSERT INTO workout_templates (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planId,
      name,
      (data.description as string) || null,
      tagsJson,
      (data.defaultWeightUnit as string) || null,
      (data.sourceMarkdown as string) || null,
      now,
      now,
      data.isFavorite === true ? 1 : 0,
    ]
  );

  // Import exercises
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  for (const exerciseData of exercises) {
    const ex = exerciseData as Record<string, unknown>;
    const exerciseId = generateId();

    await db.runAsync(
      `INSERT INTO template_exercises (id, workout_template_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exerciseId,
        planId,
        (ex.exerciseName as string) || 'Unknown',
        (ex.orderIndex as number) ?? 0,
        (ex.notes as string) || null,
        (ex.equipmentType as string) || null,
        (ex.groupType as string) || null,
        (ex.groupName as string) || null,
        null, // parent_exercise_id
      ]
    );

    // Import sets — note: template_sets lacks is_amrap and notes columns
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    for (const setData of sets) {
      const s = setData as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO template_sets (id, template_exercise_id, order_index, target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds, tempo, is_dropset, is_per_side)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          exerciseId,
          (s.orderIndex as number) ?? 0,
          (s.targetWeight as number) ?? null,
          (s.targetWeightUnit as string) || null,
          (s.targetReps as number) ?? null,
          (s.targetTime as number) ?? null,
          (s.targetRpe as number) ?? null,
          (s.restSeconds as number) ?? null,
          (s.tempo as string) || null,
          s.isDropset === true ? 1 : 0,
          s.isPerSide === true ? 1 : 0,
        ]
      );
    }
  }

  result.plansImported += 1;
}

async function importSession(
  data: Record<string, unknown>,
  result: ImportResult
): Promise<void> {
  const name = data.name as string | undefined;
  const date = data.date as string | undefined;
  if (!name || !date) return;

  const db = await getDatabase();

  // Check for duplicate by name + date
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workout_sessions WHERE name = ? AND date = ?',
    [name, date]
  );
  if (existing && existing.count > 0) {
    result.sessionsSkipped += 1;
    return;
  }

  const sessionId = generateId();

  await db.runAsync(
    `INSERT INTO workout_sessions (id, workout_template_id, name, date, start_time, end_time, duration, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      null, // no template association
      name,
      date,
      (data.startTime as string) || null,
      (data.endTime as string) || null,
      (data.duration as number) ?? null,
      (data.notes as string) || null,
      (data.status as string) || 'completed',
    ]
  );

  // Import exercises
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  for (const exerciseData of exercises) {
    const ex = exerciseData as Record<string, unknown>;
    const exerciseId = generateId();

    await db.runAsync(
      `INSERT INTO session_exercises (id, workout_session_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exerciseId,
        sessionId,
        (ex.exerciseName as string) || 'Unknown',
        (ex.orderIndex as number) ?? 0,
        (ex.notes as string) || null,
        (ex.equipmentType as string) || null,
        (ex.groupType as string) || null,
        (ex.groupName as string) || null,
        null, // parent_exercise_id
        (ex.status as string) || 'completed',
      ]
    );

    // Import sets
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    for (const setData of sets) {
      const s = setData as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO session_sets (id, session_exercise_id, order_index, parent_set_id, drop_sequence,
         target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds,
         actual_weight, actual_weight_unit, actual_reps, actual_time, actual_rpe,
         completed_at, status, notes, tempo, is_dropset, is_per_side)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          exerciseId,
          (s.orderIndex as number) ?? 0,
          null, // parent_set_id
          null, // drop_sequence
          (s.targetWeight as number) ?? null,
          (s.targetWeightUnit as string) || null,
          (s.targetReps as number) ?? null,
          (s.targetTime as number) ?? null,
          (s.targetRpe as number) ?? null,
          (s.restSeconds as number) ?? null,
          (s.actualWeight as number) ?? null,
          (s.actualWeightUnit as string) || null,
          (s.actualReps as number) ?? null,
          (s.actualTime as number) ?? null,
          (s.actualRpe as number) ?? null,
          (s.completedAt as string) || null,
          (s.status as string) || 'completed',
          (s.notes as string) || null,
          (s.tempo as string) || null,
          s.isDropset === true ? 1 : 0,
          s.isPerSide === true ? 1 : 0,
        ]
      );
    }
  }

  result.sessionsImported += 1;
}

async function importGym(
  data: Record<string, unknown>,
  result: ImportResult
): Promise<void> {
  const name = data.name as string | undefined;
  if (!name) return;

  const db = await getDatabase();

  // Check for duplicate by name
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM gyms WHERE name = ?',
    [name]
  );
  if (existing && existing.count > 0) {
    result.gymsSkipped += 1;
    return;
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO gyms (id, name, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      generateId(),
      name,
      0, // Not default
      now,
      now,
    ]
  );

  result.gymsImported += 1;
}
