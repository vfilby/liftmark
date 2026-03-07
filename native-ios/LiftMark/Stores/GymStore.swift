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
                try GymRow
                    .filter(Column("deleted_at") == nil)
                    .order(Column("is_default").desc, Column("name"))
                    .fetchAll(db)
            }
            gyms = rows.map {
                Gym(
                    id: $0.id,
                    name: $0.name,
                    isDefault: $0.isDefault != 0,
                    deletedAt: $0.deletedAt,
                    createdAt: $0.createdAt,
                    updatedAt: $0.updatedAt
                )
            }

            // Safety net: ensure exactly one default gym
            ensureSingleDefault()
        } catch {
            print("Failed to load gyms: \(error)")
        }
    }

    func createGym(name: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                // If no active gyms exist, make this the default
                let activeCount = try Int.fetchOne(
                    db,
                    sql: "SELECT COUNT(*) FROM gyms WHERE deleted_at IS NULL"
                ) ?? 0
                let row = GymRow(
                    id: IDGenerator.generate(),
                    name: name,
                    isDefault: activeCount == 0 ? 1 : 0,
                    deletedAt: nil,
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
        let activeGyms = gyms.filter { !$0.isDeleted }
        guard activeGyms.count > 1 else { return }

        let deletedGym = activeGyms.first { $0.id == id }

        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                // Soft-delete the gym
                try db.execute(
                    sql: "UPDATE gyms SET deleted_at = ?, updated_at = ? WHERE id = ?",
                    arguments: [now, now, id]
                )
                // Soft-delete associated equipment
                try db.execute(
                    sql: "UPDATE gym_equipment SET deleted_at = ?, updated_at = ? WHERE gym_id = ?",
                    arguments: [now, now, id]
                )

                // If deleted gym was the default, reassign to first remaining active gym
                if deletedGym?.isDefault == true {
                    let firstRemaining = try Row.fetchOne(
                        db,
                        sql: "SELECT id FROM gyms WHERE deleted_at IS NULL AND id != ? ORDER BY name LIMIT 1",
                        arguments: [id]
                    )
                    if let newDefaultId: String = firstRemaining?["id"] {
                        try db.execute(sql: "UPDATE gyms SET is_default = 0 WHERE deleted_at IS NULL")
                        try db.execute(
                            sql: "UPDATE gyms SET is_default = 1, updated_at = ? WHERE id = ?",
                            arguments: [now, newDefaultId]
                        )
                    }
                }
            }
            loadGyms()
        } catch {
            print("Failed to delete gym: \(error)")
        }
    }

    func setDefault(id: String) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                // Clear all defaults, then set the chosen one
                try db.execute(
                    sql: "UPDATE gyms SET is_default = 0, updated_at = ? WHERE deleted_at IS NULL",
                    arguments: [now]
                )
                try db.execute(
                    sql: "UPDATE gyms SET is_default = 1, updated_at = ? WHERE id = ?",
                    arguments: [now, id]
                )
            }
            loadGyms()
        } catch {
            print("Failed to set default gym: \(error)")
        }
    }

    // MARK: - Private

    /// Ensures exactly one gym is marked as default. Fixes data if needed.
    private func ensureSingleDefault() {
        let defaults = gyms.filter(\.isDefault)
        if defaults.count == 1 { return }

        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            try dbQueue.write { db in
                // Clear all defaults
                try db.execute(
                    sql: "UPDATE gyms SET is_default = 0 WHERE deleted_at IS NULL"
                )
                // Set the first active gym as default
                let first = try Row.fetchOne(
                    db,
                    sql: "SELECT id FROM gyms WHERE deleted_at IS NULL ORDER BY name LIMIT 1"
                )
                if let defaultId: String = first?["id"] {
                    try db.execute(
                        sql: "UPDATE gyms SET is_default = 1, updated_at = ? WHERE id = ?",
                        arguments: [now, defaultId]
                    )
                }
            }

            // Re-read after fixing
            let rows = try dbQueue.read { db in
                try GymRow
                    .filter(Column("deleted_at") == nil)
                    .order(Column("is_default").desc, Column("name"))
                    .fetchAll(db)
            }
            gyms = rows.map {
                Gym(
                    id: $0.id,
                    name: $0.name,
                    isDefault: $0.isDefault != 0,
                    deletedAt: $0.deletedAt,
                    createdAt: $0.createdAt,
                    updatedAt: $0.updatedAt
                )
            }
        } catch {
            print("Failed to ensure single default gym: \(error)")
        }
    }
}
