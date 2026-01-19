/**
 * Sync Metadata Repository
 * Manages sync state, tokens, and metadata persistence
 */

import { getDatabase } from './index';

export interface SyncMetadata {
  id: string;
  deviceId: string;
  lastSyncDate: string | null;
  serverChangeToken: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'WorkoutTemplate' | 'WorkoutSession';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string; // JSON serialized entity
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: string;
  remoteData: string;
  resolution: 'local' | 'remote' | 'pending';
  resolvedAt: string | null;
  createdAt: string;
}

// MARK: - Sync Metadata Operations

/**
 * Get sync metadata (creates default if not exists)
 */
export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = await getDatabase();

  let metadata = await db.getFirstAsync<SyncMetadata>(
    'SELECT * FROM sync_metadata LIMIT 1'
  );

  if (!metadata) {
    // Create default metadata
    const { generateId } = await import('@/utils/id');
    const deviceId = generateId(); // Unique device ID
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sync_metadata (id, device_id, last_sync_date, server_change_token, sync_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), deviceId, null, null, 0, now, now]
    );

    metadata = await db.getFirstAsync<SyncMetadata>(
      'SELECT * FROM sync_metadata LIMIT 1'
    );
  }

  return metadata!;
}

/**
 * Update sync metadata
 */
export async function updateSyncMetadata(updates: {
  lastSyncDate?: string;
  serverChangeToken?: string;
  syncEnabled?: boolean;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.lastSyncDate !== undefined) {
    fields.push('last_sync_date = ?');
    values.push(updates.lastSyncDate);
  }

  if (updates.serverChangeToken !== undefined) {
    fields.push('server_change_token = ?');
    values.push(updates.serverChangeToken);
  }

  if (updates.syncEnabled !== undefined) {
    fields.push('sync_enabled = ?');
    values.push(updates.syncEnabled ? 1 : 0);
  }

  fields.push('updated_at = ?');
  values.push(now);

  await db.runAsync(
    `UPDATE sync_metadata SET ${fields.join(', ')} WHERE id = (SELECT id FROM sync_metadata LIMIT 1)`,
    values
  );
}

/**
 * Enable or disable sync
 */
export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await updateSyncMetadata({ syncEnabled: enabled });
}

/**
 * Update last sync date and token
 */
export async function updateLastSync(serverChangeToken: string): Promise<void> {
  const now = new Date().toISOString();
  await updateSyncMetadata({
    lastSyncDate: now,
    serverChangeToken,
  });
}

// MARK: - Sync Queue Operations

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(
  entityType: 'WorkoutTemplate' | 'WorkoutSession',
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  payload: any
): Promise<void> {
  const db = await getDatabase();
  const { generateId } = await import('@/utils/id');
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, attempts, last_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      entityType,
      entityId,
      operation,
      JSON.stringify(payload),
      0,
      null,
      now,
    ]
  );
}

/**
 * Get all pending sync queue items
 */
export async function getPendingSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue ORDER BY created_at ASC`
  );

  return rows;
}

/**
 * Get pending count
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue'
  );

  return result?.count ?? 0;
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(queueItemId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [queueItemId]);
}

/**
 * Update sync queue item attempt
 */
export async function incrementSyncAttempt(queueItemId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE sync_queue SET attempts = attempts + 1, last_attempt_at = ? WHERE id = ?',
    [now, queueItemId]
  );
}

/**
 * Clear entire sync queue (use with caution)
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue');
}

// MARK: - Sync Conflict Operations

/**
 * Log a sync conflict for debugging
 */
export async function logSyncConflict(
  entityType: string,
  entityId: string,
  localData: any,
  remoteData: any,
  resolution: 'local' | 'remote'
): Promise<void> {
  const db = await getDatabase();
  const { generateId } = await import('@/utils/id');
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_conflicts (id, entity_type, entity_id, local_data, remote_data, resolution, resolved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      entityType,
      entityId,
      JSON.stringify(localData),
      JSON.stringify(remoteData),
      resolution,
      now,
      now,
    ]
  );
}

/**
 * Get all sync conflicts (for debugging)
 */
export async function getAllSyncConflicts(): Promise<SyncConflict[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<SyncConflict>(
    'SELECT * FROM sync_conflicts ORDER BY created_at DESC LIMIT 100'
  );

  return rows;
}

/**
 * Clear old sync conflicts (keep last 30 days)
 */
export async function clearOldSyncConflicts(): Promise<void> {
  const db = await getDatabase();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await db.runAsync('DELETE FROM sync_conflicts WHERE created_at < ?', [
    thirtyDaysAgo.toISOString(),
  ]);
}
