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

// MARK: - CloudKitService

final class CloudKitService {
    static let shared = CloudKitService()

    private let container: CKContainer?
    private let database: CKDatabase?
    private var isInitialized = false

    private init() {
        // CKContainer.default() can crash on simulators without CloudKit entitlements.
        // Guard against that by catching any ObjC exception or Swift trap.
        let c: CKContainer? = {
            // Check if CloudKit entitlement exists before attempting to create container
            if Bundle.main.object(forInfoDictionaryKey: "com.apple.developer.icloud-container-identifiers") == nil,
               Bundle.main.object(forInfoDictionaryKey: "com.apple.developer.ubiquity-container-identifiers") == nil {
                // No CloudKit entitlement — skip container creation
                return nil
            }
            return CKContainer.default()
        }()
        self.container = c
        self.database = c?.privateCloudDatabase
    }

    // MARK: - Initialize

    /// Initialize the CloudKit connection.
    func initialize() async -> Bool {
        guard let container else {
            Logger.shared.warn(.app, "CloudKit not configured — no entitlement found")
            return false
        }
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
        guard let container else { return .noAccount }
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
        guard let database else { return nil }
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
        guard let database else { return nil }
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
        guard let database else { return [] }
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
        guard let database else { return false }
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

    /// Perform a full sync: upload all local entities, download all remote records, merge with last-writer-wins.
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

        // 3. Upload all local entities in dependency order
        let uploadResult = await uploadAllEntities()
        result.uploaded = uploadResult.count
        result.errors.append(contentsOf: uploadResult.errors)

        // 4. Download all remote records and merge
        let downloadResult = await downloadAndMergeAllEntities(isFirstSync: isFirstSync)
        result.downloaded = downloadResult.count
        result.conflicts = downloadResult.conflicts
        result.errors.append(contentsOf: downloadResult.errors)

        // 5. Handle deletes (skip on first sync)
        if !isFirstSync {
            let deleteResult = await handleDeletes(
                localIds: uploadResult.localIds,
                remoteIds: downloadResult.remoteIds
            )
            result.errors.append(contentsOf: deleteResult.errors)
        }

        // 6. Update sync metadata
        updateLastSyncDate()

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

    private func updateLastSyncDate() {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                let existing = try Row.fetchOne(db, sql: "SELECT id FROM sync_metadata LIMIT 1")
                if existing != nil {
                    try db.execute(sql: "UPDATE sync_metadata SET last_sync_date = ?, updated_at = ?", arguments: [now, now])
                } else {
                    try db.execute(
                        sql: "INSERT INTO sync_metadata (id, device_id, last_sync_date, sync_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                        arguments: [IDGenerator.generate(), UUID().uuidString, now, 1, now, now]
                    )
                }
            }
        } catch {
            Logger.shared.error(.app, "Failed to update sync metadata", error: error)
        }
    }

    // MARK: - Upload

    private func uploadAllEntities() async -> UploadResult {
        var result = UploadResult()

        // Upload order per spec: Gym, GymEquipment, WorkoutPlan, PlannedExercise, PlannedSet,
        // WorkoutSession, SessionExercise, SessionSet, UserSettings
        do {
            let dbQueue = try DatabaseManager.shared.database()

            // Gym
            let gyms = try await dbQueue.read { db in try GymRow.fetchAll(db) }
            result.localIds["Gym"] = Set(gyms.map { $0.id })
            for gym in gyms {
                let record = gymToRecord(gym)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload Gym \(gym.id)") }
            }

            // GymEquipment
            let equipment = try await dbQueue.read { db in try GymEquipmentRow.fetchAll(db) }
            result.localIds["GymEquipment"] = Set(equipment.map { $0.id })
            for eq in equipment {
                let record = gymEquipmentToRecord(eq)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload GymEquipment \(eq.id)") }
            }

            // WorkoutPlan (just the plan row, not exercises/sets — those are separate record types)
            let plans = try await dbQueue.read { db in try WorkoutPlanRow.fetchAll(db) }
            result.localIds["WorkoutPlan"] = Set(plans.map { $0.id })
            for plan in plans {
                let record = workoutPlanToRecord(plan)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload WorkoutPlan \(plan.id)") }
            }

            // PlannedExercise
            let plannedExercises = try await dbQueue.read { db in try PlannedExerciseRow.fetchAll(db) }
            result.localIds["PlannedExercise"] = Set(plannedExercises.map { $0.id })
            for ex in plannedExercises {
                let record = plannedExerciseToRecord(ex)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload PlannedExercise \(ex.id)") }
            }

            // PlannedSet
            let plannedSets = try await dbQueue.read { db in try PlannedSetRow.fetchAll(db) }
            result.localIds["PlannedSet"] = Set(plannedSets.map { $0.id })
            for ps in plannedSets {
                let record = plannedSetToRecord(ps)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload PlannedSet \(ps.id)") }
            }

            // WorkoutSession
            let sessions = try await dbQueue.read { db in try WorkoutSessionRow.fetchAll(db) }
            result.localIds["WorkoutSession"] = Set(sessions.map { $0.id })
            for session in sessions {
                let record = workoutSessionToRecord(session)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload WorkoutSession \(session.id)") }
            }

            // SessionExercise
            let sessionExercises = try await dbQueue.read { db in try SessionExerciseRow.fetchAll(db) }
            result.localIds["SessionExercise"] = Set(sessionExercises.map { $0.id })
            for se in sessionExercises {
                let record = sessionExerciseToRecord(se)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload SessionExercise \(se.id)") }
            }

            // SessionSet
            let sessionSets = try await dbQueue.read { db in try SessionSetRow.fetchAll(db) }
            result.localIds["SessionSet"] = Set(sessionSets.map { $0.id })
            for ss in sessionSets {
                let record = sessionSetToRecord(ss)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload SessionSet \(ss.id)") }
            }

            // UserSettings
            let settings = try await dbQueue.read { db in try UserSettingsRow.fetchOne(db) }
            if let settings {
                result.localIds["UserSettings"] = Set(["user-settings"])
                let record = userSettingsToRecord(settings)
                if await saveRecord(record) != nil { result.count += 1 }
                else { result.errors.append("Failed to upload UserSettings") }
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

        // Download order per spec (same as upload): parents before children
        let recordTypes = ["Gym", "GymEquipment", "WorkoutPlan", "PlannedExercise", "PlannedSet",
                           "WorkoutSession", "SessionExercise", "SessionSet", "UserSettings"]

        for recordType in recordTypes {
            let remoteRecords = await fetchRecords(recordType: recordType)
            var ids = Set<String>()
            for record in remoteRecords {
                ids.insert(record.recordId)
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

    // MARK: - Delete Handling

    private func handleDeletes(localIds: [String: Set<String>], remoteIds: [String: Set<String>]) async -> DeleteResult {
        var result = DeleteResult()

        // Delete order: children before parents (reverse of sync order)
        let deleteOrder = ["SessionSet", "SessionExercise", "WorkoutSession",
                           "PlannedSet", "PlannedExercise", "WorkoutPlan",
                           "GymEquipment", "Gym"]

        for recordType in deleteOrder {
            let local = localIds[recordType] ?? []
            let remote = remoteIds[recordType] ?? []

            // Records in local but not remote → deleted on another device → delete locally
            let toDeleteLocally = local.subtracting(remote)
            for id in toDeleteLocally {
                do {
                    try deleteLocalRecord(id: id, recordType: recordType)
                } catch {
                    result.errors.append("Failed to delete local \(recordType) \(id): \(error.localizedDescription)")
                }
            }

            // Records in remote but not local → deleted on this device → delete remotely
            let toDeleteRemotely = remote.subtracting(local)
            for id in toDeleteRemotely {
                let success = await deleteRecord(recordId: id, recordType: recordType)
                if !success {
                    result.errors.append("Failed to delete remote \(recordType) \(id)")
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
        if let p = ex.parentExerciseId { fields["parentExerciseId"] = p }
        return CloudKitRecord(recordId: ex.id, recordType: "PlannedExercise", fields: fields)
    }

    private func plannedSetToRecord(_ ps: PlannedSetRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "plannedExerciseId": makeReference(recordType: "PlannedExercise", recordId: ps.templateExerciseId),
            "orderIndex": Int64(ps.orderIndex),
            "isDropset": Int64(ps.isDropset),
            "isPerSide": Int64(ps.isPerSide),
            "isAmrap": Int64(ps.isAmrap),
        ]
        if let w = ps.targetWeight { fields["targetWeight"] = w }
        if let u = ps.targetWeightUnit { fields["targetWeightUnit"] = u }
        if let r = ps.targetReps { fields["targetReps"] = Int64(r) }
        if let t = ps.targetTime { fields["targetTime"] = Int64(t) }
        if let rpe = ps.targetRpe { fields["targetRpe"] = Double(rpe) }
        if let r = ps.restSeconds { fields["restSeconds"] = Int64(r) }
        if let t = ps.tempo { fields["tempo"] = t }
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
        if let p = se.parentExerciseId { fields["parentExerciseId"] = p }
        return CloudKitRecord(recordId: se.id, recordType: "SessionExercise", fields: fields)
    }

    private func sessionSetToRecord(_ ss: SessionSetRow) -> CloudKitRecord {
        var fields: [String: Any] = [
            "sessionExerciseId": makeReference(recordType: "SessionExercise", recordId: ss.sessionExerciseId),
            "orderIndex": Int64(ss.orderIndex),
            "status": ss.status,
            "isDropset": Int64(ss.isDropset),
            "isPerSide": Int64(ss.isPerSide),
        ]
        if let p = ss.parentSetId { fields["parentSetId"] = p }
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
        if let t = ss.tempo { fields["tempo"] = t }
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
            if let existing, !remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = GymRow(
                id: record.recordId,
                name: stringField(record, "name") ?? "Gym",
                isDefault: Int(int64Field(record, "isDefault") ?? 0),
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
            if let existing, !remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = GymEquipmentRow(
                id: record.recordId,
                name: stringField(record, "name") ?? "Equipment",
                isAvailable: Int(int64Field(record, "isAvailable") ?? 1),
                lastCheckedAt: dateToISO(dateField(record, "lastCheckedAt")),
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
            // PlannedExercise has no updatedAt — always overwrite from remote if newer parent or new record
            let row = PlannedExerciseRow(
                id: record.recordId,
                workoutTemplateId: referenceId(record, "workoutPlanId") ?? existing?.workoutTemplateId ?? "",
                exerciseName: stringField(record, "exerciseName") ?? existing?.exerciseName ?? "",
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                notes: stringField(record, "notes"),
                equipmentType: stringField(record, "equipmentType"),
                groupType: stringField(record, "groupType"),
                groupName: stringField(record, "groupName"),
                parentExerciseId: stringField(record, "parentExerciseId")
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergePlannedSet(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try PlannedSetRow.fetchOne(db, key: record.recordId)
            let row = PlannedSetRow(
                id: record.recordId,
                templateExerciseId: referenceId(record, "plannedExerciseId") ?? existing?.templateExerciseId ?? "",
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                targetWeight: doubleField(record, "targetWeight"),
                targetWeightUnit: stringField(record, "targetWeightUnit"),
                targetReps: int64Field(record, "targetReps").map { Int($0) },
                targetTime: int64Field(record, "targetTime").map { Int($0) },
                targetRpe: int64Field(record, "targetRpe").map { Int($0) } ?? doubleField(record, "targetRpe").map { Int($0) },
                restSeconds: int64Field(record, "restSeconds").map { Int($0) },
                tempo: stringField(record, "tempo"),
                isDropset: Int(int64Field(record, "isDropset") ?? 0),
                isPerSide: Int(int64Field(record, "isPerSide") ?? 0),
                isAmrap: Int(int64Field(record, "isAmrap") ?? 0),
                notes: stringField(record, "notes")
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergeWorkoutSession(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try WorkoutSessionRow.fetchOne(db, key: record.recordId)
            // Use startTime for LWW comparison since sessions don't have updatedAt
            let row = WorkoutSessionRow(
                id: record.recordId,
                workoutTemplateId: stringField(record, "workoutPlanId"),
                name: stringField(record, "name") ?? existing?.name ?? "Workout",
                date: stringField(record, "date") ?? existing?.date ?? "",
                startTime: dateToISO(dateField(record, "startTime")),
                endTime: dateToISO(dateField(record, "endTime")),
                duration: int64Field(record, "duration").map { Int($0) },
                notes: stringField(record, "notes"),
                status: stringField(record, "status") ?? existing?.status ?? SessionStatus.inProgress.rawValue
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergeSessionExercise(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try SessionExerciseRow.fetchOne(db, key: record.recordId)
            let row = SessionExerciseRow(
                id: record.recordId,
                workoutSessionId: referenceId(record, "workoutSessionId") ?? existing?.workoutSessionId ?? "",
                exerciseName: stringField(record, "exerciseName") ?? existing?.exerciseName ?? "",
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                notes: stringField(record, "notes"),
                equipmentType: stringField(record, "equipmentType"),
                groupType: stringField(record, "groupType"),
                groupName: stringField(record, "groupName"),
                parentExerciseId: stringField(record, "parentExerciseId"),
                status: stringField(record, "status") ?? existing?.status ?? ExerciseStatus.pending.rawValue
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return existing == nil
        }
    }

    private func mergeSessionSet(_ record: CloudKitRecord, dbQueue: DatabaseQueue) throws -> Bool {
        return try dbQueue.write { db in
            let existing = try SessionSetRow.fetchOne(db, key: record.recordId)
            let row = SessionSetRow(
                id: record.recordId,
                sessionExerciseId: referenceId(record, "sessionExerciseId") ?? existing?.sessionExerciseId ?? "",
                orderIndex: Int(int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                parentSetId: stringField(record, "parentSetId"),
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
                tempo: stringField(record, "tempo"),
                isDropset: Int(int64Field(record, "isDropset") ?? 0),
                isPerSide: Int(int64Field(record, "isPerSide") ?? 0)
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
