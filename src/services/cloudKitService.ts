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

  async getAccountStatus(): Promise<string | null> {
    try {
      const result = await getAccountStatus();
      if (result.success) {
        return result.data || null;
      } else {
        console.error('Failed to get account status:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Account status error:', error);
      return null;
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