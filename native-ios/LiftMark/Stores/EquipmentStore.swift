import Foundation
import GRDB

@Observable
final class EquipmentStore {
    private(set) var equipment: [GymEquipment] = []
    private(set) var isLoading = false

    func loadEquipment(forGym gymId: String) {
        isLoading = true
        defer { isLoading = false }
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let rows = try dbQueue.read { db in
                try GymEquipmentRow
                    .filter(Column("gym_id") == gymId && Column("deleted_at") == nil)
                    .order(Column("name"))
                    .fetchAll(db)
            }
            equipment = rows.map {
                GymEquipment(
                    id: $0.id,
                    gymId: $0.gymId ?? gymId,
                    name: $0.name,
                    isAvailable: $0.isAvailable != 0,
                    lastCheckedAt: $0.lastCheckedAt,
                    createdAt: $0.createdAt,
                    updatedAt: $0.updatedAt
                )
            }
        } catch {
            print("Failed to load equipment: \(error)")
        }
    }

    func addEquipment(name: String, gymId: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                let row = GymEquipmentRow(
                    id: IDGenerator.generate(),
                    name: name,
                    isAvailable: 1,
                    lastCheckedAt: nil,
                    deletedAt: nil,
                    createdAt: now,
                    updatedAt: now,
                    gymId: gymId
                )
                try row.insert(db)
            }
            loadEquipment(forGym: gymId)
        } catch {
            print("Failed to add equipment: \(error)")
        }
    }

    func removeEquipment(id: String, gymId: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            try dbQueue.write { db in
                try db.execute(sql: "DELETE FROM gym_equipment WHERE id = ?", arguments: [id])
            }
            loadEquipment(forGym: gymId)
        } catch {
            print("Failed to remove equipment: \(error)")
        }
    }

    func toggleAvailability(id: String, gymId: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                try db.execute(
                    sql: "UPDATE gym_equipment SET is_available = CASE WHEN is_available = 1 THEN 0 ELSE 1 END, last_checked_at = ? WHERE id = ?",
                    arguments: [now, id]
                )
            }
            loadEquipment(forGym: gymId)
        } catch {
            print("Failed to toggle equipment: \(error)")
        }
    }
}
