import Foundation
import CloudKit

// MARK: - CloudKit Record Type

struct CloudKitRecord {
    let recordId: String
    let recordType: String
    var fields: [String: Any]
}

// MARK: - CloudKit Account Status

enum CloudKitAccountStatus: String {
    case available
    case noAccount
    case restricted
    case couldNotDetermine
    case error
}

// MARK: - CloudKitService

final class CloudKitService {
    static let shared = CloudKitService()

    private let container: CKContainer
    private let database: CKDatabase
    private var isInitialized = false

    private init() {
        self.container = CKContainer.default()
        self.database = container.privateCloudDatabase
    }

    // MARK: - Initialize

    /// Initialize the CloudKit connection.
    func initialize() async -> Bool {
        do {
            let status = try await container.accountStatus()
            if status == .available {
                isInitialized = true
                Logger.shared.info(.app, "CloudKit initialized successfully")
                return true
            } else {
                Logger.shared.warn(.app, "CloudKit not available, status: \(status.rawValue)")
                return false
            }
        } catch {
            Logger.shared.error(.app, "CloudKit initialization error", error: error)
            return false
        }
    }

    // MARK: - Account Status

    /// Check the current iCloud account status.
    func getAccountStatus() async -> CloudKitAccountStatus {
        do {
            let status = try await container.accountStatus()
            switch status {
            case .available:
                return .available
            case .noAccount:
                return .noAccount
            case .restricted:
                return .restricted
            case .couldNotDetermine:
                return .couldNotDetermine
            case .temporarilyUnavailable:
                return .couldNotDetermine
            @unknown default:
                return .couldNotDetermine
            }
        } catch {
            Logger.shared.error(.app, "Failed to get CloudKit account status", error: error)

            let errorMessage = error.localizedDescription
            if errorMessage.contains("simulator") || errorMessage.contains("development") {
                return .noAccount
            }
            if errorMessage.contains("restricted") {
                return .restricted
            }

            return .couldNotDetermine
        }
    }

    // MARK: - Save Record

    /// Save a record to CloudKit.
    func saveRecord(_ record: CloudKitRecord) async -> CloudKitRecord? {
        if !isInitialized {
            let initialized = await initialize()
            if !initialized { return nil }
        }

        do {
            let ckRecord = CKRecord(recordType: record.recordType, recordID: CKRecord.ID(recordName: record.recordId))
            for (key, value) in record.fields {
                ckRecord[key] = value as? CKRecordValueProtocol
            }

            let savedRecord = try await database.save(ckRecord)

            var fields: [String: Any] = [:]
            for key in savedRecord.allKeys() {
                fields[key] = savedRecord[key]
            }

            return CloudKitRecord(
                recordId: savedRecord.recordID.recordName,
                recordType: savedRecord.recordType,
                fields: fields
            )
        } catch {
            Logger.shared.error(.app, "Failed to save CloudKit record", error: error)
            return nil
        }
    }

    // MARK: - Fetch Record

    /// Fetch a single record by ID and type.
    func fetchRecord(recordId: String, recordType: String) async -> CloudKitRecord? {
        if !isInitialized {
            let initialized = await initialize()
            if !initialized { return nil }
        }

        do {
            let recordID = CKRecord.ID(recordName: recordId)
            let ckRecord = try await database.record(for: recordID)

            var fields: [String: Any] = [:]
            for key in ckRecord.allKeys() {
                fields[key] = ckRecord[key]
            }

            return CloudKitRecord(
                recordId: ckRecord.recordID.recordName,
                recordType: ckRecord.recordType,
                fields: fields
            )
        } catch {
            Logger.shared.error(.app, "Failed to fetch CloudKit record", error: error)
            return nil
        }
    }

    // MARK: - Fetch Records

    /// Fetch all records of a given type.
    func fetchRecords(recordType: String) async -> [CloudKitRecord] {
        if !isInitialized {
            let initialized = await initialize()
            if !initialized { return [] }
        }

        do {
            let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
            let (results, _) = try await database.records(matching: query)

            return results.compactMap { _, result in
                guard let ckRecord = try? result.get() else { return nil }
                var fields: [String: Any] = [:]
                for key in ckRecord.allKeys() {
                    fields[key] = ckRecord[key]
                }
                return CloudKitRecord(
                    recordId: ckRecord.recordID.recordName,
                    recordType: ckRecord.recordType,
                    fields: fields
                )
            }
        } catch {
            Logger.shared.error(.app, "Failed to fetch CloudKit records", error: error)
            return []
        }
    }

    // MARK: - Delete Record

    /// Delete a record by ID and type.
    func deleteRecord(recordId: String, recordType: String) async -> Bool {
        if !isInitialized {
            let initialized = await initialize()
            if !initialized { return false }
        }

        do {
            let recordID = CKRecord.ID(recordName: recordId)
            try await database.deleteRecord(withID: recordID)
            return true
        } catch {
            Logger.shared.error(.app, "Failed to delete CloudKit record", error: error)
            return false
        }
    }
}
