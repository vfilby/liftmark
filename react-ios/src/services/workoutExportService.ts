import { Paths, File } from 'expo-file-system';
import Constants from 'expo-constants';
import { getCompletedSessions } from '@/db/sessionRepository';
import { getAllWorkoutPlans } from '@/db/repository';
import { getDatabase } from '@/db/index';
import type { WorkoutSession, WorkoutPlan, PlannedExercise, PlannedSet, SessionExercise, SessionSet, GymRow, UserSettingsRow } from '@/types';

/**
 * Export completed workout sessions as a portable JSON file.
 * Strips internal IDs to produce a clean, shareable format.
 * Returns the file URI for sharing.
 */
export async function exportSessionsAsJson(): Promise<string> {
  const sessions = await getCompletedSessions();

  if (sessions.length === 0) {
    throw new ExportError('No completed workouts to export.');
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || '1.0.0',
    sessions: sessions.map(stripSession),
  };

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '_');
  const fileName = `liftmark_workouts_${timestamp}.json`;
  const exportFile = new File(Paths.cache, fileName);

  exportFile.write(JSON.stringify(exportData, null, 2));

  return exportFile.uri;
}

/**
 * Export a single workout session as a portable JSON file.
 * Returns the file URI for sharing.
 */
export async function exportSingleSessionAsJson(session: WorkoutSession): Promise<string> {
  const exportData = {
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || '1.0.0',
    session: stripSession(session),
  };

  const fileName = buildSessionFileName(session.name, session.date);
  const exportFile = new File(Paths.cache, fileName);

  exportFile.write(JSON.stringify(exportData, null, 2));

  return exportFile.uri;
}

/**
 * Build a sanitized file name: workout-{name}-{date}.json
 */
export function buildSessionFileName(name: string, date: string): string {
  const sanitized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // strip diacritics
    .replace(/[^\w\s-]/g, '')            // remove non-alphanumeric (except spaces/hyphens)
    .replace(/\s+/g, '-')               // spaces to hyphens
    .replace(/-+/g, '-')                // collapse multiple hyphens
    .replace(/^-|-$/g, '')              // trim leading/trailing hyphens
    .slice(0, 50);

  const datePart = date.split('T')[0] || new Date().toISOString().split('T')[0];
  const namePart = sanitized || 'workout';

  return `workout-${namePart}-${datePart}.json`;
}

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Export all app data as a unified JSON file for backup/transfer.
 * Includes plans, sessions, gyms, and safe settings (no API keys).
 * Returns the file URI for sharing.
 */
export async function exportUnifiedJson(): Promise<string> {
  const plans = await getAllWorkoutPlans();
  const sessions = await getCompletedSessions();
  const db = await getDatabase();

  // Read gyms
  const gymRows = await db.getAllAsync<GymRow>('SELECT * FROM gyms');
  const gyms = gymRows.map(row => {
    const gym: Record<string, unknown> = {
      name: row.name,
      isDefault: row.is_default === 1,
    };
    if (row.created_at) gym.createdAt = row.created_at;
    return gym;
  });

  // Read settings (exclude sensitive data like API keys)
  const settingsRow = await db.getFirstAsync<UserSettingsRow>(
    'SELECT * FROM user_settings LIMIT 1'
  );
  const settings: Record<string, unknown> = {};
  if (settingsRow) {
    settings.defaultWeightUnit = settingsRow.default_weight_unit;
    settings.enableWorkoutTimer = settingsRow.enable_workout_timer === 1;
    settings.autoStartRestTimer = settingsRow.auto_start_rest_timer === 1;
    settings.theme = settingsRow.theme;
    settings.keepScreenAwake = settingsRow.keep_screen_awake === 1;
    if (settingsRow.custom_prompt_addition) {
      settings.customPromptAddition = settingsRow.custom_prompt_addition;
    }
  }

  const exportData = {
    formatVersion: '1.0',
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || '1.0.0',
    plans: plans.map(stripPlan),
    sessions: sessions.map(stripSession),
    gyms,
    settings,
  };

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '_');
  const fileName = `liftmark_export_${timestamp}.json`;
  const exportFile = new File(Paths.cache, fileName);

  exportFile.write(JSON.stringify(exportData, null, 2));

  return exportFile.uri;
}

function stripPlan(plan: WorkoutPlan) {
  const result: Record<string, unknown> = {
    name: plan.name,
    exercises: plan.exercises
      .filter(e => e.sets.length > 0 || e.groupType != null)
      .map(stripPlannedExercise),
  };
  if (plan.description) result.description = plan.description;
  if (plan.tags.length > 0) result.tags = plan.tags;
  if (plan.defaultWeightUnit) result.defaultWeightUnit = plan.defaultWeightUnit;
  if (plan.sourceMarkdown) result.sourceMarkdown = plan.sourceMarkdown;
  result.isFavorite = plan.isFavorite ?? false;
  return result;
}

function stripPlannedExercise(exercise: PlannedExercise) {
  const result: Record<string, unknown> = {
    exerciseName: exercise.exerciseName,
    orderIndex: exercise.orderIndex,
    sets: exercise.sets.map(stripPlannedSet),
  };
  if (exercise.notes) result.notes = exercise.notes;
  if (exercise.equipmentType) result.equipmentType = exercise.equipmentType;
  if (exercise.groupType) result.groupType = exercise.groupType;
  if (exercise.groupName) result.groupName = exercise.groupName;
  return result;
}

function stripPlannedSet(set: PlannedSet) {
  const result: Record<string, unknown> = {
    orderIndex: set.orderIndex,
    isDropset: set.isDropset ?? false,
    isPerSide: set.isPerSide ?? false,
  };
  if (set.targetWeight != null) result.targetWeight = set.targetWeight;
  if (set.targetWeightUnit) result.targetWeightUnit = set.targetWeightUnit;
  if (set.targetReps != null) result.targetReps = set.targetReps;
  if (set.targetTime != null) result.targetTime = set.targetTime;
  if (set.targetRpe != null) result.targetRpe = set.targetRpe;
  if (set.restSeconds != null) result.restSeconds = set.restSeconds;
  if (set.tempo) result.tempo = set.tempo;
  if (set.notes) result.notes = set.notes;
  return result;
}

function stripSession(session: WorkoutSession) {
  return {
    name: session.name,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    notes: session.notes,
    status: session.status,
    exercises: session.exercises.map(stripExercise),
  };
}

function stripExercise(exercise: SessionExercise) {
  return {
    exerciseName: exercise.exerciseName,
    orderIndex: exercise.orderIndex,
    notes: exercise.notes,
    equipmentType: exercise.equipmentType,
    groupType: exercise.groupType,
    groupName: exercise.groupName,
    status: exercise.status,
    sets: exercise.sets.map(stripSet),
  };
}

function stripSet(set: SessionSet) {
  return {
    orderIndex: set.orderIndex,
    targetWeight: set.targetWeight,
    targetWeightUnit: set.targetWeightUnit,
    targetReps: set.targetReps,
    targetTime: set.targetTime,
    targetRpe: set.targetRpe,
    restSeconds: set.restSeconds,
    actualWeight: set.actualWeight,
    actualWeightUnit: set.actualWeightUnit,
    actualReps: set.actualReps,
    actualTime: set.actualTime,
    actualRpe: set.actualRpe,
    completedAt: set.completedAt,
    status: set.status,
    notes: set.notes,
    tempo: set.tempo,
    isDropset: set.isDropset,
    isPerSide: set.isPerSide,
  };
}
