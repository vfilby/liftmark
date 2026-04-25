import Foundation
import GRDB

// Set/exercise mutations for an in-progress session. Split out from SessionRepository
// to keep the main file under SwiftLint's type_body_length / file_length limits.
extension SessionRepository {

    @discardableResult
    // swiftlint:disable:next function_parameter_count
    func updateSessionSet(
        _ setId: String,
        actualWeight: Double?,
        actualWeightUnit: WeightUnit?,
        actualReps: Int?,
        actualTime: Int?,
        actualRpe: Int?,
        status: SetStatus
    ) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        let completedAt = status == .completed ? now : nil

        let oldMeasurementIds = try dbQueue.read { db in
            try fetchMeasurementIds(setId: setId, role: "actual", db: db)
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            try db.execute(
                sql: """
                UPDATE session_sets
                SET status = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                arguments: [status.rawValue, completedAt, now, setId]
            )
            try deleteMeasurements(setId: setId, role: "actual", db: db)
            let actual = EntryValues(
                weight: actualWeight.map { MeasuredWeight(value: $0, unit: actualWeightUnit ?? .lbs) },
                reps: actualReps,
                time: actualTime,
                distance: nil,
                rpe: actualRpe
            )
            newMeasurementIds = try insertMeasurements(
                actual, setId: setId, role: "actual", groupIndex: 0, now: now, db: db
            )
        }
        return measurementSyncChanges(setId: setId, deleted: oldMeasurementIds, saved: newMeasurementIds)
    }

    @discardableResult
    func updateSessionSetTarget(
        _ setId: String,
        targetWeight: Double?,
        targetReps: Int?,
        targetTime: Int?,
        restSeconds: Int?
    ) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now

        let oldMeasurementIds = try dbQueue.read { db in
            try fetchMeasurementIds(setId: setId, role: "target", db: db)
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            // rest is stored on the session_sets row, not in set_measurements
            try db.execute(
                sql: "UPDATE session_sets SET updated_at = ?, rest_seconds = ? WHERE id = ?",
                arguments: [now, restSeconds, setId]
            )
            try deleteMeasurements(setId: setId, role: "target", db: db)
            let target = EntryValues(
                weight: targetWeight.map { MeasuredWeight(value: $0, unit: .lbs) },
                reps: targetReps,
                time: targetTime,
                distance: nil,
                rpe: nil
            )
            newMeasurementIds = try insertMeasurements(
                target, setId: setId, role: "target", groupIndex: 0, now: now, db: db
            )
        }
        return measurementSyncChanges(setId: setId, deleted: oldMeasurementIds, saved: newMeasurementIds)
    }

    /// Complete a drop set by saving multiple actual entries at different groupIndices.
    @discardableResult
    func completeDropSet(
        _ setId: String,
        entries: [(weight: Double?, weightUnit: WeightUnit?, reps: Int?)]
    ) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now

        let oldMeasurementIds = try dbQueue.read { db in
            try fetchMeasurementIds(setId: setId, role: "actual", db: db)
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            try db.execute(
                sql: """
                UPDATE session_sets
                SET status = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                arguments: [SetStatus.completed.rawValue, now, now, setId]
            )
            try deleteMeasurements(setId: setId, role: "actual", db: db)

            for (groupIndex, entry) in entries.enumerated() {
                let actual = EntryValues(
                    weight: entry.weight.map { MeasuredWeight(value: $0, unit: entry.weightUnit ?? .lbs) },
                    reps: entry.reps,
                    time: nil,
                    distance: nil,
                    rpe: nil
                )
                let inserted = try insertMeasurements(
                    actual, setId: setId, role: "actual", groupIndex: groupIndex, now: now, db: db
                )
                newMeasurementIds.append(contentsOf: inserted)
            }
        }
        return measurementSyncChanges(setId: setId, deleted: oldMeasurementIds, saved: newMeasurementIds)
    }

    @discardableResult
    func skipSet(_ setId: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE session_sets SET status = ?, updated_at = ? WHERE id = ?",
                arguments: [SetStatus.skipped.rawValue, now, setId]
            )
        }
        return [.save(recordType: "SessionSet", recordID: setId)]
    }

    func insertSessionExercise(
        sessionId: String,
        exerciseName: String,
        orderIndex: Int,
        notes: String? = nil,
        equipmentType: String? = nil
    ) throws -> (String, [SyncChange]) {
        let dbQueue = try dbManager.database()
        let exerciseId = IDGenerator.generate()
        let now = self.now
        try dbQueue.write { db in
            let row = SessionExerciseRow(
                id: exerciseId,
                workoutSessionId: sessionId,
                exerciseName: exerciseName,
                orderIndex: orderIndex,
                notes: notes,
                equipmentType: equipmentType,
                groupType: nil,
                groupName: nil,
                parentExerciseId: nil,
                status: ExerciseStatus.pending.rawValue,
                updatedAt: now
            )
            try row.insert(db)
        }
        return (exerciseId, [.save(recordType: "SessionExercise", recordID: exerciseId)])
    }

    @discardableResult
    func insertSessionSet(
        exerciseId: String, orderIndex: Int,
        targetWeight: Double? = nil, targetWeightUnit: WeightUnit? = nil,
        targetReps: Int? = nil, targetTime: Int? = nil,
        restSeconds: Int? = nil
    ) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let setId = IDGenerator.generate()
        let now = self.now
        var measurementIds: [String] = []
        try dbQueue.write { db in
            let row = SessionSetRow(
                id: setId,
                sessionExerciseId: exerciseId,
                orderIndex: orderIndex,
                restSeconds: restSeconds,
                completedAt: nil,
                status: SetStatus.pending.rawValue,
                notes: nil,
                isDropset: 0,
                isPerSide: 0,
                isAmrap: 0,
                side: nil,
                updatedAt: now
            )
            try row.insert(db)

            // Insert target measurements
            let target = EntryValues(
                weight: targetWeight.map { MeasuredWeight(value: $0, unit: targetWeightUnit ?? .lbs) },
                reps: targetReps,
                time: targetTime,
                distance: nil,
                rpe: nil
            )
            if !target.isEmpty {
                let rows = target.toMeasurementRows(
                    setId: setId,
                    parentType: "session",
                    role: "target",
                    groupIndex: 0,
                    now: now
                )
                for mRow in rows {
                    try mRow.insert(db)
                    measurementIds.append(mRow.id)
                }
            }
        }
        var changes: [SyncChange] = [.save(recordType: "SessionSet", recordID: setId)]
        for mId in measurementIds {
            changes.append(.save(recordType: "SetMeasurement", recordID: mId))
        }
        return changes
    }

    /// Update the freeform notes on a workout session. Used for workout-level notes
    /// captured during, at the end of, or after a session. Empty/whitespace-only input
    /// is stored as NULL so there is a single canonical "no notes" state.
    @discardableResult
    func updateSessionNotes(_ sessionId: String, notes: String?) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        let normalized: String? = {
            guard let trimmed = notes?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
                return nil
            }
            return trimmed
        }()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE workout_sessions SET notes = ?, updated_at = ? WHERE id = ?",
                arguments: [normalized, now, sessionId]
            )
        }
        return [.save(recordType: "WorkoutSession", recordID: sessionId)]
    }

    @discardableResult
    func updateSessionExercise(
        _ exerciseId: String,
        name: String,
        notes: String?,
        equipmentType: String?
    ) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        try dbQueue.write { db in
            try db.execute(
                sql: """
                UPDATE session_exercises
                SET exercise_name = ?, notes = ?, equipment_type = ?, updated_at = ?
                WHERE id = ?
                """,
                arguments: [name, notes, equipmentType, now, exerciseId]
            )
        }
        return [.save(recordType: "SessionExercise", recordID: exerciseId)]
    }

    @discardableResult
    func deleteSessionExercise(_ exerciseId: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        // Collect child set IDs and measurement IDs before deleting
        let (childSetIds, measurementIds) = try dbQueue.read { db -> ([String], [String]) in
            let setRows = try Row.fetchAll(
                db,
                sql: "SELECT id FROM session_sets WHERE session_exercise_id = ?",
                arguments: [exerciseId]
            )
            let setIds = setRows.compactMap { $0["id"] as String? }
            var mIds: [String] = []
            for setId in setIds {
                let mRows = try Row.fetchAll(
                    db,
                    sql: "SELECT id FROM set_measurements WHERE set_id = ?",
                    arguments: [setId]
                )
                mIds.append(contentsOf: mRows.compactMap { $0["id"] as String? })
            }
            return (setIds, mIds)
        }
        try dbQueue.write { db in
            // Delete measurements for sets (no CASCADE)
            for setId in childSetIds {
                try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ?", arguments: [setId])
            }
            try db.execute(sql: "DELETE FROM session_exercises WHERE id = ?", arguments: [exerciseId])
        }
        var changes: [SyncChange] = []
        for mId in measurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        for setId in childSetIds {
            changes.append(.delete(recordType: "SessionSet", recordID: setId))
        }
        changes.append(.delete(recordType: "SessionExercise", recordID: exerciseId))
        return changes
    }

    @discardableResult
    func deleteSessionSet(_ setId: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        // Collect measurement IDs before deleting
        let measurementIds = try dbQueue.read { db -> [String] in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT id FROM set_measurements WHERE set_id = ?",
                arguments: [setId]
            )
            return rows.compactMap { $0["id"] as String? }
        }
        try dbQueue.write { db in
            // Delete measurements first (no CASCADE)
            try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ?", arguments: [setId])
            try db.execute(sql: "DELETE FROM session_sets WHERE id = ?", arguments: [setId])
        }
        var changes: [SyncChange] = []
        for mId in measurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        changes.append(.delete(recordType: "SessionSet", recordID: setId))
        return changes
    }

    // MARK: - Shared measurement helpers

    fileprivate func fetchMeasurementIds(setId: String, role: String, db: Database) throws -> [String] {
        let rows = try Row.fetchAll(db, sql: """
            SELECT id FROM set_measurements
            WHERE set_id = ? AND parent_type = 'session' AND role = ?
            """, arguments: [setId, role])
        return rows.compactMap { $0["id"] as String? }
    }

    fileprivate func deleteMeasurements(setId: String, role: String, db: Database) throws {
        try db.execute(
            sql: """
            DELETE FROM set_measurements
            WHERE set_id = ? AND parent_type = 'session' AND role = ?
            """,
            arguments: [setId, role]
        )
    }

    // swiftlint:disable:next function_parameter_count
    fileprivate func insertMeasurements(
        _ values: EntryValues,
        setId: String,
        role: String,
        groupIndex: Int,
        now: String,
        db: Database
    ) throws -> [String] {
        guard !values.isEmpty else { return [] }
        var ids: [String] = []
        let rows = values.toMeasurementRows(
            setId: setId, parentType: "session", role: role, groupIndex: groupIndex, now: now
        )
        for mRow in rows {
            try mRow.insert(db)
            ids.append(mRow.id)
        }
        return ids
    }

    fileprivate func measurementSyncChanges(
        setId: String,
        deleted: [String],
        saved: [String]
    ) -> [SyncChange] {
        var changes: [SyncChange] = [.save(recordType: "SessionSet", recordID: setId)]
        changes.append(contentsOf: deleted.map { .delete(recordType: "SetMeasurement", recordID: $0) })
        changes.append(contentsOf: saved.map { .save(recordType: "SetMeasurement", recordID: $0) })
        return changes
    }
}
