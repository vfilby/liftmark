# Database Schema — Interop Contract

> Canonical SQLite DDL for the LiftMark `.db` backup format. Any app version or platform implementation that reads or writes `.db` files **must** conform to this schema.
>
> See also: [data-model.md](../data-model.md) for entity definitions and business rules, [import-export-schema.md](import-export-schema.md) for JSON and markdown formats.

---

## Overview

- **Format**: SQLite 3
- **File extension**: `.db`
- **Foreign keys**: `PRAGMA foreign_keys = ON`
- **Schema version**: Tracked in `schema_version` table
- **Current version**: 1

### Forward Compatibility

- Newer schema versions add tables, columns, or indexes via migrations.
- An app receiving a `.db` file with a **higher** schema version than it supports **should reject the file** with a clear error rather than silently losing data.
- An app receiving a `.db` file with a **lower** schema version **must run its migration chain** to bring the file up to the current version before use.

---

## Tables

### schema_version

Tracks the current migration version. Single-row table.

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL DEFAULT 0
);
```

---

### workout_templates

Workout plan definitions. Maps to the **WorkoutPlan** entity.

```sql
CREATE TABLE IF NOT EXISTS workout_templates (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  tags                TEXT,                 -- JSON array of strings
  default_weight_unit TEXT,                 -- 'lbs' or 'kg'
  source_markdown     TEXT,                 -- Original LMWF markdown
  created_at          TEXT NOT NULL,        -- ISO 8601
  updated_at          TEXT NOT NULL,        -- ISO 8601
  is_favorite         INTEGER DEFAULT 0     -- Boolean: 0 or 1
);
```

---

### template_exercises

Exercises within a workout plan. Maps to the **PlannedExercise** entity.

```sql
CREATE TABLE IF NOT EXISTS template_exercises (
  id                   TEXT PRIMARY KEY,
  workout_template_id  TEXT NOT NULL,
  exercise_name        TEXT NOT NULL,
  order_index          INTEGER NOT NULL,
  notes                TEXT,
  equipment_type       TEXT,
  group_type           TEXT,                 -- 'superset' or 'section'
  group_name           TEXT,
  parent_exercise_id   TEXT,
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
);
```

---

### template_sets

Target sets within a planned exercise. Maps to the **PlannedSet** entity.

```sql
CREATE TABLE IF NOT EXISTS template_sets (
  id                    TEXT PRIMARY KEY,
  template_exercise_id  TEXT NOT NULL,
  order_index           INTEGER NOT NULL,
  target_weight         REAL,
  target_weight_unit    TEXT,
  target_reps           INTEGER,
  target_time           INTEGER,
  target_rpe            INTEGER,
  rest_seconds          INTEGER,
  tempo                 TEXT,
  is_dropset            INTEGER DEFAULT 0,
  is_per_side           INTEGER DEFAULT 0,
  is_amrap              INTEGER DEFAULT 0,
  notes                 TEXT,
  FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
);
```

---

### workout_sessions

Actual workout instances. Maps to the **WorkoutSession** entity.

```sql
CREATE TABLE IF NOT EXISTS workout_sessions (
  id                   TEXT PRIMARY KEY,
  workout_template_id  TEXT,
  name                 TEXT NOT NULL,
  date                 TEXT NOT NULL,
  start_time           TEXT,
  end_time             TEXT,
  duration             INTEGER,
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'in_progress',
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
);
```

---

### session_exercises

Exercises within a workout session. Maps to the **SessionExercise** entity.

```sql
CREATE TABLE IF NOT EXISTS session_exercises (
  id                   TEXT PRIMARY KEY,
  workout_session_id   TEXT NOT NULL,
  exercise_name        TEXT NOT NULL,
  order_index          INTEGER NOT NULL,
  notes                TEXT,
  equipment_type       TEXT,
  group_type           TEXT,
  group_name           TEXT,
  parent_exercise_id   TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
);
```

---

### session_sets

Individual sets within a session exercise. Maps to the **SessionSet** entity.

```sql
CREATE TABLE IF NOT EXISTS session_sets (
  id                   TEXT PRIMARY KEY,
  session_exercise_id  TEXT NOT NULL,
  order_index          INTEGER NOT NULL,
  parent_set_id        TEXT,
  drop_sequence        INTEGER,
  target_weight        REAL,
  target_weight_unit   TEXT,
  target_reps          INTEGER,
  target_time          INTEGER,
  target_rpe           INTEGER,
  rest_seconds         INTEGER,
  actual_weight        REAL,
  actual_weight_unit   TEXT,
  actual_reps          INTEGER,
  actual_time          INTEGER,
  actual_rpe           INTEGER,
  completed_at         TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  notes                TEXT,
  tempo                TEXT,
  is_dropset           INTEGER DEFAULT 0,
  is_per_side          INTEGER DEFAULT 0,
  side                 TEXT,                 -- 'left' or 'right' for expanded per-side timed sets, NULL otherwise
  FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
);
```

---

### user_settings

Singleton preferences table. Maps to the **UserSettings** entity.

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id                          TEXT PRIMARY KEY,
  default_weight_unit         TEXT NOT NULL DEFAULT 'lbs',
  enable_workout_timer        INTEGER DEFAULT 1,
  auto_start_rest_timer       INTEGER DEFAULT 1,
  theme                       TEXT DEFAULT 'auto',
  notifications_enabled       INTEGER DEFAULT 1,
  custom_prompt_addition      TEXT,
  anthropic_api_key           TEXT,
  anthropic_api_key_status    TEXT DEFAULT 'not_set',
  healthkit_enabled           INTEGER DEFAULT 0,
  live_activities_enabled     INTEGER DEFAULT 1,
  keep_screen_awake           INTEGER DEFAULT 1,
  show_open_in_claude_button  INTEGER DEFAULT 0,
  home_tiles                  TEXT,
  developer_mode_enabled      INTEGER DEFAULT 0,     -- Boolean: hidden developer menu
  countdown_sounds_enabled    INTEGER DEFAULT 1,     -- Boolean: audible countdown ticks
  has_accepted_disclaimer     INTEGER DEFAULT 0,     -- Boolean: onboarding disclaimer accepted
  default_timer_countdown     INTEGER DEFAULT 0,     -- Boolean: initial mode for ExerciseTimerView (0 = count-up, 1 = count-down)
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);
```

