import * as SQLite from 'expo-sqlite';

const DB_NAME = 'liftmark.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize and return the database instance
 * Creates tables if they don't exist
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Run migrations
    await runMigrations(db);

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    db = null;
    throw error;
  }
}

/**
 * Run database migrations
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create tables for MVP
  // Only creating workout_templates, template_exercises, template_sets, and user_settings
  // Session tables will be added in Phase 3

  await database.execAsync(`
    -- Workout Templates
    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      default_weight_unit TEXT,
      source_markdown TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Template Exercises
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
    );

    -- Template Sets
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
      FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );

    -- User Settings
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
      enable_workout_timer INTEGER DEFAULT 1,
      auto_start_rest_timer INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'auto',
      notifications_enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Gym Locations
    CREATE TABLE IF NOT EXISTS gyms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Gym Equipment Availability
    CREATE TABLE IF NOT EXISTS gym_equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_available INTEGER DEFAULT 1,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_template_exercises_workout
      ON template_exercises(workout_template_id);

    CREATE INDEX IF NOT EXISTS idx_gym_equipment_name
      ON gym_equipment(name);

    CREATE INDEX IF NOT EXISTS idx_gyms_default
      ON gyms(is_default);

    CREATE INDEX IF NOT EXISTS idx_template_sets_exercise
      ON template_sets(template_exercise_id);

    -- Workout Sessions (actual workout instances)
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
    );

    -- Session Exercises
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
    );

    -- Session Sets
    CREATE TABLE IF NOT EXISTS session_sets (
      id TEXT PRIMARY KEY,
      session_exercise_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      parent_set_id TEXT,
      drop_sequence INTEGER,
      -- Target/Planned values (copied from template)
      target_weight REAL,
      target_weight_unit TEXT,
      target_reps INTEGER,
      target_time INTEGER,
      target_rpe INTEGER,
      rest_seconds INTEGER,
      -- Actual performance values (user input)
      actual_weight REAL,
      actual_weight_unit TEXT,
      actual_reps INTEGER,
      actual_time INTEGER,
      actual_rpe INTEGER,
      -- Metadata
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      tempo TEXT,
      is_dropset INTEGER DEFAULT 0,
      FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
    );

    -- Session indexes
    CREATE INDEX IF NOT EXISTS idx_session_exercises_session
      ON session_exercises(workout_session_id);

    CREATE INDEX IF NOT EXISTS idx_session_sets_exercise
      ON session_sets(session_exercise_id);

    CREATE INDEX IF NOT EXISTS idx_workout_sessions_status
      ON workout_sessions(status);
  `);

  // Migration: Add auto_start_rest_timer column if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN auto_start_rest_timer INTEGER DEFAULT 1`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add custom_prompt_addition column if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN custom_prompt_addition TEXT`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add is_per_side column to template_sets if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE template_sets ADD COLUMN is_per_side INTEGER DEFAULT 0`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add is_per_side column to session_sets if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE session_sets ADD COLUMN is_per_side INTEGER DEFAULT 0`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add healthkit_enabled column to user_settings if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN healthkit_enabled INTEGER DEFAULT 0`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add live_activities_enabled column to user_settings if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN live_activities_enabled INTEGER DEFAULT 1`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add keep_screen_awake column to user_settings if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN keep_screen_awake INTEGER DEFAULT 1`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add anthropic_api_key column to user_settings if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN anthropic_api_key TEXT`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add gym_id column to gym_equipment if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE gym_equipment ADD COLUMN gym_id TEXT`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Create sync tables for CloudKit synchronization
  await database.execAsync(`
    -- Sync Metadata (stores sync state and tokens)
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      last_sync_date TEXT,
      server_change_token TEXT,
      sync_enabled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Sync Queue (pending operations to sync)
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      created_at TEXT NOT NULL
    );

    -- Sync Conflicts (for debugging conflict resolution)
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      local_data TEXT NOT NULL,
      remote_data TEXT NOT NULL,
      resolution TEXT NOT NULL,
      resolved_at TEXT,
      created_at TEXT NOT NULL
    );

    -- Indexes for sync tables
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
      ON sync_queue(entity_type, entity_id);

    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity
      ON sync_conflicts(entity_type, entity_id);
  `);

  // Migration: Create default gym and migrate existing equipment
  try {
    const { generateId } = await import('@/utils/id');
    const existingGym = await database.getFirstAsync('SELECT id FROM gyms LIMIT 1');

    if (!existingGym) {
      // Check if there's any existing equipment without a gym_id
      const orphanedEquipment = await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM gym_equipment WHERE gym_id IS NULL`
      );

      const now = new Date().toISOString();
      const defaultGymId = generateId();

      // Create default gym
      await database.runAsync(
        `INSERT INTO gyms (id, name, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [defaultGymId, 'My Gym', 1, now, now]
      );
      console.log('Default gym created');

      // Migrate any existing equipment to the default gym
      if (orphanedEquipment && orphanedEquipment.count > 0) {
        await database.runAsync(
          `UPDATE gym_equipment SET gym_id = ? WHERE gym_id IS NULL`,
          [defaultGymId]
        );
        console.log(`Migrated ${orphanedEquipment.count} equipment items to default gym`);
      }
    }
  } catch (error) {
    console.error('Failed to migrate gyms:', error);
  }

  // Migration: Add gym_equipment index on gym_id
  try {
    await database.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_gym_equipment_gym ON gym_equipment(gym_id)`
    );
  } catch {
    // Index might already exist
  }

  // Migration: Add anthropic_api_key column to user_settings if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN anthropic_api_key TEXT`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add anthropic_api_key_status column to user_settings if it doesn't exist
  try {
    await database.runAsync(
      `ALTER TABLE user_settings ADD COLUMN anthropic_api_key_status TEXT DEFAULT 'not_set'`
    );
  } catch {
    // Column already exists, ignore error
  }

  // Initialize default user settings if they don't exist
  try {
    const settings = await database.getFirstAsync('SELECT * FROM user_settings LIMIT 1');

    if (!settings) {
      const { generateId } = await import('@/utils/id');
      const now = new Date().toISOString();

      await database.runAsync(
        `INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), 'lbs', 1, 1, 'auto', 1, now, now]
      );
      console.log('Default user settings created');
    }
  } catch (error) {
    console.error('Failed to initialize default settings:', error);
    // Don't throw here - the app can still function without settings
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Clear all data (for testing/development)
 */
export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    DELETE FROM session_sets;
    DELETE FROM session_exercises;
    DELETE FROM workout_sessions;
    DELETE FROM template_sets;
    DELETE FROM template_exercises;
    DELETE FROM workout_templates;
    DELETE FROM gym_equipment;
    DELETE FROM gyms;
  `);
}
