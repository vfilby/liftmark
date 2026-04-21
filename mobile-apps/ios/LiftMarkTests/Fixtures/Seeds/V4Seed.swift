import Foundation

extension DatabaseSeeds {

    // MARK: - v4 DDL (post-migrateToV4)

    static let v4DDL: String = #"""
    CREATE TABLE workout_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, tags TEXT,
        default_weight_unit TEXT, source_markdown TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_favorite INTEGER DEFAULT 0
    );
    CREATE TABLE template_exercises (
        id TEXT PRIMARY KEY, workout_template_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE template_sets (
        id TEXT PRIMARY KEY, template_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        target_weight REAL, target_weight_unit TEXT, target_reps INTEGER, target_time INTEGER,
        target_rpe INTEGER, rest_seconds INTEGER, tempo TEXT,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE user_settings (
        id TEXT PRIMARY KEY, default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
        enable_workout_timer INTEGER DEFAULT 1, auto_start_rest_timer INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'auto', notifications_enabled INTEGER DEFAULT 1,
        custom_prompt_addition TEXT, anthropic_api_key TEXT,
        anthropic_api_key_status TEXT DEFAULT 'not_set',
        healthkit_enabled INTEGER DEFAULT 0, live_activities_enabled INTEGER DEFAULT 1,
        keep_screen_awake INTEGER DEFAULT 1, show_open_in_claude_button INTEGER DEFAULT 0,
        home_tiles TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        developer_mode_enabled INTEGER DEFAULT 0
    );
    CREATE TABLE gyms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE gym_equipment (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        is_available INTEGER DEFAULT 1, last_checked_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, gym_id TEXT, deleted_at TEXT
    );
    CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY, workout_template_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL,
        start_time TEXT, end_time TEXT, duration INTEGER, notes TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress',
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );
    CREATE TABLE session_exercises (
        id TEXT PRIMARY KEY, workout_session_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE session_sets (
        id TEXT PRIMARY KEY, session_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        parent_set_id TEXT, drop_sequence INTEGER,
        target_weight REAL, target_weight_unit TEXT, target_reps INTEGER, target_time INTEGER, target_rpe INTEGER,
        rest_seconds INTEGER,
        actual_weight REAL, actual_weight_unit TEXT, actual_reps INTEGER, actual_time INTEGER, actual_rpe INTEGER,
        completed_at TEXT, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, tempo TEXT,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0,
        FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
    );
    CREATE TABLE sync_metadata (
        id TEXT PRIMARY KEY, device_id TEXT NOT NULL, last_sync_date TEXT,
        server_change_token TEXT, sync_enabled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        last_uploaded INTEGER DEFAULT 0, last_downloaded INTEGER DEFAULT 0, last_conflicts INTEGER DEFAULT 0
    );
    CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        operation TEXT NOT NULL, payload TEXT NOT NULL,
        attempts INTEGER DEFAULT 0, last_attempt_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE sync_conflicts (
        id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        local_data TEXT NOT NULL, remote_data TEXT NOT NULL, resolution TEXT NOT NULL,
        resolved_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE schema_version (version INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX idx_template_exercises_workout ON template_exercises(workout_template_id);
    CREATE INDEX idx_template_sets_exercise ON template_sets(template_exercise_id);
    CREATE INDEX idx_workout_templates_favorite ON workout_templates(is_favorite);
    CREATE INDEX idx_session_exercises_session ON session_exercises(workout_session_id);
    CREATE INDEX idx_session_exercises_name ON session_exercises(exercise_name);
    CREATE INDEX idx_session_sets_exercise ON session_sets(session_exercise_id);
    CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
    CREATE INDEX idx_gym_equipment_name ON gym_equipment(name);
    CREATE INDEX idx_gym_equipment_gym ON gym_equipment(gym_id);
    CREATE INDEX idx_gyms_default ON gyms(is_default);
    CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    CREATE INDEX idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id);
    """#

    /// v4 data, zero-defaults variant — no gym has is_default=1. Invariant fix (if the migration were
    /// re-applied) picks the alphabetically-first non-deleted gym as default.
    static let v4DataZeroDefaults: String = #"""
    INSERT INTO workout_templates
      (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite)
    VALUES
      ('\#(templatePushId)', 'Push Day', NULL, NULL, 'lbs', NULL, '\#(ts1)', '\#(ts1)', 0);

    INSERT INTO user_settings
      (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled,
       anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled,
       keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled)
    VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1,
       'sk-ant-legacy-test-value', 'valid', 0, 1,
       1, 0, '\#(ts1)', '\#(ts1)', 1);

    -- Two gyms, BOTH is_default=0 — invariant violated at v4; forward chain hits v9 dedup only (no further fix-up).
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)', 'Beta Gym',  0, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymWork)', 'Alpha Gym', 0, '\#(ts1)', '\#(ts1)', NULL);

    INSERT INTO gym_equipment
      (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at)
    VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL),
      ('\#(equipBench)',   'Bench',   1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymWork)', '\#(ts2)');

    INSERT INTO sync_metadata (id, device_id, created_at, updated_at)
    VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');

    INSERT INTO schema_version (version) VALUES (4);
    """#

    /// v4 data, two-defaults variant — two non-deleted gyms have is_default=1.
    static let v4DataTwoDefaults: String = #"""
    INSERT INTO workout_templates
      (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite)
    VALUES
      ('\#(templatePushId)', 'Push Day', NULL, NULL, 'lbs', NULL, '\#(ts1)', '\#(ts1)', 0);

    INSERT INTO user_settings
      (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled,
       anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled,
       keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled)
    VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1,
       'sk-ant-legacy-test-value', 'valid', 0, 1,
       1, 0, '\#(ts1)', '\#(ts1)', 0);

    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)',    'Beta Gym',  1, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymWork)',    'Alpha Gym', 1, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymAnother)', 'Gamma Gym', 0, '\#(ts1)', '\#(ts1)', NULL);

    INSERT INTO gym_equipment
      (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at)
    VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL);

    INSERT INTO sync_metadata (id, device_id, created_at, updated_at)
    VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');

    INSERT INTO schema_version (version) VALUES (4);
    """#
}
