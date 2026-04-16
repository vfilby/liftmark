import Foundation
import GRDB

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
    var updatedAt: String?

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
        case updatedAt = "updated_at"
    }
}

// MARK: - PlannedSetRow (GRDB Record)

struct PlannedSetRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "template_sets"

    var id: String
    var templateExerciseId: String
    var orderIndex: Int
    var restSeconds: Int?
    var isDropset: Int // SQLite boolean
    var isPerSide: Int // SQLite boolean
    var isAmrap: Int // SQLite boolean
    var notes: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case templateExerciseId = "template_exercise_id"
        case orderIndex = "order_index"
        case restSeconds = "rest_seconds"
        case isDropset = "is_dropset"
        case isPerSide = "is_per_side"
        case isAmrap = "is_amrap"
        case notes
        case updatedAt = "updated_at"
    }
}
