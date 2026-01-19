/**
 * CloudKit Service - Lazy-loading wrapper for CloudKit native module
 * Provides type-safe interface for CloudKit operations
 */

import type {
  CloudKitAccountStatus,
  CloudKitInitializeResult,
  CloudKitRecord,
  CloudKitQueryResult,
  CloudKitFetchChangesResult,
  CloudKitRecordInput,
} from '../../modules/expo-cloudkit/src';

// Lazy-load the CloudKit module
let cloudKitModule: typeof import('../../modules/expo-cloudkit/src') | null = null;

async function getCloudKitModule() {
  if (!cloudKitModule) {
    cloudKitModule = await import('../../modules/expo-cloudkit/src');
  }
  return cloudKitModule;
}

// MARK: - Service Interface

/**
 * Initialize CloudKit and check iCloud availability
 * @returns Account status and availability
 */
export async function initializeCloudKit(): Promise<CloudKitInitializeResult | null> {
  try {
    const module = await getCloudKitModule();
    return await module.initialize();
  } catch (error) {
    console.error('Failed to initialize CloudKit:', error);
    return null;
  }
}

/**
 * Check if CloudKit is available and user is signed in
 * @returns true if CloudKit is available
 */
export async function isCloudKitAvailable(): Promise<boolean> {
  const result = await initializeCloudKit();
  return result?.isAvailable ?? false;
}

/**
 * Save a record to CloudKit
 * @param recordType CloudKit record type
 * @param fields Record fields
 * @param recordName Optional record name (UUID from SQLite)
 * @returns Saved record or null on error
 */
export async function saveCloudKitRecord(
  recordType: string,
  fields: Record<string, any>,
  recordName?: string
): Promise<CloudKitRecord | null> {
  try {
    const module = await getCloudKitModule();
    return await module.saveRecord(recordType, fields, recordName);
  } catch (error) {
    console.error('Failed to save CloudKit record:', error);
    return null;
  }
}

/**
 * Fetch a single record by recordName
 * @param recordName CloudKit record name (UUID)
 * @returns Record or null if not found
 */
export async function fetchCloudKitRecord(recordName: string): Promise<CloudKitRecord | null> {
  try {
    const module = await getCloudKitModule();
    return await module.fetchRecord(recordName);
  } catch (error) {
    console.error('Failed to fetch CloudKit record:', error);
    return null;
  }
}

/**
 * Query records with optional predicate and limit
 * @param recordType CloudKit record type
 * @param predicate NSPredicate format string
 * @param limit Maximum records to fetch
 * @returns Query results or null on error
 */
export async function queryCloudKitRecords(
  recordType: string,
  predicate?: string,
  limit?: number
): Promise<CloudKitQueryResult | null> {
  try {
    const module = await getCloudKitModule();
    return await module.queryRecords(recordType, predicate, limit);
  } catch (error) {
    console.error('Failed to query CloudKit records:', error);
    return null;
  }
}

/**
 * Delete a record from CloudKit
 * @param recordName CloudKit record name (UUID)
 * @returns true on success, false on error
 */
export async function deleteCloudKitRecord(recordName: string): Promise<boolean> {
  try {
    const module = await getCloudKitModule();
    const result = await module.deleteRecord(recordName);
    return result ?? false;
  } catch (error) {
    console.error('Failed to delete CloudKit record:', error);
    return false;
  }
}

/**
 * Fetch changes since last sync (incremental sync)
 * @param serverChangeToken Token from previous sync
 * @returns Changed/deleted records and new token
 */
export async function fetchCloudKitChanges(
  serverChangeToken?: string
): Promise<CloudKitFetchChangesResult | null> {
  try {
    const module = await getCloudKitModule();
    return await module.fetchChanges(serverChangeToken);
  } catch (error) {
    console.error('Failed to fetch CloudKit changes:', error);
    return null;
  }
}

/**
 * Batch save multiple records (up to 400 per batch)
 * @param records Array of records to save
 * @returns Saved records or empty array on error
 */
export async function batchSaveCloudKitRecords(
  records: CloudKitRecordInput[]
): Promise<CloudKitRecord[]> {
  try {
    // CloudKit supports max 400 records per batch
    const MAX_BATCH_SIZE = 400;
    const batches: CloudKitRecordInput[][] = [];

    for (let i = 0; i < records.length; i += MAX_BATCH_SIZE) {
      batches.push(records.slice(i, i + MAX_BATCH_SIZE));
    }

    const module = await getCloudKitModule();
    const allResults: CloudKitRecord[] = [];

    for (const batch of batches) {
      const result = await module.batchSaveRecords(batch);
      if (result) {
        allResults.push(...result);
      }
    }

    return allResults;
  } catch (error) {
    console.error('Failed to batch save CloudKit records:', error);
    return [];
  }
}

// MARK: - Helper Functions

/**
 * Convert a date to ISO string for CloudKit
 * @param date Date object
 * @returns ISO string
 */
export function dateToCloudKitString(date: Date): string {
  return date.toISOString();
}

/**
 * Convert CloudKit date string to Date object
 * @param dateString ISO string or timestamp
 * @returns Date object
 */
export function cloudKitStringToDate(dateString: string | number): Date {
  if (typeof dateString === 'number') {
    return new Date(dateString);
  }
  return new Date(dateString);
}

/**
 * Convert boolean to CloudKit integer (0 or 1)
 * @param value Boolean value
 * @returns 1 for true, 0 for false
 */
export function booleanToCloudKitInt(value: boolean): number {
  return value ? 1 : 0;
}

/**
 * Convert CloudKit integer to boolean
 * @param value Integer (0 or 1)
 * @returns Boolean
 */
export function cloudKitIntToBoolean(value: number): boolean {
  return value === 1;
}
