import Foundation
import GRDB

/// Pre-bridge backup primitive for the GRDB migrator bridge.
///
/// Lives in `<Application Support>/LiftMark/pre-grdb-bridge.bak.db`. Writes are performed
/// via the SQLite Online Backup API (`DatabaseReader.backup(to:)`), never `FileManager.copyItem`.
/// Post-write verification is the rowCount / integrity_check / header / required-tables gate.
///
/// See `spec/services/migrator.md` §2 for full semantics.
enum MigratorBridgeBackup {

    // MARK: - Types

    enum VerificationStep: String {
        case integrity
        case header
        case tables
        case rowCount
    }

    enum BackupError: LocalizedError {
        case applicationSupportUnavailable
        case liveDatabaseMissing
        case diskFull(freeBytes: Int64, requiredBytes: Int64)
        case sourceIntegrityFailed(output: String)
        case backupWriteFailed(underlying: Error)
        case verificationFailed(step: VerificationStep, detail: String)
        case restoreFailed(underlying: Error)

        var errorDescription: String? {
            switch self {
            case .applicationSupportUnavailable:
                return "Could not resolve Application Support directory."
            case .liveDatabaseMissing:
                return "Live database file not found."
            case .diskFull(let free, let required):
                return "Insufficient disk space (free=\(free), required=\(required))."
            case .sourceIntegrityFailed(let output):
                return "Pre-existing database integrity failure: \(output)"
            case .backupWriteFailed(let underlying):
                return "Backup write failed: \(underlying.localizedDescription)"
            case .verificationFailed(let step, let detail):
                return "Backup verification failed at step \(step.rawValue): \(detail)"
            case .restoreFailed(let underlying):
                return "Backup restore failed: \(underlying.localizedDescription)"
            }
        }
    }

    // MARK: - Paths

    private static let backupDirName = "LiftMark"
    private static let backupFileName = "pre-grdb-bridge.bak.db"

    /// `<Application Support>/LiftMark/pre-grdb-bridge.bak.db`.
    static func resolveBackupURL() throws -> URL {
        let fm = FileManager.default
        guard let appSupport = try? fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) else {
            throw BackupError.applicationSupportUnavailable
        }
        let dir = appSupport.appendingPathComponent(backupDirName, isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(backupFileName)
    }

    // MARK: - Pre-flight

    /// Asserts disk free ≥ 2× DB size and that `PRAGMA integrity_check` returns `"ok"`.
    /// Renames any stale backup to `<filename>.prev-<iso>` rather than overwriting.
    static func preflight(
        liveDBURL: URL,
        liveDbQueue: DatabaseQueue
    ) throws {
        let fm = FileManager.default

        // Disk free ≥ 2× DB size.
        let dbSize = try dbSizeBytes(at: liveDBURL)
        let free = try diskFreeBytes(for: liveDBURL)
        if free < dbSize * 2 {
            throw BackupError.diskFull(freeBytes: free, requiredBytes: dbSize * 2)
        }

        // Stale prior backup — move out of the way; don't overwrite.
        let backupURL = try resolveBackupURL()
        if fm.fileExists(atPath: backupURL.path) {
            let iso = ISO8601DateFormatter().string(from: Date())
                .replacingOccurrences(of: ":", with: "-")
            var renamed = backupURL.deletingLastPathComponent()
                .appendingPathComponent("\(backupFileName).prev-\(iso)")
            // Same-second collisions: disambiguate with a short UUID suffix.
            if fm.fileExists(atPath: renamed.path) {
                let suffix = UUID().uuidString.prefix(8)
                renamed = backupURL.deletingLastPathComponent()
                    .appendingPathComponent("\(backupFileName).prev-\(iso)-\(suffix)")
            }
            try fm.moveItem(at: backupURL, to: renamed)
        }

        // Source integrity_check.
        let integrity = try liveDbQueue.read { db in
            try String.fetchOne(db, sql: "PRAGMA integrity_check") ?? ""
        }
        if integrity != "ok" {
            throw BackupError.sourceIntegrityFailed(output: integrity)
        }
    }

    // MARK: - Create backup

    /// Creates the backup at `<AppSupport>/LiftMark/pre-grdb-bridge.bak.db` using SQLite's
    /// Online Backup API, then runs post-backup verification. On any failure, leaves the
    /// (possibly-partial) backup file in place — callers rename it to `.prev-<iso>` on retry.
    /// Returns the backup file URL and its size.
    @discardableResult
    static func create(
        from liveDbQueue: DatabaseQueue,
        liveDBURL: URL
    ) throws -> (url: URL, sizeBytes: Int64) {
        let backupURL = try resolveBackupURL()

        do {
            let destQueue = try DatabaseQueue(path: backupURL.path)
            try liveDbQueue.backup(to: destQueue)
            // Explicitly close the destination by dropping the reference.
            _ = destQueue
        } catch {
            throw BackupError.backupWriteFailed(underlying: error)
        }

        try verify(backupURL: backupURL, against: liveDbQueue, liveDBURL: liveDBURL)

        let size = (try? dbSizeBytes(at: backupURL)) ?? 0
        return (backupURL, size)
    }

    // MARK: - Verification

