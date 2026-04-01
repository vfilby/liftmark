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

// MARK: - CKSyncEngineManager

final class CKSyncEngineManager: @unchecked Sendable {
    static let shared = CKSyncEngineManager()

    private let container = CKContainer(identifier: "iCloud.com.eff3.liftmark.v2")
    private var engine: CKSyncEngine?
    private let mapper = CKRecordMapper()
    let zoneID = CKRecordZone.ID(zoneName: "LiftMarkData", ownerName: CKCurrentUserDefaultName)

    /// Track record types for pending changes (CKRecord.ID doesn't carry type)
    private var pendingRecordTypes: [String: String] = [:] // recordID.recordName -> recordType
    private let lock = NSLock()

    private var currentSnapshot: SessionSnapshot?

    // Sync stats accumulated during a fetch/send cycle
    private var syncDownloaded = 0
    private var syncUploaded = 0
    private var syncConflicts = 0
    private var syncChangedRecordTypes: Set<String> = []

    // Rate limiting for automatic fetches
    private static let minimumFetchInterval: TimeInterval = 30
    private var lastSyncTime: Date?

    // Composed helpers
    private let metadataStore = CKSyncMetadataStore()
    private lazy var conflictResolver = CKSyncConflictResolver(mapper: mapper)

    private init() {}

    // MARK: - Lifecycle

    /// Whether we've already triggered zone creation + full upload in this session.
    private var hasScheduledInitialUpload = false

    func start() {
        lock.lock()
        guard engine == nil else {
            lock.unlock()
            return
        }

        let serialization = loadPersistedState()
        let isFirstStart = serialization == nil

        let config = CKSyncEngine.Configuration(
            database: container.privateCloudDatabase,
            stateSerialization: serialization,
            delegate: self
        )
        engine = CKSyncEngine(config)
        lock.unlock()

        Logger.shared.info(.sync, "CKSyncEngine started (firstStart=\(isFirstStart))")

        // Don't create zone here — the engine fires .accountChange immediately,
        // which handles zone creation. Doing it here too causes a race.
    }

