import Foundation
import GRDB

// MARK: - WorkoutSessionRow (GRDB Record)

struct WorkoutSessionRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "workout_sessions"

    var id: String
    var workoutTemplateId: String?
    var name: String
    var date: String
    var startTime: String?
    var endTime: String?
    var duration: Int?
    var notes: String?
    var status: String
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case workoutTemplateId = "workout_template_id"
        case name
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case duration
        case notes
        case status
        case updatedAt = "updated_at"
    }
}

// MARK: - SessionExerciseRow (GRDB Record)

struct SessionExerciseRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "session_exercises"

    var id: String
    var workoutSessionId: String
    var exerciseName: String
    var orderIndex: Int
    var notes: String?
    var equipmentType: String?
    var groupType: String?
    var groupName: String?
    var parentExerciseId: String?
    var status: String
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case workoutSessionId = "workout_session_id"
        case exerciseName = "exercise_name"
        case orderIndex = "order_index"
        case notes
        case equipmentType = "equipment_type"
        case groupType = "group_type"
        case groupName = "group_name"
        case parentExerciseId = "parent_exercise_id"
        case status
        case updatedAt = "updated_at"
    }
}

// MARK: - SessionSetRow (GRDB Record)

struct SessionSetRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "session_sets"

    var id: String
    var sessionExerciseId: String
    var orderIndex: Int
    var parentSetId: String?
    var dropSequence: Int?
    // Target values
    var targetWeight: Double?
    var targetWeightUnit: String?
    var targetReps: Int?
    var targetTime: Int?
    var targetDistance: Double?
    var targetDistanceUnit: String?
    var targetRpe: Int?
    var restSeconds: Int?
    // Actual values
    var actualWeight: Double?
    var actualWeightUnit: String?
    var actualReps: Int?
    var actualTime: Int?
    var actualDistance: Double?
    var actualDistanceUnit: String?
    var actualRpe: Int?
    // Metadata
    var completedAt: String?
    var status: String
    var notes: String?
    var tempo: String?
    var isDropset: Int // SQLite boolean
    var isPerSide: Int // SQLite boolean
    var side: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case sessionExerciseId = "session_exercise_id"
        case orderIndex = "order_index"
        case parentSetId = "parent_set_id"
        case dropSequence = "drop_sequence"
        case targetWeight = "target_weight"
        case targetWeightUnit = "target_weight_unit"
        case targetReps = "target_reps"
        case targetTime = "target_time"
        case targetDistance = "target_distance"
        case targetDistanceUnit = "target_distance_unit"
        case targetRpe = "target_rpe"
        case restSeconds = "rest_seconds"
        case actualWeight = "actual_weight"
        case actualWeightUnit = "actual_weight_unit"
        case actualReps = "actual_reps"
        case actualTime = "actual_time"
        case actualDistance = "actual_distance"
        case actualDistanceUnit = "actual_distance_unit"
        case actualRpe = "actual_rpe"
        case completedAt = "completed_at"
        case status
        case notes
        case tempo
        case isDropset = "is_dropset"
        case isPerSide = "is_per_side"
        case side
        case updatedAt = "updated_at"
    }
}
