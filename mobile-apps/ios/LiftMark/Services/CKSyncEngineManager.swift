import CloudKit
import GRDB

// MARK: - Notification

extension Notification.Name {
    static let syncCompleted = Notification.Name("syncCompleted")
}

// MARK: - CloudKit Account Status

enum CloudKitAccountStatus: String {
    case available
    case noAccount
    case restricted
    case couldNotDetermine
    case error
}

// MARK: - Last Sync Stats

struct LastSyncStats {
    var uploaded: Int
    var downloaded: Int
    var conflicts: Int
}

// MARK: - CKSyncEngineManager

final class CKSyncEngineManager: @unchecked Sendable {
    static let shared = CKSyncEngineManager()

    private let container = CKContainer(identifier: "iCloud.com.eff3.liftmark.v2")
    private var engine: CKSyncEngine?
    private let mapper = CKRecordMapper()
    let zoneID = CKRecordZone.ID(zoneName: "LiftMarkData", ownerName: CKCurrentUserDefaultName)

    /// Track record types for pending changes (CKRecord.ID doesn't carry type)
    private var pendingRecordTypes: [String: String] = [:] // recordID.recordName -> recordType
    /// Records that already exist on the server — skip these in nextRecordZoneChangeBatch
    private var resolvedConflicts = Set<String>() // recordID.recordName
    private let lock = NSLock()

    private var currentSnapshot: SessionSnapshot?

    private init() {}

    // MARK: - Lifecycle

    /// Whether we've already triggered zone creation + full upload in this session.
    private var hasScheduledInitialUpload = false

    func start() {
        guard engine == nil else { return }

        let serialization = loadPersistedState()
        let isFirstStart = serialization == nil

        let config = CKSyncEngine.Configuration(
            database: container.privateCloudDatabase,
            stateSerialization: serialization,
            delegate: self
        )
        engine = CKSyncEngine(config)

        Logger.shared.info(.sync, "CKSyncEngine started (firstStart=\(isFirstStart))")

        // Don't create zone here — the engine fires .accountChange immediately,
        // which handles zone creation. Doing it here too causes a race.
    }

    func stop() {
        engine = nil
        Logger.shared.info(.sync, "CKSyncEngine stopped")
    }

    // MARK: - Account Status

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
            Logger.shared.error(.sync, "Failed to get CloudKit account status", error: error)

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

