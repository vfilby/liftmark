import CloudKit
import ExpoModulesCore

// MARK: - Custom Exceptions

class CloudKitNotAvailableException: Exception {
  override var reason: String {
    "CloudKit is not available. Please ensure iCloud is enabled and user is signed in."
  }
}

class InvalidRecordTypeException: Exception {
  override var reason: String {
    "Invalid CloudKit record type specified."
  }
}

class RecordNotFoundException: Exception {
  override var reason: String {
    "CloudKit record not found."
  }
}

class CloudKitOperationException: Exception {
  override var reason: String {
    "CloudKit operation failed."
  }
}

// MARK: - Main Module

public class ExpoCloudKitModule: Module {

  // Private CloudKit database
  private let container: CKContainer
  private let privateDatabase: CKDatabase
  private let customZoneID: CKRecordZone.ID

  // MARK: - Initialization

  override init(appContext: AppContext) {
    // Initialize CloudKit container with app's identifier
    self.container = CKContainer(identifier: "iCloud.com.eff3.liftmark")
    self.privateDatabase = container.privateCloudDatabase
    self.customZoneID = CKRecordZone.ID(zoneName: "LiftMarkZone", ownerName: CKCurrentUserDefaultName)

    super.init(appContext: appContext)
  }

  // MARK: - Module Definition

