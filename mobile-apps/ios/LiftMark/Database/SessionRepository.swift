import Foundation
import GRDB

/// Repository for WorkoutSession CRUD operations.
///
/// Auxiliary logic lives in sibling files:
/// - `SessionRepository+Assembly.swift` — `assembleSession` row→model mapping
/// - `SessionRepository+Create.swift` — `createFromPlan` and graph-insert helpers
/// - `SessionRepository+Stats.swift` — best-weight aggregate queries
/// - `SessionRepository+SetMutations.swift` — in-progress set/exercise mutations
struct SessionRepository {
    let dbManager: DatabaseManager

    var now: String { ISO8601DateFormatter().string(from: Date()) }

    init(dbManager: DatabaseManager = .shared) {
        self.dbManager = dbManager
    }

    // MARK: - Read

    func getAll() throws -> [WorkoutSession] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let sessionRows = try WorkoutSessionRow.order(Column("date").desc).fetchAll(db)
            return try sessionRows.map { try assembleSession(from: $0, in: db) }
        }
    }

    func getById(_ id: String) throws -> WorkoutSession? {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            guard let row = try WorkoutSessionRow.fetchOne(db, key: id) else { return nil }
            return try assembleSession(from: row, in: db)
        }
    }

    func getCompleted() throws -> [WorkoutSession] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let sessionRows = try WorkoutSessionRow
                .filter(Column("status") == SessionStatus.completed.rawValue)
                .order(Column("end_time").desc, Column("date").desc)
                .fetchAll(db)
            return try sessionRows.map { try assembleSession(from: $0, in: db) }
        }
    }

    func getActiveSession() throws -> WorkoutSession? {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            guard let row = try WorkoutSessionRow
                .filter(Column("status") == SessionStatus.inProgress.rawValue)
                .fetchOne(db) else { return nil }
            return try assembleSession(from: row, in: db)
        }
    }

    /// Get recent completed sessions, ordered by end_time descending.
    func getRecentSessions(_ limit: Int) throws -> [WorkoutSession] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let sessionRows = try WorkoutSessionRow
                .filter(Column("status") == SessionStatus.completed.rawValue)
                .order(Column("end_time").desc, Column("date").desc)
                .limit(limit)
                .fetchAll(db)
            return try sessionRows.map { try assembleSession(from: $0, in: db) }
        }
    }

    // MARK: - Write

    @discardableResult
    func complete(_ sessionId: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = ISO8601DateFormatter().string(from: Date())
        try dbQueue.write { db in
            guard let row = try WorkoutSessionRow.fetchOne(db, key: sessionId) else { return }
            var duration: Int?
            if let startTime = row.startTime,
               let start = ISO8601DateFormatter().date(from: startTime) {
                duration = Int(Date().timeIntervalSince(start))
            }
            try db.execute(
                sql: """
                UPDATE workout_sessions
                SET status = ?, end_time = ?, duration = ?, updated_at = ?
                WHERE id = ?
                """,
                arguments: [SessionStatus.completed.rawValue, now, duration, now, sessionId]
            )
        }
        return [.save(recordType: "WorkoutSession", recordID: sessionId)]
    }

    @discardableResult
    func cancel(_ sessionId: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE workout_sessions SET status = ?, updated_at = ? WHERE id = ?",
                arguments: [SessionStatus.canceled.rawValue, now, sessionId]
            )
        }
        return [.save(recordType: "WorkoutSession", recordID: sessionId)]
    }

    /// Cancel all in-progress sessions. Used to clean up stale sessions before starting a new workout.
    @discardableResult
    func cancelAllInProgress() throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        let canceledIds: [String] = try dbQueue.write { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT id FROM workout_sessions WHERE status = ?",
                arguments: [SessionStatus.inProgress.rawValue]
            )
            let ids = rows.compactMap { $0["id"] as String? }
            try db.execute(
                sql: "UPDATE workout_sessions SET status = ?, updated_at = ? WHERE status = ?",
                arguments: [SessionStatus.canceled.rawValue, now, SessionStatus.inProgress.rawValue]
            )
            return ids
        }
        return canceledIds.map { .save(recordType: "WorkoutSession", recordID: $0) }
    }

    @discardableResult
    func delete(_ id: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let (exerciseIds, setIds, measurementIds) = try dbQueue.read { db -> ([String], [String], [String]) in
            try collectSessionChildIds(sessionId: id, db: db)
        }
        try dbQueue.write { db in
            for setId in setIds {
                try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ?", arguments: [setId])
            }
            try db.execute(sql: "DELETE FROM workout_sessions WHERE id = ?", arguments: [id])
        }
        var changes: [SyncChange] = []
        changes.append(contentsOf: measurementIds.map { .delete(recordType: "SetMeasurement", recordID: $0) })
        changes.append(contentsOf: setIds.map { .delete(recordType: "SessionSet", recordID: $0) })
        changes.append(contentsOf: exerciseIds.map { .delete(recordType: "SessionExercise", recordID: $0) })
        changes.append(.delete(recordType: "WorkoutSession", recordID: id))
        return changes
    }

    private func collectSessionChildIds(
        sessionId: String,
        db: Database
    ) throws -> (exerciseIds: [String], setIds: [String], measurementIds: [String]) {
        let exRows = try Row.fetchAll(
            db,
            sql: "SELECT id FROM session_exercises WHERE workout_session_id = ?",
            arguments: [sessionId]
        )
        let exIds = exRows.compactMap { $0["id"] as String? }
        let setRows = try Row.fetchAll(db, sql: """
            SELECT ss.id FROM session_sets ss
            JOIN session_exercises se ON se.id = ss.session_exercise_id
            WHERE se.workout_session_id = ?
        """, arguments: [sessionId])
        let sIds = setRows.compactMap { $0["id"] as String? }
        var mIds: [String] = []
        for setId in sIds {
            let mRows = try Row.fetchAll(
                db,
                sql: "SELECT id FROM set_measurements WHERE set_id = ?",
                arguments: [setId]
            )
            mIds.append(contentsOf: mRows.compactMap { $0["id"] as String? })
        }
        return (exIds, sIds, mIds)
    }
}
