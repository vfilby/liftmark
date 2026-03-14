import Foundation
import GRDB

/// Repository for WorkoutSession CRUD operations.
struct SessionRepository {
    private let dbManager: DatabaseManager

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

    func createFromPlan(_ plan: WorkoutPlan) throws -> WorkoutSession {
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

        return try dbQueue.write { db in
            let sessionRow = WorkoutSessionRow(
                id: session.id,
                workoutTemplateId: plan.id,
                name: plan.name,
                date: dateString,
                startTime: now,
                endTime: nil,
                duration: nil,
                notes: nil,
                status: SessionStatus.inProgress.rawValue
            )
            try sessionRow.insert(db)

            // Map plan exercise IDs to session exercise IDs for parentExerciseId
            var planToSessionIdMap: [String: String] = [:]
            for exercise in plan.exercises {
                let sessionExerciseId = IDGenerator.generate()
                planToSessionIdMap[exercise.id] = sessionExerciseId
            }

            for exercise in plan.exercises {
                let sessionExerciseId = planToSessionIdMap[exercise.id]!
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
                    status: ExerciseStatus.pending.rawValue
                )
                try exerciseRow.insert(db)

                var expandedOrderIndex = 0
                for set in exercise.sets {
                    if set.isPerSide && set.targetTime != nil {
                        // Expand into left and right sets
                        for side in ["left", "right"] {
                            let setRow = SessionSetRow(
                                id: IDGenerator.generate(),
                                sessionExerciseId: sessionExerciseId,
                                orderIndex: expandedOrderIndex,
                                parentSetId: nil,
                                dropSequence: nil,
                                targetWeight: set.targetWeight,
                                targetWeightUnit: set.targetWeightUnit?.rawValue,
                                targetReps: set.targetReps,
                                targetTime: set.targetTime,
                                targetRpe: set.targetRpe,
                                restSeconds: side == "right" ? set.restSeconds : nil,
                                actualWeight: nil,
                                actualWeightUnit: nil,
                                actualReps: nil,
                                actualTime: nil,
                                actualRpe: nil,
                                completedAt: nil,
                                status: SetStatus.pending.rawValue,
                                notes: nil,
                                tempo: set.tempo,
                                isDropset: set.isDropset ? 1 : 0,
                                isPerSide: 1,
                                side: side
                            )
                            try setRow.insert(db)
                            expandedOrderIndex += 1
                        }
                    } else {
                        let setRow = SessionSetRow(
                            id: IDGenerator.generate(),
                            sessionExerciseId: sessionExerciseId,
                            orderIndex: expandedOrderIndex,
                            parentSetId: nil,
                            dropSequence: nil,
                            targetWeight: set.targetWeight,
                            targetWeightUnit: set.targetWeightUnit?.rawValue,
                            targetReps: set.targetReps,
                            targetTime: set.targetTime,
                            targetRpe: set.targetRpe,
                            restSeconds: set.restSeconds,
                            actualWeight: nil,
                            actualWeightUnit: nil,
                            actualReps: nil,
                            actualTime: nil,
                            actualRpe: nil,
                            completedAt: nil,
                            status: SetStatus.pending.rawValue,
                            notes: nil,
                            tempo: set.tempo,
                            isDropset: set.isDropset ? 1 : 0,
                            isPerSide: set.isPerSide ? 1 : 0,
                            side: nil
                        )
                        try setRow.insert(db)
                        expandedOrderIndex += 1
                    }
                }
            }

            // Re-assemble the full session with exercises and sets from DB
            return try assembleSession(from: sessionRow, in: db)
        }
    }

    func complete(_ sessionId: String) throws {
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
                sql: "UPDATE workout_sessions SET status = ?, end_time = ?, duration = ? WHERE id = ?",
                arguments: [SessionStatus.completed.rawValue, now, duration, sessionId]
            )
        }
    }

    func cancel(_ sessionId: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE workout_sessions SET status = ? WHERE id = ?",
                arguments: [SessionStatus.canceled.rawValue, sessionId]
            )
        }
    }

    /// Cancel all in-progress sessions. Used to clean up stale sessions before starting a new workout.
    func cancelAllInProgress() throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE workout_sessions SET status = ? WHERE status = ?",
                arguments: [SessionStatus.canceled.rawValue, SessionStatus.inProgress.rawValue]
            )
        }
    }

    func delete(_ id: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM workout_sessions WHERE id = ?", arguments: [id])
        }
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
                    MAX(COALESCE(ss.actual_weight, ss.target_weight, 0)) as max_weight,
                    COALESCE(ss.actual_reps, ss.target_reps, 0) as reps,
                    COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit
                FROM session_exercises se
                JOIN workout_sessions ws ON ws.id = se.workout_session_id
                JOIN session_sets ss ON ss.session_exercise_id = se.id
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

    func updateSessionSet(_ setId: String, actualWeight: Double?, actualWeightUnit: WeightUnit?, actualReps: Int?, actualTime: Int?, actualRpe: Int?, status: SetStatus) throws {
        let dbQueue = try dbManager.database()
        let now = status == .completed ? ISO8601DateFormatter().string(from: Date()) : nil
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE session_sets
                    SET actual_weight = ?, actual_weight_unit = ?, actual_reps = ?, actual_time = ?, actual_rpe = ?,
                        status = ?, completed_at = ?
                    WHERE id = ?
                """,
                arguments: [actualWeight, actualWeightUnit?.rawValue, actualReps, actualTime, actualRpe, status.rawValue, now, setId]
            )
        }
    }

    func updateSessionSetTarget(_ setId: String, targetWeight: Double?, targetReps: Int?, targetTime: Int?) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE session_sets SET target_weight = ?, target_reps = ?, target_time = ? WHERE id = ?",
                arguments: [targetWeight, targetReps, targetTime, setId]
            )
        }
    }

    func skipSet(_ setId: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE session_sets SET status = ? WHERE id = ?",
                arguments: [SetStatus.skipped.rawValue, setId]
            )
        }
    }

    func insertSessionExercise(sessionId: String, exerciseName: String, orderIndex: Int, notes: String? = nil, equipmentType: String? = nil) throws -> String {
        let dbQueue = try dbManager.database()
        let exerciseId = IDGenerator.generate()
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
                status: ExerciseStatus.pending.rawValue
            )
            try row.insert(db)
        }
        return exerciseId
    }

    func insertSessionSet(exerciseId: String, orderIndex: Int, targetWeight: Double? = nil, targetWeightUnit: WeightUnit? = nil, targetReps: Int? = nil, targetTime: Int? = nil) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            let row = SessionSetRow(
                id: IDGenerator.generate(),
                sessionExerciseId: exerciseId,
                orderIndex: orderIndex,
                parentSetId: nil,
                dropSequence: nil,
                targetWeight: targetWeight,
                targetWeightUnit: targetWeightUnit?.rawValue,
                targetReps: targetReps,
                targetTime: targetTime,
                targetRpe: nil,
                restSeconds: nil,
                actualWeight: nil,
                actualWeightUnit: nil,
                actualReps: nil,
                actualTime: nil,
                actualRpe: nil,
                completedAt: nil,
                status: SetStatus.pending.rawValue,
                notes: nil,
                tempo: nil,
                isDropset: 0,
                isPerSide: 0,
                side: nil
            )
            try row.insert(db)
        }
    }

    func updateSessionExercise(_ exerciseId: String, name: String, notes: String?, equipmentType: String?) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE session_exercises SET exercise_name = ?, notes = ?, equipment_type = ? WHERE id = ?",
                arguments: [name, notes, equipmentType, exerciseId]
            )
        }
    }

    func deleteSessionExercise(_ exerciseId: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM session_exercises WHERE id = ?", arguments: [exerciseId])
        }
    }

    func deleteSessionSet(_ setId: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM session_sets WHERE id = ?", arguments: [setId])
        }
    }

    // MARK: - Assembly

    private func assembleSession(from row: WorkoutSessionRow, in db: Database) throws -> WorkoutSession {
        let exerciseRows = try SessionExerciseRow
            .filter(Column("workout_session_id") == row.id)
            .order(Column("order_index"))
            .fetchAll(db)

        let exercises = try exerciseRows.map { exerciseRow -> SessionExercise in
            let setRows = try SessionSetRow
                .filter(Column("session_exercise_id") == exerciseRow.id)
                .order(Column("order_index"))
                .fetchAll(db)

            let sets = setRows.map { setRow in
                SessionSet(
                    id: setRow.id,
                    sessionExerciseId: setRow.sessionExerciseId,
                    orderIndex: setRow.orderIndex,
                    parentSetId: setRow.parentSetId,
                    dropSequence: setRow.dropSequence,
                    targetWeight: setRow.targetWeight,
                    targetWeightUnit: setRow.targetWeightUnit.flatMap { WeightUnit(rawValue: $0) },
                    targetReps: setRow.targetReps,
                    targetTime: setRow.targetTime,
                    targetRpe: setRow.targetRpe,
                    restSeconds: setRow.restSeconds,
                    actualWeight: setRow.actualWeight,
                    actualWeightUnit: setRow.actualWeightUnit.flatMap { WeightUnit(rawValue: $0) },
                    actualReps: setRow.actualReps,
                    actualTime: setRow.actualTime,
                    actualRpe: setRow.actualRpe,
                    completedAt: setRow.completedAt,
                    status: SetStatus(rawValue: setRow.status) ?? .pending,
                    notes: setRow.notes,
                    tempo: setRow.tempo,
                    isDropset: setRow.isDropset != 0,
                    isPerSide: setRow.isPerSide != 0,
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
