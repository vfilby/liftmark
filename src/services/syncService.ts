/**
 * Sync Service - Core CloudKit synchronization logic
 * Handles push/pull sync, conflict resolution, and sync orchestration
 */

import type { WorkoutTemplate, WorkoutSession } from '@/types';
import { useSyncStore } from '@/stores/syncStore';
import {
  getSyncMetadata,
  updateLastSync,
  getPendingSyncQueue,
  removeFromSyncQueue,
  incrementSyncAttempt,
  logSyncConflict,
  addToSyncQueue,
  getPendingSyncCount,
} from '@/db/syncMetadataRepository';
import {
  isCloudKitAvailable,
  saveCloudKitRecord,
  fetchCloudKitChanges,
  queryCloudKitRecords,
  deleteCloudKitRecord,
  batchSaveCloudKitRecords,
} from './cloudKitService';
import {
  getWorkoutTemplateById,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
} from '@/db/repository';
import { getDatabase } from '@/db';

// MARK: - Types

interface SyncResult {
  success: boolean;
  error?: string;
  pushedCount?: number;
  pulledCount?: number;
  conflictsResolved?: number;
}

// MARK: - Debounce Timer

let syncDebounceTimer: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

// MARK: - Main Sync Functions

/**
 * Full sync cycle: push then pull
 */