    // MARK: - Sync Metadata

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
            Logger.shared.error(.sync, "Failed to read last sync date", error: error)
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
            Logger.shared.error(.sync, "Failed to read last sync stats", error: error)
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
            Logger.shared.error(.sync, "Failed to update sync enabled", error: error)
        }
    }

    private func updateSyncMetadata() {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                let existing = try Row.fetchOne(db, sql: "SELECT id FROM sync_metadata LIMIT 1")
                if existing != nil {
                    try db.execute(
                        sql: "UPDATE sync_metadata SET last_sync_date = ?, updated_at = ?",
                        arguments: [now, now]
                    )
                } else {
                    try db.execute(
                        sql: "INSERT INTO sync_metadata (id, device_id, last_sync_date, sync_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                        arguments: [IDGenerator.generate(), UUID().uuidString, now, 1, now, now]
                    )
                }
            }
        } catch {
            Logger.shared.error(.sync, "Failed to update sync metadata", error: error)
        }
    }

    // MARK: - Manual Fetch

    func fetchChanges() {
        Task {
            try? await engine?.fetchChanges()
        }
    }

    // MARK: - Public API for Repositories

    static func notifySave(recordType: String, recordID: String) {
        let manager = CKSyncEngineManager.shared
        manager.lock.lock()
        manager.pendingRecordTypes[recordID] = recordType
        manager.lock.unlock()

        let ckRecordID = CKRecord.ID(recordName: recordID, zoneID: manager.zoneID)
        manager.engine?.state.add(pendingRecordZoneChanges: [.saveRecord(ckRecordID)])
    }

    static func notifyDelete(recordType: String, recordID: String) {
        let manager = CKSyncEngineManager.shared
        manager.lock.lock()
        manager.pendingRecordTypes.removeValue(forKey: recordID)
        manager.lock.unlock()

        let ckRecordID = CKRecord.ID(recordName: recordID, zoneID: manager.zoneID)
        manager.engine?.state.add(pendingRecordZoneChanges: [.deleteRecord(ckRecordID)])
    }

    private func isConflictResolved(_ recordName: String) -> Bool {
        lock.lock()
        let resolved = resolvedConflicts.contains(recordName)
        lock.unlock()
        return resolved
    }

    // MARK: - Zone Management

    private func createZoneAndScheduleFullUpload() async {
        Logger.shared.info(.sync, "[sync-engine] Creating zone \(zoneID.zoneName)...")

        // Create the custom zone
        let zone = CKRecordZone(zoneID: zoneID)
        do {
            _ = try await container.privateCloudDatabase.save(zone)
            Logger.shared.info(.sync, "[sync-engine] Created record zone: \(zoneID.zoneName)")
        } catch {
            let ckError = error as? CKError
            if ckError?.code == .zoneNotFound || ckError?.code == .partialFailure {
                Logger.shared.info(.sync, "[sync-engine] Zone already exists (non-fatal): \(error.localizedDescription)")
            } else {
                Logger.shared.error(.sync, "[sync-engine] Failed to create zone: \(error)")
            }
        }

        // Collect all local record IDs and schedule them for upload
        scheduleFullUpload()
    }

    private func scheduleFullUpload() {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            try dbQueue.read { db in
                let tables: [(tableName: String, recordType: String)] = [
                    ("gyms", "Gym"),
                    ("gym_equipment", "GymEquipment"),
                    ("workout_templates", "WorkoutPlan"),
                    ("template_exercises", "PlannedExercise"),
                    ("template_sets", "PlannedSet"),
                    ("workout_sessions", "WorkoutSession"),
                    ("session_exercises", "SessionExercise"),
                    ("session_sets", "SessionSet"),
                    // user_settings excluded — fetched from server, only uploaded on change
                ]

                var pendingChanges: [CKSyncEngine.PendingRecordZoneChange] = []

                for (tableName, recordType) in tables {
                    let rows = try Row.fetchAll(db, sql: "SELECT id FROM \(tableName)")
                    for row in rows {
                        guard let id: String = row["id"] else { continue }
                        let recordID = CKRecord.ID(recordName: id, zoneID: zoneID)
                        pendingChanges.append(.saveRecord(recordID))

                        lock.lock()
                        pendingRecordTypes[id] = recordType
                        lock.unlock()
                    }
                }

                if !pendingChanges.isEmpty {
                    engine?.state.add(pendingRecordZoneChanges: pendingChanges)
                    Logger.shared.info(.sync, "Scheduled full upload: \(pendingChanges.count) records")
                }
            }
        } catch {
            Logger.shared.error(.sync, "Failed to schedule full upload", error: error)
        }
    }

    // MARK: - State Persistence

    private func persistState(_ serialization: CKSyncEngine.State.Serialization) {
        do {
            let data = try JSONEncoder().encode(serialization)
            let dbQueue = try DatabaseManager.shared.database()
            try dbQueue.write { db in
                try db.execute(
                    sql: "INSERT OR REPLACE INTO sync_engine_state (id, data) VALUES ('default', ?)",
                    arguments: [data]
                )
            }
        } catch {
            Logger.shared.error(.sync, "Failed to persist sync engine state", error: error)
        }
    }

    private func loadPersistedState() -> CKSyncEngine.State.Serialization? {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            return try dbQueue.read { db in
                let row = try Row.fetchOne(db, sql: "SELECT data FROM sync_engine_state WHERE id = 'default'")
                guard let row, let data: Data = row["data"] else { return nil }
                return try JSONDecoder().decode(CKSyncEngine.State.Serialization.self, from: data)
            }
        } catch {
            Logger.shared.error(.sync, "Failed to load persisted sync engine state", error: error)
            return nil
        }
    }

    // MARK: - Event Handlers

    /// Dependency order for merging: parents before children.
    private static let mergeOrder = [
        "Gym", "GymEquipment", "WorkoutPlan", "PlannedExercise", "PlannedSet",
        "WorkoutSession", "SessionExercise", "SessionSet", "UserSettings"
    ]

    private func handleFetchedChanges(_ event: CKSyncEngine.Event.FetchedRecordZoneChanges) {
        let protectedIds = mapper.getActiveSessionProtectedIds()

        // Sort modifications by dependency order (parents before children)
        let sortedModifications = event.modifications.sorted { a, b in
            let aIndex = Self.mergeOrder.firstIndex(of: a.record.recordType) ?? Int.max
            let bIndex = Self.mergeOrder.firstIndex(of: b.record.recordType) ?? Int.max
            return aIndex < bIndex
        }

        // Two-pass merge: first pass inserts what it can, second pass retries
        // failures (e.g., superset children that depend on parent exercises).
        var failedRecords: [CKRecord] = []

        for modification in sortedModifications {
            let record = modification.record
            let recordId = record.recordID.recordName
            let recordType = record.recordType

            if let protectedSet = protectedIds.byRecordType[recordType], protectedSet.contains(recordId) {
                Logger.shared.debug(.sync, "[sync-engine] Skipping protected record: \(recordType)/\(recordId)")
                continue
            }

            do {
                let merged = try mapper.mergeIncoming(record)
                if merged {
                    Logger.shared.debug(.sync, "[sync-engine] Merged \(recordType)/\(recordId)")
                }
            } catch {
                failedRecords.append(record)
            }
        }

        // Retry failed records (parents should exist now)
        for record in failedRecords {
            let recordId = record.recordID.recordName
            let recordType = record.recordType
            do {
                let merged = try mapper.mergeIncoming(record)
                if merged {
                    Logger.shared.debug(.sync, "[sync-engine] Merged (retry) \(recordType)/\(recordId)")
                }
            } catch {
                Logger.shared.error(.sync, "[sync-engine] Failed to merge \(recordType)/\(recordId)", error: error)
            }
        }

        for deletion in event.deletions {
            let recordId = deletion.recordID.recordName
            let recordType = deletion.recordType

            // Skip if this record belongs to an active workout session
            if let protectedSet = protectedIds.byRecordType[recordType], protectedSet.contains(recordId) {
                Logger.shared.debug(.sync, "[sync-engine] Skipping protected deletion: \(recordType)/\(recordId)")
                continue
            }

            do {
                try mapper.deleteLocalRecord(id: recordId)
                Logger.shared.debug(.sync, "[sync-engine] Deleted \(recordType)/\(recordId)")
            } catch {
                Logger.shared.error(.sync, "[sync-engine] Failed to delete \(recordType)/\(recordId)", error: error)
            }
        }
    }

    private func handleSentChanges(_ event: CKSyncEngine.Event.SentRecordZoneChanges) {
        // Clean up successfully saved records
        for savedRecord in event.savedRecords {
            let recordName = savedRecord.recordID.recordName
            lock.lock()
            pendingRecordTypes.removeValue(forKey: recordName)
            lock.unlock()
        }

        // Handle conflicts: merge server record into local DB, then stop retrying.
        // The server version is now local. Future local changes will be queued via notifySave.
        for failedSave in event.failedRecordSaves {
            let recordName = failedSave.record.recordID.recordName
            let error = failedSave.error

            if error.code == .serverRecordChanged,
               let serverRecord = error.serverRecord {
                do {
                    _ = try mapper.mergeIncoming(serverRecord)
                    Logger.shared.info(.sync, "[sync-engine] Merged server version for \(recordName)")
                } catch {
                    Logger.shared.error(.sync, "[sync-engine] Failed to merge conflict for \(recordName)", error: error)
                }
                // Mark as resolved so nextRecordZoneChangeBatch skips it on retry
                lock.lock()
                resolvedConflicts.insert(recordName)
                lock.unlock()
            } else {
                Logger.shared.error(.sync, "[sync-engine] Failed to save \(recordName): \(error.localizedDescription)")
            }
        }

    }

    private func handleAccountChange(_ event: CKSyncEngine.Event.AccountChange) {
        switch event.changeType {
        case .signIn, .switchAccounts:
            guard !hasScheduledInitialUpload else {
                Logger.shared.info(.sync, "[sync-engine] Account changed but initial upload already scheduled, skipping")
                return
            }
            hasScheduledInitialUpload = true
            Logger.shared.info(.sync, "[sync-engine] Account changed (\(event.changeType)), creating zone and scheduling full upload")
            Task {
                await createZoneAndScheduleFullUpload()
            }
        case .signOut:
            Logger.shared.info(.sync, "[sync-engine] Account signed out, clearing engine state")
            do {
                let dbQueue = try DatabaseManager.shared.database()
                try dbQueue.write { db in
                    try db.execute(sql: "DELETE FROM sync_engine_state")
                }
            } catch {
                Logger.shared.error(.sync, "[sync-engine] Failed to clear engine state on sign out", error: error)
            }
        @unknown default:
            Logger.shared.warn(.sync, "[sync-engine] Unknown account change type")
        }
    }
}

