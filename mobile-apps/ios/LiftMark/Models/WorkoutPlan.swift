import Foundation

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
