import Foundation
import CloudKit
import GRDB

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

// MARK: - Sync Result

struct SyncResult {
    var success: Bool
    var uploaded: Int
    var downloaded: Int
    var conflicts: Int
    var errors: [String]
    var timestamp: Date
}

// MARK: - Last Sync Stats

struct LastSyncStats {
    var uploaded: Int
    var downloaded: Int
    var conflicts: Int
}

// MARK: - CloudKitService

final class CloudKitService: @unchecked Sendable {
    static let shared = CloudKitService()

    private let container: CKContainer
    private let database: CKDatabase
    private var isInitialized = false

    private init() {
        // Use the shared container ID (matches the React Native app) rather than
        // .default(), which derives from the bundle ID and would produce
        // "iCloud.com.eff3.liftmark.native-ios" instead of the correct container.
        self.container = CKContainer(identifier: "iCloud.com.eff3.liftmark.v2")
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

    /// Save a record to CloudKit. If the record already exists on the server,
    /// fetches the server version (to get its change tag) and retries the save.
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
            return cloudKitRecordToLocal(savedRecord)
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Record already exists on server — fetch it to get the change tag, then update
            Logger.shared.info(.app, "Record \(record.recordId) already exists on server, fetching and retrying save")
            do {
                let recordID = CKRecord.ID(recordName: record.recordId)
                let serverRecord = try await database.record(for: recordID)

                // Apply our fields onto the server record (which has the correct change tag)
                for (key, value) in record.fields {
                    serverRecord[key] = value as? CKRecordValueProtocol
                }

                let savedRecord = try await database.save(serverRecord)
                return cloudKitRecordToLocal(savedRecord)
            } catch {
                Logger.shared.error(.app, "Failed to save CloudKit record after conflict resolution", error: error)
                return nil
            }
        } catch {
            Logger.shared.error(.app, "Failed to save CloudKit record", error: error)
            return nil
        }
    }

    /// Convert a CKRecord to our local CloudKitRecord wrapper.
    private func cloudKitRecordToLocal(_ ckRecord: CKRecord) -> CloudKitRecord {
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

    /// Fetch all records of a given type, paginating through all results.
    /// CloudKit returns a maximum of ~100 records per query batch.
    func fetchRecords(recordType: String) async -> [CloudKitRecord] {

        if !isInitialized {
            let initialized = await initialize()
            if !initialized { return [] }
        }

        do {
            var allRecords: [CloudKitRecord] = []
            var pageCount = 0

            let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
            let (firstResults, firstCursor) = try await database.records(matching: query)
            pageCount += 1
            allRecords.append(contentsOf: convertCKResults(firstResults))

            var cursor = firstCursor
            while let activeCursor = cursor {
                let (moreResults, nextCursor) = try await database.records(continuingMatchFrom: activeCursor)
                pageCount += 1
                allRecords.append(contentsOf: convertCKResults(moreResults))
                cursor = nextCursor
            }

            Logger.shared.info(.sync, "[Sync] Fetched \(allRecords.count) \(recordType) records (\(pageCount) pages)")
            return allRecords
        } catch {
            Logger.shared.error(.app, "Failed to fetch CloudKit records", error: error)
            return []
        }
    }

    /// Convert raw CloudKit query results into CloudKitRecord values.
    private func convertCKResults(_ results: [(CKRecord.ID, Result<CKRecord, Error>)]) -> [CloudKitRecord] {
        results.compactMap { _, result in
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

    // MARK: - Sync All

    /// Perform a full sync: download first (merge with last-writer-wins), then upload only new local records.
    func syncAll() async -> SyncResult {
        var result = SyncResult(success: false, uploaded: 0, downloaded: 0, conflicts: 0, errors: [], timestamp: Date())

        // 1. Check account status
        let status = await getAccountStatus()
        guard status == .available else {
            result.errors.append("iCloud account not available (status: \(status.rawValue))")
            Logger.shared.warn(.app, "Sync aborted: iCloud not available (\(status.rawValue))")
            return result
        }

        // 2. Detect first sync
        let isFirstSync = checkIsFirstSync()

        // 3. Download all remote records and merge first.
        //    This establishes the server state before we decide what to upload,
        //    avoiding the upload storm where every record fails with serverRecordChanged
        //    because the server already has it (e.g. synced from another app/device).
        let downloadResult = await downloadAndMergeAllEntities(isFirstSync: isFirstSync)
        result.downloaded = downloadResult.count
        result.conflicts = downloadResult.conflicts
        result.errors.append(contentsOf: downloadResult.errors)

        // 4. Upload only local records that the server does not already have.
        //    Records already on the server were resolved in the download phase above.
        let uploadResult = await uploadNewEntities(existingServerIds: downloadResult.remoteIds)
        result.uploaded = uploadResult.count
        result.errors.append(contentsOf: uploadResult.errors)

        // 5. Handle local-only deletes: records on server that no longer exist locally
        //    were deleted on this device → propagate the delete to the server.
        //    NOTE: We intentionally do NOT delete server records that are missing locally
        //    before the download phase — those are legitimately new remote records.
        //    Phase 1 limitation: without a sync queue we cannot distinguish "added remotely"
        //    from "deleted locally" for records that were present in a previous sync but
        //    are now absent from the local DB. Remote deletes are deferred to Phase 2.
        if !isFirstSync {
            let deleteResult = await handleLocalDeletes(
                localIds: uploadResult.localIds,
                remoteIds: downloadResult.remoteIds
            )
            result.errors.append(contentsOf: deleteResult.errors)
        }

        // 6. Update sync metadata
        updateSyncMetadata(uploaded: result.uploaded, downloaded: result.downloaded, conflicts: result.conflicts)

        result.success = result.errors.isEmpty
        result.timestamp = Date()
        Logger.shared.info(.app, "Sync completed: uploaded=\(result.uploaded), downloaded=\(result.downloaded), conflicts=\(result.conflicts), errors=\(result.errors.count)")
        return result
    }

    // MARK: - Sync Helpers

    private struct UploadResult {
        var count: Int = 0
        var errors: [String] = []
        var localIds: [String: Set<String>] = [:] // recordType -> set of IDs
    }

    private struct DownloadResult {
        var count: Int = 0
        var conflicts: Int = 0
        var errors: [String] = []
        var remoteIds: [String: Set<String>] = [:] // recordType -> set of IDs
    }

    private struct DeleteResult {
        var errors: [String] = []
    }

    private func checkIsFirstSync() -> Bool {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            return try dbQueue.read { db in
                let row = try Row.fetchOne(db, sql: "SELECT last_sync_date FROM sync_metadata LIMIT 1")
                if let row, let _: String = row["last_sync_date"] {
                    return false
                }
                return true
            }
        } catch {
            return true
        }
    }

    func getLastSyncDate() -> Date? {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            return try dbQueue.read { db in
                let row = try Row.fetchOne(db, sql: "SELECT last_sync_date FROM sync_metadata LIMIT 1")
                if let row, let dateString: String = row["last_sync_date"] {
                    return ISO8601DateFormatter().date(from: dateString)
                }
                return nil
            }
        } catch {
            Logger.shared.error(.app, "Failed to read last sync date", error: error)
            return nil
        }
    }

    func getLastSyncStats() -> LastSyncStats? {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            return try dbQueue.read { db in
                let row = try Row.fetchOne(db, sql: "SELECT last_sync_date, last_uploaded, last_downloaded, last_conflicts FROM sync_metadata LIMIT 1")
                guard let row, let _: String = row["last_sync_date"] else { return nil }
                return LastSyncStats(
                    uploaded: row["last_uploaded"] ?? 0,
                    downloaded: row["last_downloaded"] ?? 0,
                    conflicts: row["last_conflicts"] ?? 0
                )
            }
        } catch {
            Logger.shared.error(.app, "Failed to read last sync stats", error: error)
            return nil
        }
    }

    func getSyncEnabled() -> Bool {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            return try dbQueue.read { db in
                let row = try Row.fetchOne(db, sql: "SELECT sync_enabled FROM sync_metadata LIMIT 1")
                if let row, let value: Int = row["sync_enabled"] {
                    return value != 0
                }
                return true // default on
            }
        } catch {
            return true
        }
    }

    func setSyncEnabled(_ enabled: Bool) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                let existing = try Row.fetchOne(db, sql: "SELECT id FROM sync_metadata LIMIT 1")
                if existing != nil {
                    try db.execute(sql: "UPDATE sync_metadata SET sync_enabled = ?, updated_at = ?", arguments: [enabled ? 1 : 0, now])
                } else {
                    try db.execute(
                        sql: "INSERT INTO sync_metadata (id, device_id, sync_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                        arguments: [IDGenerator.generate(), UUID().uuidString, enabled ? 1 : 0, now, now]
                    )
                }
            }
        } catch {
            Logger.shared.error(.app, "Failed to update sync enabled", error: error)
        }
    }

    private func updateSyncMetadata(uploaded: Int, downloaded: Int, conflicts: Int) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                let existing = try Row.fetchOne(db, sql: "SELECT id FROM sync_metadata LIMIT 1")
                if existing != nil {
                    try db.execute(
                        sql: "UPDATE sync_metadata SET last_sync_date = ?, last_uploaded = ?, last_downloaded = ?, last_conflicts = ?, updated_at = ?",
                        arguments: [now, uploaded, downloaded, conflicts, now]
                    )
                } else {
                    try db.execute(
                        sql: "INSERT INTO sync_metadata (id, device_id, last_sync_date, last_uploaded, last_downloaded, last_conflicts, sync_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        arguments: [IDGenerator.generate(), UUID().uuidString, now, uploaded, downloaded, conflicts, 1, now, now]
                    )
                }
            }
        } catch {
            Logger.shared.error(.app, "Failed to update sync metadata", error: error)
        }
    }

    // MARK: - Upload

    /// Upload only local records that do not yet exist on the server.
    /// Records already present on the server are resolved by the download/merge phase.
    private func uploadNewEntities(existingServerIds: [String: Set<String>]) async -> UploadResult {
        var result = UploadResult()

        // Upload order per spec: Gym, GymEquipment, WorkoutPlan, PlannedExercise, PlannedSet,
        // WorkoutSession, SessionExercise, SessionSet, UserSettings
        do {
            let dbQueue = try DatabaseManager.shared.database()

            // localIds tracks IDs confirmed on the server: start from existingServerIds
            // (downloaded in the merge phase) and add only successfully uploaded IDs.
            // Failed uploads must NOT appear in localIds — otherwise handleLocalDeletes
            // would interpret them as "present locally but missing from server" and delete them.

            let allGyms = try await dbQueue.read { db in try GymRow.fetchAll(db) }
            let activeGyms = allGyms.filter { $0.deletedAt == nil }
            let deletedGyms = allGyms.filter { $0.deletedAt != nil }
            var confirmedGymIds = existingServerIds["Gym"] ?? []
            for gym in activeGyms where !confirmedGymIds.contains(gym.id) {
                let record = gymToRecord(gym)
                if await saveRecord(record) != nil { result.count += 1; confirmedGymIds.insert(gym.id) }
                else { result.errors.append("Failed to upload Gym \(gym.id)") }
            }
            // Delete soft-deleted gyms from CloudKit
            for gym in deletedGyms {
                confirmedGymIds.remove(gym.id)
                await deleteRecord(recordId: gym.id, recordType: "Gym")
            }
            result.localIds["Gym"] = confirmedGymIds

            let allEquipment = try await dbQueue.read { db in try GymEquipmentRow.fetchAll(db) }
            let activeEquipment = allEquipment.filter { $0.deletedAt == nil }
            let deletedEquipment = allEquipment.filter { $0.deletedAt != nil }
            var confirmedEquipmentIds = existingServerIds["GymEquipment"] ?? []
            for eq in activeEquipment where !confirmedEquipmentIds.contains(eq.id) {
                let record = gymEquipmentToRecord(eq)
                if await saveRecord(record) != nil { result.count += 1; confirmedEquipmentIds.insert(eq.id) }
                else { result.errors.append("Failed to upload GymEquipment \(eq.id)") }
            }
            // Delete soft-deleted equipment from CloudKit
            for eq in deletedEquipment {
                confirmedEquipmentIds.remove(eq.id)
                await deleteRecord(recordId: eq.id, recordType: "GymEquipment")
            }
            result.localIds["GymEquipment"] = confirmedEquipmentIds

            let plans = try await dbQueue.read { db in try WorkoutPlanRow.fetchAll(db) }
            var confirmedPlanIds = existingServerIds["WorkoutPlan"] ?? []
            for plan in plans where !confirmedPlanIds.contains(plan.id) {
                let record = workoutPlanToRecord(plan)
                if await saveRecord(record) != nil { result.count += 1; confirmedPlanIds.insert(plan.id) }
                else { result.errors.append("Failed to upload WorkoutPlan \(plan.id)") }
            }
            result.localIds["WorkoutPlan"] = confirmedPlanIds

            let plannedExercises = try await dbQueue.read { db in try PlannedExerciseRow.fetchAll(db) }
            var confirmedPlannedExIds = existingServerIds["PlannedExercise"] ?? []
            for ex in plannedExercises where !confirmedPlannedExIds.contains(ex.id) {
                let record = plannedExerciseToRecord(ex)
                if await saveRecord(record) != nil { result.count += 1; confirmedPlannedExIds.insert(ex.id) }
                else { result.errors.append("Failed to upload PlannedExercise \(ex.id)") }
            }
            result.localIds["PlannedExercise"] = confirmedPlannedExIds

            let plannedSets = try await dbQueue.read { db in try PlannedSetRow.fetchAll(db) }
            var confirmedPlannedSetIds = existingServerIds["PlannedSet"] ?? []
            for ps in plannedSets where !confirmedPlannedSetIds.contains(ps.id) {
                let record = plannedSetToRecord(ps)
                if await saveRecord(record) != nil { result.count += 1; confirmedPlannedSetIds.insert(ps.id) }
                else { result.errors.append("Failed to upload PlannedSet \(ps.id)") }
            }
            result.localIds["PlannedSet"] = confirmedPlannedSetIds

            let sessions = try await dbQueue.read { db in try WorkoutSessionRow.fetchAll(db) }
            var confirmedSessionIds = existingServerIds["WorkoutSession"] ?? []
            for session in sessions where !confirmedSessionIds.contains(session.id) {
                let record = workoutSessionToRecord(session)
                if await saveRecord(record) != nil { result.count += 1; confirmedSessionIds.insert(session.id) }
                else { result.errors.append("Failed to upload WorkoutSession \(session.id)") }
            }
            result.localIds["WorkoutSession"] = confirmedSessionIds

            let sessionExercises = try await dbQueue.read { db in try SessionExerciseRow.fetchAll(db) }
            var confirmedSessionExIds = existingServerIds["SessionExercise"] ?? []
            for se in sessionExercises where !confirmedSessionExIds.contains(se.id) {
                let record = sessionExerciseToRecord(se)
                if await saveRecord(record) != nil { result.count += 1; confirmedSessionExIds.insert(se.id) }
                else { result.errors.append("Failed to upload SessionExercise \(se.id)") }
            }
            result.localIds["SessionExercise"] = confirmedSessionExIds

            let sessionSets = try await dbQueue.read { db in try SessionSetRow.fetchAll(db) }
            var confirmedSessionSetIds = existingServerIds["SessionSet"] ?? []
            for ss in sessionSets where !confirmedSessionSetIds.contains(ss.id) {
                let record = sessionSetToRecord(ss)
                if await saveRecord(record) != nil { result.count += 1; confirmedSessionSetIds.insert(ss.id) }
                else { result.errors.append("Failed to upload SessionSet \(ss.id)") }
            }
            result.localIds["SessionSet"] = confirmedSessionSetIds

            let settings = try await dbQueue.read { db in try UserSettingsRow.fetchOne(db) }
            if let settings {
                var confirmedSettingsIds = existingServerIds["UserSettings"] ?? []
                if !confirmedSettingsIds.contains(settings.id) {
                    let record = userSettingsToRecord(settings)
                    if await saveRecord(record) != nil { result.count += 1; confirmedSettingsIds.insert(settings.id) }
                    else { result.errors.append("Failed to upload UserSettings") }
                }
                result.localIds["UserSettings"] = confirmedSettingsIds
            }

        } catch {
            result.errors.append("Database error during upload: \(error.localizedDescription)")
            Logger.shared.error(.app, "Sync upload failed", error: error)
        }

        return result
    }

    /// Keep the full upload method for internal use (e.g. force-push scenarios).
    private func uploadAllEntities() async -> UploadResult {
        var result = UploadResult()

        // Upload order per spec: Gym, GymEquipment, WorkoutPlan, PlannedExercise, PlannedSet,
        // WorkoutSession, SessionExercise, SessionSet, UserSettings
        do {
            let dbQueue = try DatabaseManager.shared.database()

            // localIds tracks only IDs confirmed on the server (successful uploads).
            // Failed uploads must NOT appear in localIds for correct delete handling.

            // Gym (skip soft-deleted, delete them from CloudKit)
            let allGyms = try await dbQueue.read { db in try GymRow.fetchAll(db) }
            var confirmedGymIds = Set<String>()
            for gym in allGyms where gym.deletedAt == nil {
                let record = gymToRecord(gym)
                if await saveRecord(record) != nil { result.count += 1; confirmedGymIds.insert(gym.id) }
                else { result.errors.append("Failed to upload Gym \(gym.id)") }
            }
            for gym in allGyms where gym.deletedAt != nil {
                await deleteRecord(recordId: gym.id, recordType: "Gym")
            }
            result.localIds["Gym"] = confirmedGymIds

            // GymEquipment (skip soft-deleted, delete them from CloudKit)
            let allEquipment = try await dbQueue.read { db in try GymEquipmentRow.fetchAll(db) }
            var confirmedEquipmentIds = Set<String>()
            for eq in allEquipment where eq.deletedAt == nil {
                let record = gymEquipmentToRecord(eq)
                if await saveRecord(record) != nil { result.count += 1; confirmedEquipmentIds.insert(eq.id) }
                else { result.errors.append("Failed to upload GymEquipment \(eq.id)") }
            }
            for eq in allEquipment where eq.deletedAt != nil {
                await deleteRecord(recordId: eq.id, recordType: "GymEquipment")
            }
            result.localIds["GymEquipment"] = confirmedEquipmentIds

            // WorkoutPlan (just the plan row, not exercises/sets — those are separate record types)
            let plans = try await dbQueue.read { db in try WorkoutPlanRow.fetchAll(db) }
            var confirmedPlanIds = Set<String>()
            for plan in plans {
                let record = workoutPlanToRecord(plan)
                if await saveRecord(record) != nil { result.count += 1; confirmedPlanIds.insert(plan.id) }
                else { result.errors.append("Failed to upload WorkoutPlan \(plan.id)") }
            }
            result.localIds["WorkoutPlan"] = confirmedPlanIds

            // PlannedExercise
            let plannedExercises = try await dbQueue.read { db in try PlannedExerciseRow.fetchAll(db) }
            var confirmedPlannedExIds = Set<String>()
            for ex in plannedExercises {
                let record = plannedExerciseToRecord(ex)
                if await saveRecord(record) != nil { result.count += 1; confirmedPlannedExIds.insert(ex.id) }
                else { result.errors.append("Failed to upload PlannedExercise \(ex.id)") }
            }
            result.localIds["PlannedExercise"] = confirmedPlannedExIds

            // PlannedSet
            let plannedSets = try await dbQueue.read { db in try PlannedSetRow.fetchAll(db) }
            var confirmedPlannedSetIds = Set<String>()
            for ps in plannedSets {
                let record = plannedSetToRecord(ps)
                if await saveRecord(record) != nil { result.count += 1; confirmedPlannedSetIds.insert(ps.id) }
                else { result.errors.append("Failed to upload PlannedSet \(ps.id)") }
            }
            result.localIds["PlannedSet"] = confirmedPlannedSetIds

            // WorkoutSession
            let sessions = try await dbQueue.read { db in try WorkoutSessionRow.fetchAll(db) }
            var confirmedSessionIds = Set<String>()
            for session in sessions {
                let record = workoutSessionToRecord(session)
                if await saveRecord(record) != nil { result.count += 1; confirmedSessionIds.insert(session.id) }
                else { result.errors.append("Failed to upload WorkoutSession \(session.id)") }
            }
            result.localIds["WorkoutSession"] = confirmedSessionIds

            // SessionExercise
            let sessionExercises = try await dbQueue.read { db in try SessionExerciseRow.fetchAll(db) }
            var confirmedSessionExIds = Set<String>()
            for se in sessionExercises {
                let record = sessionExerciseToRecord(se)
                if await saveRecord(record) != nil { result.count += 1; confirmedSessionExIds.insert(se.id) }
                else { result.errors.append("Failed to upload SessionExercise \(se.id)") }
            }
            result.localIds["SessionExercise"] = confirmedSessionExIds

            // SessionSet
            let sessionSets = try await dbQueue.read { db in try SessionSetRow.fetchAll(db) }
            var confirmedSessionSetIds = Set<String>()
            for ss in sessionSets {
                let record = sessionSetToRecord(ss)
                if await saveRecord(record) != nil { result.count += 1; confirmedSessionSetIds.insert(ss.id) }
                else { result.errors.append("Failed to upload SessionSet \(ss.id)") }
            }
            result.localIds["SessionSet"] = confirmedSessionSetIds

            // UserSettings
            let settings = try await dbQueue.read { db in try UserSettingsRow.fetchOne(db) }
            if let settings {
                var confirmedSettingsIds = Set<String>()
                let record = userSettingsToRecord(settings)
                if await saveRecord(record) != nil { result.count += 1; confirmedSettingsIds.insert(settings.id) }
                else { result.errors.append("Failed to upload UserSettings") }
                result.localIds["UserSettings"] = confirmedSettingsIds
            }

        } catch {
            result.errors.append("Database error during upload: \(error.localizedDescription)")
            Logger.shared.error(.app, "Sync upload failed", error: error)
        }

        return result
    }

    // MARK: - Download & Merge

    private func downloadAndMergeAllEntities(isFirstSync: Bool) async -> DownloadResult {
        var result = DownloadResult()

        // Collect IDs belonging to the active workout session — these must not be overwritten by sync.
        let protected = getActiveSessionProtectedIds()

        // Download order per spec (same as upload): parents before children
        let recordTypes = ["Gym", "GymEquipment", "WorkoutPlan", "PlannedExercise", "PlannedSet",
                           "WorkoutSession", "SessionExercise", "SessionSet", "UserSettings"]

        for recordType in recordTypes {
            let remoteRecords = await fetchRecords(recordType: recordType)
            var ids = Set<String>()
            for record in remoteRecords {
                ids.insert(record.recordId)

                // Skip merging records that belong to the active session
                if let protectedIds = protected.byRecordType[recordType], protectedIds.contains(record.recordId) {
                    continue
                }

                do {
                    let merged = try mergeRecord(record, recordType: recordType)
                    if merged { result.count += 1 }
                } catch {
                    result.errors.append("Failed to merge \(recordType) \(record.recordId): \(error.localizedDescription)")
                }
            }
            result.remoteIds[recordType] = ids
        }

        return result
    }

    /// Merge a single remote record into local DB using last-writer-wins. Returns true if local was updated.
    private func mergeRecord(_ record: CloudKitRecord, recordType: String) throws -> Bool {
        let dbQueue = try DatabaseManager.shared.database()

        switch recordType {
        case "Gym":
            return try mergeGym(record, dbQueue: dbQueue)
        case "GymEquipment":
            return try mergeGymEquipment(record, dbQueue: dbQueue)
        case "WorkoutPlan":
            return try mergeWorkoutPlan(record, dbQueue: dbQueue)
        case "PlannedExercise":
            return try mergePlannedExercise(record, dbQueue: dbQueue)
        case "PlannedSet":
            return try mergePlannedSet(record, dbQueue: dbQueue)
        case "WorkoutSession":
            return try mergeWorkoutSession(record, dbQueue: dbQueue)
        case "SessionExercise":
            return try mergeSessionExercise(record, dbQueue: dbQueue)
        case "SessionSet":
            return try mergeSessionSet(record, dbQueue: dbQueue)
        case "UserSettings":
            return try mergeUserSettings(record, dbQueue: dbQueue)
        default:
            return false
        }
    }

    // MARK: - Active Session Protection

    /// IDs belonging to an in-progress workout session that must not be deleted or overwritten by sync.
    struct ActiveSessionProtectedIds {
        let sessionId: String?
        let exerciseIds: Set<String>
        let setIds: Set<String>
        /// Parent plan IDs protected because the active session references this plan.
        let planId: String?
        let plannedExerciseIds: Set<String>
        let plannedSetIds: Set<String>

        /// All protected IDs keyed by CloudKit record type.
        var byRecordType: [String: Set<String>] {
            var map: [String: Set<String>] = [:]
            if let sid = sessionId { map["WorkoutSession"] = [sid] }
            if !exerciseIds.isEmpty { map["SessionExercise"] = exerciseIds }
            if !setIds.isEmpty { map["SessionSet"] = setIds }
            if let pid = planId { map["WorkoutPlan"] = [pid] }
            if !plannedExerciseIds.isEmpty { map["PlannedExercise"] = plannedExerciseIds }
            if !plannedSetIds.isEmpty { map["PlannedSet"] = plannedSetIds }
            return map
        }

        static let empty = ActiveSessionProtectedIds(
            sessionId: nil, exerciseIds: [], setIds: [],
            planId: nil, plannedExerciseIds: [], plannedSetIds: []
        )
    }

    /// Query the database for the active (in_progress) session and collect all IDs that belong to it,
    /// including the parent WorkoutPlan's PlannedExercise and PlannedSet records.
    func getActiveSessionProtectedIds() -> ActiveSessionProtectedIds {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            return try dbQueue.read { db in
                guard let sessionRow = try Row.fetchOne(db, sql: "SELECT id, workout_template_id FROM workout_sessions WHERE status = 'in_progress' LIMIT 1"),
                      let sessionId: String = sessionRow["id"] else {
                    return .empty
                }

                let exerciseRows = try Row.fetchAll(db, sql: "SELECT id FROM session_exercises WHERE workout_session_id = ?", arguments: [sessionId])
                let exerciseIds = Set(exerciseRows.compactMap { $0["id"] as String? })

                var setIds = Set<String>()
                if !exerciseIds.isEmpty {
                    let placeholders = exerciseIds.map { _ in "?" }.joined(separator: ",")
                    let setRows = try Row.fetchAll(db, sql: "SELECT id FROM session_sets WHERE session_exercise_id IN (\(placeholders))", arguments: StatementArguments(Array(exerciseIds)))
                    setIds = Set(setRows.compactMap { $0["id"] as String? })
                }

                // Protect parent plan records if the session references a workout plan
                let planId: String? = sessionRow["workout_template_id"]
                var plannedExerciseIds = Set<String>()
                var plannedSetIds = Set<String>()

                if let planId, !planId.isEmpty {
                    let peRows = try Row.fetchAll(db, sql: "SELECT id FROM template_exercises WHERE workout_template_id = ?", arguments: [planId])
                    plannedExerciseIds = Set(peRows.compactMap { $0["id"] as String? })

                    if !plannedExerciseIds.isEmpty {
                        let pePlaceholders = plannedExerciseIds.map { _ in "?" }.joined(separator: ",")
                        let psRows = try Row.fetchAll(db, sql: "SELECT id FROM template_sets WHERE template_exercise_id IN (\(pePlaceholders))", arguments: StatementArguments(Array(plannedExerciseIds)))
                        plannedSetIds = Set(psRows.compactMap { $0["id"] as String? })
                    }
                }

                return ActiveSessionProtectedIds(
                    sessionId: sessionId, exerciseIds: exerciseIds, setIds: setIds,
                    planId: planId, plannedExerciseIds: plannedExerciseIds, plannedSetIds: plannedSetIds
                )
            }
        } catch {
            Logger.shared.error(.app, "Failed to query active session for sync protection", error: error)
            return .empty
        }
    }

    // MARK: - Delete Handling

    /// Handle deletes propagated from the server: records present locally but absent from the
    /// server were deleted on another device and should be removed locally.
    ///
    /// Remote deletes (propagating local deletions to the server) are intentionally omitted in
    /// Phase 1. Without a sync queue we cannot reliably distinguish "record deleted locally" from
    /// "record newly added to the server by another device". That distinction requires Phase 2
    /// change-tracking. Incorrectly deleting server records would cause data loss in the
    /// upload-storm scenario we already observed.
    private func handleLocalDeletes(localIds: [String: Set<String>], remoteIds: [String: Set<String>]) async -> DeleteResult {
        var result = DeleteResult()

        // Collect IDs belonging to the active workout session — these must never be deleted by sync.
        let protected = getActiveSessionProtectedIds()

        // Delete order: children before parents (reverse of sync order)
        let deleteOrder = ["SessionSet", "SessionExercise", "WorkoutSession",
                           "PlannedSet", "PlannedExercise", "WorkoutPlan",
                           "GymEquipment", "Gym"]

        for recordType in deleteOrder {
            let local = localIds[recordType] ?? []
            let remote = remoteIds[recordType] ?? []

            // Records present locally but missing from server → deleted on another device → delete locally
            var toDeleteLocally = local.subtracting(remote)

            // Exclude active session records from deletion
            if let protectedIds = protected.byRecordType[recordType] {
                toDeleteLocally.subtract(protectedIds)
            }

            for id in toDeleteLocally {
                do {
                    try deleteLocalRecord(id: id, recordType: recordType)
                } catch {
                    result.errors.append("Failed to delete local \(recordType) \(id): \(error.localizedDescription)")
                }
            }
        }

        return result
    }

    private func deleteLocalRecord(id: String, recordType: String) throws {
        let dbQueue = try DatabaseManager.shared.database()
        let table: String
        switch recordType {
        case "Gym": table = "gyms"
        case "GymEquipment": table = "gym_equipment"
        case "WorkoutPlan": table = "workout_templates"
        case "PlannedExercise": table = "template_exercises"
        case "PlannedSet": table = "template_sets"
        case "WorkoutSession": table = "workout_sessions"
        case "SessionExercise": table = "session_exercises"
        case "SessionSet": table = "session_sets"
        case "UserSettings": table = "user_settings"
        default: return
        }
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM \(table) WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Entity → CloudKit Record Conversion

    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private let isoFormatterNoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func parseDate(_ str: String?) -> Date? {
        guard let str else { return nil }
        return isoFormatter.date(from: str) ?? isoFormatterNoFrac.date(from: str)
    }

    private func makeReference(recordType: String, recordId: String) -> CKRecord.Reference {
        let id = CKRecord.ID(recordName: recordId)
        return CKRecord.Reference(recordID: id, action: .none)
    }

    private func gymToRecord(_ gym: GymRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "name": gym.name,
            "isDefault": Int64(gym.isDefault),
        ]
        if let d = parseDate(gym.createdAt) { fields["createdAt"] = d }
        if let d = parseDate(gym.updatedAt) { fields["updatedAt"] = d }
        return CloudKitRecord(recordId: gym.id, recordType: "Gym", fields: fields)
    }

    private func gymEquipmentToRecord(_ eq: GymEquipmentRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "name": eq.name,
            "isAvailable": Int64(eq.isAvailable),
        ]
        if let gymId = eq.gymId {
            fields["gymId"] = makeReference(recordType: "Gym", recordId: gymId)
        }
        if let d = parseDate(eq.lastCheckedAt) { fields["lastCheckedAt"] = d }
        if let d = parseDate(eq.createdAt) { fields["createdAt"] = d }
        if let d = parseDate(eq.updatedAt) { fields["updatedAt"] = d }
        return CloudKitRecord(recordId: eq.id, recordType: "GymEquipment", fields: fields)
    }

    private func workoutPlanToRecord(_ plan: WorkoutPlanRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "name": plan.name,
            "isFavorite": Int64(plan.isFavorite),
        ]
        if let d = plan.description { fields["planDescription"] = d }
        if let t = plan.tags { fields["tags"] = t } // Already JSON string
        if let u = plan.defaultWeightUnit { fields["defaultWeightUnit"] = u }
        if let m = plan.sourceMarkdown { fields["sourceMarkdown"] = m }
        if let d = parseDate(plan.createdAt) { fields["createdAt"] = d }
        if let d = parseDate(plan.updatedAt) { fields["updatedAt"] = d }
        return CloudKitRecord(recordId: plan.id, recordType: "WorkoutPlan", fields: fields)
    }

    private func plannedExerciseToRecord(_ ex: PlannedExerciseRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "workoutPlanId": makeReference(recordType: "WorkoutPlan", recordId: ex.workoutTemplateId),
            "exerciseName": ex.exerciseName,
            "orderIndex": Int64(ex.orderIndex),
        ]
        if let n = ex.notes { fields["notes"] = n }
        if let e = ex.equipmentType { fields["equipmentType"] = e }
        if let g = ex.groupType { fields["groupType"] = g }
        if let g = ex.groupName { fields["groupName"] = g }
        if let p = ex.parentExerciseId { fields["parentExerciseId"] = makeReference(recordType: "PlannedExercise", recordId: p) }
        return CloudKitRecord(recordId: ex.id, recordType: "PlannedExercise", fields: fields)
    }

    private func plannedSetToRecord(_ ps: PlannedSetRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "plannedExerciseId": makeReference(recordType: "PlannedExercise", recordId: ps.templateExerciseId),
            "orderIndex": Int64(ps.orderIndex),
        ]
        // Build attributes list from boolean flags
        var attrs: [String] = []
        if ps.isDropset != 0 { attrs.append("dropset") }
        if ps.isPerSide != 0 { attrs.append("perSide") }
        if ps.isAmrap != 0 { attrs.append("amrap") }
        if !attrs.isEmpty { fields["attributes"] = attrs }
        if let w = ps.targetWeight { fields["targetWeight"] = w }
        if let u = ps.targetWeightUnit { fields["targetWeightUnit"] = u }
        if let r = ps.targetReps { fields["targetReps"] = Int64(r) }
        if let t = ps.targetTime { fields["targetTime"] = Int64(t) }
        if let rpe = ps.targetRpe { fields["targetRpe"] = Double(rpe) }
        if let r = ps.restSeconds { fields["restSeconds"] = Int64(r) }
        if let n = ps.notes { fields["notes"] = n }
        return CloudKitRecord(recordId: ps.id, recordType: "PlannedSet", fields: fields)
    }

    private func workoutSessionToRecord(_ session: WorkoutSessionRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "name": session.name,
            "date": session.date,
            "status": session.status,
        ]
        // workoutPlanId is a plain String, not a reference (plan may be deleted)
        if let pid = session.workoutTemplateId { fields["workoutPlanId"] = pid }
        if let d = parseDate(session.startTime) { fields["startTime"] = d }
        if let d = parseDate(session.endTime) { fields["endTime"] = d }
        if let dur = session.duration { fields["duration"] = Int64(dur) }
        if let n = session.notes { fields["notes"] = n }
        return CloudKitRecord(recordId: session.id, recordType: "WorkoutSession", fields: fields)
    }

    private func sessionExerciseToRecord(_ se: SessionExerciseRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "workoutSessionId": makeReference(recordType: "WorkoutSession", recordId: se.workoutSessionId),
            "exerciseName": se.exerciseName,
            "orderIndex": Int64(se.orderIndex),
            "status": se.status,
        ]
        if let n = se.notes { fields["notes"] = n }
        if let e = se.equipmentType { fields["equipmentType"] = e }
        if let g = se.groupType { fields["groupType"] = g }
        if let g = se.groupName { fields["groupName"] = g }
        if let p = se.parentExerciseId { fields["parentExerciseId"] = makeReference(recordType: "SessionExercise", recordId: p) }
        return CloudKitRecord(recordId: se.id, recordType: "SessionExercise", fields: fields)
    }

    private func sessionSetToRecord(_ ss: SessionSetRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "sessionExerciseId": makeReference(recordType: "SessionExercise", recordId: ss.sessionExerciseId),
            "orderIndex": Int64(ss.orderIndex),
            "status": ss.status,
        ]
        // Build attributes list from boolean flags
        var attrs: [String] = []
        if ss.isDropset != 0 { attrs.append("dropset") }
        if ss.isPerSide != 0 { attrs.append("perSide") }
        if !attrs.isEmpty { fields["attributes"] = attrs }
        if let p = ss.parentSetId { fields["parentSetId"] = makeReference(recordType: "SessionSet", recordId: p) }
        if let d = ss.dropSequence { fields["dropSequence"] = Int64(d) }
        if let w = ss.targetWeight { fields["targetWeight"] = w }
        if let u = ss.targetWeightUnit { fields["targetWeightUnit"] = u }
        if let r = ss.targetReps { fields["targetReps"] = Int64(r) }
        if let t = ss.targetTime { fields["targetTime"] = Int64(t) }
        if let rpe = ss.targetRpe { fields["targetRpe"] = Double(rpe) }
        if let r = ss.restSeconds { fields["restSeconds"] = Int64(r) }
        if let w = ss.actualWeight { fields["actualWeight"] = w }
        if let u = ss.actualWeightUnit { fields["actualWeightUnit"] = u }
        if let r = ss.actualReps { fields["actualReps"] = Int64(r) }
        if let t = ss.actualTime { fields["actualTime"] = Int64(t) }
        if let rpe = ss.actualRpe { fields["actualRpe"] = Double(rpe) }
        if let d = parseDate(ss.completedAt) { fields["completedAt"] = d }
        if let n = ss.notes { fields["notes"] = n }
        return CloudKitRecord(recordId: ss.id, recordType: "SessionSet", fields: fields)
    }

    private func userSettingsToRecord(_ s: UserSettingsRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "defaultWeightUnit": s.defaultWeightUnit,
            "enableWorkoutTimer": Int64(s.enableWorkoutTimer),
            "autoStartRestTimer": Int64(s.autoStartRestTimer),
            "theme": s.theme,
            "notificationsEnabled": Int64(s.notificationsEnabled),
            "healthKitEnabled": Int64(s.healthkitEnabled),
            "liveActivitiesEnabled": Int64(s.liveActivitiesEnabled),
            "keepScreenAwake": Int64(s.keepScreenAwake),
            "showOpenInClaudeButton": Int64(s.showOpenInClaudeButton),
            "countdownSoundsEnabled": Int64(s.countdownSoundsEnabled),
        ]
        if let c = s.customPromptAddition { fields["customPromptAddition"] = c }
        if let h = s.homeTiles { fields["homeTiles"] = h } // Already JSON string
        if let d = parseDate(s.updatedAt) { fields["updatedAt"] = d }
        // Never sync anthropicApiKey
        return CloudKitRecord(recordId: "user-settings", recordType: "UserSettings", fields: fields)
    }

    // MARK: - CloudKit Record → Local DB Merge (Last-Writer-Wins)

    private func stringField(_ record: CloudKitRecord, _ key: String) -> String? {
        record.fields[key] as? String
    }

    private func int64Field(_ record: CloudKitRecord, _ key: String) -> Int64? {
        record.fields[key] as? Int64
    }

    private func doubleField(_ record: CloudKitRecord, _ key: String) -> Double? {
        record.fields[key] as? Double
    }

    private func dateField(_ record: CloudKitRecord, _ key: String) -> Date? {
        record.fields[key] as? Date
    }

    private func dateToISO(_ date: Date?) -> String? {
        guard let date else { return nil }
        return isoFormatter.string(from: date)
    }

    private func stringListField(_ record: CloudKitRecord, _ key: String) -> [String] {
        record.fields[key] as? [String] ?? []
    }

    private func referenceId(_ record: CloudKitRecord, _ key: String) -> String? {
        if let ref = record.fields[key] as? CKRecord.Reference {
            return ref.recordID.recordName
        }
        return record.fields[key] as? String
    }

    /// Returns true if remote updatedAt is newer than local updatedAt.
    private func remoteIsNewer(remoteDate: Date?, localUpdatedAt: String?) -> Bool {
        guard let remoteDate else { return false }
        guard let localStr = localUpdatedAt, let localDate = parseDate(localStr) else { return true }
        return remoteDate > localDate
    }

    private func mergeGym(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try GymRow.fetchOne(db, key: record.recordId)

            // Don't re-insert a gym that was soft-deleted locally
            if let existing, existing.deletedAt != nil {
                return false
            }

            if let existing, !remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = GymRow(
                id: record.recordId,
                name: stringField(record, "name") ?? "Gym",
                isDefault: Int(int64Field(record, "isDefault") ?? 0),
                deletedAt: nil,
                createdAt: dateToISO(dateField(record, "createdAt")) ?? existing?.createdAt ?? isoFormatter.string(from: Date()),
                updatedAt: dateToISO(remoteUpdatedAt) ?? existing?.updatedAt ?? isoFormatter.string(from: Date())
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergeGymEquipment(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try GymEquipmentRow.fetchOne(db, key: record.recordId)

            // Don't re-insert equipment that was soft-deleted locally
            if let existing, existing.deletedAt != nil {
                return false
            }

            if let existing, !remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = GymEquipmentRow(
                id: record.recordId,
                name: stringField(record, "name") ?? "Equipment",
                isAvailable: Int(int64Field(record, "isAvailable") ?? 1),
                lastCheckedAt: dateToISO(dateField(record, "lastCheckedAt")),
                deletedAt: nil,
                createdAt: dateToISO(dateField(record, "createdAt")) ?? existing?.createdAt ?? isoFormatter.string(from: Date()),
                updatedAt: dateToISO(remoteUpdatedAt) ?? existing?.updatedAt ?? isoFormatter.string(from: Date()),
                gymId: referenceId(record, "gymId")
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergeWorkoutPlan(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try WorkoutPlanRow.fetchOne(db, key: record.recordId)
            if let existing, !remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = WorkoutPlanRow(
                id: record.recordId,
                name: stringField(record, "name") ?? "Workout",
                description: stringField(record, "planDescription"),
                tags: stringField(record, "tags"),
                defaultWeightUnit: stringField(record, "defaultWeightUnit"),
                sourceMarkdown: stringField(record, "sourceMarkdown"),
                createdAt: dateToISO(dateField(record, "createdAt")) ?? existing?.createdAt ?? isoFormatter.string(from: Date()),
                updatedAt: dateToISO(remoteUpdatedAt) ?? existing?.updatedAt ?? isoFormatter.string(from: Date()),
                isFavorite: Int(int64Field(record, "isFavorite") ?? 0)
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergePlannedExercise(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try PlannedExerciseRow.fetchOne(db, key: record.recordId)
            let fk = referenceId(record, "workoutPlanId") ?? existing?.workoutTemplateId ?? ""
            // Skip insert if FK is empty — would violate foreign key constraint
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping PlannedExercise \(record.recordId): missing workoutPlanId FK")
                return false
            }
            // PlannedExercise has no updatedAt — always overwrite from remote if newer parent or new record
            let row = PlannedExerciseRow(
                id: record.recordId,
                workoutTemplateId: fk,
                exerciseName: stringField(record, "exerciseName") ?? existing?.exerciseName ?? "",
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                notes: stringField(record, "notes"),
                equipmentType: stringField(record, "equipmentType"),
                groupType: stringField(record, "groupType"),
                groupName: stringField(record, "groupName"),
                parentExerciseId: referenceId(record, "parentExerciseId")
            )
            if existing != nil {
                try row.update(db)
            } else {
                // Deduplication: skip if exercise with same plan, name, and order already exists
                let duplicate = try PlannedExerciseRow
                    .filter(Column("workout_template_id") == row.workoutTemplateId)
                    .filter(Column("exercise_name") == row.exerciseName)
                    .filter(Column("order_index") == row.orderIndex)
                    .fetchOne(db)
                if duplicate != nil {
                    Logger.shared.warn(.sync, "Skipping duplicate exercise: \(row.exerciseName) at index \(row.orderIndex)")
                    return false
                }
                try row.insert(db)
            }
            return existing == nil
        }
    }

    private func mergePlannedSet(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try PlannedSetRow.fetchOne(db, key: record.recordId)
            let fk = referenceId(record, "plannedExerciseId") ?? existing?.templateExerciseId ?? ""
            // Skip insert if FK is empty — would violate foreign key constraint
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping PlannedSet \(record.recordId): missing plannedExerciseId FK")
                return false
            }
            let attrs = stringListField(record, "attributes")
            let row = PlannedSetRow(
                id: record.recordId,
                templateExerciseId: fk,
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                targetWeight: doubleField(record, "targetWeight"),
                targetWeightUnit: stringField(record, "targetWeightUnit"),
                targetReps: int64Field(record, "targetReps").map { Int($0) },
                targetTime: int64Field(record, "targetTime").map { Int($0) },
                targetRpe: int64Field(record, "targetRpe").map { Int($0) } ?? doubleField(record, "targetRpe").map { Int($0) },
                restSeconds: int64Field(record, "restSeconds").map { Int($0) },
                tempo: nil,
                isDropset: attrs.contains("dropset") ? 1 : 0,
                isPerSide: attrs.contains("perSide") ? 1 : 0,
                isAmrap: attrs.contains("amrap") ? 1 : 0,
                notes: stringField(record, "notes")
            )
            if existing != nil {
                try row.update(db)
            } else {
                // Deduplication: skip if set with same exercise and order already exists
                let duplicate = try PlannedSetRow
                    .filter(Column("template_exercise_id") == row.templateExerciseId)
                    .filter(Column("order_index") == row.orderIndex)
                    .fetchOne(db)
                if duplicate != nil {
                    Logger.shared.warn(.sync, "Skipping duplicate set at index \(row.orderIndex)")
                    return false
                }
                try row.insert(db)
            }
            return existing == nil
        }
    }

    private func mergeWorkoutSession(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try WorkoutSessionRow.fetchOne(db, key: record.recordId)

            // Don't let remote data overwrite a local cancellation — the user's
            // explicit discard action on this device is authoritative.
            let remoteStatus = stringField(record, "status")
            let mergedStatus: String
            if existing?.status == SessionStatus.canceled.rawValue {
                mergedStatus = SessionStatus.canceled.rawValue
            } else {
                mergedStatus = remoteStatus ?? existing?.status ?? SessionStatus.inProgress.rawValue
            }

            let row = WorkoutSessionRow(
                id: record.recordId,
                workoutTemplateId: stringField(record, "workoutPlanId"),
                name: stringField(record, "name") ?? existing?.name ?? "Workout",
                date: stringField(record, "date") ?? existing?.date ?? "",
                startTime: dateToISO(dateField(record, "startTime")),
                endTime: dateToISO(dateField(record, "endTime")),
                duration: int64Field(record, "duration").map { Int($0) },
                notes: stringField(record, "notes"),
                status: mergedStatus
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergeSessionExercise(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try SessionExerciseRow.fetchOne(db, key: record.recordId)
            let fk = referenceId(record, "workoutSessionId") ?? existing?.workoutSessionId ?? ""
            // Skip insert if FK is empty — would violate foreign key constraint
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping SessionExercise \(record.recordId): missing workoutSessionId FK")
                return false
            }
            let row = SessionExerciseRow(
                id: record.recordId,
                workoutSessionId: fk,
                exerciseName: stringField(record, "exerciseName") ?? existing?.exerciseName ?? "",
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                notes: stringField(record, "notes"),
                equipmentType: stringField(record, "equipmentType"),
                groupType: stringField(record, "groupType"),
                groupName: stringField(record, "groupName"),
                parentExerciseId: referenceId(record, "parentExerciseId"),
                status: stringField(record, "status") ?? existing?.status ?? ExerciseStatus.pending.rawValue
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergeSessionSet(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try SessionSetRow.fetchOne(db, key: record.recordId)
            let fk = referenceId(record, "sessionExerciseId") ?? existing?.sessionExerciseId ?? ""
            // Skip insert if FK is empty — would violate foreign key constraint
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping SessionSet \(record.recordId): missing sessionExerciseId FK")
                return false
            }
            let attrs = stringListField(record, "attributes")
            let row = SessionSetRow(
                id: record.recordId,
                sessionExerciseId: fk,
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                parentSetId: referenceId(record, "parentSetId"),
                dropSequence: int64Field(record, "dropSequence").map { Int($0) },
                targetWeight: doubleField(record, "targetWeight"),
                targetWeightUnit: stringField(record, "targetWeightUnit"),
                targetReps: int64Field(record, "targetReps").map { Int($0) },
                targetTime: int64Field(record, "targetTime").map { Int($0) },
                targetRpe: int64Field(record, "targetRpe").map { Int($0) } ?? doubleField(record, "targetRpe").map { Int($0) },
                restSeconds: int64Field(record, "restSeconds").map { Int($0) },
                actualWeight: doubleField(record, "actualWeight"),
                actualWeightUnit: stringField(record, "actualWeightUnit"),
                actualReps: int64Field(record, "actualReps").map { Int($0) },
                actualTime: int64Field(record, "actualTime").map { Int($0) },
                actualRpe: int64Field(record, "actualRpe").map { Int($0) } ?? doubleField(record, "actualRpe").map { Int($0) },
                completedAt: dateToISO(dateField(record, "completedAt")),
                status: stringField(record, "status") ?? existing?.status ?? SetStatus.pending.rawValue,
                notes: stringField(record, "notes"),
                tempo: nil,
                isDropset: attrs.contains("dropset") ? 1 : 0,
                isPerSide: attrs.contains("perSide") ? 1 : 0,
                side: stringField(record, "side")
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergeUserSettings(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try UserSettingsRow.fetchOne(db)
            if let existing, !remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            // For UserSettings, merge field-by-field taking newer values
            // Since we're doing Phase 1 simple sync, overwrite if remote is newer
            if let existing {
                let updatedAt = dateToISO(remoteUpdatedAt) ?? existing.updatedAt
                let row = UserSettingsRow(
                    id: existing.id,
                    defaultWeightUnit: stringField(record, "defaultWeightUnit") ?? existing.defaultWeightUnit,
                    enableWorkoutTimer: Int(int64Field(record, "enableWorkoutTimer") ?? Int64(existing.enableWorkoutTimer)),
                    autoStartRestTimer: Int(int64Field(record, "autoStartRestTimer") ?? Int64(existing.autoStartRestTimer)),
                    theme: stringField(record, "theme") ?? existing.theme,
                    notificationsEnabled: Int(int64Field(record, "notificationsEnabled") ?? Int64(existing.notificationsEnabled)),
                    customPromptAddition: stringField(record, "customPromptAddition") ?? existing.customPromptAddition,
                    anthropicApiKey: existing.anthropicApiKey, // Never sync
                    anthropicApiKeyStatus: existing.anthropicApiKeyStatus, // Never sync
                    healthkitEnabled: Int(int64Field(record, "healthKitEnabled") ?? Int64(existing.healthkitEnabled)),
                    liveActivitiesEnabled: Int(int64Field(record, "liveActivitiesEnabled") ?? Int64(existing.liveActivitiesEnabled)),
                    keepScreenAwake: Int(int64Field(record, "keepScreenAwake") ?? Int64(existing.keepScreenAwake)),
                    showOpenInClaudeButton: Int(int64Field(record, "showOpenInClaudeButton") ?? Int64(existing.showOpenInClaudeButton)),
                    developerModeEnabled: existing.developerModeEnabled,
                    countdownSoundsEnabled: Int(int64Field(record, "countdownSoundsEnabled") ?? Int64(existing.countdownSoundsEnabled)),
                    homeTiles: stringField(record, "homeTiles") ?? existing.homeTiles,
                    createdAt: existing.createdAt,
                    updatedAt: updatedAt
                )
                try row.update(db)
                return true
            } else {
                // No local settings — insert from remote
                let now = isoFormatter.string(from: Date())
                let row = UserSettingsRow(
                    id: IDGenerator.generate(),
                    defaultWeightUnit: stringField(record, "defaultWeightUnit") ?? "lbs",
                    enableWorkoutTimer: Int(int64Field(record, "enableWorkoutTimer") ?? 1),
                    autoStartRestTimer: Int(int64Field(record, "autoStartRestTimer") ?? 1),
                    theme: stringField(record, "theme") ?? "auto",
                    notificationsEnabled: Int(int64Field(record, "notificationsEnabled") ?? 1),
                    customPromptAddition: stringField(record, "customPromptAddition"),
                    anthropicApiKey: nil,
                    anthropicApiKeyStatus: "not_set",
                    healthkitEnabled: Int(int64Field(record, "healthKitEnabled") ?? 0),
                    liveActivitiesEnabled: Int(int64Field(record, "liveActivitiesEnabled") ?? 1),
                    keepScreenAwake: Int(int64Field(record, "keepScreenAwake") ?? 1),
                    showOpenInClaudeButton: Int(int64Field(record, "showOpenInClaudeButton") ?? 0),
                    developerModeEnabled: 0,
                    countdownSoundsEnabled: Int(int64Field(record, "countdownSoundsEnabled") ?? 1),
                    homeTiles: stringField(record, "homeTiles"),
                    createdAt: now,
                    updatedAt: dateToISO(remoteUpdatedAt) ?? now
                )
                try row.insert(db)
                return true
            }
        }
    }
}
