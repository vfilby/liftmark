import Foundation
import GRDB

/// Repository for WorkoutPlan CRUD operations.
struct WorkoutPlanRepository {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager = .shared) {
        self.dbManager = dbManager
    }

    // MARK: - Read

    func getAll() throws -> [WorkoutPlan] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let planRows = try WorkoutPlanRow.order(Column("updated_at").desc).fetchAll(db)
            return try planRows.map { try assemblePlan(from: $0, in: db) }
        }
    }

    func getById(_ id: String) throws -> WorkoutPlan? {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            guard let row = try WorkoutPlanRow.fetchOne(db, key: id) else { return nil }
            return try assemblePlan(from: row, in: db)
        }
    }

    func getFavorites() throws -> [WorkoutPlan] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let planRows = try WorkoutPlanRow
                .filter(Column("is_favorite") == 1)
                .order(Column("updated_at").desc)
                .fetchAll(db)
            return try planRows.map { try assemblePlan(from: $0, in: db) }
        }
    }

    func getRecent(limit: Int = 3) throws -> [WorkoutPlan] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let planRows = try WorkoutPlanRow
                .order(Column("updated_at").desc)
                .limit(limit)
                .fetchAll(db)
            return try planRows.map { try assemblePlan(from: $0, in: db) }
        }
    }

    // MARK: - Write

    func create(_ plan: WorkoutPlan) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            let tagsJSON = try JSONEncoder().encode(plan.tags)
            let tagsString = String(data: tagsJSON, encoding: .utf8)

            let planRow = WorkoutPlanRow(
                id: plan.id,
                name: plan.name,
                description: plan.description,
                tags: tagsString,
                defaultWeightUnit: plan.defaultWeightUnit?.rawValue,
                sourceMarkdown: plan.sourceMarkdown,
                createdAt: plan.createdAt,
                updatedAt: plan.updatedAt,
                isFavorite: plan.isFavorite ? 1 : 0
            )
            try planRow.insert(db)

            for exercise in plan.exercises {
                let exerciseRow = PlannedExerciseRow(
                    id: exercise.id,
                    workoutTemplateId: plan.id,
                    exerciseName: exercise.exerciseName,
                    orderIndex: exercise.orderIndex,
                    notes: exercise.notes,
                    equipmentType: exercise.equipmentType,
                    groupType: exercise.groupType?.rawValue,
                    groupName: exercise.groupName,
                    parentExerciseId: exercise.parentExerciseId
                )
                try exerciseRow.insert(db)

                for set in exercise.sets {
                    let setRow = PlannedSetRow(
                        id: set.id,
                        templateExerciseId: exercise.id,
                        orderIndex: set.orderIndex,
                        targetWeight: set.targetWeight,
                        targetWeightUnit: set.targetWeightUnit?.rawValue,
                        targetReps: set.targetReps,
                        targetTime: set.targetTime,
                        targetRpe: set.targetRpe,
                        restSeconds: set.restSeconds,
                        tempo: set.tempo,
                        isDropset: set.isDropset ? 1 : 0,
                        isPerSide: set.isPerSide ? 1 : 0,
                        isAmrap: set.isAmrap ? 1 : 0,
                        notes: set.notes
                    )
                    try setRow.insert(db)
                }
            }
        }
    }

    func update(_ plan: WorkoutPlan) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            // Delete existing exercises (cascades to sets)
            try db.execute(
                sql: "DELETE FROM template_exercises WHERE workout_template_id = ?",
                arguments: [plan.id]
            )

            let tagsJSON = try JSONEncoder().encode(plan.tags)
            let tagsString = String(data: tagsJSON, encoding: .utf8)

            let planRow = WorkoutPlanRow(
                id: plan.id,
                name: plan.name,
                description: plan.description,
                tags: tagsString,
                defaultWeightUnit: plan.defaultWeightUnit?.rawValue,
                sourceMarkdown: plan.sourceMarkdown,
                createdAt: plan.createdAt,
                updatedAt: ISO8601DateFormatter().string(from: Date()),
                isFavorite: plan.isFavorite ? 1 : 0
            )
            try planRow.update(db)

            // Re-insert exercises and sets
            for exercise in plan.exercises {
                let exerciseRow = PlannedExerciseRow(
                    id: exercise.id,
                    workoutTemplateId: plan.id,
                    exerciseName: exercise.exerciseName,
                    orderIndex: exercise.orderIndex,
                    notes: exercise.notes,
                    equipmentType: exercise.equipmentType,
                    groupType: exercise.groupType?.rawValue,
                    groupName: exercise.groupName,
                    parentExerciseId: exercise.parentExerciseId
                )
                try exerciseRow.insert(db)

                for set in exercise.sets {
                    let setRow = PlannedSetRow(
                        id: set.id,
                        templateExerciseId: exercise.id,
                        orderIndex: set.orderIndex,
                        targetWeight: set.targetWeight,
                        targetWeightUnit: set.targetWeightUnit?.rawValue,
                        targetReps: set.targetReps,
                        targetTime: set.targetTime,
                        targetRpe: set.targetRpe,
                        restSeconds: set.restSeconds,
                        tempo: set.tempo,
                        isDropset: set.isDropset ? 1 : 0,
                        isPerSide: set.isPerSide ? 1 : 0,
                        isAmrap: set.isAmrap ? 1 : 0,
                        notes: set.notes
                    )
                    try setRow.insert(db)
                }
            }
        }
    }

    func delete(_ id: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM workout_templates WHERE id = ?", arguments: [id])
        }
    }

    func toggleFavorite(_ id: String) throws {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE workout_templates SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?",
                arguments: [id]
            )
        }
    }

    // MARK: - Assembly

    private func assemblePlan(from row: WorkoutPlanRow, in db: Database) throws -> WorkoutPlan {
        let exerciseRows = try PlannedExerciseRow
            .filter(Column("workout_template_id") == row.id)
            .order(Column("order_index"))
            .fetchAll(db)

        let exercises = try exerciseRows.map { exerciseRow -> PlannedExercise in
            let setRows = try PlannedSetRow
                .filter(Column("template_exercise_id") == exerciseRow.id)
                .order(Column("order_index"))
                .fetchAll(db)

            let sets = setRows.map { setRow in
                PlannedSet(
                    id: setRow.id,
                    plannedExerciseId: setRow.templateExerciseId,
                    orderIndex: setRow.orderIndex,
                    targetWeight: setRow.targetWeight,
                    targetWeightUnit: setRow.targetWeightUnit.flatMap { WeightUnit(rawValue: $0) },
                    targetReps: setRow.targetReps,
                    targetTime: setRow.targetTime,
                    targetRpe: setRow.targetRpe,
                    restSeconds: setRow.restSeconds,
                    tempo: setRow.tempo,
                    isDropset: setRow.isDropset != 0,
                    isPerSide: setRow.isPerSide != 0,
                    isAmrap: setRow.isAmrap != 0,
                    notes: setRow.notes
                )
            }

            return PlannedExercise(
                id: exerciseRow.id,
                workoutPlanId: exerciseRow.workoutTemplateId,
                exerciseName: exerciseRow.exerciseName,
                orderIndex: exerciseRow.orderIndex,
                notes: exerciseRow.notes,
                equipmentType: exerciseRow.equipmentType,
                groupType: exerciseRow.groupType.flatMap { GroupType(rawValue: $0) },
                groupName: exerciseRow.groupName,
                parentExerciseId: exerciseRow.parentExerciseId,
                sets: sets
            )
        }

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