    func stop() {
        lock.lock()
        engine = nil
        lock.unlock()
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

    // MARK: - Sync Metadata (delegated)

    func getLastSyncDate() -> Date? { metadataStore.getLastSyncDate() }
    func getLastSyncStats() -> LastSyncStats? { metadataStore.getLastSyncStats() }
    func getSyncEnabled() -> Bool { metadataStore.getSyncEnabled() }
    func setSyncEnabled(_ enabled: Bool) { metadataStore.setSyncEnabled(enabled) }

    // MARK: - Fetch

    /// Fetch remote changes. Automatic calls are rate-limited; pass `manual: true` to bypass.
    func fetchChanges(manual: Bool = false) {
        if !manual {
            lock.lock()
            let lastSync = lastSyncTime
            lock.unlock()
            if let lastSync,
               Date().timeIntervalSince(lastSync) < Self.minimumFetchInterval {
                Logger.shared.debug(.sync, "[sync-engine] Skipping automatic fetch — last sync was \(Int(Date().timeIntervalSince(lastSync)))s ago (minimum \(Int(Self.minimumFetchInterval))s)")
                return
            }
        }
        lock.lock()
        let currentEngine = engine
        lock.unlock()
        Task {
            try? await currentEngine?.fetchChanges()
        }
    }

    // MARK: - Public API for Repositories

    static func notifySave(recordType: String, recordID: String) {
        let manager = CKSyncEngineManager.shared
        manager.lock.lock()
        manager.pendingRecordTypes[recordID] = recordType
        let engine = manager.engine
        manager.lock.unlock()
        let ckRecordID = CKRecord.ID(recordName: recordID, zoneID: manager.zoneID)
        engine?.state.add(pendingRecordZoneChanges: [.saveRecord(ckRecordID)])
    }

    static func notifyDelete(recordType: String, recordID: String) {
        let manager = CKSyncEngineManager.shared
        manager.lock.lock()
        manager.pendingRecordTypes.removeValue(forKey: recordID)
        let engine = manager.engine
        manager.lock.unlock()
        let ckRecordID = CKRecord.ID(recordName: recordID, zoneID: manager.zoneID)
        engine?.state.add(pendingRecordZoneChanges: [.deleteRecord(ckRecordID)])
    }

    // MARK: - Zone Management

    private func createZoneAndScheduleFullUpload() async {
        Logger.shared.info(.sync, "[sync-engine] Creating zone \(zoneID.zoneName)...")

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
                    lock.lock()
                    let currentEngine = engine
                    lock.unlock()
                    currentEngine?.state.add(pendingRecordZoneChanges: pendingChanges)
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

    // MARK: - Fetched Changes

    /// Dependency order for merging: parents before children.
    private static let mergeOrder = [
        "Gym", "GymEquipment", "WorkoutPlan", "PlannedExercise", "PlannedSet",
        "WorkoutSession", "SessionExercise", "SessionSet", "UserSettings"
    ]

    private func handleFetchedChanges(_ event: CKSyncEngine.Event.FetchedRecordZoneChanges) {
        let protectedIds = mapper.getActiveSessionProtectedIds()
        var downloaded = 0

        // Sort modifications by dependency order (parents before children)
        let sortedModifications = event.modifications.sorted { a, b in
            let aIndex = Self.mergeOrder.firstIndex(of: a.record.recordType) ?? Int.max
            let bIndex = Self.mergeOrder.firstIndex(of: b.record.recordType) ?? Int.max
            return aIndex < bIndex
        }

        // Multi-pass merge: retry until all records are merged or no progress is made.
        // This handles arbitrarily deep FK hierarchies (e.g., Plan → Exercise → Set).
        var pendingRecords: [CKRecord] = []
        var changedTypes: Set<String> = []

        for modification in sortedModifications {
            let record = modification.record
            let recordId = record.recordID.recordName
            let recordType = record.recordType

            if let protectedSet = protectedIds.byRecordType[recordType], protectedSet.contains(recordId) {
                Logger.shared.debug(.sync, "[sync-engine] Skipping protected record: \(recordType)/\(recordId)")
                continue
            }
            pendingRecords.append(record)
        }

        let maxPasses = Self.mergeOrder.count
        for pass in 0..<maxPasses {
            guard !pendingRecords.isEmpty else { break }

            var failedRecords: [CKRecord] = []
            var mergedThisPass = 0

            for record in pendingRecords {
                let recordId = record.recordID.recordName
                let recordType = record.recordType
                do {
                    let merged = try mapper.mergeIncoming(record)
                    if merged {
                        downloaded += 1
                        mergedThisPass += 1
                        changedTypes.insert(recordType)
                        Logger.shared.debug(.sync, "[sync-engine] Merged \(recordType)/\(recordId)\(pass > 0 ? " (pass \(pass + 1))" : "")")
                    } else {
                        failedRecords.append(record)
                    }
                } catch {
                    failedRecords.append(record)
                }
            }

            pendingRecords = failedRecords

            if mergedThisPass == 0 {
                for record in pendingRecords {
                    Logger.shared.error(.sync, "[sync-engine] Failed to merge \(record.recordType)/\(record.recordID.recordName) after \(pass + 1) passes")
                }
                break
            }

            if !pendingRecords.isEmpty {
                Logger.shared.debug(.sync, "[sync-engine] Pass \(pass + 1) merged \(mergedThisPass), retrying \(pendingRecords.count) remaining")
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
                downloaded += 1
                changedTypes.insert(recordType)
                Logger.shared.debug(.sync, "[sync-engine] Deleted \(recordType)/\(recordId)")
            } catch {
                Logger.shared.error(.sync, "[sync-engine] Failed to delete \(recordType)/\(recordId)", error: error)
            }
        }

        lock.lock()
        syncDownloaded += downloaded
        syncChangedRecordTypes.formUnion(changedTypes)
        lock.unlock()
    }

    // MARK: - Sent Changes (delegated)

    private func handleSentChanges(_ event: CKSyncEngine.Event.SentRecordZoneChanges) {
        let result = conflictResolver.handleSentChanges(event, removePendingType: { recordName in
            self.lock.lock()
            self.pendingRecordTypes.removeValue(forKey: recordName)
            self.lock.unlock()
        }, engine: engine)

        lock.lock()
        syncUploaded += result.uploaded
        syncConflicts += result.conflicts
        lock.unlock()
    }

    // MARK: - Account Changes

    private func handleAccountChange(_ event: CKSyncEngine.Event.AccountChange) {
        switch event.changeType {
        case .switchAccounts:
            Logger.shared.warn(.sync, "[sync-engine] CloudKit account switched — resetting upload state before syncing to new account")
            lock.lock()
            hasScheduledInitialUpload = true
            lock.unlock()
            Logger.shared.info(.sync, "[sync-engine] Account changed (\(event.changeType)), creating zone and scheduling full upload")
            Task {
                await createZoneAndScheduleFullUpload()
            }
        case .signIn:
            lock.lock()
            guard !hasScheduledInitialUpload else {
                lock.unlock()
                Logger.shared.info(.sync, "[sync-engine] Account changed but initial upload already scheduled, skipping")
                return
            }
            hasScheduledInitialUpload = true
            lock.unlock()
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

    // MARK: - Sync Stats Helpers (synchronous, safe to call from async context)

    private func resetSyncStats() {
        lock.lock()
        syncDownloaded = 0
        syncUploaded = 0
        syncConflicts = 0
        syncChangedRecordTypes = []
        lock.unlock()
    }

    private func collectSyncStats() -> (stats: LastSyncStats, changedRecordTypes: Set<String>) {
        lock.lock()
        let stats = LastSyncStats(uploaded: syncUploaded, downloaded: syncDownloaded, conflicts: syncConflicts)
        let changed = syncChangedRecordTypes
        lastSyncTime = Date()
        lock.unlock()
        return (stats, changed)
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
            resetSyncStats()

        case .didFetchChanges:
            if let snapshot = currentSnapshot {
                SyncSessionGuard.validateAndRestore(snapshot: snapshot)
            }
            currentSnapshot = nil
            let (stats, changedRecordTypes) = collectSyncStats()
            metadataStore.updateSyncMetadata(stats: stats)
            await MainActor.run {
                NotificationCenter.default.post(
                    name: .syncCompleted,
                    object: nil,
                    userInfo: ["changedRecordTypes": changedRecordTypes]
                )
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
            if self.conflictResolver.isConflictResolved(recordName) {
                return nil
            }

            return self.mapper.createCKRecord(for: recordID, zoneID: self.zoneID)
        }
        return batch
    }
}
