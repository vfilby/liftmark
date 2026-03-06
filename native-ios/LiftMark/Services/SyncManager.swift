import Foundation

extension Notification.Name {
    static let syncCompleted = Notification.Name("syncCompleted")
}

actor SyncManager {
    static let shared = SyncManager()

    private var isSyncing = false
    private var pollingTask: Task<Void, Never>?
    private let pollingInterval: Duration = .seconds(300) // 5 minutes

    private init() {}

    // MARK: - Sync

    @discardableResult
    func triggerSync() async -> SyncResult? {
        guard !isSyncing else {
            Logger.shared.info(.sync, "Sync already in progress, skipping")
            return nil
        }

        isSyncing = true
        Logger.shared.info(.sync, "Sync triggered")

        let snapshot = SyncSessionGuard.takeSnapshot()

        let result = await CloudKitService.shared.syncAll()

        // Validate BEFORE posting .syncCompleted so SessionStore picks up restored data
        if let snapshot {
            SyncSessionGuard.validateAndRestore(snapshot: snapshot)
        }

        isSyncing = false

        if result.success {
            Logger.shared.info(.sync, "Sync completed: \(result.uploaded) up, \(result.downloaded) down, \(result.conflicts) conflicts")
            await MainActor.run {
                NotificationCenter.default.post(name: .syncCompleted, object: nil)
            }
        } else {
            Logger.shared.error(.sync, "Sync failed: \(result.errors.joined(separator: ", "))")
        }

        return result
    }

    // MARK: - Polling

    func startPolling() {
        guard pollingTask == nil else { return }

        Logger.shared.info(.sync, "Starting sync polling (every \(pollingInterval))")

        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: self?.pollingInterval ?? .seconds(300))
                guard !Task.isCancelled else { break }
                await self?.triggerSync()
            }
        }
    }

    func stopPolling() {
        guard pollingTask != nil else { return }
        Logger.shared.info(.sync, "Stopping sync polling")
        pollingTask?.cancel()
        pollingTask = nil
    }
}
