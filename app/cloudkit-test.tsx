import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { cloudKitService } from '@/services/cloudKitService';

export default function CloudKitTest() {
  const [accountStatus, setAccountStatus] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState(false);

  const handleInitialize = async () => {
    setIsLoading(true);
    try {
      const success = await cloudKitService.initialize();
      if (success) {
        Alert.alert('Success', 'CloudKit initialized successfully');
        const status = await cloudKitService.getAccountStatus();
        setAccountStatus(status || 'unknown');
      } else {
        Alert.alert('Error', 'Failed to initialize CloudKit');
      }
    } catch (error) {
      Alert.alert('Error', `CloudKit initialization failed: ${error}`);
    }
    setIsLoading(false);
  };

  const handleSaveTestRecord = async () => {
    setIsLoading(true);
    try {
      const testRecord = {
        recordType: 'TestRecord',
        data: {
          name: 'Test Record',
          createdAt: new Date().toISOString(),
          value: 42
        }
      };

      const savedRecord = await cloudKitService.saveRecord(testRecord);
      if (savedRecord) {
        Alert.alert('Success', `Record saved with ID: ${savedRecord.id}`);
      } else {
        Alert.alert('Error', 'Failed to save record');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to save record: ${error}`);
    }
    setIsLoading(false);
  };

  const handleFetchRecords = async () => {
    setIsLoading(true);
    try {
      const records = await cloudKitService.fetchRecords('TestRecord');
      Alert.alert('Success', `Found ${records.length} records`);
    } catch (error) {
      Alert.alert('Error', `Failed to fetch records: ${error}`);
    }
    setIsLoading(false);
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }} testID="cloudkit-test-screen">
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        CloudKit Test
      </Text>
      
      <Text style={{ marginBottom: 20, textAlign: 'center' }} testID="cloudkit-test-status">
        Account Status: {accountStatus}
      </Text>

      <TouchableOpacity
        style={{ 
          backgroundColor: '#007AFF', 
          padding: 15, 
          borderRadius: 8, 
          marginBottom: 15,
          opacity: isLoading ? 0.6 : 1 
        }}
        onPress={handleInitialize}
        disabled={isLoading}
        testID="cloudkit-test-initialize-button"
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
          Initialize CloudKit
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ 
          backgroundColor: '#34C759', 
          padding: 15, 
          borderRadius: 8, 
          marginBottom: 15,
          opacity: isLoading ? 0.6 : 1 
        }}
        onPress={handleSaveTestRecord}
        disabled={isLoading}
        testID="cloudkit-test-save-button"
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
          Save Test Record
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ 
          backgroundColor: '#FF9500', 
          padding: 15, 
          borderRadius: 8, 
          marginBottom: 15,
          opacity: isLoading ? 0.6 : 1 
        }}
        onPress={handleFetchRecords}
        disabled={isLoading}
        testID="cloudkit-test-fetch-button"
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
          Fetch Test Records
        </Text>
      </TouchableOpacity>

      {isLoading && (
        <Text style={{ textAlign: 'center', marginTop: 20, fontStyle: 'italic' }} testID="cloudkit-test-loading">
          Loading...
        </Text>
      )}
    </View>
  );
}
