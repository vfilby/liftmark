import ExpoModulesCore
import CloudKit

public class ExpoCloudKitModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoCloudKit')` in JavaScript.
    Name("ExpoCloudKit")

    // Defines event names that the module can send to JavaScript.
    Events("onCloudKitAccountChange")

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    AsyncFunction("initialize") { (promise: Promise) in
      DispatchQueue.main.async {
        CKContainer.default().accountStatus { (accountStatus, error) in
          if let error = error {
            promise.reject("CLOUDKIT_ERROR", "Failed to check CloudKit account status: \(error.localizedDescription)")
            return
          }
          
          switch accountStatus {
          case .available:
            promise.resolve(true)
          case .noAccount:
            promise.reject("CLOUDKIT_NO_ACCOUNT", "No iCloud account available")
          case .restricted:
            promise.reject("CLOUDKIT_RESTRICTED", "CloudKit access is restricted")
          case .couldNotDetermine:
            promise.reject("CLOUDKIT_UNKNOWN", "Could not determine CloudKit account status")
          case .temporarilyUnavailable:
            promise.reject("CLOUDKIT_TEMPORARILY_UNAVAILABLE", "CloudKit is temporarily unavailable")
          @unknown default:
            promise.reject("CLOUDKIT_UNKNOWN", "Unknown CloudKit account status")
          }
        }
      }
    }

    AsyncFunction("getAccountStatus") { (promise: Promise) in
      DispatchQueue.main.async {
        CKContainer.default().accountStatus { (accountStatus, error) in
          if let error = error {
            promise.reject("CLOUDKIT_ERROR", "Failed to check CloudKit account status: \(error.localizedDescription)")
            return
          }
          
          let statusString: String
          switch accountStatus {
          case .available:
            statusString = "available"
          case .noAccount:
            statusString = "noAccount"
          case .restricted:
            statusString = "restricted"
          case .couldNotDetermine:
            statusString = "couldNotDetermine"
          case .temporarilyUnavailable:
            statusString = "temporarilyUnavailable"
          @unknown default:
            statusString = "unknown"
          }
          
          promise.resolve(statusString)
        }
      }
    }

    AsyncFunction("saveRecord") { (record: [String: Any], promise: Promise) in
      DispatchQueue.main.async {
        guard let recordType = record["recordType"] as? String,
              let data = record["data"] as? [String: Any] else {
          promise.reject("INVALID_RECORD", "Invalid record format")
          return
        }
        
        let ckRecord: CKRecord
        if let recordId = record["id"] as? String {
          let ckRecordID = CKRecord.ID(recordName: recordId)
          ckRecord = CKRecord(recordType: recordType, recordID: ckRecordID)
        } else {
          ckRecord = CKRecord(recordType: recordType)
        }
        
        // Set the record data
        for (key, value) in data {
          ckRecord[key] = value as? CKRecordValue
        }
        
        let database = CKContainer.default().privateCloudDatabase
        database.save(ckRecord) { (savedRecord, error) in
          if let error = error {
            promise.reject("CLOUDKIT_SAVE_ERROR", "Failed to save record: \(error.localizedDescription)")
            return
          }
          
          guard let savedRecord = savedRecord else {
            promise.reject("CLOUDKIT_SAVE_ERROR", "No record returned from save operation")
            return
          }
          
          let resultRecord: [String: Any] = [
            "id": savedRecord.recordID.recordName,
            "recordType": savedRecord.recordType,
            "data": self.recordToDict(savedRecord)
          ]
          
          promise.resolve(resultRecord)
        }
      }
    }

    AsyncFunction("fetchRecord") { (recordId: String, recordType: String, promise: Promise) in
      DispatchQueue.main.async {
        let ckRecordID = CKRecord.ID(recordName: recordId)
        let database = CKContainer.default().privateCloudDatabase
        
        database.fetch(withRecordID: ckRecordID) { (record, error) in
          if let error = error {
            promise.reject("CLOUDKIT_FETCH_ERROR", "Failed to fetch record: \(error.localizedDescription)")
            return
          }
          
          guard let record = record else {
            promise.reject("CLOUDKIT_FETCH_ERROR", "No record found")
            return
          }
          
          let resultRecord: [String: Any] = [
            "id": record.recordID.recordName,
            "recordType": record.recordType,
            "data": self.recordToDict(record)
          ]
          
          promise.resolve(resultRecord)
        }
      }
    }

    AsyncFunction("fetchRecords") { (recordType: String, promise: Promise) in
      DispatchQueue.main.async {
        let predicate = NSPredicate(value: true)
        let query = CKQuery(recordType: recordType, predicate: predicate)
        let database = CKContainer.default().privateCloudDatabase
        
        database.perform(query, inZoneWith: nil) { (records, error) in
          if let error = error {
            promise.reject("CLOUDKIT_FETCH_ERROR", "Failed to fetch records: \(error.localizedDescription)")
            return
          }
          
          let resultRecords = records?.map { record in
            return [
              "id": record.recordID.recordName,
              "recordType": record.recordType,
              "data": self.recordToDict(record)
            ]
          } ?? []
          
          promise.resolve(resultRecords)
        }
      }
    }

    AsyncFunction("deleteRecord") { (recordId: String, recordType: String, promise: Promise) in
      DispatchQueue.main.async {
        let ckRecordID = CKRecord.ID(recordName: recordId)
        let database = CKContainer.default().privateCloudDatabase
        
        database.delete(withRecordID: ckRecordID) { (deletedRecordID, error) in
          if let error = error {
            promise.reject("CLOUDKIT_DELETE_ERROR", "Failed to delete record: \(error.localizedDescription)")
            return
          }
          
          promise.resolve(true)
        }
      }
    }
  }

  // Helper function to convert CKRecord to dictionary
  private func recordToDict(_ record: CKRecord) -> [String: Any] {
    var dict: [String: Any] = [:]
    for key in record.allKeys() {
      if let value = record[key] {
        dict[key] = self.ckRecordValueToAny(value)
      }
    }
    return dict
  }

  // Helper function to convert CKRecordValue to Any
  private func ckRecordValueToAny(_ value: CKRecordValue) -> Any {
    switch value {
    case let stringValue as String:
      return stringValue
    case let numberValue as NSNumber:
      return numberValue
    case let dateValue as Date:
      return dateValue.timeIntervalSince1970
    case let dataValue as Data:
      return dataValue.base64EncodedString()
    default:
      return "\(value)"
    }
  }
}