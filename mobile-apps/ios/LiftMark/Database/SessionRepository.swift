import Foundation
import GRDB

/// Repository for WorkoutSession CRUD operations.
struct SessionRepository {
    private let dbManager: DatabaseManager

    private var now: String { ISO8601DateFormatter().string(from: Date()) }

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

    // MARK: - Write

    func createFromPlan(_ plan: WorkoutPlan) throws -> (WorkoutSession, [SyncChange]) {
        let dbQueue = try dbManager.database()
        let now = ISO8601DateFormatter().string(from: Date())
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: Date())

        let session = WorkoutSession(
            id: IDGenerator.generate(),
            workoutPlanId: plan.id,
            name: plan.name,
            date: dateString,
            startTime: now,
            status: .inProgress
        )

        var createdExerciseIds: [String] = []
        var createdSetIds: [String] = []
        var createdMeasurementIds: [String] = []

        let result = try dbQueue.write { db -> WorkoutSession in
            let sessionRow = WorkoutSessionRow(
                id: session.id,
                workoutTemplateId: plan.id,
                name: plan.name,
                date: dateString,
                startTime: now,
                endTime: nil,
                duration: nil,
                notes: nil,
                status: SessionStatus.inProgress.rawValue,
                updatedAt: now
            )
            try sessionRow.insert(db)

            // Map plan exercise IDs to session exercise IDs for parentExerciseId
            var planToSessionIdMap: [String: String] = [:]
            for exercise in plan.exercises {
                let sessionExerciseId = IDGenerator.generate()
                planToSessionIdMap[exercise.id] = sessionExerciseId
            }

            for exercise in plan.exercises {
                guard let sessionExerciseId = planToSessionIdMap[exercise.id] else {
                    Logger.shared.error(.app, "Missing session exercise ID mapping for plan exercise \(exercise.id)")
                    continue
                }
                createdExerciseIds.append(sessionExerciseId)
                let mappedParentId = exercise.parentExerciseId.flatMap { planToSessionIdMap[$0] }
                let exerciseRow = SessionExerciseRow(
                    id: sessionExerciseId,
                    workoutSessionId: session.id,
                    exerciseName: exercise.exerciseName,
                    orderIndex: exercise.orderIndex,
                    notes: exercise.notes,
                    equipmentType: exercise.equipmentType,
                    groupType: exercise.groupType?.rawValue,
                    groupName: exercise.groupName,
                    parentExerciseId: mappedParentId,
                    status: ExerciseStatus.pending.rawValue,
                    updatedAt: now
                )
                try exerciseRow.insert(db)

                let (setIds, measurementIds) = try insertSessionSets(
                    from: exercise.sets,
                    sessionExerciseId: sessionExerciseId,
                    now: now,
                    in: db
                )
                createdSetIds.append(contentsOf: setIds)
                createdMeasurementIds.append(contentsOf: measurementIds)
            }

            // Re-assemble the full session with exercises and sets from DB
            return try assembleSession(from: sessionRow, in: db)
        }

        var syncChanges: [SyncChange] = [.save(recordType: "WorkoutSession", recordID: session.id)]
        for exId in createdExerciseIds {
            syncChanges.append(.save(recordType: "SessionExercise", recordID: exId))
        }
        for setId in createdSetIds {
            syncChanges.append(.save(recordType: "SessionSet", recordID: setId))
        }
        for mId in createdMeasurementIds {
            syncChanges.append(.save(recordType: "SetMeasurement", recordID: mId))
        }

