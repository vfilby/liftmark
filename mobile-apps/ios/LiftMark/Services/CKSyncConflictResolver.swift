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

    /// Returns true if the given recordName was already resolved (server was newer and merged).
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
    /// - Returns: The number of successfully uploaded records and the number of conflicts encountered.
    @discardableResult
    func handleSentChanges(
        _ event: CKSyncEngine.Event.SentRecordZoneChanges,
        removePendingType: (String) -> Void,
        engine: CKSyncEngine?
    ) -> (uploaded: Int, conflicts: Int) {
        var conflicts = 0

        // Clean up successfully saved records
        for savedRecord in event.savedRecords {
            let recordName = savedRecord.recordID.recordName
            removePendingType(recordName)
        }

        // Handle failures
        for failedSave in event.failedRecordSaves {
            let record = failedSave.record
            let recordName = record.recordID.recordName
            let recordType = record.recordType
            let error = failedSave.error

            switch error.code {
            case .serverRecordChanged:
                conflicts += 1
                handleServerRecordChanged(recordName: recordName, recordType: recordType, error: error)

            case .networkFailure, .networkUnavailable:
                Logger.shared.warn(.sync, "[sync-engine] Network unavailable for \(recordType)/\(recordName) (CKError \(error.code.rawValue)), CKSyncEngine will retry")

            case .quotaExceeded:
                Logger.shared.error(.sync, "[sync-engine] iCloud quota exceeded for \(recordType)/\(recordName) (CKError \(error.code.rawValue))")

            case .notAuthenticated:
                Logger.shared.error(.sync, "[sync-engine] Not authenticated for \(recordType)/\(recordName) (CKError \(error.code.rawValue))")

            case .unknownItem:
                Logger.shared.warn(.sync, "[sync-engine] Unknown item \(recordType)/\(recordName) (CKError \(error.code.rawValue), parent likely deleted), removing from pending")
                let ckRecordID = record.recordID
                engine?.state.remove(pendingRecordZoneChanges: [.saveRecord(ckRecordID)])
                removePendingType(recordName)

            case .partialFailure:
                handlePartialFailure(recordName: recordName, recordType: recordType, error: error)

            default:
                Logger.shared.error(
                    .sync,
                    "[sync-engine] Failed to save \(recordType)/\(recordName): "
                        + "CKError \(error.code.rawValue) "
                        + "(\(Self.errorCodeName(error.code))) "
                        + "— \(error.localizedDescription)"
                )
            }
        }

        return (uploaded: event.savedRecords.count, conflicts: conflicts)
    }

    // MARK: - Private

    private func handleServerRecordChanged(recordName: String, recordType: String, error: CKError) {
        if let serverRecord = error.serverRecord {
            if mapper.serverRecordIsNewer(serverRecord) {
                // Server record is newer (or equal) — merge it and mark resolved
                do {
                    _ = try mapper.mergeIncoming(serverRecord)
                    Logger.shared.info(.sync, "[sync-engine] Conflict: server is newer for \(recordType)/\(recordName), merged server version")
                } catch {
                    Logger.shared.error(.sync, "[sync-engine] Failed to merge conflict for \(recordType)/\(recordName)", error: error)
                }
                // Mark as resolved so nextRecordZoneChangeBatch skips it on retry
                lock.lock()
                resolvedConflicts.insert(recordName)
                lock.unlock()
            } else {
                // Local record is newer — don't merge, don't mark resolved.
                // The record stays pending so CKSyncEngine will re-upload the local version.
                Logger.shared.info(.sync, "[sync-engine] Conflict: local is newer for \(recordType)/\(recordName), will re-upload local version")
            }
        } else {
            Logger.shared.error(.sync, "[sync-engine] serverRecordChanged for \(recordType)/\(recordName) but no serverRecord provided (CKError \(error.code.rawValue))")
        }
    }

    private func handlePartialFailure(recordName: String, recordType: String, error: CKError) {
        if let partialErrors = error.partialErrorsByItemID {
            for (itemID, itemError) in partialErrors {
                let ckError = itemError as? CKError
                let codeInfo = ckError.map { "CKError \($0.code.rawValue) (\(Self.errorCodeName($0.code)))" } ?? "non-CK error"
                let subRecordID = (itemID as? CKRecord.ID)?.recordName ?? "\(itemID)"
                Logger.shared.error(.sync, "[sync-engine] Partial failure for \(recordType)/\(subRecordID): \(codeInfo) — \(itemError.localizedDescription)")
            }
        } else {
            Logger.shared.error(.sync, "[sync-engine] Partial failure for \(recordType)/\(recordName): CKError \(error.code.rawValue) — \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    /// Human-readable name for common CKError codes.
    private static let errorCodeNames: [CKError.Code: String] = [
        .internalError: "internalError",
        .partialFailure: "partialFailure",
        .networkUnavailable: "networkUnavailable",
        .networkFailure: "networkFailure",
        .badContainer: "badContainer",
        .serviceUnavailable: "serviceUnavailable",
        .requestRateLimited: "requestRateLimited",
        .missingEntitlement: "missingEntitlement",
        .notAuthenticated: "notAuthenticated",
        .permissionFailure: "permissionFailure",
        .unknownItem: "unknownItem",
        .invalidArguments: "invalidArguments",
        .serverRecordChanged: "serverRecordChanged",
        .serverRejectedRequest: "serverRejectedRequest",
        .assetFileNotFound: "assetFileNotFound",
        .assetFileModified: "assetFileModified",
        .incompatibleVersion: "incompatibleVersion",
        .constraintViolation: "constraintViolation",
        .operationCancelled: "operationCancelled",
        .changeTokenExpired: "changeTokenExpired",
        .batchRequestFailed: "batchRequestFailed",
        .zoneBusy: "zoneBusy",
        .badDatabase: "badDatabase",
        .quotaExceeded: "quotaExceeded",
        .zoneNotFound: "zoneNotFound",
        .limitExceeded: "limitExceeded",
        .userDeletedZone: "userDeletedZone",
        .managedAccountRestricted: "managedAccountRestricted",
        .participantMayNeedVerification: "participantMayNeedVerification",
        .accountTemporarilyUnavailable: "accountTemporarilyUnavailable",
    ]

    static func errorCodeName(_ code: CKError.Code) -> String {
        errorCodeNames[code] ?? "unknown(\(code.rawValue))"
    }
}
