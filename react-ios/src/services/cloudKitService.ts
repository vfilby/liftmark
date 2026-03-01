import {
  initializeCloudKit,
  saveRecord,
  fetchRecord,
  fetchRecords,
  deleteRecord,
  getAccountStatus,
  type CloudKitRecord,
  type CloudKitResult
} from '../../modules/expo-cloudkit/src';
import { getDatabase } from '@/db';
import { getAllWorkoutPlans, createWorkoutPlan, updateWorkoutPlan, deleteWorkoutPlan } from '@/db/repository';
import { getWorkoutSessionById, deleteSession } from '@/db/sessionRepository';
import { generateId } from '@/utils/id';
import { logger } from '@/services/logger';
import type {
  WorkoutPlan,
  PlannedExercise,
  PlannedSet,
  WorkoutSession,
  SessionExercise,
  SessionSet,
  UserSettings,
  Gym,
  GymEquipment,
  WorkoutPlanRow,
  PlannedExerciseRow,
  PlannedSetRow,
  WorkoutSessionRow,
  SessionExerciseRow,
  SessionSetRow,
  GymRow,
  GymEquipmentRow,
  UserSettingsRow,
} from '@/types';

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
  timestamp: string;
}

export class CloudKitService {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    try {
      const result = await initializeCloudKit();
      if (result.success) {
        this.isInitialized = true;
        console.log('CloudKit initialized successfully');
        return true;
      } else {
        console.error('CloudKit initialization failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('CloudKit initialization error:', error);
      return false;
    }
  }

  async getAccountStatus(): Promise<string> {
    console.log('[CloudKitService] getAccountStatus called');
    try {
      console.log('[CloudKitService] Calling getAccountStatus() from module');
      const result = await getAccountStatus();
      console.log('[CloudKitService] Got result:', JSON.stringify(result));

      if (result.success) {
        console.log('[CloudKitService] Success, returning:', result.data);
        return result.data || 'unknown';
      } else {
        console.error('[CloudKitService] Failed to get account status:', result.error);
        // Return error status instead of throwing
        return 'error';
      }
    } catch (error) {
      console.error('[CloudKitService] Account status error caught:', error);
      console.error('[CloudKitService] Error type:', typeof error);
      console.error('[CloudKitService] Error stringified:', JSON.stringify(error, null, 2));

      // Handle specific simulator/development errors
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        console.log('[CloudKitService] Error message:', errorMessage);

        if (errorMessage.includes('simulator') || errorMessage.includes('development')) {
          console.log('[CloudKitService] Detected simulator error, returning noAccount');
          return 'noAccount'; // Treat simulator as no account available
        }
        if (errorMessage.includes('restricted') || errorMessage.includes('RESTRICTED')) {
          console.log('[CloudKitService] Detected restricted error');
          return 'restricted';
        }
      }
      // Never throw - always return a valid status
      console.log('[CloudKitService] Returning couldNotDetermine');
      return 'couldNotDetermine';
    }
  }

