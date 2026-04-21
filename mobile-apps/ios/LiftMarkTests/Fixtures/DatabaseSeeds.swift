// Frozen DDL + data seeds for upgrade-path migration tests.
//
// These strings are **authoritative**. Mirrors under `test-fixtures/db-seeds/` exist for human review,
// but the Swift constants in this file are what the tests actually load. If you update a seed, update
// both — the README in that directory notes this.
//
// DDL strings were initially captured by running `DatabaseManager.runMigrations(on:upTo:)` and dumping
// `sqlite_master`. The cross-check test (`testVNSeedMatchesLiveMigrateToVN`) guards against future drift
// by diffing PRAGMA table_info + index names between live migrations and the seed.
//
// Data fixtures use hard-coded UUIDs and ISO-8601 timestamps. Rule: **no clock reads, no `UUID()`**.
// Determinism is load-bearing for reproducibility across CI runs and local debugging.

import Foundation

enum DatabaseSeeds {

    // MARK: - Deterministic IDs and timestamps
    //
    // UUIDs are UUID4-style but hand-generated so parent/child references remain stable.
    // Timestamp convention: 2024-01-XX to keep them well clear of "today".

    // Templates
    static let templatePushId = "11111111-1111-1111-1111-000000000001"
    static let templatePullId = "11111111-1111-1111-1111-000000000002"

    // Template exercises
    static let tplExBench = "22222222-2222-2222-2222-000000000001"
    static let tplExBenchChild = "22222222-2222-2222-2222-000000000002"   // superset child of tplExBench
    static let tplExRow = "22222222-2222-2222-2222-000000000003"
    static let tplExCurl = "22222222-2222-2222-2222-000000000004"

    // Template sets
    static let tplSet1 = "33333333-3333-3333-3333-000000000001"  // weight/reps
    static let tplSet2 = "33333333-3333-3333-3333-000000000002"  // time only
    static let tplSet3 = "33333333-3333-3333-3333-000000000003"  // rpe set, dropset
    static let tplSet4 = "33333333-3333-3333-3333-000000000004"  // per-side
    static let tplSet5 = "33333333-3333-3333-3333-000000000005"  // amrap
    static let tplSet6 = "33333333-3333-3333-3333-000000000006"  // NULL rest, populated tempo
    static let tplSet7 = "33333333-3333-3333-3333-000000000007"
    static let tplSet8 = "33333333-3333-3333-3333-000000000008"

    // Sessions
    static let sessionDoneId = "44444444-4444-4444-4444-000000000001"
    static let sessionInProgressId = "44444444-4444-4444-4444-000000000002"

    // Session exercises
    static let sesExBench = "55555555-5555-5555-5555-000000000001"
    static let sesExBenchChild = "55555555-5555-5555-5555-000000000002"  // superset child
    static let sesExRow = "55555555-5555-5555-5555-000000000003"

    // Session sets — six rows with diverse measurement shapes
    static let sesSet1 = "66666666-6666-6666-6666-000000000001"  // unstarted target only
    static let sesSet2 = "66666666-6666-6666-6666-000000000002"  // complete
    static let sesSet3 = "66666666-6666-6666-6666-000000000003"  // dropset parent
    static let sesSet4 = "66666666-6666-6666-6666-000000000004"  // dropset child (parent_set_id = sesSet3)
    static let sesSet5 = "66666666-6666-6666-6666-000000000005"  // time only
    static let sesSet6 = "66666666-6666-6666-6666-000000000006"  // distance-only

    // Gyms / equipment
    static let gymHome = "77777777-7777-7777-7777-000000000001"
    static let gymWork = "77777777-7777-7777-7777-000000000002"
    static let gymAnother = "77777777-7777-7777-7777-000000000003"  // v4-two-defaults variant
    static let equipBarbell = "88888888-8888-8888-8888-000000000001"
    static let equipBench = "88888888-8888-8888-8888-000000000002"
    static let equipRack = "88888888-8888-8888-8888-000000000003"

    // User settings
    static let userSettingsId = "99999999-9999-9999-9999-000000000001"

    // Sync
    static let syncMetaId = "aaaaaaaa-aaaa-aaaa-aaaa-000000000001"
    static let syncQ1 = "bbbbbbbb-bbbb-bbbb-bbbb-000000000001"
    static let syncQ2 = "bbbbbbbb-bbbb-bbbb-bbbb-000000000002"
    static let syncQ3 = "bbbbbbbb-bbbb-bbbb-bbbb-000000000003"
    static let syncConflict1 = "cccccccc-cccc-cccc-cccc-000000000001"

    static let ts1 = "2024-01-15T10:00:00Z"
    static let ts2 = "2024-01-15T11:00:00Z"
    static let ts3 = "2024-01-15T12:34:56Z"  // v8 seed distinctive value
    static let tsDate = "2024-01-15"

