import Foundation

// MARK: - Gym

struct Gym: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var isDefault: Bool
    var deletedAt: String?
    var createdAt: String
    var updatedAt: String

    var isDeleted: Bool { deletedAt != nil }

    init(
        id: String = UUID().uuidString,
        name: String,
        isDefault: Bool = false,
        deletedAt: String? = nil,
        createdAt: String = ISO8601DateFormatter().string(from: Date()),
        updatedAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
        self.deletedAt = deletedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - GymEquipment

struct GymEquipment: Identifiable, Codable, Hashable {
    var id: String
    var gymId: String
    var name: String
    var isAvailable: Bool
    var lastCheckedAt: String?
    var createdAt: String
    var updatedAt: String

    init(
        id: String = UUID().uuidString,
        gymId: String,
        name: String,
        isAvailable: Bool = true,
        lastCheckedAt: String? = nil,
        createdAt: String = ISO8601DateFormatter().string(from: Date()),
        updatedAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.gymId = gymId
        self.name = name
        self.isAvailable = isAvailable
        self.lastCheckedAt = lastCheckedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Preset Equipment

struct PresetEquipment {
    static let freeWeights = [
        "Barbell", "Dumbbells", "Kettlebells", "Weight Plates", "EZ Curl Bar"
    ]

    static let benchesAndRacks = [
        "Flat Bench", "Incline Bench", "Adjustable Bench",
        "Squat Rack", "Power Rack", "Smith Machine"
    ]

    static let machines = [
        "Cable Machine", "Lat Pulldown", "Leg Press", "Leg Curl",
        "Leg Extension", "Chest Press Machine", "Shoulder Press Machine", "Row Machine"
    ]

    static let cardio = [
        "Treadmill", "Stationary Bike", "Rowing Machine", "Elliptical", "Stair Climber"
    ]

    static let other = [
        "Pull-up Bar", "Dip Station", "Resistance Bands",
        "TRX/Suspension Trainer", "Medicine Ball", "Battle Ropes", "Foam Roller"
    ]

    static let all: [String] = freeWeights + benchesAndRacks + machines + cardio + other
}
