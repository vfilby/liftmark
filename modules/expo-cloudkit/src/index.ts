import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// Import the native module
const ExpoCloudKitModule = requireNativeModule('ExpoCloudKit');

// MARK: - Types

export type CloudKitAccountStatus =
  | 'available'
  | 'noAccount'
  | 'restricted'
  | 'couldNotDetermine'
  | 'temporarilyUnavailable'
  | 'unknown';

export interface CloudKitInitializeResult {
  status: CloudKitAccountStatus;
  isAvailable: boolean;
}

export interface CloudKitRecord {
  recordName: string;
  recordType: string;
  fields: Record<string, any>;
  modificationDate?: number;
}

export interface CloudKitQueryResult {
  records: CloudKitRecord[];
  hasMore: boolean;
}

export interface CloudKitFetchChangesResult {
  changedRecords: CloudKitRecord[];
  deletedRecordIDs: string[];
  serverChangeToken?: string;
}

export interface CloudKitRecordInput {
  recordType: string;
  recordName?: string;
  fields: Record<string, any>;
}

// MARK: - Helper Functions

function assertIOS(functionName: string): boolean {
  if (Platform.OS !== 'ios') {
    console.warn(`${functionName} is only available on iOS`);
    return false;
  }
  return true;
}

// MARK: - Module Functions

/**
 * Initialize CloudKit and check iCloud account status
 * @returns Promise with account status and availability
 */
export async function initialize(): Promise<CloudKitInitializeResult | null> {
  if (!assertIOS('initialize')) return null;
  return await ExpoCloudKitModule.initialize();
}

/**
 * Save a record to CloudKit (create or update)
 * @param recordType The CloudKit record type (e.g., 'WorkoutTemplate')
 * @param fields Record fields as key-value pairs
 * @param recordName Optional record name (UUID from SQLite). If not provided, CloudKit generates one
 * @returns Promise with the saved record
 */
export async function saveRecord(
  recordType: string,
  fields: Record<string, any>,
  recordName?: string
): Promise<CloudKitRecord | null> {
  if (!assertIOS('saveRecord')) return null;
  return await ExpoCloudKitModule.saveRecord(recordType, fields, recordName || null);
}

/**
 * Fetch a single record by recordName
 * @param recordName The CloudKit record name (UUID)
 * @returns Promise with the record or null if not found
 */
export async function fetchRecord(recordName: string): Promise<CloudKitRecord | null> {
  if (!assertIOS('fetchRecord')) return null;
  try {
    return await ExpoCloudKitModule.fetchRecord(recordName);
  } catch (error) {
    console.error('Failed to fetch record:', error);
    return null;
  }
}

/**
 * Query records with optional predicate and limit
 * @param recordType The CloudKit record type
 * @param predicate Optional NSPredicate format string (e.g., 'isDeleted == 0')
 * @param limit Optional maximum number of records to fetch
 * @returns Promise with query results
 */
export async function queryRecords(
  recordType: string,
  predicate?: string,
  limit?: number
): Promise<CloudKitQueryResult | null> {
  if (!assertIOS('queryRecords')) return null;
  return await ExpoCloudKitModule.queryRecords(recordType, predicate || null, limit || null);
}

/**
 * Delete a record from CloudKit
 * @param recordName The CloudKit record name (UUID)
 * @returns Promise with success boolean
 */
export async function deleteRecord(recordName: string): Promise<boolean | null> {
  if (!assertIOS('deleteRecord')) return null;
  try {
    return await ExpoCloudKitModule.deleteRecord(recordName);
  } catch (error) {
    console.error('Failed to delete record:', error);
    return false;
  }
}

/**
 * Fetch changes since last sync (incremental sync)
 * @param serverChangeToken Optional token from previous sync
 * @returns Promise with changed/deleted records and new token
 */
export async function fetchChanges(
  serverChangeToken?: string
): Promise<CloudKitFetchChangesResult | null> {
  if (!assertIOS('fetchChanges')) return null;
  return await ExpoCloudKitModule.fetchChanges(serverChangeToken || null);
}

/**
 * Batch save multiple records (up to 400 per batch)
 * @param records Array of records to save
 * @returns Promise with saved records
 */
export async function batchSaveRecords(
  records: CloudKitRecordInput[]
): Promise<CloudKitRecord[] | null> {
  if (!assertIOS('batchSaveRecords')) return null;
  return await ExpoCloudKitModule.batchSaveRecords(records);
}

// Re-export types
export * from './types';