  public func definition() -> ModuleDefinition {
    Name("ExpoCloudKit")

    // Check iCloud account status
    AsyncFunction("initialize") { (promise: Promise) in
      self.container.accountStatus { status, error in
        if let error = error {
          promise.reject(CloudKitNotAvailableException(), error.localizedDescription)
          return
        }

        let statusString: String
        switch status {
        case .available:
          statusString = "available"
          // Ensure custom zone exists
          Task {
            await self.ensureCustomZoneExists()
          }
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

        promise.resolve([
          "status": statusString,
          "isAvailable": status == .available
        ])
      }
    }

    // Save a record (create or update)
    AsyncFunction("saveRecord") { (recordType: String, fields: [String: Any], recordName: String?, promise: Promise) in
      Task {
        do {
          let record: CKRecord

          if let recordName = recordName {
            // Update existing record or create with specific ID
            let recordID = CKRecord.ID(recordName: recordName, zoneID: self.customZoneID)
            record = CKRecord(recordType: recordType, recordID: recordID)
          } else {
            // Create new record with auto-generated ID
            let recordID = CKRecord.ID(zoneID: self.customZoneID)
            record = CKRecord(recordType: recordType, recordID: recordID)
          }

          // Set fields
          for (key, value) in fields {
            record[key] = self.convertToCloudKitValue(value)
          }

          // Save to CloudKit
          let savedRecord = try await self.privateDatabase.save(record)
          let result = self.convertRecordToDict(savedRecord)
          promise.resolve(result)
        } catch {
          promise.reject(CloudKitOperationException(), error.localizedDescription)
        }
      }
    }

    // Fetch a single record by recordName
    AsyncFunction("fetchRecord") { (recordName: String, promise: Promise) in
      Task {
        do {
          let recordID = CKRecord.ID(recordName: recordName, zoneID: self.customZoneID)
          let record = try await self.privateDatabase.record(for: recordID)
          let result = self.convertRecordToDict(record)
          promise.resolve(result)
        } catch let error as CKError where error.code == .unknownItem {
          promise.reject(RecordNotFoundException(), "Record not found: \(recordName)")
        } catch {
          promise.reject(CloudKitOperationException(), error.localizedDescription)
        }
      }
    }

    // Query records with predicate
    AsyncFunction("queryRecords") { (recordType: String, predicate: String?, limit: Int?, promise: Promise) in
      Task {
        do {
          let ckPredicate: NSPredicate
          if let predicate = predicate, !predicate.isEmpty {
            ckPredicate = NSPredicate(format: predicate)
          } else {
            ckPredicate = NSPredicate(value: true)
          }

          let query = CKQuery(recordType: recordType, predicate: ckPredicate)
          query.sortDescriptors = [NSSortDescriptor(key: "modificationDate", ascending: false)]

          var results: [[String: Any]] = []
          var cursor: CKQueryOperation.Cursor?

          let operation = CKQueryOperation(query: query)
          operation.zoneID = self.customZoneID

          if let limit = limit {
            operation.resultsLimit = limit
          }

          operation.recordMatchedBlock = { recordID, result in
            switch result {
            case .success(let record):
              let dict = self.convertRecordToDict(record)
              results.append(dict)
            case .failure(let error):
              print("Error fetching record: \(error)")
            }
          }

          operation.queryResultBlock = { result in
            switch result {
            case .success(let newCursor):
              cursor = newCursor
            case .failure(let error):
              promise.reject(CloudKitOperationException(), error.localizedDescription)
              return
            }

            promise.resolve([
              "records": results,
              "hasMore": cursor != nil
            ])
          }

          self.privateDatabase.add(operation)
        } catch {
          promise.reject(CloudKitOperationException(), error.localizedDescription)
        }
      }
    }

    // Delete a record
    AsyncFunction("deleteRecord") { (recordName: String, promise: Promise) in
      Task {
        do {
          let recordID = CKRecord.ID(recordName: recordName, zoneID: self.customZoneID)
          try await self.privateDatabase.deleteRecord(withID: recordID)
          promise.resolve(true)
        } catch {
          promise.reject(CloudKitOperationException(), error.localizedDescription)
        }
      }
    }

    // Fetch changes (incremental sync)
    AsyncFunction("fetchChanges") { (serverChangeToken: String?, promise: Promise) in
      Task {
        do {
          var token: CKServerChangeToken? = nil
          if let tokenString = serverChangeToken {
            token = self.decodeChangeToken(tokenString)
          }

          let zoneConfiguration = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
          zoneConfiguration.previousServerChangeToken = token

          var changedRecords: [[String: Any]] = []
          var deletedRecordIDs: [String] = []
          var newToken: String? = nil

          let operation = CKFetchRecordZoneChangesOperation(
            recordZoneIDs: [self.customZoneID],
            configurationsByRecordZoneID: [self.customZoneID: zoneConfiguration]
          )

          operation.recordWasChangedBlock = { recordID, result in
            switch result {
            case .success(let record):
              changedRecords.append(self.convertRecordToDict(record))
            case .failure(let error):
              print("Error fetching changed record: \(error)")
            }
          }

          operation.recordWithIDWasDeletedBlock = { recordID, recordType in
            deletedRecordIDs.append(recordID.recordName)
          }

          operation.recordZoneFetchResultBlock = { zoneID, result in
            switch result {
            case .success(let serverChangeToken):
              if let token = serverChangeToken {
                newToken = self.encodeChangeToken(token)
              }
            case .failure(let error):
              print("Zone fetch error: \(error)")
            }
          }

          operation.fetchRecordZoneChangesResultBlock = { result in
            switch result {
            case .success:
              promise.resolve([
                "changedRecords": changedRecords,
                "deletedRecordIDs": deletedRecordIDs,
                "serverChangeToken": newToken as Any
              ])
            case .failure(let error):
              promise.reject(CloudKitOperationException(), error.localizedDescription)
            }
          }

          self.privateDatabase.add(operation)
        } catch {
          promise.reject(CloudKitOperationException(), error.localizedDescription)
        }
      }
    }

    // Batch save records (up to 400 records per batch)
    AsyncFunction("batchSaveRecords") { (records: [[String: Any]], promise: Promise) in
      Task {
        do {
          var ckRecords: [CKRecord] = []

          for recordData in records {
            guard let recordType = recordData["recordType"] as? String,
                  let fields = recordData["fields"] as? [String: Any] else {
              continue
            }

            let recordID: CKRecord.ID
            if let recordName = recordData["recordName"] as? String {
              recordID = CKRecord.ID(recordName: recordName, zoneID: self.customZoneID)
            } else {
              recordID = CKRecord.ID(zoneID: self.customZoneID)
            }

            let record = CKRecord(recordType: recordType, recordID: recordID)
            for (key, value) in fields {
              record[key] = self.convertToCloudKitValue(value)
            }
            ckRecords.append(record)
          }

          // CloudKit supports up to 400 records per batch
          let savedRecords = try await self.privateDatabase.modifyRecords(saving: ckRecords, deleting: [])
          let results = savedRecords.saveResults.compactMap { _, result -> [String: Any]? in
            switch result {
            case .success(let record):
              return self.convertRecordToDict(record)
            case .failure:
              return nil
            }
          }

          promise.resolve(results)
        } catch {
          promise.reject(CloudKitOperationException(), error.localizedDescription)
        }
      }
    }
  }

  // MARK: - Helper Methods

  private func ensureCustomZoneExists() async {
    do {
      let zone = CKRecordZone(zoneID: customZoneID)
      _ = try await privateDatabase.save(zone)
      print("Custom zone created or already exists")
    } catch {
      print("Error creating custom zone: \(error)")
    }
  }

  private func convertRecordToDict(_ record: CKRecord) -> [String: Any] {
    var dict: [String: Any] = [
      "recordName": record.recordID.recordName,
      "recordType": record.recordType,
      "fields": [:] as [String: Any]
    ]

    var fields: [String: Any] = [:]
    for key in record.allKeys() {
      if let value = record[key] {
        fields[key] = convertFromCloudKitValue(value)
      }
    }
    dict["fields"] = fields

    if let modificationDate = record.modificationDate {
      dict["modificationDate"] = modificationDate.timeIntervalSince1970 * 1000 // milliseconds
    }

    return dict
  }

  private func convertToCloudKitValue(_ value: Any) -> CKRecordValue? {
    if let string = value as? String {
      return string as CKRecordValue
    } else if let number = value as? NSNumber {
      return number
    } else if let date = value as? Date {
      return date as CKRecordValue
    } else if let array = value as? [Any] {
      return array as? CKRecordValue
    }
    return nil
  }

  private func convertFromCloudKitValue(_ value: Any) -> Any {
    if let date = value as? Date {
      return date.timeIntervalSince1970 * 1000 // Convert to milliseconds
    }
    return value
  }

  private func encodeChangeToken(_ token: CKServerChangeToken) -> String {
    let data = NSKeyedArchiver.archivedData(withRootObject: token)
    return data.base64EncodedString()
  }

  private func decodeChangeToken(_ string: String) -> CKServerChangeToken? {
    guard let data = Data(base64Encoded: string) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data)
  }
}
