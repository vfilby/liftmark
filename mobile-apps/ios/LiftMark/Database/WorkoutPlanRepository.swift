import Foundation
import GRDB

/// Repository for WorkoutPlan CRUD operations.
struct WorkoutPlanRepository {
    private let dbManager: DatabaseManager

    private var now: String { ISO8601DateFormatter().string(from: Date()) }

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

    @discardableResult
    func create(_ plan: WorkoutPlan) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        var createdMeasurementIds: [String] = []
        try dbQueue.write { db in
            let planRow = makePlanRow(from: plan, updatedAt: plan.updatedAt)
            try planRow.insert(db)
            createdMeasurementIds = try insertExerciseGraph(
                for: plan,
                planUpdatedAt: plan.updatedAt,
                db: db
            )
        }
        return saveChanges(for: plan, measurementIds: createdMeasurementIds)
    }

    @discardableResult
    func update(_ plan: WorkoutPlan) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()

        // Collect old exercise/set/measurement IDs before deletion for sync notifications
        let oldIds = try dbQueue.read { db in
            try collectPlanChildIds(planId: plan.id, db: db)
        }

        var newMeasurementIds: [String] = []
        try dbQueue.write { db in
            try deletePlanChildren(setIds: oldIds.setIds, planId: plan.id, db: db)

            let now = ISO8601DateFormatter().string(from: Date())
            let planRow = makePlanRow(from: plan, updatedAt: now)
            try planRow.update(db)

            newMeasurementIds = try insertExerciseGraph(
                for: plan,
                planUpdatedAt: now,
                db: db
            )
        }

        var changes = deleteChanges(
            exerciseIds: oldIds.exerciseIds,
            setIds: oldIds.setIds,
            measurementIds: oldIds.measurementIds
        )
        changes.append(contentsOf: saveChanges(for: plan, measurementIds: newMeasurementIds))
        return changes
    }

    @discardableResult
    func delete(_ id: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        let oldIds = try dbQueue.read { db in
            try collectPlanChildIds(planId: id, db: db)
        }
        try dbQueue.write { db in
            for setId in oldIds.setIds {
                try db.execute(
                    sql: "DELETE FROM set_measurements WHERE set_id = ?",
                    arguments: [setId]
                )
            }
            try db.execute(sql: "DELETE FROM workout_templates WHERE id = ?", arguments: [id])
        }
        var changes = deleteChanges(
            exerciseIds: oldIds.exerciseIds,
            setIds: oldIds.setIds,
            measurementIds: oldIds.measurementIds
        )
        changes.append(.delete(recordType: "WorkoutPlan", recordID: id))
        return changes
    }

    @discardableResult
    func toggleFavorite(_ id: String) throws -> [SyncChange] {
        let dbQueue = try dbManager.database()
        try dbQueue.write { db in
            try db.execute(
                sql: """
                UPDATE workout_templates
                SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
                WHERE id = ?
                """,
                arguments: [id]
            )
        }
        return [.save(recordType: "WorkoutPlan", recordID: id)]
    }

    // MARK: - Write helpers

    private func makePlanRow(from plan: WorkoutPlan, updatedAt: String) -> WorkoutPlanRow {
        let tagsJSON = (try? JSONEncoder().encode(plan.tags)) ?? Data()
        let tagsString = String(data: tagsJSON, encoding: .utf8)
        return WorkoutPlanRow(
            id: plan.id,
            name: plan.name,
            description: plan.description,
            tags: tagsString,
            defaultWeightUnit: plan.defaultWeightUnit?.rawValue,
            sourceMarkdown: plan.sourceMarkdown,
            createdAt: plan.createdAt,
            updatedAt: updatedAt,
            isFavorite: plan.isFavorite ? 1 : 0
        )
    }

    /// Inserts the plan's exercises, sets, and target measurements. Returns measurement IDs.
    private func insertExerciseGraph(
        for plan: WorkoutPlan,
        planUpdatedAt now: String,
        db: Database
    ) throws -> [String] {
        var measurementIds: [String] = []
        for exercise in plan.exercises {
            try makeExerciseRow(exercise, planId: plan.id, updatedAt: now).insert(db)
            for set in exercise.sets {
                try makeSetRow(set, exerciseId: exercise.id, updatedAt: now).insert(db)
                let inserted = try insertTargetMeasurements(for: set, now: now, db: db)
                measurementIds.append(contentsOf: inserted)
            }
        }
        return measurementIds
    }

    private func makeExerciseRow(
        _ exercise: PlannedExercise,
        planId: String,
        updatedAt: String
    ) -> PlannedExerciseRow {
        PlannedExerciseRow(
            id: exercise.id,
            workoutTemplateId: planId,
            exerciseName: exercise.exerciseName,
            orderIndex: exercise.orderIndex,
            notes: exercise.notes,
            equipmentType: exercise.equipmentType,
            groupType: exercise.groupType?.rawValue,
            groupName: exercise.groupName,
            parentExerciseId: exercise.parentExerciseId,
            updatedAt: updatedAt
        )
    }

    private func makeSetRow(
        _ set: PlannedSet,
        exerciseId: String,
        updatedAt: String
    ) -> PlannedSetRow {
        PlannedSetRow(
            id: set.id,
            templateExerciseId: exerciseId,
            orderIndex: set.orderIndex,
            restSeconds: set.restSeconds,
            isDropset: set.isDropset ? 1 : 0,
            isPerSide: set.isPerSide ? 1 : 0,
            isAmrap: set.isAmrap ? 1 : 0,
            notes: set.notes,
            updatedAt: updatedAt
        )
    }

    private func insertTargetMeasurements(
        for set: PlannedSet,
        now: String,
        db: Database
    ) throws -> [String] {
        var ids: [String] = []
        for entry in set.entries {
            guard let target = entry.target else { continue }
            let rows = target.toMeasurementRows(
                setId: set.id,
                parentType: "planned",
                role: "target",
                groupIndex: entry.groupIndex,
                now: now
            )
            for row in rows {
                try row.insert(db)
                ids.append(row.id)
            }
        }
        return ids
    }

    private func deletePlanChildren(setIds: [String], planId: String, db: Database) throws {
        for setId in setIds {
            try db.execute(
                sql: "DELETE FROM set_measurements WHERE set_id = ?",
                arguments: [setId]
            )
        }
        try db.execute(
            sql: "DELETE FROM template_exercises WHERE workout_template_id = ?",
            arguments: [planId]
        )
    }

    private func collectPlanChildIds(
        planId: String,
        db: Database
    ) throws -> (exerciseIds: [String], setIds: [String], measurementIds: [String]) {
        let exRows = try Row.fetchAll(
            db,
            sql: "SELECT id FROM template_exercises WHERE workout_template_id = ?",
            arguments: [planId]
        )
        let exerciseIds = exRows.compactMap { $0["id"] as String? }

        let setRows = try Row.fetchAll(db, sql: """
            SELECT ts.id FROM template_sets ts
            JOIN template_exercises te ON te.id = ts.template_exercise_id
            WHERE te.workout_template_id = ?
        """, arguments: [planId])
        let setIds = setRows.compactMap { $0["id"] as String? }

        var measurementIds: [String] = []
        for setId in setIds {
            let mRows = try Row.fetchAll(
                db,
                sql: "SELECT id FROM set_measurements WHERE set_id = ?",
                arguments: [setId]
            )
            measurementIds.append(contentsOf: mRows.compactMap { $0["id"] as String? })
        }
        return (exerciseIds, setIds, measurementIds)
    }

    private func saveChanges(for plan: WorkoutPlan, measurementIds: [String]) -> [SyncChange] {
        var changes: [SyncChange] = [.save(recordType: "WorkoutPlan", recordID: plan.id)]
        for exercise in plan.exercises {
            changes.append(.save(recordType: "PlannedExercise", recordID: exercise.id))
            for set in exercise.sets {
                changes.append(.save(recordType: "PlannedSet", recordID: set.id))
            }
        }
        for mId in measurementIds {
            changes.append(.save(recordType: "SetMeasurement", recordID: mId))
        }
        return changes
    }

    private func deleteChanges(
        exerciseIds: [String],
        setIds: [String],
        measurementIds: [String]
    ) -> [SyncChange] {
        var changes: [SyncChange] = []
        for mId in measurementIds {
            changes.append(.delete(recordType: "SetMeasurement", recordID: mId))
        }
        for setId in setIds {
            changes.append(.delete(recordType: "PlannedSet", recordID: setId))
        }
        for exId in exerciseIds {
            changes.append(.delete(recordType: "PlannedExercise", recordID: exId))
        }
        return changes
    }

    // MARK: - Assembly

    private func assemblePlan(from row: WorkoutPlanRow, in db: Database) throws -> WorkoutPlan {
        let exerciseRows = try PlannedExerciseRow
            .filter(Column("workout_template_id") == row.id)
            .order(Column("order_index"))
            .fetchAll(db)

        // Batch-fetch all sets for this plan's exercises in one query
        let exerciseIds = exerciseRows.map(\.id)
        let allSetRows = try PlannedSetRow
            .filter(exerciseIds.contains(Column("template_exercise_id")))
            .order(Column("order_index"))
            .fetchAll(db)
        let setsByExerciseId = Dictionary(grouping: allSetRows, by: \.templateExerciseId)

        // Batch-fetch all measurements for these sets
        let setIds = allSetRows.map(\.id)
        let allMeasurements: [SetMeasurementRow]
        if !setIds.isEmpty {
            allMeasurements = try SetMeasurementRow
                .filter(setIds.contains(Column("set_id")))
                .filter(Column("parent_type") == "planned")
                .order(Column("group_index"), Column("role"), Column("kind"))
                .fetchAll(db)
        } else {
            allMeasurements = []
        }
        let measurementsBySetId = Dictionary(grouping: allMeasurements, by: \.setId)

        let exercises = exerciseRows.map { exerciseRow -> PlannedExercise in
            let setRows = setsByExerciseId[exerciseRow.id] ?? []

            let sets = setRows.map { setRow -> PlannedSet in
                let measurements = measurementsBySetId[setRow.id] ?? []
                let entries = SetEntry.buildEntries(from: measurements)
                return PlannedSet(
                    id: setRow.id,
                    plannedExerciseId: setRow.templateExerciseId,
                    orderIndex: setRow.orderIndex,
                    entries: entries,
                    restSeconds: setRow.restSeconds,
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