        return (result, syncChanges)
    }

    /// Insert session sets from planned sets, expanding per-side sets into left/right pairs.
    /// Returns the IDs of all created session sets and measurement rows.
    private func insertSessionSets(
        from plannedSets: [PlannedSet],
        sessionExerciseId: String,
        now: String,
        in db: Database
    ) throws -> (setIds: [String], measurementIds: [String]) {
        var createdSetIds: [String] = []
        var createdMeasurementIds: [String] = []
        var expandedOrderIndex = 0

        for set in plannedSets {
            // Only expand per-side sets into left/right pairs when they have a time target.
            // Rep-based per-side sets remain as a single set with the isPerSide flag preserved.
            let hasTimeTarget = set.entries.contains { $0.target?.time != nil }
            if set.isPerSide && hasTimeTarget {
                for side in ["left", "right"] {
                    let setId = IDGenerator.generate()
                    createdSetIds.append(setId)
                    let setRow = SessionSetRow(
                        id: setId,
                        sessionExerciseId: sessionExerciseId,
                        orderIndex: expandedOrderIndex,
                        restSeconds: side == "right" ? set.restSeconds : nil,
                        completedAt: nil,
                        status: SetStatus.pending.rawValue,
                        notes: nil,
                        isDropset: set.isDropset ? 1 : 0,
                        isPerSide: 1,
                        isAmrap: set.isAmrap ? 1 : 0,
                        side: side,
                        updatedAt: now
                    )
                    try setRow.insert(db)

                    // Copy target measurements from planned set
                    let mIds = try insertMeasurementsFromPlannedSet(set, sessionSetId: setId, now: now, in: db)
                    createdMeasurementIds.append(contentsOf: mIds)

                    expandedOrderIndex += 1
                }
            } else {
                let setId = IDGenerator.generate()
                createdSetIds.append(setId)
                let setRow = SessionSetRow(
                    id: setId,
                    sessionExerciseId: sessionExerciseId,
                    orderIndex: expandedOrderIndex,
                    restSeconds: set.restSeconds,
                    completedAt: nil,
                    status: SetStatus.pending.rawValue,
                    notes: nil,
                    isDropset: set.isDropset ? 1 : 0,
                    isPerSide: set.isPerSide ? 1 : 0,
                    isAmrap: set.isAmrap ? 1 : 0,
                    side: nil,
                    updatedAt: now
                )
                try setRow.insert(db)

                // Copy target measurements from planned set
                let mIds = try insertMeasurementsFromPlannedSet(set, sessionSetId: setId, now: now, in: db)
                createdMeasurementIds.append(contentsOf: mIds)

                expandedOrderIndex += 1
            }
        }

        return (createdSetIds, createdMeasurementIds)
    }

    /// Copy target measurements from a planned set into session measurements.
    /// Returns the IDs of all created measurement rows.
    @discardableResult
    private func insertMeasurementsFromPlannedSet(
        _ plannedSet: PlannedSet,
        sessionSetId: String,
        now: String,
        in db: Database
    ) throws -> [String] {
        var measurementIds: [String] = []
        for entry in plannedSet.entries {
            if let target = entry.target {
                for mRow in target.toMeasurementRows(
                    setId: sessionSetId, parentType: "session",
                    role: "target", groupIndex: entry.groupIndex, now: now
                ) {
                    try mRow.insert(db)
                    measurementIds.append(mRow.id)
                }
            }
        }
        return measurementIds
    }

    @discardableResult
    func complete(_ sessionId: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = ISO8601DateFormatter().string(from: Date())
        try dbQueue.write { db in
            guard let row = try WorkoutSessionRow.fetchOne(db, key: sessionId) else { return }
            var duration: Int? = nil
            if let startTime = row.startTime,
               let start = ISO8601DateFormatter().date(from: startTime) {
                duration = Int(Date().timeIntervalSince(start))
            }
            try db.execute(
                sql: "UPDATE workout_sessions SET status = ?, end_time = ?, duration = ?, updated_at = ? WHERE id = ?",
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
            let rows = try Row.fetchAll(db, sql: "SELECT id FROM workout_sessions WHERE status = ?", arguments: [SessionStatus.inProgress.rawValue])
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
        // Collect child IDs before cascading delete
        let (exerciseIds, setIds, measurementIds) = try dbQueue.read { db -> ([String], [String], [String]) in
            let exRows = try Row.fetchAll(db, sql: "SELECT id FROM session_exercises WHERE workout_session_id = ?", arguments: [id])
            let exIds = exRows.compactMap { $0["id"] as String? }
            let setRows = try Row.fetchAll(db, sql: """
                SELECT ss.id FROM session_sets ss
                JOIN session_exercises se ON se.id = ss.session_exercise_id
                WHERE se.workout_session_id = ?
            """, arguments: [id])
            let sIds = setRows.compactMap { $0["id"] as String? }
            var mIds: [String] = []
            for setId in sIds {
                let mRows = try Row.fetchAll(db, sql: "SELECT id FROM set_measurements WHERE set_id = ?", arguments: [setId])
                mIds.append(contentsOf: mRows.compactMap { $0["id"] as String? })
            }
            return (exIds, sIds, mIds)
        }
        try dbQueue.write { db in
            // Delete measurements for sets (no CASCADE)
            for setId in setIds {
                try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ?", arguments: [setId])
            }
            try db.execute(sql: "DELETE FROM workout_sessions WHERE id = ?", arguments: [id])
        }
        var changes: [SyncChange] = []
        for mId in measurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        for setId in setIds {
            changes.append(.delete(recordType: "SessionSet", recordID: setId))
        }
        for exId in exerciseIds {
            changes.append(.delete(recordType: "SessionExercise", recordID: exId))
        }
        changes.append(.delete(recordType: "WorkoutSession", recordID: id))
        return changes
    }

    /// Get recent completed sessions, ordered by end_time descending (most recently completed first).
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

    /// Get best weight + reps for each exercise across all completed sessions.
    func getExerciseBestWeights() throws -> [String: (weight: Double, reps: Int, unit: String)] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: """
                SELECT
                    se.exercise_name,
                    MAX(COALESCE(mw_actual.value, mw_target.value, 0)) as max_weight,
                    COALESCE(mr_actual.value, mr_target.value, 0) as reps,
                    COALESCE(mw_actual.unit, mw_target.unit, 'lbs') as unit
                FROM session_exercises se
                JOIN workout_sessions ws ON ws.id = se.workout_session_id
                JOIN session_sets ss ON ss.session_exercise_id = se.id
                LEFT JOIN set_measurements mw_actual ON mw_actual.set_id = ss.id
                    AND mw_actual.parent_type = 'session' AND mw_actual.kind = 'weight' AND mw_actual.role = 'actual'
                LEFT JOIN set_measurements mw_target ON mw_target.set_id = ss.id
                    AND mw_target.parent_type = 'session' AND mw_target.kind = 'weight' AND mw_target.role = 'target'
                LEFT JOIN set_measurements mr_actual ON mr_actual.set_id = ss.id
                    AND mr_actual.parent_type = 'session' AND mr_actual.kind = 'reps' AND mr_actual.role = 'actual'
                LEFT JOIN set_measurements mr_target ON mr_target.set_id = ss.id
                    AND mr_target.parent_type = 'session' AND mr_target.kind = 'reps' AND mr_target.role = 'target'
                WHERE ws.status = 'completed' AND ss.status = 'completed'
                GROUP BY se.exercise_name
                HAVING max_weight > 0
                ORDER BY se.exercise_name
            """)

            var result: [String: (weight: Double, reps: Int, unit: String)] = [:]
            for row in rows {
                guard let name: String = row["exercise_name"],
                      let weight: Double = row["max_weight"] else { continue }
                let reps: Int = row["reps"] ?? 0
                let unit: String = row["unit"] ?? "lbs"
                result[name] = (weight, reps, unit)
            }
            return result
        }
    }

    /// Get best weights normalized by canonical exercise name.
    /// Merges aliases so "Bench Press" and "Barbell Bench Press" share one entry.
    func getExerciseBestWeightsNormalized() throws -> [String: (weight: Double, reps: Int, unit: String)] {
        let raw = try getExerciseBestWeights()
        var merged: [String: (weight: Double, reps: Int, unit: String)] = [:]
        for (name, data) in raw {
            let canonical = ExerciseDictionary.getCanonicalName(name)
            if let existing = merged[canonical] {
                if data.weight > existing.weight {
                    merged[canonical] = data
                }
            } else {
                merged[canonical] = data
            }
        }
        return merged
    }

    // MARK: - Set Mutations

    @discardableResult
    func updateSessionSet(_ setId: String, actualWeight: Double?, actualWeightUnit: WeightUnit?, actualReps: Int?, actualTime: Int?, actualRpe: Int?, status: SetStatus) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        let completedAt = status == .completed ? now : nil

        // Collect old actual measurement IDs before deleting
        let oldMeasurementIds = try dbQueue.read { db -> [String] in
            let rows = try Row.fetchAll(db, sql: "SELECT id FROM set_measurements WHERE set_id = ? AND parent_type = 'session' AND role = 'actual'", arguments: [setId])
            return rows.compactMap { $0["id"] as String? }
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            // Update set status
            try db.execute(
                sql: "UPDATE session_sets SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
                arguments: [status.rawValue, completedAt, now, setId]
            )

            // Replace actual measurements
            try db.execute(
                sql: "DELETE FROM set_measurements WHERE set_id = ? AND parent_type = 'session' AND role = 'actual'",
                arguments: [setId]
            )
            let actual = EntryValues(
                weight: actualWeight.map { MeasuredWeight(value: $0, unit: actualWeightUnit ?? .lbs) },
                reps: actualReps,
                time: actualTime,
                distance: nil,
                rpe: actualRpe
            )
            if !actual.isEmpty {
                for mRow in actual.toMeasurementRows(setId: setId, parentType: "session", role: "actual", groupIndex: 0, now: now) {
                    try mRow.insert(db)
                    newMeasurementIds.append(mRow.id)
                }
            }
        }

        var changes: [SyncChange] = [.save(recordType: "SessionSet", recordID: setId)]
        for mId in oldMeasurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        for mId in newMeasurementIds {
            changes.append(.save(recordType: "SetMeasurement", recordID: mId))
        }
        return changes
    }

    @discardableResult
    func updateSessionSetTarget(_ setId: String, targetWeight: Double?, targetReps: Int?, targetTime: Int?) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now

        // Collect old target measurement IDs before deleting
        let oldMeasurementIds = try dbQueue.read { db -> [String] in
            let rows = try Row.fetchAll(db, sql: "SELECT id FROM set_measurements WHERE set_id = ? AND parent_type = 'session' AND role = 'target'", arguments: [setId])
            return rows.compactMap { $0["id"] as String? }
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            // Update set timestamp
            try db.execute(
                sql: "UPDATE session_sets SET updated_at = ? WHERE id = ?",
                arguments: [now, setId]
            )

            // Replace target measurements
            try db.execute(
                sql: "DELETE FROM set_measurements WHERE set_id = ? AND parent_type = 'session' AND role = 'target'",
                arguments: [setId]
            )
            let target = EntryValues(
                weight: targetWeight.map { MeasuredWeight(value: $0, unit: .lbs) },
                reps: targetReps,
                time: targetTime,
                distance: nil,
                rpe: nil
            )
            if !target.isEmpty {
                for mRow in target.toMeasurementRows(setId: setId, parentType: "session", role: "target", groupIndex: 0, now: now) {
                    try mRow.insert(db)
                    newMeasurementIds.append(mRow.id)
                }
            }
        }

        var changes: [SyncChange] = [.save(recordType: "SessionSet", recordID: setId)]
        for mId in oldMeasurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        for mId in newMeasurementIds {
            changes.append(.save(recordType: "SetMeasurement", recordID: mId))
        }
        return changes
    }

    /// Complete a drop set by saving multiple actual entries at different groupIndices.
    @discardableResult
    func completeDropSet(_ setId: String, entries: [(weight: Double?, weightUnit: WeightUnit?, reps: Int?)]) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now

        // Collect old actual measurement IDs before deleting
        let oldMeasurementIds = try dbQueue.read { db -> [String] in
            let rows = try Row.fetchAll(db, sql: "SELECT id FROM set_measurements WHERE set_id = ? AND parent_type = 'session' AND role = 'actual'", arguments: [setId])
            return rows.compactMap { $0["id"] as String? }
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            // Update set status
            try db.execute(
                sql: "UPDATE session_sets SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
                arguments: [SetStatus.completed.rawValue, now, now, setId]
            )

            // Replace actual measurements
            try db.execute(
                sql: "DELETE FROM set_measurements WHERE set_id = ? AND parent_type = 'session' AND role = 'actual'",
                arguments: [setId]
            )

            for (groupIndex, entry) in entries.enumerated() {
                let actual = EntryValues(
                    weight: entry.weight.map { MeasuredWeight(value: $0, unit: entry.weightUnit ?? .lbs) },
                    reps: entry.reps,
                    time: nil,
                    distance: nil,
                    rpe: nil
                )
                if !actual.isEmpty {
                    for mRow in actual.toMeasurementRows(setId: setId, parentType: "session", role: "actual", groupIndex: groupIndex, now: now) {
                        try mRow.insert(db)
                        newMeasurementIds.append(mRow.id)
                    }
                }
            }
        }

        var changes: [SyncChange] = [.save(recordType: "SessionSet", recordID: setId)]
        for mId in oldMeasurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        for mId in newMeasurementIds {
            changes.append(.save(recordType: "SetMeasurement", recordID: mId))
        }
        return changes
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

    func insertSessionExercise(sessionId: String, exerciseName: String, orderIndex: Int, notes: String? = nil, equipmentType: String? = nil) throws -> (String, [SyncChange]) {
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
        targetReps: Int? = nil, targetTime: Int? = nil
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
                restSeconds: nil,
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
                for mRow in target.toMeasurementRows(setId: setId, parentType: "session", role: "target", groupIndex: 0, now: now) {
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

    @discardableResult
    func updateSessionExercise(_ exerciseId: String, name: String, notes: String?, equipmentType: String?) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let now = self.now
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE session_exercises SET exercise_name = ?, notes = ?, equipment_type = ?, updated_at = ? WHERE id = ?",
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
            let setRows = try Row.fetchAll(db, sql: "SELECT id FROM session_sets WHERE session_exercise_id = ?", arguments: [exerciseId])
            let setIds = setRows.compactMap { $0["id"] as String? }
            var mIds: [String] = []
            for setId in setIds {
                let mRows = try Row.fetchAll(db, sql: "SELECT id FROM set_measurements WHERE set_id = ?", arguments: [setId])
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
            let rows = try Row.fetchAll(db, sql: "SELECT id FROM set_measurements WHERE set_id = ?", arguments: [setId])
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

    // MARK: - Assembly

    private func assembleSession(from row: WorkoutSessionRow, in db: Database) throws -> WorkoutSession {
        let exerciseRows = try SessionExerciseRow
            .filter(Column("workout_session_id") == row.id)
            .order(Column("order_index"))
            .fetchAll(db)

        // Batch-fetch all sets for this session's exercises in one query
        let exerciseIds = exerciseRows.map(\.id)
        let allSetRows = try SessionSetRow
            .filter(exerciseIds.contains(Column("session_exercise_id")))
            .order(Column("order_index"))
            .fetchAll(db)
        let setsByExerciseId = Dictionary(grouping: allSetRows, by: \.sessionExerciseId)

        // Batch-fetch all measurements for these sets
        let setIds = allSetRows.map(\.id)
        let allMeasurements: [SetMeasurementRow]
        if !setIds.isEmpty {
            allMeasurements = try SetMeasurementRow
                .filter(setIds.contains(Column("set_id")))
                .filter(Column("parent_type") == "session")
                .order(Column("group_index"), Column("role"), Column("kind"))
                .fetchAll(db)
        } else {
            allMeasurements = []
        }
        let measurementsBySetId = Dictionary(grouping: allMeasurements, by: \.setId)

        let exercises = exerciseRows.map { exerciseRow -> SessionExercise in
            let setRows = setsByExerciseId[exerciseRow.id] ?? []

            let sets = setRows.map { setRow -> SessionSet in
                let measurements = measurementsBySetId[setRow.id] ?? []
                let entries = SetEntry.buildEntries(from: measurements)
                return SessionSet(
                    id: setRow.id,
                    sessionExerciseId: setRow.sessionExerciseId,
                    orderIndex: setRow.orderIndex,
                    entries: entries,
                    restSeconds: setRow.restSeconds,
                    completedAt: setRow.completedAt,
                    status: SetStatus(rawValue: setRow.status) ?? .pending,
                    notes: setRow.notes,
                    isDropset: setRow.isDropset != 0,
                    isPerSide: setRow.isPerSide != 0,
                    isAmrap: setRow.isAmrap != 0,
                    side: setRow.side
                )
            }

            return SessionExercise(
                id: exerciseRow.id,
                workoutSessionId: exerciseRow.workoutSessionId,
                exerciseName: exerciseRow.exerciseName,
                orderIndex: exerciseRow.orderIndex,
                notes: exerciseRow.notes,
                equipmentType: exerciseRow.equipmentType,
                groupType: exerciseRow.groupType.flatMap { GroupType(rawValue: $0) },
                groupName: exerciseRow.groupName,
                parentExerciseId: exerciseRow.parentExerciseId,
                sets: sets,
                status: ExerciseStatus(rawValue: exerciseRow.status) ?? .pending
            )
        }

        return WorkoutSession(
            id: row.id,
            workoutPlanId: row.workoutTemplateId,
            name: row.name,
            date: row.date,
            startTime: row.startTime,
            endTime: row.endTime,
            duration: row.duration,
            notes: row.notes,
            exercises: exercises,
            status: SessionStatus(rawValue: row.status) ?? .inProgress
        )
    }
}
