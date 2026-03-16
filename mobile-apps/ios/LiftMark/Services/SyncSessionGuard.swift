import Foundation
import GRDB

/// Snapshot of an active workout session's database rows, used to detect and restore
/// data loss caused by sync operations.
struct SessionSnapshot {
    let sessionRow: WorkoutSessionRow
    let exerciseRows: [SessionExerciseRow]
    let setRows: [SessionSetRow]

    var exerciseIds: Set<String> { Set(exerciseRows.map(\.id)) }
    var setIds: Set<String> { Set(setRows.map(\.id)) }
    var exerciseCount: Int { exerciseRows.count }
    var setCount: Int { setRows.count }
}

/// Stateless guard that snapshots an active workout session before sync
/// and validates/restores it afterward. Prevents data loss regardless of
/// whether the underlying sync protection logic works correctly.
enum SyncSessionGuard {

    // MARK: - Snapshot

    /// Captures the current in-progress session and all its child rows.
    /// Returns nil if no active session exists.
    static func takeSnapshot() -> SessionSnapshot? {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let snapshot = try dbQueue.read { db -> SessionSnapshot? in
                guard let session = try WorkoutSessionRow
                    .filter(Column("status") == "in_progress")
                    .fetchOne(db)
                else {
                    return nil
                }

                let exercises = try SessionExerciseRow
                    .filter(Column("workout_session_id") == session.id)
                    .fetchAll(db)

                let exerciseIds = exercises.map(\.id)
                var sets: [SessionSetRow] = []
                if !exerciseIds.isEmpty {
                    sets = try SessionSetRow
                        .filter(exerciseIds.contains(Column("session_exercise_id")))
                        .fetchAll(db)
                }

                return SessionSnapshot(
                    sessionRow: session,
                    exerciseRows: exercises,
                    setRows: sets
                )
            }

            // Log OUTSIDE the db read block to avoid reentrancy (Logger writes to the same DB)
            if let snapshot {
                Logger.shared.debug(.sync,
                    "[sync-guard] Snapshot: session=\(snapshot.sessionRow.id), exercises=\(snapshot.exerciseCount), sets=\(snapshot.setCount)")
            } else {
                Logger.shared.debug(.sync, "[sync-guard] No active session, skipping snapshot")
            }

            return snapshot
        } catch {
            Logger.shared.error(.sync, "[sync-guard] Failed to take snapshot: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Validate & Restore

    /// Compares current database state against the snapshot. If any exercise or set IDs
    /// from the snapshot are missing, restores them. Returns true if session was intact.
    @discardableResult
    static func validateAndRestore(snapshot: SessionSnapshot) -> Bool {
        do {
            let dbQueue = try DatabaseManager.shared.database()

            let (missingExercises, missingSets) = try dbQueue.read { db -> ([SessionExerciseRow], [SessionSetRow]) in
                // Check session still exists
                let currentSession = try WorkoutSessionRow.fetchOne(db, key: snapshot.sessionRow.id)
                guard let currentSession else {
                    return (snapshot.exerciseRows, snapshot.setRows)
                }

                // If the session was canceled since the snapshot was taken,
                // don't restore anything — the user intentionally discarded it.
                if currentSession.status == SessionStatus.canceled.rawValue {
                    Logger.shared.debug(.sync,
                        "[sync-guard] Session \(snapshot.sessionRow.id) was canceled, skipping restore")
                    return ([], [])
                }

                // Find current exercise IDs
                let exerciseRows = try Row.fetchAll(db, sql: "SELECT id FROM session_exercises WHERE workout_session_id = ?", arguments: [snapshot.sessionRow.id])
                let currentExIds = Set(exerciseRows.compactMap { $0["id"] as String? })
                let missingEx = snapshot.exerciseRows.filter { !currentExIds.contains($0.id) }

                // Find current set IDs
                let snapshotExerciseIds = snapshot.exerciseRows.map(\.id)
                guard !snapshotExerciseIds.isEmpty else {
                    return (missingEx, [])
                }
                let placeholders = snapshotExerciseIds.map { _ in "?" }.joined(separator: ",")
                let setRows = try Row.fetchAll(db, sql: "SELECT id FROM session_sets WHERE session_exercise_id IN (\(placeholders))", arguments: StatementArguments(snapshotExerciseIds))
                let currentSetIds = Set(setRows.compactMap { $0["id"] as String? })
                let missingSt = snapshot.setRows.filter { !currentSetIds.contains($0.id) }

                return (missingEx, missingSt)
            }

            if missingExercises.isEmpty && missingSets.isEmpty {
                // Log OUTSIDE db block
                Logger.shared.debug(.sync,
                    "[sync-guard] Intact after sync: exercises=\(snapshot.exerciseCount), sets=\(snapshot.setCount)")
                return true
            }

            // Data loss detected — log OUTSIDE db block
            let missingExIds = missingExercises.map(\.id)
            let missingSetIds = missingSets.map(\.id)
            Logger.shared.error(.sync,
                "[sync-guard] DATA LOSS: missing \(missingExercises.count) exercises \(missingExIds), \(missingSets.count) sets \(missingSetIds)")

            try restore(missingExercises: missingExercises, missingSets: missingSets,
                        session: snapshot.sessionRow, dbQueue: dbQueue)

            Logger.shared.error(.sync,
                "[sync-guard] RESTORED \(missingExercises.count) exercises, \(missingSets.count) sets")
            return false

        } catch {
            Logger.shared.error(.sync, "[sync-guard] RESTORE FAILED: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Private

    /// Re-inserts missing rows. Exercises before sets (parent before child).
    private static func restore(
        missingExercises: [SessionExerciseRow],
        missingSets: [SessionSetRow],
        session: WorkoutSessionRow,
        dbQueue: DatabaseQueue
    ) throws {
        try dbQueue.write { db in
            // Restore session if missing
            if try WorkoutSessionRow.fetchOne(db, key: session.id) == nil {
                try session.insert(db)
            }

            // Exercises first (parent)
            for exercise in missingExercises {
                try exercise.insert(db)
            }

            // Sets second (child)
            for set in missingSets {
                try set.insert(db)
            }
        }
    }
}