    // MARK: - v1 DDL (post-migrateToV1 schema)

    static let v1DDL: String = #"""
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
        home_tiles TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE gyms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE gym_equipment (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        is_available INTEGER DEFAULT 1, last_checked_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, gym_id TEXT
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
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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

    // MARK: - v1 data — rich corpus covering every §5 edge case

    static let v1Data: String = #"""
    INSERT INTO workout_templates (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', 'Chest/shoulders/triceps', '["push","upper"]', 'lbs', '# Push Day', '\#(ts1)', '\#(ts1)', 1),
      ('\#(templatePullId)', 'Pull Day', NULL, NULL, NULL, NULL, '\#(ts2)', '\#(ts2)', 0);

    INSERT INTO template_exercises (id, workout_template_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id) VALUES
      ('\#(tplExBench)', '\#(templatePushId)', 'Bench Press', 0, 'warmup first', 'barbell', 'superset', 'Push A', NULL),
      ('\#(tplExBenchChild)', '\#(templatePushId)', 'Overhead Press', 1, NULL, 'barbell', 'superset', 'Push A', '\#(tplExBench)'),
      ('\#(tplExRow)', '\#(templatePullId)', 'Barbell Row', 0, NULL, 'barbell', NULL, NULL, NULL),
      ('\#(tplExCurl)', '\#(templatePullId)', 'Curl', 1, NULL, 'dumbbell', NULL, NULL, NULL);

    INSERT INTO template_sets (id, template_exercise_id, order_index, target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds, tempo, is_dropset, is_per_side, is_amrap, notes) VALUES
      ('\#(tplSet1)', '\#(tplExBench)', 0, 135.0, 'lbs', 5, NULL, NULL, 180, NULL, 0, 0, 0, NULL),
      ('\#(tplSet2)', '\#(tplExBench)', 1, NULL, NULL, NULL, 60, NULL, 60, NULL, 0, 0, 0, 'plank-style hold'),
      ('\#(tplSet3)', '\#(tplExBench)', 2, 95.0, 'lbs', 8, NULL, 8, 90, NULL, 1, 0, 0, NULL),
      ('\#(tplSet4)', '\#(tplExBenchChild)', 0, 45.0, 'lbs', 10, NULL, NULL, 60, NULL, 0, 1, 0, NULL),
      ('\#(tplSet5)', '\#(tplExBenchChild)', 1, 135.0, 'lbs', NULL, NULL, NULL, 120, NULL, 0, 0, 1, NULL),
      ('\#(tplSet6)', '\#(tplExRow)', 0, 155.0, 'lbs', 5, NULL, NULL, NULL, '2-0-1-0', 0, 0, 0, NULL),
      ('\#(tplSet7)', '\#(tplExRow)', 1, 155.0, 'lbs', 5, NULL, NULL, 120, NULL, 0, 0, 0, NULL),
      ('\#(tplSet8)', '\#(tplExCurl)', 0, 30.0, 'lbs', 12, NULL, NULL, 60, NULL, 0, 0, 0, NULL);

    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, custom_prompt_addition, anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, home_tiles, created_at, updated_at) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, NULL, 'sk-ant-legacy-test-value', 'valid', 0, 1, 1, 0, NULL, '\#(ts1)', '\#(ts1)');

