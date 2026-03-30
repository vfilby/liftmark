import Foundation
import GRDB

// MARK: - GymRow (GRDB Record)

struct GymRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "gyms"

    var id: String
    var name: String
    var isDefault: Int // SQLite boolean
    var deletedAt: String?
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case isDefault = "is_default"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - GymEquipmentRow (GRDB Record)

struct GymEquipmentRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "gym_equipment"

    var id: String
    var name: String
    var isAvailable: Int // SQLite boolean
    var lastCheckedAt: String?
    var deletedAt: String?
    var createdAt: String
    var updatedAt: String
    var gymId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case isAvailable = "is_available"
        case lastCheckedAt = "last_checked_at"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case gymId = "gym_id"
    }
}