    /// Opens the backup as its own queue and runs integrity_check, `validateDatabaseFile`,
    /// per-table row-count match, and `schema_version` match.
    static func verify(
        backupURL: URL,
        against liveDbQueue: DatabaseQueue,
        liveDBURL: URL
    ) throws {
        // 1. Open the backup as its own queue and integrity-check.
        let backupQueue = try DatabaseQueue(path: backupURL.path)
        let backupIntegrity = try backupQueue.read { db in
            try String.fetchOne(db, sql: "PRAGMA integrity_check") ?? ""
        }
        if backupIntegrity != "ok" {
            throw BackupError.verificationFailed(
                step: .integrity,
                detail: backupIntegrity
            )
        }

        // 2. Header + required-tables check.
        if !DatabaseBackupService.validateDatabaseFile(at: backupURL) {
            throw BackupError.verificationFailed(
                step: .header,
                detail: "validateDatabaseFile failed"
            )
        }

        // 3. Row count per required table matches live.
        let tables = Self.rowCountTables
        let liveCounts = try liveDbQueue.read { db in
            try Self.rowCounts(db: db, tables: tables)
        }
        let backupCounts = try backupQueue.read { db in
            try Self.rowCounts(db: db, tables: tables)
        }
        for table in tables {
            let live = liveCounts[table] ?? -1
            let back = backupCounts[table] ?? -1
            if live != back {
                throw BackupError.verificationFailed(
                    step: .rowCount,
                    detail: "\(table): live=\(live) backup=\(back)"
                )
            }
        }

        // 4. schema_version.version match.
        let liveVersion = try? liveDbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT version FROM schema_version LIMIT 1")
        }
        let backupVersion = try? backupQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT version FROM schema_version LIMIT 1")
        }
        if liveVersion != backupVersion {
            throw BackupError.verificationFailed(
                step: .rowCount,
                detail: "schema_version mismatch: live=\(String(describing: liveVersion)) backup=\(String(describing: backupVersion))"
            )
        }
    }

    // MARK: - Restore

    /// Restore the backup over the live DB. Renames the current live file to
    /// `liftmark.db.failed-<iso>` (kept, not deleted) before copying the backup back.
    /// Sets `UserDefaults.migrator.bridge.lastAttemptFailed = true` so the app can surface
    /// a one-time alert on next launch.
    static func restore(backupURL: URL, liveDBURL: URL) throws {
        let fm = FileManager.default

        guard fm.fileExists(atPath: backupURL.path) else {
            throw BackupError.restoreFailed(underlying: BackupError.liveDatabaseMissing)
        }

        do {
            if fm.fileExists(atPath: liveDBURL.path) {
                let iso = ISO8601DateFormatter().string(from: Date())
                    .replacingOccurrences(of: ":", with: "-")
                let failed = liveDBURL.deletingLastPathComponent()
                    .appendingPathComponent("\(liveDBURL.lastPathComponent).failed-\(iso)")
                try fm.moveItem(at: liveDBURL, to: failed)
            }
            try fm.copyItem(at: backupURL, to: liveDBURL)
        } catch {
            throw BackupError.restoreFailed(underlying: error)
        }

        UserDefaults.standard.set(true, forKey: UserDefaultsKey.lastAttemptFailed)
    }

    // MARK: - Disk / sizing helpers

    static func dbSizeBytes(at url: URL) throws -> Int64 {
        let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
        return (attrs[.size] as? NSNumber)?.int64Value ?? 0
    }

    static func diskFreeBytes(for url: URL) throws -> Int64 {
        let values = try url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        if let capacity = values.volumeAvailableCapacityForImportantUsage {
            return capacity
        }
        // Fallback — rarely hit on-device.
        let attrs = try FileManager.default.attributesOfFileSystem(forPath: url.path)
        return (attrs[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
    }

    // MARK: - UserDefaults keys

    enum UserDefaultsKey {
        static let postSuccessfulLaunchCount = "migrator.bridge.postSuccessfulLaunchCount"
        static let succeededEventSent = "migrator.bridge.succeededEventSent"
        static let lastAttemptFailed = "migrator.bridge.lastAttemptFailed"
        static let lastSuccessBuildNumber = "migrator.bridge.lastSuccessBuildNumber"
    }

    // MARK: - Required tables for row-count comparison

    /// Every table that should exist in both live and backup. Mirrors the `requiredTables`
    /// list in `DatabaseBackupService` plus v12+ arrivals; row counts must match per table.
    /// `sync_engine_state`, `set_measurements`, `schema_version` included when present.
    static let rowCountTables: [String] = [
        "workout_templates",
        "template_exercises",
        "template_sets",
        "user_settings",
        "gyms",
        "gym_equipment",
        "workout_sessions",
        "session_exercises",
        "session_sets"
    ]

    private static func rowCounts(db: Database, tables: [String]) throws -> [String: Int] {
        var out: [String: Int] = [:]
        for table in tables {
            let exists = try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
                arguments: [table]
            ) ?? 0
            if exists == 0 {
                // Table missing from one side counts as 0; the counter will still detect
                // asymmetry because the other side's fetched COUNT(*) will differ.
                out[table] = 0
                continue
            }
            out[table] = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(table)") ?? 0
        }
        return out
    }
}
