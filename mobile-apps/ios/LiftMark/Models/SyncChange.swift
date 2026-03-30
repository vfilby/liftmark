import Foundation

/// Represents a record change that needs to be synced to CloudKit.
/// Returned by repositories so the calling layer can forward to the sync engine.
enum SyncChange {
    case save(recordType: String, recordID: String)
    case delete(recordType: String, recordID: String)

    /// Send this change to the CKSyncEngineManager.
    func notify() {
        switch self {
        case .save(let recordType, let recordID):
            CKSyncEngineManager.notifySave(recordType: recordType, recordID: recordID)
        case .delete(let recordType, let recordID):
            CKSyncEngineManager.notifyDelete(recordType: recordType, recordID: recordID)
        }
    }

    /// Send an array of changes to the CKSyncEngineManager.
    static func notifyAll(_ changes: [SyncChange]) {
        for change in changes {
            change.notify()
        }
    }
}