  async saveRecord(record: CloudKitRecord): Promise<CloudKitRecord | null> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }

    try {
      const result = await saveRecord(record);
      if (result.success) {
        return result.data || null;
      } else {
        console.error('Failed to save record:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Save record error:', error);
      return null;
    }
  }

  async fetchRecord(recordId: string, recordType: string): Promise<CloudKitRecord | null> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }

    try {
      const result = await fetchRecord(recordId, recordType);
      if (result.success) {
        return result.data || null;
      } else {
        console.error('Failed to fetch record:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Fetch record error:', error);
      return null;
    }
  }

  async fetchRecords(recordType: string): Promise<CloudKitRecord[]> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return [];
    }

    try {
      const result = await fetchRecords(recordType);
      if (result.success) {
        return result.data || [];
      } else {
        console.error('Failed to fetch records:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Fetch records error:', error);
      return [];
    }
  }

  async deleteRecord(recordId: string, recordType: string): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    try {
      const result = await deleteRecord(recordId, recordType);
      if (result.success) {
        return result.data || false;
      } else {
        console.error('Failed to delete record:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Delete record error:', error);
      return false;
    }
  }

  // ============================================================================
  // syncAll — Phase 1 full upload/download sync
  // ============================================================================

  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Check account status
      const status = await this.getAccountStatus();
      if (status !== 'available') {
        result.errors.push(`iCloud account not available (status: ${status})`);
        logger.warn('network', `[Sync] Aborted: account status is ${status}`);
        return result;
      }

      // 2. Ensure initialized
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          result.errors.push('Failed to initialize CloudKit');
          return result;
        }
      }

      // 3. Detect first sync
      const db = await getDatabase();
      const syncMeta = await db.getFirstAsync<{ last_sync_date: string | null }>(
        'SELECT last_sync_date FROM sync_metadata LIMIT 1'
      );
      const isFirstSync = !syncMeta || syncMeta.last_sync_date === null;

      logger.info('network', `[Sync] Starting sync (firstSync: ${isFirstSync})`);

      // 4. Upload all local entities in dependency order
      const uploadCount = await this.uploadAll(result);
      result.uploaded = uploadCount;

      // 5. Download all remote records and merge
      const downloadCount = await this.downloadAndMerge(result, isFirstSync);
      result.downloaded = downloadCount;

      // 6. Update last_sync_date
      const now = new Date().toISOString();
      if (syncMeta) {
        await db.runAsync('UPDATE sync_metadata SET last_sync_date = ?, updated_at = ?', [now, now]);
      } else {
        await db.runAsync(
          'INSERT INTO sync_metadata (id, device_id, last_sync_date, sync_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), 'react-native', now, 1, now, now]
        );
      }

      result.success = result.errors.length === 0;
      result.timestamp = now;
      logger.info('network', `[Sync] Complete: uploaded=${result.uploaded}, downloaded=${result.downloaded}, conflicts=${result.conflicts}, errors=${result.errors.length}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync failed: ${msg}`);
      logger.error('network', `[Sync] Fatal error: ${msg}`, error instanceof Error ? error : undefined);
    }

    return result;
  }

  // ============================================================================
  // Upload helpers
  // ============================================================================

  private async uploadAll(result: SyncResult): Promise<number> {
    let count = 0;
    const db = await getDatabase();

    // 1. Gyms
    count += await this.uploadEntities(
      db, 'SELECT * FROM gyms', 'Gym',
      (row: GymRow) => ({
        name: row.name,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
      (row: GymRow) => row.id,
      result
    );

    // 2. GymEquipment
    count += await this.uploadEntities(
      db, 'SELECT * FROM gym_equipment', 'GymEquipment',
      (row: GymEquipmentRow) => ({
        gymId: row.gym_id,
        name: row.name,
        isAvailable: row.is_available,
        lastCheckedAt: row.last_checked_at || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
      (row: GymEquipmentRow) => row.id,
      result
    );

    // 3. WorkoutPlans
    count += await this.uploadEntities(
      db, 'SELECT * FROM workout_templates', 'WorkoutPlan',
      (row: WorkoutPlanRow) => ({
        name: row.name,
        planDescription: row.description || '',
        tags: row.tags || '[]',
        defaultWeightUnit: row.default_weight_unit || '',
        sourceMarkdown: row.source_markdown || '',
        isFavorite: row.is_favorite,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
      (row: WorkoutPlanRow) => row.id,
      result
    );

    // 4. PlannedExercises
    count += await this.uploadEntities(
      db, 'SELECT * FROM template_exercises', 'PlannedExercise',
      (row: PlannedExerciseRow) => ({
        workoutPlanId: row.workout_template_id,
        exerciseName: row.exercise_name,
        orderIndex: row.order_index,
        notes: row.notes || '',
        equipmentType: row.equipment_type || '',
        groupType: row.group_type || '',
        groupName: row.group_name || '',
        parentExerciseId: row.parent_exercise_id || '',
      }),
      (row: PlannedExerciseRow) => row.id,
      result
    );

    // 5. PlannedSets
    count += await this.uploadEntities(
      db, 'SELECT * FROM template_sets', 'PlannedSet',
      (row: PlannedSetRow) => ({
        plannedExerciseId: row.template_exercise_id,
        orderIndex: row.order_index,
        targetWeight: row.target_weight ?? 0,
        targetWeightUnit: row.target_weight_unit || '',
        targetReps: row.target_reps ?? 0,
        targetTime: row.target_time ?? 0,
        targetRpe: row.target_rpe ?? 0,
        restSeconds: row.rest_seconds ?? 0,
        tempo: row.tempo || '',
        isDropset: row.is_dropset,
        isPerSide: row.is_per_side,
        isAmrap: row.is_amrap,
        notes: row.notes || '',
      }),
      (row: PlannedSetRow) => row.id,
      result
    );

    // 6. WorkoutSessions
    count += await this.uploadEntities(
      db, 'SELECT * FROM workout_sessions', 'WorkoutSession',
      (row: WorkoutSessionRow) => ({
        workoutPlanId: row.workout_template_id || '',
        name: row.name,
        date: row.date,
        startTime: row.start_time || '',
        endTime: row.end_time || '',
        duration: row.duration ?? 0,
        notes: row.notes || '',
        status: row.status,
      }),
      (row: WorkoutSessionRow) => row.id,
      result
    );

    // 7. SessionExercises
    count += await this.uploadEntities(
      db, 'SELECT * FROM session_exercises', 'SessionExercise',
      (row: SessionExerciseRow) => ({
        workoutSessionId: row.workout_session_id,
        exerciseName: row.exercise_name,
        orderIndex: row.order_index,
        notes: row.notes || '',
        equipmentType: row.equipment_type || '',
        groupType: row.group_type || '',
        groupName: row.group_name || '',
        parentExerciseId: row.parent_exercise_id || '',
        status: row.status,
      }),
      (row: SessionExerciseRow) => row.id,
      result
    );

    // 8. SessionSets
    count += await this.uploadEntities(
      db, 'SELECT * FROM session_sets', 'SessionSet',
      (row: SessionSetRow) => ({
        sessionExerciseId: row.session_exercise_id,
        orderIndex: row.order_index,
        parentSetId: row.parent_set_id || '',
        dropSequence: row.drop_sequence ?? 0,
        targetWeight: row.target_weight ?? 0,
        targetWeightUnit: row.target_weight_unit || '',
        targetReps: row.target_reps ?? 0,
        targetTime: row.target_time ?? 0,
        targetRpe: row.target_rpe ?? 0,
        restSeconds: row.rest_seconds ?? 0,
        actualWeight: row.actual_weight ?? 0,
        actualWeightUnit: row.actual_weight_unit || '',
        actualReps: row.actual_reps ?? 0,
        actualTime: row.actual_time ?? 0,
        actualRpe: row.actual_rpe ?? 0,
        completedAt: row.completed_at || '',
        status: row.status,
        notes: row.notes || '',
        tempo: row.tempo || '',
        isDropset: row.is_dropset,
        isPerSide: row.is_per_side,
      }),
      (row: SessionSetRow) => row.id,
      result
    );

    // 9. UserSettings (singleton)
    try {
      const settingsRow = await db.getFirstAsync<UserSettingsRow>(
        'SELECT * FROM user_settings LIMIT 1'
      );
      if (settingsRow) {
        const saved = await this.saveRecord({
          id: 'user-settings',
          recordType: 'UserSettings',
          data: {
            defaultWeightUnit: settingsRow.default_weight_unit,
            enableWorkoutTimer: settingsRow.enable_workout_timer,
            autoStartRestTimer: settingsRow.auto_start_rest_timer,
            theme: settingsRow.theme,
            notificationsEnabled: settingsRow.notifications_enabled,
            customPromptAddition: settingsRow.custom_prompt_addition || '',
            healthKitEnabled: settingsRow.healthkit_enabled,
            liveActivitiesEnabled: settingsRow.live_activities_enabled,
            keepScreenAwake: settingsRow.keep_screen_awake,
            showOpenInClaudeButton: settingsRow.show_open_in_claude_button,
            homeTiles: settingsRow.home_tiles || '[]',
            updatedAt: settingsRow.updated_at,
          },
        });
        if (saved) count++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Upload UserSettings failed: ${msg}`);
    }

    return count;
  }

  private async uploadEntities<T>(
    db: Awaited<ReturnType<typeof getDatabase>>,
    query: string,
    recordType: string,
    toFields: (row: T) => Record<string, any>,
    getId: (row: T) => string,
    result: SyncResult
  ): Promise<number> {
    let count = 0;
    try {
      const rows = await db.getAllAsync<T>(query);
      for (const row of rows) {
        try {
          const saved = await this.saveRecord({
            id: getId(row),
            recordType,
            data: toFields(row),
          });
          if (saved) count++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Upload ${recordType} ${getId(row)} failed: ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Upload ${recordType} query failed: ${msg}`);
    }
    return count;
  }

  // ============================================================================
  // Download & merge helpers
  // ============================================================================

  private async downloadAndMerge(result: SyncResult, isFirstSync: boolean): Promise<number> {
    let count = 0;
    const db = await getDatabase();

    // Process each record type in dependency order
    count += await this.mergeGyms(db, result, isFirstSync);
    count += await this.mergeGymEquipment(db, result, isFirstSync);
    count += await this.mergeWorkoutPlans(db, result, isFirstSync);
    count += await this.mergePlannedExercises(db, result, isFirstSync);
    count += await this.mergePlannedSets(db, result, isFirstSync);
    count += await this.mergeWorkoutSessions(db, result, isFirstSync);
    count += await this.mergeSessionExercises(db, result, isFirstSync);
    count += await this.mergeSessionSets(db, result, isFirstSync);
    count += await this.mergeUserSettings(db, result);

    return count;
  }

  private async mergeGyms(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('Gym');
      const localRows = await db.getAllAsync<GymRow>('SELECT * FROM gyms');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);
        const remoteUpdatedAt = record.data.updatedAt as string;

        if (!local) {
          // Remote-only: insert locally
          await db.runAsync(
            'INSERT INTO gyms (id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            [id, record.data.name, record.data.isDefault ?? 0, record.data.createdAt, remoteUpdatedAt]
          );
          count++;
        } else if (remoteUpdatedAt > local.updated_at) {
          // Remote is newer: overwrite local
          await db.runAsync(
            'UPDATE gyms SET name = ?, is_default = ?, updated_at = ? WHERE id = ?',
            [record.data.name, record.data.isDefault ?? 0, remoteUpdatedAt, id]
          );
          count++;
          result.conflicts++;
        }
      }

      // Handle deletes (only if not first sync)
      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM gym_equipment WHERE gym_id = ?', [local.id]);
            await db.runAsync('DELETE FROM gyms WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge Gym failed: ${msg}`);
    }
    return count;
  }

  private async mergeGymEquipment(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('GymEquipment');
      const localRows = await db.getAllAsync<GymEquipmentRow>('SELECT * FROM gym_equipment');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);
        const remoteUpdatedAt = record.data.updatedAt as string;

        if (!local) {
          await db.runAsync(
            'INSERT INTO gym_equipment (id, gym_id, name, is_available, last_checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, record.data.gymId, record.data.name, record.data.isAvailable ?? 1, record.data.lastCheckedAt || null, record.data.createdAt, remoteUpdatedAt]
          );
          count++;
        } else if (remoteUpdatedAt > local.updated_at) {
          await db.runAsync(
            'UPDATE gym_equipment SET gym_id = ?, name = ?, is_available = ?, last_checked_at = ?, updated_at = ? WHERE id = ?',
            [record.data.gymId, record.data.name, record.data.isAvailable ?? 1, record.data.lastCheckedAt || null, remoteUpdatedAt, id]
          );
          count++;
          result.conflicts++;
        }
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM gym_equipment WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge GymEquipment failed: ${msg}`);
    }
    return count;
  }

  private async mergeWorkoutPlans(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('WorkoutPlan');
      const localRows = await db.getAllAsync<WorkoutPlanRow>('SELECT * FROM workout_templates');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);
        const remoteUpdatedAt = record.data.updatedAt as string;

        if (!local) {
          await db.runAsync(
            'INSERT INTO workout_templates (id, name, description, tags, default_weight_unit, source_markdown, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, record.data.name, record.data.planDescription || null, record.data.tags || '[]', record.data.defaultWeightUnit || null, record.data.sourceMarkdown || null, record.data.isFavorite ?? 0, record.data.createdAt, remoteUpdatedAt]
          );
          count++;
        } else if (remoteUpdatedAt > local.updated_at) {
          await db.runAsync(
            'UPDATE workout_templates SET name = ?, description = ?, tags = ?, default_weight_unit = ?, source_markdown = ?, is_favorite = ?, updated_at = ? WHERE id = ?',
            [record.data.name, record.data.planDescription || null, record.data.tags || '[]', record.data.defaultWeightUnit || null, record.data.sourceMarkdown || null, record.data.isFavorite ?? 0, remoteUpdatedAt, id]
          );
          count++;
          result.conflicts++;
        }
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge WorkoutPlan failed: ${msg}`);
    }
    return count;
  }

  private async mergePlannedExercises(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('PlannedExercise');
      const localRows = await db.getAllAsync<PlannedExerciseRow>('SELECT * FROM template_exercises');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);

        if (!local) {
          await db.runAsync(
            'INSERT INTO template_exercises (id, workout_template_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, record.data.workoutPlanId, record.data.exerciseName, record.data.orderIndex, record.data.notes || null, record.data.equipmentType || null, record.data.groupType || null, record.data.groupName || null, record.data.parentExerciseId || null]
          );
          count++;
        }
        // PlannedExercises don't have updatedAt; they are replaced atomically with their parent plan
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM template_exercises WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge PlannedExercise failed: ${msg}`);
    }
    return count;
  }

  private async mergePlannedSets(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('PlannedSet');
      const localRows = await db.getAllAsync<PlannedSetRow>('SELECT * FROM template_sets');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);

        if (!local) {
          await db.runAsync(
            'INSERT INTO template_sets (id, template_exercise_id, order_index, target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds, tempo, is_dropset, is_per_side) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, record.data.plannedExerciseId, record.data.orderIndex, record.data.targetWeight || null, record.data.targetWeightUnit || null, record.data.targetReps || null, record.data.targetTime || null, record.data.targetRpe || null, record.data.restSeconds || null, record.data.tempo || null, record.data.isDropset ?? 0, record.data.isPerSide ?? 0]
          );
          count++;
        }
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM template_sets WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge PlannedSet failed: ${msg}`);
    }
    return count;
  }

  private async mergeWorkoutSessions(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('WorkoutSession');
      const localRows = await db.getAllAsync<WorkoutSessionRow>('SELECT * FROM workout_sessions');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);

        if (!local) {
          await db.runAsync(
            'INSERT INTO workout_sessions (id, workout_template_id, name, date, start_time, end_time, duration, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, record.data.workoutPlanId || null, record.data.name, record.data.date, record.data.startTime || null, record.data.endTime || null, record.data.duration ?? null, record.data.notes || null, record.data.status]
          );
          count++;
        }
        // Sessions use startTime/endTime but no updatedAt — treat as immutable once completed
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge WorkoutSession failed: ${msg}`);
    }
    return count;
  }

  private async mergeSessionExercises(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('SessionExercise');
      const localRows = await db.getAllAsync<SessionExerciseRow>('SELECT * FROM session_exercises');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);

        if (!local) {
          await db.runAsync(
            'INSERT INTO session_exercises (id, workout_session_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, record.data.workoutSessionId, record.data.exerciseName, record.data.orderIndex, record.data.notes || null, record.data.equipmentType || null, record.data.groupType || null, record.data.groupName || null, record.data.parentExerciseId || null, record.data.status]
          );
          count++;
        }
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM session_exercises WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge SessionExercise failed: ${msg}`);
    }
    return count;
  }

  private async mergeSessionSets(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult,
    isFirstSync: boolean
  ): Promise<number> {
    let count = 0;
    try {
      const remoteRecords = await this.fetchRecords('SessionSet');
      const localRows = await db.getAllAsync<SessionSetRow>('SELECT * FROM session_sets');
      const localById = new Map(localRows.map(r => [r.id, r]));
      const remoteIds = new Set<string>();

      for (const record of remoteRecords) {
        const id = record.id!;
        remoteIds.add(id);
        const local = localById.get(id);

        if (!local) {
          await db.runAsync(
            `INSERT INTO session_sets (id, session_exercise_id, order_index, parent_set_id, drop_sequence,
              target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds,
              actual_weight, actual_weight_unit, actual_reps, actual_time, actual_rpe,
              completed_at, status, notes, tempo, is_dropset, is_per_side) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, record.data.sessionExerciseId, record.data.orderIndex, record.data.parentSetId || null, record.data.dropSequence ?? null,
              record.data.targetWeight || null, record.data.targetWeightUnit || null, record.data.targetReps || null, record.data.targetTime || null, record.data.targetRpe || null, record.data.restSeconds || null,
              record.data.actualWeight || null, record.data.actualWeightUnit || null, record.data.actualReps || null, record.data.actualTime || null, record.data.actualRpe || null,
              record.data.completedAt || null, record.data.status, record.data.notes || null, record.data.tempo || null, record.data.isDropset ?? 0, record.data.isPerSide ?? 0]
          );
          count++;
        }
      }

      if (!isFirstSync) {
        for (const local of localRows) {
          if (!remoteIds.has(local.id)) {
            await db.runAsync('DELETE FROM session_sets WHERE id = ?', [local.id]);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge SessionSet failed: ${msg}`);
    }
    return count;
  }

  private async mergeUserSettings(
    db: Awaited<ReturnType<typeof getDatabase>>,
    result: SyncResult
  ): Promise<number> {
    try {
      const remoteRecord = await this.fetchRecord('user-settings', 'UserSettings');
      if (!remoteRecord) return 0;

      const localRow = await db.getFirstAsync<UserSettingsRow>(
        'SELECT * FROM user_settings LIMIT 1'
      );

      if (!localRow) {
        // No local settings — insert from remote
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer,
            theme, notifications_enabled, custom_prompt_addition, healthkit_enabled, live_activities_enabled,
            keep_screen_awake, show_open_in_claude_button, home_tiles, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), remoteRecord.data.defaultWeightUnit || 'lbs', remoteRecord.data.enableWorkoutTimer ?? 1, remoteRecord.data.autoStartRestTimer ?? 1,
            remoteRecord.data.theme || 'auto', remoteRecord.data.notificationsEnabled ?? 1, remoteRecord.data.customPromptAddition || null,
            remoteRecord.data.healthKitEnabled ?? 0, remoteRecord.data.liveActivitiesEnabled ?? 1,
            remoteRecord.data.keepScreenAwake ?? 1, remoteRecord.data.showOpenInClaudeButton ?? 0,
            remoteRecord.data.homeTiles || null, now, remoteRecord.data.updatedAt || now]
        );
        return 1;
      }

      const remoteUpdatedAt = remoteRecord.data.updatedAt as string;
      if (remoteUpdatedAt && remoteUpdatedAt > localRow.updated_at) {
        // Remote is newer — overwrite local (except anthropicApiKey which is never synced)
        await db.runAsync(
          `UPDATE user_settings SET default_weight_unit = ?, enable_workout_timer = ?, auto_start_rest_timer = ?,
            theme = ?, notifications_enabled = ?, custom_prompt_addition = ?,
            healthkit_enabled = ?, live_activities_enabled = ?, keep_screen_awake = ?,
            show_open_in_claude_button = ?, home_tiles = ?, updated_at = ?
           WHERE id = ?`,
          [remoteRecord.data.defaultWeightUnit || 'lbs', remoteRecord.data.enableWorkoutTimer ?? 1, remoteRecord.data.autoStartRestTimer ?? 1,
            remoteRecord.data.theme || 'auto', remoteRecord.data.notificationsEnabled ?? 1, remoteRecord.data.customPromptAddition || null,
            remoteRecord.data.healthKitEnabled ?? 0, remoteRecord.data.liveActivitiesEnabled ?? 1,
            remoteRecord.data.keepScreenAwake ?? 1, remoteRecord.data.showOpenInClaudeButton ?? 0,
            remoteRecord.data.homeTiles || null, remoteUpdatedAt, localRow.id]
        );
        result.conflicts++;
        return 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Merge UserSettings failed: ${msg}`);
    }
    return 0;
  }
}

// Export a singleton instance
export const cloudKitService = new CloudKitService();