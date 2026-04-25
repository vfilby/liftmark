import Foundation
import GRDB

// `createFromPlan` and its sub-helpers are split out from SessionRepository
// to keep the main file under SwiftLint's type_body_length limits. The flow:
// 1. Build the WorkoutSession row.
// 2. For each plan exercise, copy it into a session_exercise (remapping
//    parentExerciseId from plan-side IDs to session-side IDs).
// 3. For each planned set, insert a session_set (expanding per-side timed
//    sets into left/right pairs) plus its target measurements.
extension SessionRepository {

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

        var insertedIds = InsertedSessionIds()
        let result = try dbQueue.write { db -> WorkoutSession in
            let sessionRow = makeSessionRow(session: session, plan: plan, dateString: dateString, now: now)
            try sessionRow.insert(db)
            insertedIds = try insertExerciseGraph(plan: plan, sessionId: session.id, now: now, db: db)
            return try assembleSession(from: sessionRow, in: db)
        }
        return (result, sessionCreationChanges(sessionId: session.id, ids: insertedIds))
    }

    struct InsertedSessionIds {
        var exerciseIds: [String] = []
        var setIds: [String] = []
        var measurementIds: [String] = []
    }

    private func makeSessionRow(
        session: WorkoutSession,
        plan: WorkoutPlan,
        dateString: String,
        now: String
    ) -> WorkoutSessionRow {
        WorkoutSessionRow(
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
    }

    private func insertExerciseGraph(
        plan: WorkoutPlan,
        sessionId: String,
        now: String,
        db: Database
    ) throws -> InsertedSessionIds {
        var ids = InsertedSessionIds()

        // Map plan exercise IDs to fresh session exercise IDs (lets us remap parentExerciseId).
        var planToSessionIdMap: [String: String] = [:]
        for exercise in plan.exercises {
            planToSessionIdMap[exercise.id] = IDGenerator.generate()
        }

        for exercise in plan.exercises {
            guard let sessionExerciseId = planToSessionIdMap[exercise.id] else {
                Logger.shared.error(.app, "Missing session exercise ID mapping for plan exercise \(exercise.id)")
                continue
            }
            ids.exerciseIds.append(sessionExerciseId)
            let mappedParentId = exercise.parentExerciseId.flatMap { planToSessionIdMap[$0] }
            try makeSessionExerciseRow(
                exercise: exercise,
                sessionExerciseId: sessionExerciseId,
                sessionId: sessionId,
                parentId: mappedParentId,
                now: now
            ).insert(db)

            let (setIds, mIds) = try insertSessionSets(
                from: exercise.sets,
                sessionExerciseId: sessionExerciseId,
                now: now,
                in: db
            )
            ids.setIds.append(contentsOf: setIds)
            ids.measurementIds.append(contentsOf: mIds)
        }
        return ids
    }

    private func makeSessionExerciseRow(
        exercise: PlannedExercise,
        sessionExerciseId: String,
        sessionId: String,
        parentId: String?,
        now: String
    ) -> SessionExerciseRow {
        SessionExerciseRow(
            id: sessionExerciseId,
            workoutSessionId: sessionId,
            exerciseName: exercise.exerciseName,
            orderIndex: exercise.orderIndex,
            notes: exercise.notes,
            equipmentType: exercise.equipmentType,
            groupType: exercise.groupType?.rawValue,
            groupName: exercise.groupName,
            parentExerciseId: parentId,
            status: ExerciseStatus.pending.rawValue,
            updatedAt: now
        )
    }

    private func sessionCreationChanges(sessionId: String, ids: InsertedSessionIds) -> [SyncChange] {
        var changes: [SyncChange] = [.save(recordType: "WorkoutSession", recordID: sessionId)]
        changes.append(contentsOf: ids.exerciseIds.map { .save(recordType: "SessionExercise", recordID: $0) })
        changes.append(contentsOf: ids.setIds.map { .save(recordType: "SessionSet", recordID: $0) })
        changes.append(contentsOf: ids.measurementIds.map { .save(recordType: "SetMeasurement", recordID: $0) })
        return changes
    }

    /// Insert session sets from planned sets, expanding per-side timed sets into left/right pairs.
    /// Returns the IDs of all created session sets and measurement rows.
    private func insertSessionSets(
        from plannedSets: [PlannedSet],
        sessionExerciseId: String,
        now: String,
        in db: Database
    ) throws -> (setIds: [String], measurementIds: [String]) {
        var setIds: [String] = []
        var measurementIds: [String] = []
        var orderIndex = 0

        for set in plannedSets {
            // Expand per-side sets into left/right only when they have a time target.
            // Rep-based per-side sets remain a single set with the isPerSide flag preserved.
            let hasTimeTarget = set.entries.contains { $0.target?.time != nil }
            let layouts: [(perSide: Bool, side: String?, rest: Int?)]
            if set.isPerSide && hasTimeTarget {
                layouts = [
                    (true, "left", nil),
                    (true, "right", set.restSeconds)
                ]
            } else {
                layouts = [(set.isPerSide, nil, set.restSeconds)]
            }

            for layout in layouts {
                let inserted = try insertSessionSet(SessionSetInsertion(
                    plannedSet: set,
                    sessionExerciseId: sessionExerciseId,
                    orderIndex: orderIndex,
                    perSide: layout.perSide,
                    side: layout.side,
                    restSeconds: layout.rest,
                    now: now
                ), in: db)
                setIds.append(inserted.setId)
                measurementIds.append(contentsOf: inserted.measurementIds)
                orderIndex += 1
            }
        }
        return (setIds, measurementIds)
    }

    private struct SessionSetInsertion {
        let plannedSet: PlannedSet
        let sessionExerciseId: String
        let orderIndex: Int
        let perSide: Bool
        let side: String?
        let restSeconds: Int?
        let now: String
    }

    private func insertSessionSet(
        _ params: SessionSetInsertion,
        in db: Database
    ) throws -> (setId: String, measurementIds: [String]) {
        let setId = IDGenerator.generate()
        let setRow = SessionSetRow(
            id: setId,
            sessionExerciseId: params.sessionExerciseId,
            orderIndex: params.orderIndex,
            restSeconds: params.restSeconds,
            completedAt: nil,
            status: SetStatus.pending.rawValue,
            notes: nil,
            isDropset: params.plannedSet.isDropset ? 1 : 0,
            isPerSide: params.perSide ? 1 : 0,
            isAmrap: params.plannedSet.isAmrap ? 1 : 0,
            side: params.side,
            updatedAt: params.now
        )
        try setRow.insert(db)
        let mIds = try insertMeasurementsFromPlannedSet(
            params.plannedSet, sessionSetId: setId, now: params.now, in: db
        )
        return (setId, mIds)
    }

    /// Copy target measurements from a planned set into session measurements.
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
}
