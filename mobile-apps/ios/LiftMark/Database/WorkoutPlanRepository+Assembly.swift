import Foundation
import GRDB

// Plan assembly is split out from WorkoutPlanRepository to keep the main
// file under SwiftLint's type_body_length / function_body_length limits.
extension WorkoutPlanRepository {

    func assemblePlan(from row: WorkoutPlanRow, in db: Database) throws -> WorkoutPlan {
        let exerciseRows = try PlannedExerciseRow
            .filter(Column("workout_template_id") == row.id)
            .order(Column("order_index"))
            .fetchAll(db)

        let exerciseIds = exerciseRows.map(\.id)
        let allSetRows = try PlannedSetRow
            .filter(exerciseIds.contains(Column("template_exercise_id")))
            .order(Column("order_index"))
            .fetchAll(db)
        let setsByExerciseId = Dictionary(grouping: allSetRows, by: \.templateExerciseId)

        let measurementsBySetId = try fetchPlannedMeasurements(setIds: allSetRows.map(\.id), db: db)

        let exercises = exerciseRows.map { exerciseRow -> PlannedExercise in
            let setRows = setsByExerciseId[exerciseRow.id] ?? []
            let sets = setRows.map { mapPlannedSet($0, measurements: measurementsBySetId[$0.id] ?? []) }
            return mapPlannedExercise(exerciseRow, sets: sets)
        }

        return makePlan(row: row, exercises: exercises)
    }

    private func fetchPlannedMeasurements(
        setIds: [String],
        db: Database
    ) throws -> [String: [SetMeasurementRow]] {
        guard !setIds.isEmpty else { return [:] }
        let rows = try SetMeasurementRow
            .filter(setIds.contains(Column("set_id")))
            .filter(Column("parent_type") == "planned")
            .order(Column("group_index"), Column("role"), Column("kind"))
            .fetchAll(db)
        return Dictionary(grouping: rows, by: \.setId)
    }

    private func mapPlannedSet(_ row: PlannedSetRow, measurements: [SetMeasurementRow]) -> PlannedSet {
        PlannedSet(
            id: row.id,
            plannedExerciseId: row.templateExerciseId,
            orderIndex: row.orderIndex,
            entries: SetEntry.buildEntries(from: measurements),
            restSeconds: row.restSeconds,
            isDropset: row.isDropset != 0,
            isPerSide: row.isPerSide != 0,
            isAmrap: row.isAmrap != 0,
            notes: row.notes
        )
    }

    private func mapPlannedExercise(_ row: PlannedExerciseRow, sets: [PlannedSet]) -> PlannedExercise {
        PlannedExercise(
            id: row.id,
            workoutPlanId: row.workoutTemplateId,
            exerciseName: row.exerciseName,
            orderIndex: row.orderIndex,
            notes: row.notes,
            equipmentType: row.equipmentType,
            groupType: row.groupType.flatMap { GroupType(rawValue: $0) },
            groupName: row.groupName,
            parentExerciseId: row.parentExerciseId,
            sets: sets
        )
    }

    private func makePlan(row: WorkoutPlanRow, exercises: [PlannedExercise]) -> WorkoutPlan {
        var tags: [String] = []
        if let tagsString = row.tags, let data = tagsString.data(using: .utf8) {
            tags = (try? JSONDecoder().decode([String].self, from: data)) ?? []
        }
        return WorkoutPlan(
            id: row.id,
            name: row.name,
            description: row.description,
            tags: tags,
            defaultWeightUnit: row.defaultWeightUnit.flatMap { WeightUnit(rawValue: $0) },
            sourceMarkdown: row.sourceMarkdown,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            isFavorite: row.isFavorite != 0,
            exercises: exercises
        )
    }
}
