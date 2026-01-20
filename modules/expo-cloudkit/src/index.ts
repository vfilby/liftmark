import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoCloudKit.web.ts
// and on native platforms to ExpoCloudKit.ts  
const ExpoCloudKitModule = requireNativeModule('ExpoCloudKit');

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
    const result = await ExpoCloudKitModule.getAccountStatus();
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Export the module for direct access if needed
export { ExpoCloudKitModule };