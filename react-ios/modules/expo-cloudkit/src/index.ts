import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoCloudKit.web.ts
// and on native platforms to ExpoCloudKit.ts
console.log('[CloudKit Module] Attempting to load native module');
let ExpoCloudKitModule: any;
try {
  ExpoCloudKitModule = requireNativeModule('ExpoCloudKit');
  console.log('[CloudKit Module] Native module loaded successfully:', !!ExpoCloudKitModule);
  console.log('[CloudKit Module] Available methods:', Object.keys(ExpoCloudKitModule || {}));
} catch (error) {
  console.warn('[CloudKit Module] Failed to load native module:', error);
  // Create a mock module that returns errors
  ExpoCloudKitModule = {
    initialize: () => Promise.reject(new Error('CloudKit module not available')),
    getAccountStatus: () => Promise.reject(new Error('CloudKit module not available')),
    saveRecord: () => Promise.reject(new Error('CloudKit module not available')),
    fetchRecord: () => Promise.reject(new Error('CloudKit module not available')),
    fetchRecords: () => Promise.reject(new Error('CloudKit module not available')),
    deleteRecord: () => Promise.reject(new Error('CloudKit module not available')),
  };
  console.log('[CloudKit Module] Using mock module');
}

export interface CloudKitRecord {
  id?: string;
  data: Record<string, any>;
  recordType: string;
}

export interface CloudKitResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Basic CloudKit operations
export async function initializeCloudKit(): Promise<CloudKitResult<boolean>> {
  try {
    const result = await ExpoCloudKitModule.initialize();
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function saveRecord(record: CloudKitRecord): Promise<CloudKitResult<CloudKitRecord>> {
  try {
    const result = await ExpoCloudKitModule.saveRecord(record);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function fetchRecord(recordId: string, recordType: string): Promise<CloudKitResult<CloudKitRecord>> {
  try {
    const result = await ExpoCloudKitModule.fetchRecord(recordId, recordType);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function fetchRecords(recordType: string): Promise<CloudKitResult<CloudKitRecord[]>> {
  try {
    const result = await ExpoCloudKitModule.fetchRecords(recordType);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function deleteRecord(recordId: string, recordType: string): Promise<CloudKitResult<boolean>> {
  try {
    const result = await ExpoCloudKitModule.deleteRecord(recordId, recordType);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function getAccountStatus(): Promise<CloudKitResult<string>> {
  try {
    console.log('[CloudKit JS] getAccountStatus called');
    console.log('[CloudKit JS] ExpoCloudKitModule:', ExpoCloudKitModule);
    console.log('[CloudKit JS] ExpoCloudKitModule.getAccountStatus:', typeof ExpoCloudKitModule.getAccountStatus);

    // Add a timeout to prevent hanging forever
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log('[CloudKit JS] Timeout triggered after 5 seconds');
        reject(new Error('CloudKit account status check timed out'));
      }, 5000);
    });

    console.log('[CloudKit JS] Calling ExpoCloudKitModule.getAccountStatus()');
    const statusPromise = ExpoCloudKitModule.getAccountStatus();
    console.log('[CloudKit JS] Status promise created, racing with timeout');

    const result = await Promise.race([statusPromise, timeoutPromise]);
    console.log('[CloudKit JS] Got result:', result);
    return { success: true, data: result };
  } catch (error) {
    console.log('[CloudKit JS] getAccountStatus error:', error);
    console.log('[CloudKit JS] Error type:', typeof error);
    console.log('[CloudKit JS] Error details:', JSON.stringify(error, null, 2));
    // Ensure we always return a valid result object, never throw
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Export the module for direct access if needed
export { ExpoCloudKitModule };