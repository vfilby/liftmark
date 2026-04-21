import Foundation
import GRDB

/// Loads a frozen DB seed (DDL + data) into a unique temp DB for migration upgrade-path tests.
///
/// Contract:
/// - One temp directory per seed load so parallel XCTest invocations don't collide.
/// - `PRAGMA foreign_keys = ON` matches the production `DatabaseManager` connection pragma.
/// - DDL and data are applied in a single transaction. If either throws, the temp file is left on disk
///   for post-mortem; the caller is responsible for teardown via `cleanup()`.
/// - Returned queue is opened against the temp file; the path is exposed so tests can run subsequent
///   migrations on the same file by constructing their own queue.
///
/// The `runWithMigrations` helper is the common path: seed → migrate → assert.
enum DatabaseSeedLoader {

    struct LoadedSeed {
        let path: String
        let directory: URL
    }

    /// Writes `ddl` and `data` (in that order) into a fresh temp DB and returns its path.
    /// Does NOT run migrations — callers invoke `DatabaseManager.runMigrations(on:)` if they want them.
    static func load(ddl: String, data: String = "") throws -> LoadedSeed {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("liftmark-migration-tests")
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        let dbPath = tempDir.appendingPathComponent("seed.db").path

        let dbQueue = try DatabaseQueue(path: dbPath)
        try dbQueue.write { db in
            try db.execute(sql: "PRAGMA foreign_keys = ON")
        }
        try dbQueue.write { db in
            if !ddl.isEmpty { try db.execute(sql: ddl) }
            if !data.isEmpty { try db.execute(sql: data) }
        }
        return LoadedSeed(path: dbPath, directory: tempDir)
    }

    /// Removes the temp directory containing a loaded seed. Safe to call on a missing directory.
    static func cleanup(_ loaded: LoadedSeed) {
        try? FileManager.default.removeItem(at: loaded.directory)
    }

    /// Opens a `DatabaseQueue` at the given path with the same pragma dance as production.
    static func openQueue(at path: String) throws -> DatabaseQueue {
        let dbQueue = try DatabaseQueue(path: path)
        try dbQueue.write { db in
            try db.execute(sql: "PRAGMA foreign_keys = ON")
        }
        return dbQueue
    }
}
