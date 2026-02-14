import { Paths, File } from 'expo-file-system';
import Constants from 'expo-constants';
import { getCompletedSessions } from '@/db/sessionRepository';
import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

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

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
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
