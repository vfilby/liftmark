import Foundation
import GRDB

/// Manages the SQLite database using GRDB, including migrations.
/// Schema matches the React Native app exactly (see spec/data/database-schema.md).
final class DatabaseManager: @unchecked Sendable {
    static let shared = DatabaseManager()

    private var dbQueue: DatabaseQueue?

    private static let dbName = "liftmark.db"
    private static let currentSchemaVersion = 7

    private init() {}

    // MARK: - Public API

    /// Returns the database queue, creating/migrating if needed.
    func database() throws -> DatabaseQueue {
        if let dbQueue { return dbQueue }

        let fileManager = FileManager.default
        let documentsURL = try fileManager.url(
            for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        let sqliteDir = documentsURL.appendingPathComponent("SQLite", isDirectory: true)
        try fileManager.createDirectory(at: sqliteDir, withIntermediateDirectories: true)

        let dbPath = sqliteDir.appendingPathComponent(Self.dbName).path
        let dbQueue = try DatabaseQueue(path: dbPath)

        try dbQueue.write { db in
            try db.execute(sql: "PRAGMA foreign_keys = ON")
        }

        try runMigrations(dbQueue)
        self.dbQueue = dbQueue
        return dbQueue
    }

    /// Close the database connection.
    func close() {
        dbQueue = nil
    }

    /// Reset all data for test isolation. Opens the database if needed,
    /// truncates all tables, then closes and deletes the file.
    func deleteDatabase() {
        // Open the DB (creates it if needed) so we can truncate data.
        // This handles the case where the connection doesn't exist yet.
        if let dbQueue = try? database() {
            try? dbQueue.write { db in
                // Order matters: children first due to foreign keys
                try db.execute(sql: "DELETE FROM sync_conflicts")
                try db.execute(sql: "DELETE FROM sync_queue")
                try db.execute(sql: "DELETE FROM sync_metadata")
                try db.execute(sql: "DELETE FROM session_sets")
                try db.execute(sql: "DELETE FROM session_exercises")
                try db.execute(sql: "DELETE FROM workout_sessions")
                try db.execute(sql: "DELETE FROM template_sets")
                try db.execute(sql: "DELETE FROM template_exercises")
                try db.execute(sql: "DELETE FROM workout_templates")
                try db.execute(sql: "DELETE FROM gym_equipment")
                try db.execute(sql: "DELETE FROM gyms")
                try db.execute(sql: "DELETE FROM user_settings")
            }
        }

        // Also close and delete the file for a complete reset
        close()
        let fileManager = FileManager.default
        guard let documentsURL = try? fileManager.url(
            for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false
        ) else { return }
        let sqliteDir = documentsURL.appendingPathComponent("SQLite").path
        try? fileManager.removeItem(atPath: sqliteDir)
    }

    // MARK: - Migrations

    private func runMigrations(_ dbQueue: DatabaseQueue) throws {
        try dbQueue.write { db in
            // Create version tracking table
            try db.execute(sql: """
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER NOT NULL DEFAULT 0
                )
            """)

            let row = try Row.fetchOne(db, sql: "SELECT version FROM schema_version LIMIT 1")
            var currentVersion: Int
            if let row {
                currentVersion = row["version"]
            } else {
                try db.execute(sql: "INSERT INTO schema_version (version) VALUES (0)")
                currentVersion = 0
            }

            if currentVersion >= Self.currentSchemaVersion { return }

            if currentVersion < 1 {
                try migrateToV1(db)
            }

            if currentVersion < 2 {
                try migrateToV2(db)
            }

            if currentVersion < 3 {
                try migrateToV3(db)
            }

            if currentVersion < 4 {
                try migrateToV4(db)
            }

            if currentVersion < 5 {
                try migrateToV5(db)
            }

            if currentVersion < 6 {
                try migrateToV6(db)
            }

            if currentVersion < 7 {
                try migrateToV7(db)
            }

            try db.execute(sql: "UPDATE schema_version SET version = ?", arguments: [Self.currentSchemaVersion])
        }
    }

    private func migrateToV1(_ db: Database) throws {
        // -- Workout Templates
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS workout_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                tags TEXT,
                default_weight_unit TEXT,
                source_markdown TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_favorite INTEGER DEFAULT 0
            )
        """)

        // -- Template Exercises
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS template_exercises (
                id TEXT PRIMARY KEY,
                workout_template_id TEXT NOT NULL,
                exercise_name TEXT NOT NULL,
                order_index INTEGER NOT NULL,
                notes TEXT,
                equipment_type TEXT,
                group_type TEXT,
                group_name TEXT,
                parent_exercise_id TEXT,
                FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
            )
        """)

