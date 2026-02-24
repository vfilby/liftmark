import Foundation
import GRDB

// MARK: - DatabaseBackupService

enum DatabaseBackupService {

    private static let dbName = "liftmark.db"

    private static let requiredTables = [
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

    // MARK: - Database Path

    /// Get the file path to the current SQLite database file.
    static func getDatabasePath() throws -> URL {
        let documentsURL = try FileManager.default.url(
            for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        return documentsURL
            .appendingPathComponent("SQLite", isDirectory: true)
            .appendingPathComponent(dbName)
    }

    // MARK: - Export

    /// Export a copy of the current database file to the cache directory.
    /// Returns the URL of the exported backup.
    static func exportDatabase() throws -> URL {
        let dbPath = try getDatabasePath()

        guard FileManager.default.fileExists(atPath: dbPath.path) else {
            throw BackupError.databaseNotFound
        }

        let timestamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
            .replacingOccurrences(of: "T", with: "_")
            .replacingOccurrences(of: "Z", with: "")
        let exportFileName = "liftmark_backup_\(timestamp).db"

        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let exportURL = cacheDir.appendingPathComponent(exportFileName)

        // Remove existing file if present
        try? FileManager.default.removeItem(at: exportURL)

        try FileManager.default.copyItem(at: dbPath, to: exportURL)

        return exportURL
    }

    // MARK: - Validate

    /// Validate that a file is a legitimate SQLite database suitable for import.
    static func validateDatabaseFile(at fileURL: URL) -> Bool {
        let fileManager = FileManager.default

        // Check file exists
        guard fileManager.fileExists(atPath: fileURL.path) else { return false }

        // Check file size (at least 1024 bytes)
        guard let attributes = try? fileManager.attributesOfItem(atPath: fileURL.path),
              let fileSize = attributes[.size] as? Int,
              fileSize >= 1024 else {
            return false
        }

        // Check SQLite magic header (first 16 bytes)
        guard let fileHandle = try? FileHandle(forReadingFrom: fileURL) else { return false }
        let headerData = fileHandle.readData(ofLength: 16)
        fileHandle.closeFile()

        let expectedHeader: [UInt8] = [
            0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66,
            0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00
        ]

        guard headerData.count == 16 else { return false }

        for (i, byte) in headerData.enumerated() {
            if byte != expectedHeader[i] { return false }
        }

        // Check required tables
        do {
            let dbQueue = try DatabaseQueue(path: fileURL.path)
            let tables = try dbQueue.read { db in
                try String.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type='table'")
            }

            for required in requiredTables {
                if !tables.contains(required) { return false }
            }
        } catch {
            return false
        }

        return true
    }

    // MARK: - Import

    /// Replace the current database with the contents of an imported database file.
    /// WARNING: This is a destructive operation that replaces all existing data.
    static func importDatabase(from fileURL: URL) throws {
        let dbPath = try getDatabasePath()
        let fileManager = FileManager.default

        // Create safety backup
        let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let backupURL = cacheDir.appendingPathComponent("backup_before_import.db")

        if fileManager.fileExists(atPath: dbPath.path) {
            try? fileManager.removeItem(at: backupURL)
            try fileManager.copyItem(at: dbPath, to: backupURL)
        }

        do {
            // Close current database connection
            DatabaseManager.shared.close()

            // Delete current database
            if fileManager.fileExists(atPath: dbPath.path) {
                try fileManager.removeItem(at: dbPath)
            }

            // Copy imported file to database location
            try fileManager.copyItem(at: fileURL, to: dbPath)

            // Reopen database to verify
            _ = try DatabaseManager.shared.database()

            // Clean up safety backup
            try? fileManager.removeItem(at: backupURL)
        } catch {
            // Attempt to restore from safety backup
            if fileManager.fileExists(atPath: backupURL.path) {
                do {
                    if fileManager.fileExists(atPath: dbPath.path) {
                        try fileManager.removeItem(at: dbPath)
                    }
                    try fileManager.copyItem(at: backupURL, to: dbPath)
                    _ = try DatabaseManager.shared.database()
                } catch {
                    Logger.shared.error(.database, "Failed to restore backup after import failure", error: error)
                }
            }

            throw BackupError.importFailed(error.localizedDescription)
        }
    }
}

// MARK: - Errors

enum BackupError: LocalizedError {
    case databaseNotFound
    case importFailed(String)

    var errorDescription: String? {
        switch self {
        case .databaseNotFound:
            return "Database file not found. Please restart the app."
        case .importFailed(let reason):
            return "Import failed: \(reason). Your original data is intact."
        }
    }
}
