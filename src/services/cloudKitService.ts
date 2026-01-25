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
}

// Export a singleton instance
export const cloudKitService = new CloudKitService();