// MARK: - CKSyncEngineDelegate

extension CKSyncEngineManager: CKSyncEngineDelegate {
    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        switch event {
        case .stateUpdate(let stateUpdate):
            persistState(stateUpdate.stateSerialization)

        case .accountChange(let accountChange):
            handleAccountChange(accountChange)

        case .fetchedRecordZoneChanges(let fetchedChanges):
            handleFetchedChanges(fetchedChanges)

        case .sentRecordZoneChanges(let sentChanges):
            handleSentChanges(sentChanges)

        case .willFetchChanges:
            currentSnapshot = SyncSessionGuard.takeSnapshot()

        case .didFetchChanges:
            if let snapshot = currentSnapshot {
                SyncSessionGuard.validateAndRestore(snapshot: snapshot)
            }
            currentSnapshot = nil
            updateSyncMetadata()
            await MainActor.run {
                NotificationCenter.default.post(name: .syncCompleted, object: nil)
            }

        case .willSendChanges, .didSendChanges:
            break

        case .willFetchRecordZoneChanges, .didFetchRecordZoneChanges:
            break

        case .fetchedDatabaseChanges, .sentDatabaseChanges:
            break

        @unknown default:
            break
        }
    }

    func nextRecordZoneChangeBatch(
        _ context: CKSyncEngine.SendChangesContext,
        syncEngine: CKSyncEngine
    ) async -> CKSyncEngine.RecordZoneChangeBatch? {
        // Deduplicate pending changes (re-queued conflicts can cause duplicates)
        var seen = Set<CKRecord.ID>()
        let pendingChanges = syncEngine.state.pendingRecordZoneChanges.filter { change in
            let id: CKRecord.ID
            switch change {
            case .saveRecord(let recordID): id = recordID
            case .deleteRecord(let recordID): id = recordID
            @unknown default: return true
            }
            guard !seen.contains(id) else { return false }
            seen.insert(id)
            return true
        }

        let batch = await CKSyncEngine.RecordZoneChangeBatch(pendingChanges: pendingChanges) { recordID in
            let recordName = recordID.recordName

            // Skip records that were already resolved via conflict merge
            if self.isConflictResolved(recordName) {
                return nil
            }

            return self.mapper.createCKRecord(for: recordID, zoneID: self.zoneID)
        }
        return batch
    }
}

