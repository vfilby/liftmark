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
    var restSeconds: Int?
    var completedAt: String?
    var status: String
    var notes: String?
    var isDropset: Int // SQLite boolean
    var isPerSide: Int // SQLite boolean
    var isAmrap: Int // SQLite boolean
    var side: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case sessionExerciseId = "session_exercise_id"
        case orderIndex = "order_index"
        case restSeconds = "rest_seconds"
        case completedAt = "completed_at"
        case status
        case notes
        case isDropset = "is_dropset"
        case isPerSide = "is_per_side"
        case isAmrap = "is_amrap"
        case side
        case updatedAt = "updated_at"
    }
}

// MARK: - SetMeasurementRow (GRDB Record)

struct SetMeasurementRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "set_measurements"

    var id: String
    var setId: String
    var parentType: String // "session" or "planned"
    var role: String       // "target" or "actual"
    var kind: String       // "weight", "reps", "time", "distance", "rpe"
    var value: Double
    var unit: String?      // "lbs", "kg", "m", "km", "mi", "ft", "yd", "s" — nil for dimensionless
    var groupIndex: Int
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case setId = "set_id"
        case parentType = "parent_type"
        case role
        case kind
        case value
        case unit
        case groupIndex = "group_index"
        case updatedAt = "updated_at"
    }
}