        // -- Template Sets
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS template_sets (
                id TEXT PRIMARY KEY,
                template_exercise_id TEXT NOT NULL,
                order_index INTEGER NOT NULL,
                target_weight REAL,
                target_weight_unit TEXT,
                target_reps INTEGER,
                target_time INTEGER,
                target_rpe INTEGER,
                rest_seconds INTEGER,
                tempo TEXT,
                is_dropset INTEGER DEFAULT 0,
                is_per_side INTEGER DEFAULT 0,
                is_amrap INTEGER DEFAULT 0,
                notes TEXT,
                FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
            )
        """)

        // -- User Settings
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS user_settings (
                id TEXT PRIMARY KEY,
                default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
                enable_workout_timer INTEGER DEFAULT 1,
                auto_start_rest_timer INTEGER DEFAULT 1,
                theme TEXT DEFAULT 'auto',
                notifications_enabled INTEGER DEFAULT 1,
                custom_prompt_addition TEXT,
                anthropic_api_key TEXT,
                anthropic_api_key_status TEXT DEFAULT 'not_set',
                healthkit_enabled INTEGER DEFAULT 0,
                live_activities_enabled INTEGER DEFAULT 1,
                keep_screen_awake INTEGER DEFAULT 1,
                show_open_in_claude_button INTEGER DEFAULT 0,
                home_tiles TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        // -- Gyms
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS gyms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_default INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        // -- Gym Equipment
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS gym_equipment (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_available INTEGER DEFAULT 1,
                last_checked_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                gym_id TEXT
            )
        """)

        // -- Workout Sessions
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS workout_sessions (
                id TEXT PRIMARY KEY,
                workout_template_id TEXT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                duration INTEGER,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'in_progress',
                FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
            )
        """)

        // -- Session Exercises
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS session_exercises (
                id TEXT PRIMARY KEY,
                workout_session_id TEXT NOT NULL,
                exercise_name TEXT NOT NULL,
                order_index INTEGER NOT NULL,
                notes TEXT,
                equipment_type TEXT,
                group_type TEXT,
                group_name TEXT,
                parent_exercise_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
            )
        """)

        // -- Session Sets
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS session_sets (
                id TEXT PRIMARY KEY,
                session_exercise_id TEXT NOT NULL,
                order_index INTEGER NOT NULL,
                parent_set_id TEXT,
                drop_sequence INTEGER,
                target_weight REAL,
                target_weight_unit TEXT,
                target_reps INTEGER,
                target_time INTEGER,
                target_rpe INTEGER,
                rest_seconds INTEGER,
                actual_weight REAL,
                actual_weight_unit TEXT,
                actual_reps INTEGER,
                actual_time INTEGER,
                actual_rpe INTEGER,
                completed_at TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                notes TEXT,
                tempo TEXT,
                is_dropset INTEGER DEFAULT 0,
                is_per_side INTEGER DEFAULT 0,
                FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
            )
        """)

        // -- Sync tables (stubs)
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_metadata (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                last_sync_date TEXT,
                server_change_token TEXT,
                sync_enabled INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                payload TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                last_attempt_at TEXT,
                created_at TEXT NOT NULL
            )
        """)

        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_conflicts (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                local_data TEXT NOT NULL,
                remote_data TEXT NOT NULL,
                resolution TEXT NOT NULL,
                resolved_at TEXT,
                created_at TEXT NOT NULL
            )
        """)

        // -- Indexes
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_template_exercises_workout ON template_exercises(workout_template_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_template_sets_exercise ON template_sets(template_exercise_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_workout_templates_favorite ON workout_templates(is_favorite)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(workout_session_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_session_exercises_name ON session_exercises(exercise_name)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_session_sets_exercise ON session_sets(session_exercise_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(status)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_gym_equipment_name ON gym_equipment(name)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_gym_equipment_gym ON gym_equipment(gym_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_gyms_default ON gyms(is_default)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id)")

        // -- Seed default gym
        let existingGym = try Row.fetchOne(db, sql: "SELECT id FROM gyms LIMIT 1")
        if existingGym == nil {
            let now = ISO8601DateFormatter().string(from: Date())
            let defaultGymId = IDGenerator.generate()
            try db.execute(
                sql: "INSERT INTO gyms (id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                arguments: [defaultGymId, "My Gym", 1, now, now]
            )

            // Migrate orphaned equipment
            let orphanCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM gym_equipment WHERE gym_id IS NULL") ?? 0
            if orphanCount > 0 {
                try db.execute(sql: "UPDATE gym_equipment SET gym_id = ? WHERE gym_id IS NULL", arguments: [defaultGymId])
            }
        }

        // -- Seed default user settings
        let existingSettings = try Row.fetchOne(db, sql: "SELECT id FROM user_settings LIMIT 1")
        if existingSettings == nil {
            let now = ISO8601DateFormatter().string(from: Date())
            try db.execute(
                sql: """
                    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [IDGenerator.generate(), "lbs", 1, 1, "auto", 1, now, now]
            )
        }
    }

    private func migrateToV2(_ db: Database) throws {
        // Add last sync stat columns to sync_metadata for displaying sync history in UI
        try db.execute(sql: "ALTER TABLE sync_metadata ADD COLUMN last_uploaded INTEGER DEFAULT 0")
        try db.execute(sql: "ALTER TABLE sync_metadata ADD COLUMN last_downloaded INTEGER DEFAULT 0")
        try db.execute(sql: "ALTER TABLE sync_metadata ADD COLUMN last_conflicts INTEGER DEFAULT 0")
    }

    private func migrateToV3(_ db: Database) throws {
        try db.execute(sql: "ALTER TABLE user_settings ADD COLUMN developer_mode_enabled INTEGER DEFAULT 0")
    }

    private func migrateToV5(_ db: Database) throws {
        try db.execute(sql: "ALTER TABLE user_settings ADD COLUMN countdown_sounds_enabled INTEGER DEFAULT 1")
    }

    private func migrateToV6(_ db: Database) throws {
        try db.execute(sql: "ALTER TABLE session_sets ADD COLUMN side TEXT")
    }

    private func migrateToV7(_ db: Database) throws {
        try db.execute(sql: "ALTER TABLE user_settings ADD COLUMN has_accepted_disclaimer INTEGER DEFAULT 0")
    }

    private func migrateToV4(_ db: Database) throws {
        // Soft-delete support for gyms and gym_equipment to prevent CloudKit sync
        // from re-inserting deleted records.
        try db.execute(sql: "ALTER TABLE gyms ADD COLUMN deleted_at TEXT")
        try db.execute(sql: "ALTER TABLE gym_equipment ADD COLUMN deleted_at TEXT")

        // Ensure exactly one gym is marked as default
        let defaultCount = try Int.fetchOne(
            db,
            sql: "SELECT COUNT(*) FROM gyms WHERE is_default = 1 AND deleted_at IS NULL"
        ) ?? 0
        if defaultCount != 1 {
            try db.execute(sql: "UPDATE gyms SET is_default = 0 WHERE deleted_at IS NULL")
            let first = try Row.fetchOne(
                db,
                sql: "SELECT id FROM gyms WHERE deleted_at IS NULL ORDER BY name LIMIT 1"
            )
            if let id: String = first?["id"] {
                try db.execute(sql: "UPDATE gyms SET is_default = 1 WHERE id = ?", arguments: [id])
            }
        }
    }
}
