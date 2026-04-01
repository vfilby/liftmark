import Foundation

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
    var targetDistance: Double?
    var targetDistanceUnit: DistanceUnit?
    var targetRpe: Int?
    var restSeconds: Int?

    // Actual Performance
    var actualWeight: Double?
    var actualWeightUnit: WeightUnit?
    var actualReps: Int?
    var actualTime: Int?
    var actualDistance: Double?
    var actualDistanceUnit: DistanceUnit?
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
        targetDistance: Double? = nil,
        targetDistanceUnit: DistanceUnit? = nil,
        targetRpe: Int? = nil,
        restSeconds: Int? = nil,
        actualWeight: Double? = nil,
        actualWeightUnit: WeightUnit? = nil,
        actualReps: Int? = nil,
        actualTime: Int? = nil,
        actualDistance: Double? = nil,
        actualDistanceUnit: DistanceUnit? = nil,
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
        self.targetDistance = targetDistance
        self.targetDistanceUnit = targetDistanceUnit
        self.targetRpe = targetRpe
        self.restSeconds = restSeconds
        self.actualWeight = actualWeight
        self.actualWeightUnit = actualWeightUnit
        self.actualReps = actualReps
        self.actualTime = actualTime
        self.actualDistance = actualDistance
        self.actualDistanceUnit = actualDistanceUnit
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