export async function performFullSync(): Promise<SyncResult> {
  const store = useSyncStore.getState();

  // Check if sync is enabled
  const metadata = await getSyncMetadata();
  if (!metadata.sync_enabled) {
    return { success: false, error: 'Sync is not enabled' };
  }

  // Check if CloudKit is available
  const available = await isCloudKitAvailable();
  if (!available) {
    store.setSyncStatus('offline');
    return { success: false, error: 'CloudKit is not available' };
  }

  store.setSyncing(true);

  try {
    // Push local changes first
    const pushResult = await pushChanges();
    if (!pushResult.success) {
      throw new Error(pushResult.error || 'Failed to push changes');
    }

    // Then pull remote changes
    const pullResult = await pullChanges();
    if (!pullResult.success) {
      throw new Error(pullResult.error || 'Failed to pull changes');
    }

    // Update UI state
    store.setLastSyncDate(new Date());
    store.setPendingChanges(0);
    store.setSyncing(false);

    return {
      success: true,
      pushedCount: pushResult.pushedCount,
      pulledCount: pullResult.pulledCount,
      conflictsResolved: pullResult.conflictsResolved,
    };
  } catch (error) {
    console.error('Full sync failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    store.setSyncError(errorMessage);
    store.setSyncing(false);

    return { success: false, error: errorMessage };
  }
}

/**
 * Push local changes to CloudKit
 */
export async function pushChanges(): Promise<SyncResult> {
  try {
    const queueItems = await getPendingSyncQueue();

    if (queueItems.length === 0) {
      return { success: true, pushedCount: 0 };
    }

    let successCount = 0;

    for (const item of queueItems) {
      try {
        const payload = JSON.parse(item.payload);

        switch (item.operation) {
          case 'create':
          case 'update':
            await syncEntityToCloudKit(item.entity_type, payload);
            successCount++;
            break;

          case 'delete':
            const deleted = await deleteCloudKitRecord(item.entity_id);
            if (deleted) successCount++;
            break;
        }

        // Remove from queue on success
        await removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(`Failed to sync queue item ${item.id}:`, error);

        // Increment attempt count
        await incrementSyncAttempt(item.id);

        // If too many attempts, log and remove
        if (item.attempts >= 5) {
          console.error(`Max attempts reached for queue item ${item.id}, removing`);
          await removeFromSyncQueue(item.id);
        }
      }
    }

    return { success: true, pushedCount: successCount };
  } catch (error) {
    console.error('Push changes failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Pull changes from CloudKit
 */
export async function pullChanges(): Promise<SyncResult> {
  try {
    const metadata = await getSyncMetadata();
    const result = await fetchCloudKitChanges(metadata.server_change_token || undefined);

    if (!result) {
      return { success: false, error: 'Failed to fetch changes from CloudKit' };
    }

    let pulledCount = 0;
    let conflictsResolved = 0;

    // Process changed records
    for (const record of result.changedRecords) {
      try {
        const resolved = await processRemoteRecord(record);
        if (resolved) conflictsResolved++;
        pulledCount++;
      } catch (error) {
        console.error(`Failed to process record ${record.recordName}:`, error);
      }
    }

    // Process deleted records
    for (const recordName of result.deletedRecordIDs) {
      try {
        await processRemoteDelete(recordName);
        pulledCount++;
      } catch (error) {
        console.error(`Failed to process deleted record ${recordName}:`, error);
      }
    }

    // Update sync token
    if (result.serverChangeToken) {
      await updateLastSync(result.serverChangeToken);
    }

    return { success: true, pulledCount, conflictsResolved };
  } catch (error) {
    console.error('Pull changes failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Pull failed',
    };
  }
}

/**
 * Schedule a debounced sync (called after local changes)
 */
export function scheduleDebouncedSync(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(() => {
    performFullSync();
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Cancel scheduled sync
 */
export function cancelDebouncedSync(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
}

// MARK: - Helper Functions

/**
 * Sync a local entity to CloudKit
 */
async function syncEntityToCloudKit(
  entityType: 'WorkoutTemplate' | 'WorkoutSession',
  entity: any
): Promise<void> {
  if (entityType === 'WorkoutTemplate') {
    await syncWorkoutTemplateToCloudKit(entity);
  } else if (entityType === 'WorkoutSession') {
    await syncWorkoutSessionToCloudKit(entity);
  }
}

/**
 * Sync workout template to CloudKit (template + exercises + sets)
 */
async function syncWorkoutTemplateToCloudKit(template: WorkoutTemplate): Promise<void> {
  // Save template record
  await saveCloudKitRecord(
    'WorkoutTemplate',
    {
      name: template.name,
      description: template.description || '',
      tags: JSON.stringify(template.tags),
      defaultWeightUnit: template.defaultWeightUnit || 'lbs',
      sourceMarkdown: template.sourceMarkdown || '',
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
    template.id
  );

  // Save exercises
  for (const exercise of template.exercises) {
    await saveCloudKitRecord(
      'TemplateExercise',
      {
        workoutTemplateId: exercise.workoutTemplateId,
        exerciseName: exercise.exerciseName,
        orderIndex: exercise.orderIndex,
        notes: exercise.notes || '',
        equipmentType: exercise.equipmentType || '',
        groupType: exercise.groupType || '',
        groupName: exercise.groupName || '',
        parentExerciseId: exercise.parentExerciseId || '',
      },
      exercise.id
    );

    // Save sets
    for (const set of exercise.sets) {
      await saveCloudKitRecord(
        'TemplateSet',
        {
          templateExerciseId: set.templateExerciseId,
          orderIndex: set.orderIndex,
          targetWeight: set.targetWeight ?? 0,
          targetWeightUnit: set.targetWeightUnit || 'lbs',
          targetReps: set.targetReps ?? 0,
          targetTime: set.targetTime ?? 0,
          targetRpe: set.targetRpe ?? 0,
          restSeconds: set.restSeconds ?? 0,
          tempo: set.tempo || '',
          isDropset: set.isDropset ? 1 : 0,
          isPerSide: set.isPerSide ? 1 : 0,
        },
        set.id
      );
    }
  }
}

/**
 * Sync workout session to CloudKit (session + exercises + sets)
 */
async function syncWorkoutSessionToCloudKit(session: WorkoutSession): Promise<void> {
  // Save session record
  await saveCloudKitRecord(
    'WorkoutSession',
    {
      workoutTemplateId: session.workoutTemplateId || '',
      name: session.name,
      date: session.date,
      startTime: session.startTime || '',
      endTime: session.endTime || '',
      duration: session.duration ?? 0,
      notes: session.notes || '',
      status: session.status,
    },
    session.id
  );

  // Save exercises and sets (similar to templates)
  for (const exercise of session.exercises) {
    await saveCloudKitRecord(
      'SessionExercise',
      {
        workoutSessionId: exercise.workoutSessionId,
        exerciseName: exercise.exerciseName,
        orderIndex: exercise.orderIndex,
        notes: exercise.notes || '',
        equipmentType: exercise.equipmentType || '',
        groupType: exercise.groupType || '',
        groupName: exercise.groupName || '',
        parentExerciseId: exercise.parentExerciseId || '',
        status: exercise.status,
      },
      exercise.id
    );

    for (const set of exercise.sets) {
      await saveCloudKitRecord(
        'SessionSet',
        {
          sessionExerciseId: set.sessionExerciseId,
          orderIndex: set.orderIndex,
          parentSetId: set.parentSetId || '',
          dropSequence: set.dropSequence ?? 0,
          targetWeight: set.targetWeight ?? 0,
          targetWeightUnit: set.targetWeightUnit || 'lbs',
          targetReps: set.targetReps ?? 0,
          targetTime: set.targetTime ?? 0,
          targetRpe: set.targetRpe ?? 0,
          restSeconds: set.restSeconds ?? 0,
          actualWeight: set.actualWeight ?? 0,
          actualWeightUnit: set.actualWeightUnit || 'lbs',
          actualReps: set.actualReps ?? 0,
          actualTime: set.actualTime ?? 0,
          actualRpe: set.actualRpe ?? 0,
          completedAt: set.completedAt || '',
          status: set.status,
          notes: set.notes || '',
          tempo: set.tempo || '',
          isDropset: set.isDropset ? 1 : 0,
          isPerSide: set.isPerSide ? 1 : 0,
        },
        set.id
      );
    }
  }
}

/**
 * Process a remote CloudKit record (with conflict resolution)
 */
async function processRemoteRecord(record: any): Promise<boolean> {
  const recordType = record.recordType;
  const recordName = record.recordName;
  const fields = record.fields;

  // Only process main entity types (templates and sessions)
  if (recordType !== 'WorkoutTemplate' && recordType !== 'WorkoutSession') {
    return false;
  }

  try {
    // Get local version
    const db = await getDatabase();
    let localRecord: any = null;

    if (recordType === 'WorkoutTemplate') {
      localRecord = await getWorkoutTemplateById(recordName);
    } else if (recordType === 'WorkoutSession') {
      localRecord = await db.getFirstAsync(
        'SELECT * FROM workout_sessions WHERE id = ?',
        [recordName]
      );
    }

    // If no local record, just import remote
    if (!localRecord) {
      await importRemoteRecord(recordType, recordName, fields);
      return false;
    }

    // Conflict resolution: compare updatedAt timestamps
    const localUpdatedAt = new Date(localRecord.updatedAt || localRecord.updated_at);
    const remoteUpdatedAt = new Date(fields.updatedAt);

    const timeDiffSeconds = Math.abs(
      (remoteUpdatedAt.getTime() - localUpdatedAt.getTime()) / 1000
    );

    // If difference is > 5 seconds, choose latest
    if (timeDiffSeconds > 5) {
      if (remoteUpdatedAt > localUpdatedAt) {
        // Remote is newer, update local
        await logSyncConflict(recordType, recordName, localRecord, fields, 'remote');
        await importRemoteRecord(recordType, recordName, fields);
        return true;
      }
      // Local is newer, keep local (already synced by push)
      return false;
    }

    // Within 5 seconds: use device ID tiebreaker
    const metadata = await getSyncMetadata();
    const localDeviceId = metadata.device_id;
    const remoteDeviceId = fields.deviceId || '';

    if (remoteDeviceId > localDeviceId) {
      await logSyncConflict(recordType, recordName, localRecord, fields, 'remote');
      await importRemoteRecord(recordType, recordName, fields);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to process remote record:', error);
    return false;
  }
}

/**
 * Import a remote record into local database
 */
async function importRemoteRecord(
  recordType: string,
  recordName: string,
  fields: any
): Promise<void> {
  if (recordType === 'WorkoutTemplate') {
    // Fetch full template with exercises from CloudKit
    const result = await queryCloudKitRecords('TemplateExercise', `workoutTemplateId == "${recordName}"`);

    const template: WorkoutTemplate = {
      id: recordName,
      name: fields.name,
      description: fields.description || undefined,
      tags: fields.tags ? JSON.parse(fields.tags) : [],
      defaultWeightUnit: fields.defaultWeightUnit as 'lbs' | 'kg',
      sourceMarkdown: fields.sourceMarkdown || undefined,
      createdAt: fields.createdAt,
      updatedAt: fields.updatedAt,
      exercises: [],
    };

    // Load exercises and sets
    if (result?.records) {
      for (const exerciseRecord of result.records) {
        const setsResult = await queryCloudKitRecords(
          'TemplateSet',
          `templateExerciseId == "${exerciseRecord.recordName}"`
        );

        const sets = setsResult?.records.map((setRecord) => ({
          id: setRecord.recordName,
          templateExerciseId: setRecord.fields.templateExerciseId,
          orderIndex: setRecord.fields.orderIndex,
          targetWeight: setRecord.fields.targetWeight || undefined,
          targetWeightUnit: setRecord.fields.targetWeightUnit as 'lbs' | 'kg',
          targetReps: setRecord.fields.targetReps || undefined,
          targetTime: setRecord.fields.targetTime || undefined,
          targetRpe: setRecord.fields.targetRpe || undefined,
          restSeconds: setRecord.fields.restSeconds || undefined,
          tempo: setRecord.fields.tempo || undefined,
          isDropset: setRecord.fields.isDropset === 1,
          isPerSide: setRecord.fields.isPerSide === 1,
        })) || [];

        template.exercises.push({
          id: exerciseRecord.recordName,
          workoutTemplateId: exerciseRecord.fields.workoutTemplateId,
          exerciseName: exerciseRecord.fields.exerciseName,
          orderIndex: exerciseRecord.fields.orderIndex,
          notes: exerciseRecord.fields.notes || undefined,
          equipmentType: exerciseRecord.fields.equipmentType || undefined,
          groupType: exerciseRecord.fields.groupType as 'superset' | 'section' | undefined,
          groupName: exerciseRecord.fields.groupName || undefined,
          parentExerciseId: exerciseRecord.fields.parentExerciseId || undefined,
          sets,
        });
      }
    }

    // Update or create template in local DB
    const existing = await getWorkoutTemplateById(template.id);
    if (existing) {
      await updateWorkoutTemplate(template);
    } else {
      await createWorkoutTemplate(template);
    }
  }

  // Similar logic for WorkoutSession...
}

/**
 * Process a remote delete
 */
async function processRemoteDelete(recordName: string): Promise<void> {
  try {
    // Try to delete from local DB
    await deleteWorkoutTemplate(recordName);
  } catch (error) {
    console.error(`Failed to delete local record ${recordName}:`, error);
  }
}

// MARK: - Public Sync Triggers

/**
 * Trigger sync after local change (debounced)
 */
export function triggerSyncAfterChange(): void {
  const store = useSyncStore.getState();
  const metadata = getSyncMetadata();

  metadata.then((m) => {
    if (m.sync_enabled) {
      scheduleDebouncedSync();

      // Update pending count
      getPendingSyncCount().then((count) => {
        store.setPendingChanges(count);
      });
    }
  });
}
