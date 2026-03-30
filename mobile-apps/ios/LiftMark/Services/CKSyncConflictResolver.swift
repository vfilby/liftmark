import CloudKit

// MARK: - CKSyncConflictResolver

/// Handles the result of sent record zone changes: success cleanup, conflict resolution,
/// and error-code-specific logging/recovery.
final class CKSyncConflictResolver: @unchecked Sendable {

    private let mapper: CKRecordMapper
    private let lock = NSLock()

    /// Records that already exist on the server — skip these in nextRecordZoneChangeBatch.
    private var resolvedConflicts = Set<String>() // recordID.recordName

    init(mapper: CKRecordMapper) {
        self.mapper = mapper
    }

    /// Returns true if the given recordName was already resolved via server-wins merge.
    func isConflictResolved(_ recordName: String) -> Bool {
        lock.lock()
        let resolved = resolvedConflicts.contains(recordName)
        lock.unlock()
        return resolved
    }

    /// Process the result of a sent-changes event.
    ///
    /// - Parameters:
    ///   - event: The sent-changes event from CKSyncEngine.
    ///   - removePendingType: Callback to remove a record name from the caller's pending-types map.
    ///   - engine: The sync engine, needed to remove pending changes for unknown-item errors.
    func handleSentChanges(
        _ event: CKSyncEngine.Event.SentRecordZoneChanges,
        removePendingType: (String) -> Void,
        engine: CKSyncEngine?
    ) {
        // Clean up successfully saved records
        for savedRecord in event.savedRecords {
            let recordName = savedRecord.recordID.recordName
            removePendingType(recordName)
        }

        // Handle failures
        for failedSave in event.failedRecordSaves {
            let recordName = failedSave.record.recordID.recordName
            let error = failedSave.error

            switch error.code {
            case .serverRecordChanged:
                handleServerRecordChanged(recordName: recordName, error: error)

            case .networkFailure, .networkUnavailable:
                Logger.shared.warn(.sync, "[sync-engine] Network unavailable for \(recordName), CKSyncEngine will retry")

            case .quotaExceeded:
                Logger.shared.error(.sync, "[sync-engine] iCloud storage quota exceeded — user may need to free up iCloud space")

            case .notAuthenticated:
                Logger.shared.error(.sync, "[sync-engine] Not authenticated — user needs to sign in to iCloud")

            case .unknownItem:
                Logger.shared.warn(.sync, "[sync-engine] Unknown item \(recordName) (parent likely deleted), removing from pending")
                let ckRecordID = failedSave.record.recordID
                engine?.state.remove(pendingRecordZoneChanges: [.saveRecord(ckRecordID)])
                removePendingType(recordName)

            case .partialFailure:
                handlePartialFailure(recordName: recordName, error: error)

            default:
                Logger.shared.error(.sync, "[sync-engine] Failed to save \(recordName): code=\(error.code.rawValue) \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Private

    private func handleServerRecordChanged(recordName: String, error: CKError) {
        if let serverRecord = error.serverRecord {
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
        }
    }

    private func handlePartialFailure(recordName: String, error: CKError) {
        if let partialErrors = error.partialErrorsByItemID {
            for (itemID, itemError) in partialErrors {
                Logger.shared.error(.sync, "[sync-engine] Partial failure for \(itemID): \(itemError.localizedDescription)")
            }
        } else {
            Logger.shared.error(.sync, "[sync-engine] Partial failure for \(recordName): \(error.localizedDescription)")
        }
    }
}
