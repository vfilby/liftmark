import Foundation
import GRDB

// MARK: - WorkoutPlan

struct WorkoutPlan: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var description: String?
    var tags: [String]
    var defaultWeightUnit: WeightUnit?
    var sourceMarkdown: String?
    var createdAt: String
    var updatedAt: String
    var isFavorite: Bool
    var exercises: [PlannedExercise]

    init(
        id: String = UUID().uuidString,
        name: String,
        description: String? = nil,
        tags: [String] = [],
        defaultWeightUnit: WeightUnit? = nil,
        sourceMarkdown: String? = nil,
        createdAt: String = ISO8601DateFormatter().string(from: Date()),
        updatedAt: String = ISO8601DateFormatter().string(from: Date()),
        isFavorite: Bool = false,
        exercises: [PlannedExercise] = []
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.tags = tags
        self.defaultWeightUnit = defaultWeightUnit
        self.sourceMarkdown = sourceMarkdown
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isFavorite = isFavorite
        self.exercises = exercises
    }
}

// MARK: - WorkoutPlanRow (GRDB Record)

struct WorkoutPlanRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "workout_templates"

    var id: String
    var name: String
    var description: String?
    var tags: String? // JSON array string
    var defaultWeightUnit: String?
    var sourceMarkdown: String?
    var createdAt: String
    var updatedAt: String
    var isFavorite: Int // SQLite boolean: 0 or 1

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case tags
        case defaultWeightUnit = "default_weight_unit"
        case sourceMarkdown = "source_markdown"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isFavorite = "is_favorite"
    }
}

// MARK: - PlannedExercise

struct PlannedExercise: Identifiable, Codable, Hashable {
    var id: String
    var workoutPlanId: String
    var exerciseName: String
    var orderIndex: Int
    var notes: String?
    var equipmentType: String?
    var groupType: GroupType?
    var groupName: String?
    var parentExerciseId: String?
    var sets: [PlannedSet]

    init(
        id: String = UUID().uuidString,
        workoutPlanId: String,
        exerciseName: String,
        orderIndex: Int,
        notes: String? = nil,
        equipmentType: String? = nil,
        groupType: GroupType? = nil,
        groupName: String? = nil,
        parentExerciseId: String? = nil,
        sets: [PlannedSet] = []
    ) {
        self.id = id
        self.workoutPlanId = workoutPlanId
        self.exerciseName = exerciseName
        self.orderIndex = orderIndex
        self.notes = notes
        self.equipmentType = equipmentType
        self.groupType = groupType
        self.groupName = groupName
        self.parentExerciseId = parentExerciseId
        self.sets = sets
    }
}

// MARK: - PlannedExerciseRow (GRDB Record)

struct PlannedExerciseRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "template_exercises"

    var id: String
    var workoutTemplateId: String
    var exerciseName: String
    var orderIndex: Int
    var notes: String?
    var equipmentType: String?
    var groupType: String?
    var groupName: String?
    var parentExerciseId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case workoutTemplateId = "workout_template_id"
        case exerciseName = "exercise_name"
        case orderIndex = "order_index"
        case notes
        case equipmentType = "equipment_type"
        case groupType = "group_type"
        case groupName = "group_name"
        case parentExerciseId = "parent_exercise_id"
    }
}

// MARK: - PlannedSet

struct PlannedSet: Identifiable, Codable, Hashable {
    var id: String
    var plannedExerciseId: String
    var orderIndex: Int
    var targetWeight: Double?
    var targetWeightUnit: WeightUnit?
    var targetReps: Int?
    var targetTime: Int?
    var targetRpe: Int?
    var restSeconds: Int?
    var tempo: String?
    var isDropset: Bool
    var isPerSide: Bool
    var isAmrap: Bool
    var notes: String?

    init(
        id: String = UUID().uuidString,
        plannedExerciseId: String,
        orderIndex: Int,
        targetWeight: Double? = nil,
        targetWeightUnit: WeightUnit? = nil,
        targetReps: Int? = nil,
        targetTime: Int? = nil,
        targetRpe: Int? = nil,
        restSeconds: Int? = nil,
        tempo: String? = nil,
        isDropset: Bool = false,
        isPerSide: Bool = false,
        isAmrap: Bool = false,
        notes: String? = nil
    ) {
        self.id = id
        self.plannedExerciseId = plannedExerciseId
        self.orderIndex = orderIndex
        self.targetWeight = targetWeight
        self.targetWeightUnit = targetWeightUnit
        self.targetReps = targetReps
        self.targetTime = targetTime
        self.targetRpe = targetRpe
        self.restSeconds = restSeconds
        self.tempo = tempo
        self.isDropset = isDropset
        self.isPerSide = isPerSide
        self.isAmrap = isAmrap
        self.notes = notes
    }
}

// MARK: - PlannedSetRow (GRDB Record)

struct PlannedSetRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "template_sets"

    var id: String
    var templateExerciseId: String
    var orderIndex: Int
    var targetWeight: Double?
    var targetWeightUnit: String?
    var targetReps: Int?
    var targetTime: Int?
    var targetRpe: Int?
    var restSeconds: Int?
    var tempo: String?
    var isDropset: Int // SQLite boolean
    var isPerSide: Int // SQLite boolean
    var isAmrap: Int // SQLite boolean
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case id
        case templateExerciseId = "template_exercise_id"
        case orderIndex = "order_index"
        case targetWeight = "target_weight"
        case targetWeightUnit = "target_weight_unit"
        case targetReps = "target_reps"
        case targetTime = "target_time"
        case targetRpe = "target_rpe"
        case restSeconds = "rest_seconds"
        case tempo
        case isDropset = "is_dropset"
        case isPerSide = "is_per_side"
        case isAmrap = "is_amrap"
        case notes
    }
}
