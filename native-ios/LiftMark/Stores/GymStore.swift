import Foundation
import GRDB

@Observable
final class GymStore {
    private(set) var gyms: [Gym] = []
    private(set) var isLoading = false

    func loadGyms() {
        isLoading = true
        defer { isLoading = false }
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let rows = try dbQueue.read { db in
                try GymRow.order(Column("is_default").desc, Column("name")).fetchAll(db)
            }
            gyms = rows.map {
                Gym(
                    id: $0.id,
                    name: $0.name,
                    isDefault: $0.isDefault != 0,
                    createdAt: $0.createdAt,
                    updatedAt: $0.updatedAt
                )
            }
        } catch {
            print("Failed to load gyms: \(error)")
        }
    }

    func createGym(name: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                let row = GymRow(
                    id: IDGenerator.generate(),
                    name: name,
                    isDefault: 0,
                    createdAt: now,
                    updatedAt: now
                )
                try row.insert(db)
            }
            loadGyms()
        } catch {
            print("Failed to create gym: \(error)")
        }
    }

    func deleteGym(id: String) {
        guard gyms.count > 1 else { return }
        do {
            let dbQueue = try DatabaseManager.shared.database()
            try dbQueue.write { db in
                // Application-level cascade: delete equipment first
                try db.execute(sql: "DELETE FROM gym_equipment WHERE gym_id = ?", arguments: [id])
                try db.execute(sql: "DELETE FROM gyms WHERE id = ?", arguments: [id])
            }
            loadGyms()
        } catch {
            print("Failed to delete gym: \(error)")
        }
    }

    func setDefault(id: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            try dbQueue.write { db in
                try db.execute(sql: "UPDATE gyms SET is_default = 0")
                try db.execute(sql: "UPDATE gyms SET is_default = 1 WHERE id = ?", arguments: [id])
            }
            loadGyms()
        } catch {
            print("Failed to set default gym: \(error)")
        }
    }
}
