import Foundation
import GRDB

// Session assembly is split out from SessionRepository to keep the main
// file under SwiftLint's type_body_length / function_body_length limits.
extension SessionRepository {

    func assembleSession(from row: WorkoutSessionRow, in db: Database) throws -> WorkoutSession {
        let exerciseRows = try SessionExerciseRow
            .filter(Column("workout_session_id") == row.id)
            .order(Column("order_index"))
            .fetchAll(db)

        let exerciseIds = exerciseRows.map(\.id)
        let allSetRows = try SessionSetRow
            .filter(exerciseIds.contains(Column("session_exercise_id")))
            .order(Column("order_index"))
            .fetchAll(db)
        let setsByExerciseId = Dictionary(grouping: allSetRows, by: \.sessionExerciseId)

        let measurementsBySetId = try fetchSessionMeasurements(setIds: allSetRows.map(\.id), db: db)

        let exercises = exerciseRows.map { exerciseRow -> SessionExercise in
            let setRows = setsByExerciseId[exerciseRow.id] ?? []
            let sets = setRows.map { mapSessionSet($0, measurements: measurementsBySetId[$0.id] ?? []) }
            return mapSessionExercise(exerciseRow, sets: sets)
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

    private func fetchSessionMeasurements(
        setIds: [String],
        db: Database
    ) throws -> [String: [SetMeasurementRow]] {
        guard !setIds.isEmpty else { return [:] }
        let rows = try SetMeasurementRow
            .filter(setIds.contains(Column("set_id")))
            .filter(Column("parent_type") == "session")
            .order(Column("group_index"), Column("role"), Column("kind"))
            .fetchAll(db)
        return Dictionary(grouping: rows, by: \.setId)
    }

    private func mapSessionSet(_ row: SessionSetRow, measurements: [SetMeasurementRow]) -> SessionSet {
        SessionSet(
            id: row.id,
            sessionExerciseId: row.sessionExerciseId,
            orderIndex: row.orderIndex,
            entries: SetEntry.buildEntries(from: measurements),
            restSeconds: row.restSeconds,
            completedAt: row.completedAt,
            status: SetStatus(rawValue: row.status) ?? .pending,
            notes: row.notes,
            isDropset: row.isDropset != 0,
            isPerSide: row.isPerSide != 0,
            isAmrap: row.isAmrap != 0,
            side: row.side
        )
    }

    private func mapSessionExercise(_ row: SessionExerciseRow, sets: [SessionSet]) -> SessionExercise {
        SessionExercise(
            id: row.id,
            workoutSessionId: row.workoutSessionId,
            exerciseName: row.exerciseName,
            orderIndex: row.orderIndex,
            notes: row.notes,
            equipmentType: row.equipmentType,
            groupType: row.groupType.flatMap { GroupType(rawValue: $0) },
            groupName: row.groupName,
            parentExerciseId: row.parentExerciseId,
            sets: sets,
            status: ExerciseStatus(rawValue: row.status) ?? .pending
        )
    }
}