    INSERT INTO gyms (id, name, is_default, created_at, updated_at) VALUES
      ('\#(gymHome)', 'Home Gym', 1, '\#(ts1)', '\#(ts1)'),
      ('\#(gymWork)', 'Office Gym', 0, '\#(ts1)', '\#(ts1)');

    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)'),
      ('\#(equipBench)', 'Flat Bench', 1, '\#(ts1)', '\#(ts1)', '\#(ts1)', '\#(gymHome)'),
      ('\#(equipRack)', 'Power Rack', 1, '\#(ts1)', '\#(ts1)', '\#(ts1)', '\#(gymHome)');

    INSERT INTO workout_sessions (id, workout_template_id, name, date, start_time, end_time, duration, notes, status) VALUES
      ('\#(sessionDoneId)', '\#(templatePushId)', 'Push Day - Done', '\#(tsDate)', '2024-01-15T08:00:00Z', '2024-01-15T09:05:00Z', 3900, NULL, 'completed'),
      ('\#(sessionInProgressId)', NULL, 'Freestyle', '\#(tsDate)', '2024-01-15T17:00:00Z', NULL, NULL, NULL, 'in_progress');

    INSERT INTO session_exercises (id, workout_session_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id, status) VALUES
      ('\#(sesExBench)', '\#(sessionDoneId)', 'Bench Press', 0, NULL, 'barbell', 'superset', 'A', NULL, 'completed'),
      ('\#(sesExBenchChild)', '\#(sessionDoneId)', 'Overhead Press', 1, NULL, 'barbell', 'superset', 'A', '\#(sesExBench)', 'pending'),
      ('\#(sesExRow)', '\#(sessionInProgressId)', 'Barbell Row', 0, NULL, 'barbell', NULL, NULL, NULL, 'pending');

    -- Session sets covering: unstarted target-only, complete, dropset parent + child with drop_sequence + tempo,
    -- time-only, distance-no-column-in-v1 (populated as target_time=60 so v12 maps to unit='s').
    INSERT INTO session_sets (id, session_exercise_id, order_index, parent_set_id, drop_sequence, target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds, actual_weight, actual_weight_unit, actual_reps, actual_time, actual_rpe, completed_at, status, notes, tempo, is_dropset, is_per_side) VALUES
      ('\#(sesSet1)', '\#(sesExBench)', 0, NULL, NULL, 135.0, 'lbs', 5, NULL, NULL, 180, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', NULL, NULL, 0, 0),
      ('\#(sesSet2)', '\#(sesExBench)', 1, NULL, NULL, 135.0, 'lbs', 5, NULL, 8, 180, 135.0, 'lbs', 5, NULL, 9, '2024-01-15T08:12:00Z', 'completed', 'felt good', NULL, 0, 0),
      ('\#(sesSet3)', '\#(sesExBench)', 2, NULL, NULL, 95.0, 'lbs', 8, NULL, 9, 90, 95.0, 'lbs', 8, NULL, 9, '2024-01-15T08:25:00Z', 'completed', NULL, NULL, 1, 0),
      ('\#(sesSet4)', '\#(sesExBench)', 3, '\#(sesSet3)', 2, 75.0, 'lbs', 10, NULL, 10, 90, 75.0, 'lbs', 10, NULL, 10, '2024-01-15T08:26:30Z', 'completed', 'drop', '2-0-1-0', 1, 0),
      ('\#(sesSet5)', '\#(sesExBenchChild)', 0, NULL, NULL, NULL, NULL, NULL, 60, NULL, 60, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', NULL, NULL, 0, 0),
      ('\#(sesSet6)', '\#(sesExRow)', 0, NULL, NULL, 155.0, 'lbs', 5, NULL, NULL, 120, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', NULL, NULL, 0, 0);

    INSERT INTO sync_metadata (id, device_id, last_sync_date, server_change_token, sync_enabled, created_at, updated_at) VALUES
      ('\#(syncMetaId)', 'device-ABC', NULL, NULL, 0, '\#(ts1)', '\#(ts1)');

    INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, attempts, last_attempt_at, created_at) VALUES
      ('\#(syncQ1)', 'session', '\#(sessionDoneId)', 'create', '{}', 0, NULL, '\#(ts1)'),
      ('\#(syncQ2)', 'template', '\#(templatePushId)', 'update', '{}', 1, '\#(ts2)', '\#(ts1)'),
      ('\#(syncQ3)', 'gym', '\#(gymHome)', 'create', '{}', 0, NULL, '\#(ts2)');

    INSERT INTO sync_conflicts (id, entity_type, entity_id, local_data, remote_data, resolution, resolved_at, created_at) VALUES
      ('\#(syncConflict1)', 'session', '\#(sessionDoneId)', '{}', '{}', 'local_wins', NULL, '\#(ts1)');

    -- v1 seed also exercises v9's schema_version dedup by inserting two identical rows.
    INSERT INTO schema_version (version) VALUES (1);
    INSERT INTO schema_version (version) VALUES (1);
    """#

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
    INSERT INTO workout_templates (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', NULL, NULL, 'lbs', NULL, '\#(ts1)', '\#(ts1)', 0);
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'sk-ant-legacy-test-value', 'valid', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 1);
    -- Two gyms, BOTH is_default=0 — invariant violated at v4; forward chain hits v9 dedup only (no further fix-up).
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)',  'Beta Gym',  0, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymWork)',  'Alpha Gym', 0, '\#(ts1)', '\#(ts1)', NULL);
    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL),
      ('\#(equipBench)',   'Bench',   1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymWork)', '\#(ts2)');
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO schema_version (version) VALUES (4);
    """#

    /// v4 data, two-defaults variant — two non-deleted gyms have is_default=1.
    static let v4DataTwoDefaults: String = #"""
    INSERT INTO workout_templates (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', NULL, NULL, 'lbs', NULL, '\#(ts1)', '\#(ts1)', 0);
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'sk-ant-legacy-test-value', 'valid', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 0);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)',    'Beta Gym',  1, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymWork)',    'Alpha Gym', 1, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymAnother)', 'Gamma Gym', 0, '\#(ts1)', '\#(ts1)', NULL);
    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL);
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO schema_version (version) VALUES (4);
    """#

    // MARK: - v7 DDL

    static let v7DDL: String = #"""
    \#(v4DDLForwardThroughV7)
    """#

    // Helper: v7 adds (v5) countdown_sounds_enabled, (v6) session_sets.side, (v7) has_accepted_disclaimer.
    // All three are ALTER TABLE column adds — same indexes as v4.
    private static let v4DDLForwardThroughV7: String = #"""
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
        developer_mode_enabled INTEGER DEFAULT 0,
        countdown_sounds_enabled INTEGER DEFAULT 1,
        has_accepted_disclaimer INTEGER DEFAULT 0
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
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, side TEXT,
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

    static let v7Data: String = #"""
    INSERT INTO workout_templates (id, name, description, tags, default_weight_unit, source_markdown, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', NULL, NULL, 'lbs', NULL, '\#(ts1)', '\#(ts1)', 1);
    INSERT INTO template_exercises (id, workout_template_id, exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id) VALUES
      ('\#(tplExBench)', '\#(templatePushId)', 'Bench Press', 0, NULL, 'barbell', NULL, NULL, NULL);
    INSERT INTO template_sets (id, template_exercise_id, order_index, target_weight, target_weight_unit, target_reps, rest_seconds) VALUES
      ('\#(tplSet1)', '\#(tplExBench)', 0, 135.0, 'lbs', 5, 180);
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'sk-ant-legacy-test-value', 'valid', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 1, 1, 1);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)',  'Home Gym',  1, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymWork)',  'Office Gym', 0, '\#(ts1)', '\#(ts1)', '\#(ts2)');
    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL),
      ('\#(equipBench)',   'Bench',   1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymWork)', '\#(ts2)');
    INSERT INTO workout_sessions (id, workout_template_id, name, date, start_time, end_time, duration, notes, status) VALUES
      ('\#(sessionDoneId)', '\#(templatePushId)', 'Push Day - Done', '\#(tsDate)', '2024-01-15T08:00:00Z', '2024-01-15T09:05:00Z', 3900, NULL, 'completed');
    INSERT INTO session_exercises (id, workout_session_id, exercise_name, order_index, status) VALUES
      ('\#(sesExBench)', '\#(sessionDoneId)', 'Bench Press', 0, 'completed');
    INSERT INTO session_sets (id, session_exercise_id, order_index, target_weight, target_weight_unit, target_reps, rest_seconds, actual_weight, actual_weight_unit, actual_reps, completed_at, status, side) VALUES
      ('\#(sesSet1)', '\#(sesExBench)', 0, 135.0, 'lbs', 5, 180, 135.0, 'lbs', 5, '2024-01-15T08:12:00Z', 'completed', 'left');
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO schema_version (version) VALUES (7);
    """#

    // MARK: - v8 DDL and data (post-migrateToV8, updated_at backfilled)

    static let v8DDL: String = #"""
    CREATE TABLE workout_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, tags TEXT,
        default_weight_unit TEXT, source_markdown TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_favorite INTEGER DEFAULT 0
    );
    CREATE TABLE template_exercises (
        id TEXT PRIMARY KEY, workout_template_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE template_sets (
        id TEXT PRIMARY KEY, template_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        target_weight REAL, target_weight_unit TEXT, target_reps INTEGER, target_time INTEGER,
        target_rpe INTEGER, rest_seconds INTEGER, tempo TEXT,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        notes TEXT, updated_at TEXT,
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
        developer_mode_enabled INTEGER DEFAULT 0,
        countdown_sounds_enabled INTEGER DEFAULT 1,
        has_accepted_disclaimer INTEGER DEFAULT 0
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
        status TEXT NOT NULL DEFAULT 'in_progress', updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );
    CREATE TABLE session_exercises (
        id TEXT PRIMARY KEY, workout_session_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT,
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
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, side TEXT, updated_at TEXT,
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
    CREATE TABLE sync_engine_state (
        id TEXT PRIMARY KEY DEFAULT 'default', data BLOB NOT NULL
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

    /// v8 seed — post-v8, updated_at is backfilled. Uses a DISTINCTIVE value (2024-01-15T12:34:56Z)
    /// so a bug that re-runs v8's backfill can be caught by asserting updated_at survives untouched.
    static let v8Data: String = #"""
    INSERT INTO workout_templates (id, name, default_weight_unit, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', 'lbs', '\#(ts1)', '\#(ts3)', 1);
    INSERT INTO template_exercises (id, workout_template_id, exercise_name, order_index, equipment_type, updated_at) VALUES
      ('\#(tplExBench)', '\#(templatePushId)', 'Bench Press', 0, 'barbell', '\#(ts3)');
    INSERT INTO template_sets (id, template_exercise_id, order_index, target_weight, target_weight_unit, target_reps, rest_seconds, updated_at) VALUES
      ('\#(tplSet1)', '\#(tplExBench)', 0, 135.0, 'lbs', 5, 180, '\#(ts3)');
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'sk-ant-legacy-test-value', 'valid', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 0, 1, 0);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)',  'Home Gym',  1, '\#(ts1)', '\#(ts1)', NULL);
    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL);
    INSERT INTO workout_sessions (id, workout_template_id, name, date, start_time, end_time, duration, status, updated_at) VALUES
      ('\#(sessionDoneId)', '\#(templatePushId)', 'Push Day', '\#(tsDate)', '2024-01-15T08:00:00Z', '2024-01-15T09:05:00Z', 3900, 'completed', '\#(ts3)');
    INSERT INTO session_exercises (id, workout_session_id, exercise_name, order_index, status, updated_at) VALUES
      ('\#(sesExBench)', '\#(sessionDoneId)', 'Bench Press', 0, 'completed', '\#(ts3)');
    INSERT INTO session_sets (id, session_exercise_id, order_index, target_weight, target_weight_unit, target_reps, rest_seconds, actual_weight, actual_weight_unit, actual_reps, completed_at, status, side, updated_at) VALUES
      ('\#(sesSet1)', '\#(sesExBench)', 0, 135.0, 'lbs', 5, 180, 135.0, 'lbs', 5, '2024-01-15T08:12:00Z', 'completed', 'left', '\#(ts3)');
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO sync_engine_state (id, data) VALUES ('default', X'0123456789ABCDEF0123456789ABCDEF');
    INSERT INTO schema_version (version) VALUES (8);
    """#

    // MARK: - v11 DDL and data

    static let v11DDL: String = #"""
    CREATE TABLE workout_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, tags TEXT,
        default_weight_unit TEXT, source_markdown TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_favorite INTEGER DEFAULT 0
    );
    CREATE TABLE template_exercises (
        id TEXT PRIMARY KEY, workout_template_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE template_sets (
        id TEXT PRIMARY KEY, template_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        target_weight REAL, target_weight_unit TEXT, target_reps INTEGER, target_time INTEGER,
        target_rpe INTEGER, rest_seconds INTEGER, tempo TEXT,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        notes TEXT, updated_at TEXT, target_distance REAL, target_distance_unit TEXT,
        FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE user_settings (
        id TEXT PRIMARY KEY, default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
        enable_workout_timer INTEGER DEFAULT 1, auto_start_rest_timer INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'auto', notifications_enabled INTEGER DEFAULT 1,
        custom_prompt_addition TEXT,
        anthropic_api_key_status TEXT DEFAULT 'not_set',
        healthkit_enabled INTEGER DEFAULT 0, live_activities_enabled INTEGER DEFAULT 1,
        keep_screen_awake INTEGER DEFAULT 1, show_open_in_claude_button INTEGER DEFAULT 0,
        home_tiles TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        developer_mode_enabled INTEGER DEFAULT 0,
        countdown_sounds_enabled INTEGER DEFAULT 1,
        has_accepted_disclaimer INTEGER DEFAULT 0
    );
    CREATE TABLE gyms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE gym_equipment (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        is_available INTEGER DEFAULT 1, last_checked_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        gym_id TEXT, deleted_at TEXT,
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
        UNIQUE (gym_id, name)
    );
    CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY, workout_template_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL,
        start_time TEXT, end_time TEXT, duration INTEGER, notes TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress', updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );
    CREATE TABLE session_exercises (
        id TEXT PRIMARY KEY, workout_session_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT,
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
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, side TEXT, updated_at TEXT,
        target_distance REAL, target_distance_unit TEXT, actual_distance REAL, actual_distance_unit TEXT,
        FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
    );
    CREATE TABLE sync_metadata (
        id TEXT PRIMARY KEY, device_id TEXT NOT NULL, last_sync_date TEXT,
        server_change_token TEXT, sync_enabled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        last_uploaded INTEGER DEFAULT 0, last_downloaded INTEGER DEFAULT 0, last_conflicts INTEGER DEFAULT 0
    );
    CREATE TABLE sync_engine_state (
        id TEXT PRIMARY KEY DEFAULT 'default', data BLOB NOT NULL
    );
    CREATE TABLE schema_version (version INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX idx_template_exercises_workout ON template_exercises(workout_template_id);
    CREATE INDEX idx_template_sets_exercise ON template_sets(template_exercise_id);
    CREATE INDEX idx_workout_templates_favorite ON workout_templates(is_favorite);
    CREATE INDEX idx_session_exercises_session ON session_exercises(workout_session_id);
    CREATE INDEX idx_session_exercises_name ON session_exercises(exercise_name);
    CREATE INDEX idx_session_exercises_parent ON session_exercises(parent_exercise_id);
    CREATE INDEX idx_session_sets_exercise ON session_sets(session_exercise_id);
    CREATE INDEX idx_session_sets_parent ON session_sets(parent_set_id);
    CREATE INDEX idx_template_exercises_parent ON template_exercises(parent_exercise_id);
    CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
    CREATE INDEX idx_workout_sessions_date ON workout_sessions(date DESC);
    CREATE INDEX idx_gym_equipment_name ON gym_equipment(name);
    CREATE INDEX idx_gym_equipment_gym ON gym_equipment(gym_id);
    CREATE INDEX idx_gyms_default ON gyms(is_default);
    """#

    /// v11 seed — two gym_equipment rows with same name across different gyms, exercising the
    /// composite UNIQUE that replaced the global UNIQUE in v11.
    static let v11Data: String = #"""
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'not_set', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 0, 1, 0);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)', 'Home Gym', 1, '\#(ts1)', '\#(ts1)', NULL),
      ('\#(gymWork)', 'Office Gym', 0, '\#(ts1)', '\#(ts1)', NULL);
    -- Two "Barbell" rows across different gyms — only legal post-v11.
    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL),
      ('\#(equipBench)',   'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymWork)', NULL),
      ('\#(equipRack)',    'Rack',    1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL);
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO schema_version (version) VALUES (11);
    """#

    // MARK: - v12 DDL and data (post-reshape)

    static let v12DDL: String = #"""
    CREATE TABLE workout_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, tags TEXT,
        default_weight_unit TEXT, source_markdown TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_favorite INTEGER DEFAULT 0
    );
    CREATE TABLE template_exercises (
        id TEXT PRIMARY KEY, workout_template_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE template_sets (
        id TEXT PRIMARY KEY, template_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        rest_seconds INTEGER,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        notes TEXT, updated_at TEXT,
        FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE user_settings (
        id TEXT PRIMARY KEY, default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
        enable_workout_timer INTEGER DEFAULT 1, auto_start_rest_timer INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'auto', notifications_enabled INTEGER DEFAULT 1,
        custom_prompt_addition TEXT,
        anthropic_api_key_status TEXT DEFAULT 'not_set',
        healthkit_enabled INTEGER DEFAULT 0, live_activities_enabled INTEGER DEFAULT 1,
        keep_screen_awake INTEGER DEFAULT 1, show_open_in_claude_button INTEGER DEFAULT 0,
        home_tiles TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        developer_mode_enabled INTEGER DEFAULT 0,
        countdown_sounds_enabled INTEGER DEFAULT 1,
        has_accepted_disclaimer INTEGER DEFAULT 0
    );
    CREATE TABLE gyms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE gym_equipment (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        is_available INTEGER DEFAULT 1, last_checked_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        gym_id TEXT, deleted_at TEXT,
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
        UNIQUE (gym_id, name)
    );
    CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY, workout_template_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL,
        start_time TEXT, end_time TEXT, duration INTEGER, notes TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress', updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );
    CREATE TABLE session_exercises (
        id TEXT PRIMARY KEY, workout_session_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT,
        FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE session_sets (
        id TEXT PRIMARY KEY, session_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        rest_seconds INTEGER, completed_at TEXT, status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        side TEXT, updated_at TEXT,
        FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE set_measurements (
        id TEXT PRIMARY KEY, set_id TEXT NOT NULL, parent_type TEXT NOT NULL,
        role TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT,
        group_index INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE sync_metadata (
        id TEXT PRIMARY KEY, device_id TEXT NOT NULL, last_sync_date TEXT,
        server_change_token TEXT, sync_enabled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        last_uploaded INTEGER DEFAULT 0, last_downloaded INTEGER DEFAULT 0, last_conflicts INTEGER DEFAULT 0
    );
    CREATE TABLE sync_engine_state (
        id TEXT PRIMARY KEY DEFAULT 'default', data BLOB NOT NULL
    );
    CREATE TABLE schema_version (version INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX idx_template_exercises_workout ON template_exercises(workout_template_id);
    CREATE INDEX idx_template_sets_exercise ON template_sets(template_exercise_id);
    CREATE INDEX idx_workout_templates_favorite ON workout_templates(is_favorite);
    CREATE INDEX idx_session_exercises_session ON session_exercises(workout_session_id);
    CREATE INDEX idx_session_exercises_name ON session_exercises(exercise_name);
    CREATE INDEX idx_session_exercises_parent ON session_exercises(parent_exercise_id);
    CREATE INDEX idx_session_sets_exercise ON session_sets(session_exercise_id);
    CREATE INDEX idx_template_exercises_parent ON template_exercises(parent_exercise_id);
    CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
    CREATE INDEX idx_workout_sessions_date ON workout_sessions(date DESC);
    CREATE INDEX idx_gym_equipment_name ON gym_equipment(name);
    CREATE INDEX idx_gym_equipment_gym ON gym_equipment(gym_id);
    CREATE INDEX idx_gyms_default ON gyms(is_default);
    CREATE INDEX idx_set_measurements_set ON set_measurements(set_id, parent_type);
    CREATE INDEX idx_set_measurements_group ON set_measurements(set_id, group_index);
    """#

    /// v12 data — post-reshape; set_measurements populated; reduced session_sets / template_sets.
    /// Includes every (kind × role × parent_type) combo plus diverse units.
    static let v12Data: String = #"""
    INSERT INTO workout_templates (id, name, default_weight_unit, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', 'lbs', '\#(ts1)', '\#(ts1)', 1);
    INSERT INTO template_exercises (id, workout_template_id, exercise_name, order_index, equipment_type, updated_at) VALUES
      ('\#(tplExBench)', '\#(templatePushId)', 'Bench Press', 0, 'barbell', '\#(ts1)');
    INSERT INTO template_sets (id, template_exercise_id, order_index, rest_seconds, is_dropset, is_per_side, is_amrap, updated_at) VALUES
      ('\#(tplSet1)', '\#(tplExBench)', 0, 180, 0, 0, 0, '\#(ts1)');
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'not_set', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 0, 1, 0);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)', 'Home Gym', 1, '\#(ts1)', '\#(ts1)', NULL);
    INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at, gym_id, deleted_at) VALUES
      ('\#(equipBarbell)', 'Barbell', 1, NULL, '\#(ts1)', '\#(ts1)', '\#(gymHome)', NULL);
    INSERT INTO workout_sessions (id, workout_template_id, name, date, start_time, end_time, duration, status, updated_at) VALUES
      ('\#(sessionDoneId)', '\#(templatePushId)', 'Push Day', '\#(tsDate)', '2024-01-15T08:00:00Z', '2024-01-15T09:05:00Z', 3900, 'completed', '\#(ts1)');
    INSERT INTO session_exercises (id, workout_session_id, exercise_name, order_index, status, updated_at) VALUES
      ('\#(sesExBench)', '\#(sessionDoneId)', 'Bench Press', 0, 'completed', '\#(ts1)');
    INSERT INTO session_sets (id, session_exercise_id, order_index, rest_seconds, completed_at, status, notes, is_dropset, is_per_side, is_amrap, side, updated_at) VALUES
      ('\#(sesSet1)', '\#(sesExBench)', 0, 180, '2024-01-15T08:12:00Z', 'completed', NULL, 0, 0, 0, NULL, '\#(ts1)');
    -- set_measurements covers every kind×role×parent_type combo + diverse units
    INSERT INTO set_measurements (id, set_id, parent_type, role, kind, value, unit, group_index, updated_at) VALUES
      ('dddddddd-dddd-dddd-dddd-000000000001', '\#(sesSet1)', 'session', 'target', 'weight', 135.0, 'lbs', 0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000002', '\#(sesSet1)', 'session', 'target', 'reps',    5.0,  NULL,  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000003', '\#(sesSet1)', 'session', 'target', 'time',    60.0, 's',   0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000004', '\#(sesSet1)', 'session', 'target', 'distance',1.0,  'km',  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000005', '\#(sesSet1)', 'session', 'target', 'rpe',     8.0,  NULL,  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000006', '\#(sesSet1)', 'session', 'actual', 'weight',  60.0, 'kg',  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000007', '\#(sesSet1)', 'session', 'actual', 'reps',    5.0,  NULL,  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000008', '\#(sesSet1)', 'session', 'actual', 'time',    60.0, 's',   0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-000000000009', '\#(sesSet1)', 'session', 'actual', 'distance',1.0,  'km',  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-00000000000a', '\#(sesSet1)', 'session', 'actual', 'rpe',     9.0,  NULL,  0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-00000000000b', '\#(tplSet1)', 'planned', 'target', 'weight',  135.0,'lbs', 0, '\#(ts1)'),
      ('dddddddd-dddd-dddd-dddd-00000000000c', '\#(tplSet1)', 'planned', 'target', 'reps',    5.0,  NULL,  0, '\#(ts1)');
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO schema_version (version) VALUES (12);
    """#

    // MARK: - v13 DDL and data (head)

    /// v13 DDL = v12 DDL + `default_timer_countdown INTEGER DEFAULT 0` appended to user_settings.
    /// The test migration chain from v13 is a no-op — schema is at currentSchemaVersion.
    static let v13DDL: String = #"""
    CREATE TABLE workout_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, tags TEXT,
        default_weight_unit TEXT, source_markdown TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_favorite INTEGER DEFAULT 0
    );
    CREATE TABLE template_exercises (
        id TEXT PRIMARY KEY, workout_template_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE template_sets (
        id TEXT PRIMARY KEY, template_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        rest_seconds INTEGER,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        notes TEXT, updated_at TEXT,
        FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE user_settings (
        id TEXT PRIMARY KEY, default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
        enable_workout_timer INTEGER DEFAULT 1, auto_start_rest_timer INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'auto', notifications_enabled INTEGER DEFAULT 1,
        custom_prompt_addition TEXT,
        anthropic_api_key_status TEXT DEFAULT 'not_set',
        healthkit_enabled INTEGER DEFAULT 0, live_activities_enabled INTEGER DEFAULT 1,
        keep_screen_awake INTEGER DEFAULT 1, show_open_in_claude_button INTEGER DEFAULT 0,
        home_tiles TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        developer_mode_enabled INTEGER DEFAULT 0,
        countdown_sounds_enabled INTEGER DEFAULT 1,
        has_accepted_disclaimer INTEGER DEFAULT 0,
        default_timer_countdown INTEGER DEFAULT 0
    );
    CREATE TABLE gyms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE gym_equipment (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        is_available INTEGER DEFAULT 1, last_checked_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        gym_id TEXT, deleted_at TEXT,
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
        UNIQUE (gym_id, name)
    );
    CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY, workout_template_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL,
        start_time TEXT, end_time TEXT, duration INTEGER, notes TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress', updated_at TEXT,
        FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );
    CREATE TABLE session_exercises (
        id TEXT PRIMARY KEY, workout_session_id TEXT NOT NULL, exercise_name TEXT NOT NULL,
        order_index INTEGER NOT NULL, notes TEXT, equipment_type TEXT, group_type TEXT,
        group_name TEXT, parent_exercise_id TEXT, status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT,
        FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE session_sets (
        id TEXT PRIMARY KEY, session_exercise_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        rest_seconds INTEGER, completed_at TEXT, status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        is_dropset INTEGER DEFAULT 0, is_per_side INTEGER DEFAULT 0, is_amrap INTEGER DEFAULT 0,
        side TEXT, updated_at TEXT,
        FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
    );
    CREATE TABLE set_measurements (
        id TEXT PRIMARY KEY, set_id TEXT NOT NULL, parent_type TEXT NOT NULL,
        role TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT,
        group_index INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE sync_metadata (
        id TEXT PRIMARY KEY, device_id TEXT NOT NULL, last_sync_date TEXT,
        server_change_token TEXT, sync_enabled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        last_uploaded INTEGER DEFAULT 0, last_downloaded INTEGER DEFAULT 0, last_conflicts INTEGER DEFAULT 0
    );
    CREATE TABLE sync_engine_state (
        id TEXT PRIMARY KEY DEFAULT 'default', data BLOB NOT NULL
    );
    CREATE TABLE schema_version (version INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX idx_template_exercises_workout ON template_exercises(workout_template_id);
    CREATE INDEX idx_template_sets_exercise ON template_sets(template_exercise_id);
    CREATE INDEX idx_workout_templates_favorite ON workout_templates(is_favorite);
    CREATE INDEX idx_session_exercises_session ON session_exercises(workout_session_id);
    CREATE INDEX idx_session_exercises_name ON session_exercises(exercise_name);
    CREATE INDEX idx_session_exercises_parent ON session_exercises(parent_exercise_id);
    CREATE INDEX idx_session_sets_exercise ON session_sets(session_exercise_id);
    CREATE INDEX idx_template_exercises_parent ON template_exercises(parent_exercise_id);
    CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
    CREATE INDEX idx_workout_sessions_date ON workout_sessions(date DESC);
    CREATE INDEX idx_gym_equipment_name ON gym_equipment(name);
    CREATE INDEX idx_gym_equipment_gym ON gym_equipment(gym_id);
    CREATE INDEX idx_gyms_default ON gyms(is_default);
    CREATE INDEX idx_set_measurements_set ON set_measurements(set_id, parent_type);
    CREATE INDEX idx_set_measurements_group ON set_measurements(set_id, group_index);
    """#

    static let v13Data: String = #"""
    INSERT INTO workout_templates (id, name, default_weight_unit, created_at, updated_at, is_favorite) VALUES
      ('\#(templatePushId)', 'Push Day', 'lbs', '\#(ts1)', '\#(ts1)', 0);
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer, default_timer_countdown) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'not_set', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 0, 1, 0, 0);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)', 'Home Gym', 1, '\#(ts1)', '\#(ts1)', NULL);
    INSERT INTO sync_metadata (id, device_id, created_at, updated_at) VALUES ('\#(syncMetaId)', 'device-ABC', '\#(ts1)', '\#(ts1)');
    INSERT INTO schema_version (version) VALUES (13);
    """#

    // MARK: - Synthetic future (v14) — used to verify early-return behavior

    static let v14SyntheticDDL: String = v13DDL  // same shape
    static let v14SyntheticData: String = #"""
    INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake, show_open_in_claude_button, created_at, updated_at, developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer, default_timer_countdown) VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1, 'not_set', 0, 1, 1, 0, '\#(ts1)', '\#(ts1)', 0, 1, 0, 0);
    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)', 'Home Gym', 1, '\#(ts1)', '\#(ts1)', NULL);
    INSERT INTO schema_version (version) VALUES (14);
    """#
}