---

### gyms

Gym locations. Maps to the **Gym** entity.

```sql
CREATE TABLE IF NOT EXISTS gyms (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  is_default  INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

---

### gym_equipment

Equipment availability per gym. Maps to the **GymEquipment** entity.

```sql
CREATE TABLE IF NOT EXISTS gym_equipment (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  is_available    INTEGER DEFAULT 1,
  last_checked_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  gym_id          TEXT
);
```

---

### sync_metadata / sync_queue / sync_conflicts

Sync infrastructure tables.

```sql
CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY, device_id TEXT NOT NULL, last_sync_date TEXT,
  server_change_token TEXT, sync_enabled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  operation TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER DEFAULT 0,
  last_attempt_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  local_data TEXT NOT NULL, remote_data TEXT NOT NULL, resolution TEXT NOT NULL,
  resolved_at TEXT, created_at TEXT NOT NULL
);
```

---

## Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_template_exercises_workout    ON template_exercises(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_template_sets_exercise        ON template_sets(template_exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_favorite    ON workout_templates(is_favorite);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session     ON session_exercises(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_name        ON session_exercises(exercise_name);
CREATE INDEX IF NOT EXISTS idx_session_sets_exercise         ON session_sets(session_exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status       ON workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_gym_equipment_name            ON gym_equipment(name);
CREATE INDEX IF NOT EXISTS idx_gym_equipment_gym             ON gym_equipment(gym_id);
CREATE INDEX IF NOT EXISTS idx_gyms_default                  ON gyms(is_default);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity             ON sync_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity         ON sync_conflicts(entity_type, entity_id);
```

---

## Column Type Conventions

| SQLite Type | Application Type | Notes |
|-------------|-----------------|-------|
| `TEXT` | string | All IDs are UUIDs as text |
| `TEXT` (JSON) | string[] / object | `tags`, `home_tiles` stored as JSON strings |
| `INTEGER` | boolean | 0 = false, 1 = true |
| `INTEGER` | number | Reps, time (seconds), RPE |
| `REAL` | number | Weight values |
| `TEXT` | string (ISO 8601) | All date/datetime fields |

---

## Data Integrity

### Foreign Key Cascades

| Parent | Child | On Delete |
|--------|-------|-----------|
| `workout_templates` | `template_exercises` | CASCADE |
| `template_exercises` | `template_sets` | CASCADE |
| `template_exercises` | `template_exercises` (self) | CASCADE |
| `workout_templates` | `workout_sessions` | SET NULL |
| `workout_sessions` | `session_exercises` | CASCADE |
| `session_exercises` | `session_sets` | CASCADE |
| `session_exercises` | `session_exercises` (self) | CASCADE |
| `session_sets` | `session_sets` (self) | CASCADE |

### Application-Level Cascades

| Parent | Child | Notes |
|--------|-------|-------|
| `gyms` | `gym_equipment` | Application code deletes equipment before gym; no DB-level FK |
