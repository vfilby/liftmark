import Foundation
import GRDB

// MARK: - WorkoutSession

struct WorkoutSession: Identifiable, Codable, Hashable {
    var id: String
    var workoutPlanId: String?
    var name: String
    var date: String // ISO date YYYY-MM-DD
    var startTime: String?
    var endTime: String?
    var duration: Int? // seconds
    var notes: String?
    var exercises: [SessionExercise]
    var status: SessionStatus

    init(
        id: String = UUID().uuidString,
        workoutPlanId: String? = nil,
        name: String,
        date: String,
        startTime: String? = nil,
        endTime: String? = nil,
        duration: Int? = nil,
        notes: String? = nil,
        exercises: [SessionExercise] = [],
        status: SessionStatus = .inProgress
    ) {
        self.id = id
        self.workoutPlanId = workoutPlanId
        self.name = name
        self.date = date
        self.startTime = startTime
        self.endTime = endTime
        self.duration = duration
        self.notes = notes
        self.exercises = exercises
        self.status = status
    }
}

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

// MARK: - SessionExercise

struct SessionExercise: Identifiable, Codable, Hashable {
    var id: String
    var workoutSessionId: String
    var exerciseName: String
    var orderIndex: Int
    var notes: String?
    var equipmentType: String?
    var groupType: GroupType?
    var groupName: String?
    var parentExerciseId: String?
    var sets: [SessionSet]
    var status: ExerciseStatus

    init(
        id: String = UUID().uuidString,
        workoutSessionId: String,
        exerciseName: String,
        orderIndex: Int,
        notes: String? = nil,
        equipmentType: String? = nil,
        groupType: GroupType? = nil,
        groupName: String? = nil,
        parentExerciseId: String? = nil,
        sets: [SessionSet] = [],
        status: ExerciseStatus = .pending
    ) {
        self.id = id
        self.workoutSessionId = workoutSessionId
        self.exerciseName = exerciseName
        self.orderIndex = orderIndex
        self.notes = notes
        self.equipmentType = equipmentType
        self.groupType = groupType
        self.groupName = groupName
        self.parentExerciseId = parentExerciseId
        self.sets = sets
        self.status = status
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

// MARK: - SessionSet

struct SessionSet: Identifiable, Codable, Hashable {
    var id: String
    var sessionExerciseId: String
    var orderIndex: Int

    // Drop Set Support
    var parentSetId: String?
    var dropSequence: Int?

    // Target/Planned values
    var targetWeight: Double?
    var targetWeightUnit: WeightUnit?
    var targetReps: Int?
    var targetTime: Int?
    var targetRpe: Int?
    var restSeconds: Int?

    // Actual Performance
    var actualWeight: Double?
    var actualWeightUnit: WeightUnit?
    var actualReps: Int?
    var actualTime: Int?
    var actualRpe: Int?

    // Metadata
    var completedAt: String?
    var status: SetStatus
    var notes: String?
    var tempo: String?
    var isDropset: Bool
    var isPerSide: Bool
    var side: String?

    init(
        id: String = UUID().uuidString,
        sessionExerciseId: String,
        orderIndex: Int,
        parentSetId: String? = nil,
        dropSequence: Int? = nil,
        targetWeight: Double? = nil,
        targetWeightUnit: WeightUnit? = nil,
        targetReps: Int? = nil,
        targetTime: Int? = nil,
        targetRpe: Int? = nil,
        restSeconds: Int? = nil,
        actualWeight: Double? = nil,
        actualWeightUnit: WeightUnit? = nil,
        actualReps: Int? = nil,
        actualTime: Int? = nil,
        actualRpe: Int? = nil,
        completedAt: String? = nil,
        status: SetStatus = .pending,
        notes: String? = nil,
        tempo: String? = nil,
        isDropset: Bool = false,
        isPerSide: Bool = false,
        side: String? = nil
    ) {
        self.id = id
        self.sessionExerciseId = sessionExerciseId
        self.orderIndex = orderIndex
        self.parentSetId = parentSetId
        self.dropSequence = dropSequence
        self.targetWeight = targetWeight
        self.targetWeightUnit = targetWeightUnit
        self.targetReps = targetReps
        self.targetTime = targetTime
        self.targetRpe = targetRpe
        self.restSeconds = restSeconds
        self.actualWeight = actualWeight
        self.actualWeightUnit = actualWeightUnit
        self.actualReps = actualReps
        self.actualTime = actualTime
        self.actualRpe = actualRpe
        self.completedAt = completedAt
        self.status = status
        self.notes = notes
        self.tempo = tempo
        self.isDropset = isDropset
        self.isPerSide = isPerSide
        self.side = side
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
    var targetRpe: Int?
    var restSeconds: Int?
    // Actual values
    var actualWeight: Double?
    var actualWeightUnit: String?
    var actualReps: Int?
    var actualTime: Int?
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
        case targetRpe = "target_rpe"
        case restSeconds = "rest_seconds"
        case actualWeight = "actual_weight"
        case actualWeightUnit = "actual_weight_unit"
        case actualReps = "actual_reps"
        case actualTime = "actual_time"
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

// MARK: - Exercise History Types

struct ExerciseHistoryPoint: Codable, Hashable {
    var date: String
    var startTime: String?
    var workoutName: String
    var maxWeight: Double
    var avgReps: Double
    var totalVolume: Double
    var setsCount: Int
    var avgTime: Double
    var maxTime: Double
    var unit: WeightUnit
}

struct ExerciseProgressMetrics: Codable, Hashable {
    var exerciseName: String
    var totalSessions: Int
    var totalVolume: Double
    var maxWeight: Double
    var maxWeightUnit: WeightUnit
    var avgWeightPerSession: Double
    var avgRepsPerSet: Double
    var firstSessionDate: String
    var lastSessionDate: String
    var trend: Trend
}
