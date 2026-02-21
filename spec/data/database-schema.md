# Database Schema

> Canonical SQLite DDL for the LiftMark database. This is the authoritative storage contract.
>
> Source of truth: `src/db/index.ts`

---

## Overview

- **Database**: SQLite via `expo-sqlite`
- **File**: `liftmark.db` (stored in `Documents/SQLite/`)
- **Foreign keys**: Enabled via `PRAGMA foreign_keys = ON`
- **Schema version**: Tracked in `schema_version` table
- **Current version**: 1

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

Workout plan definitions (the "template" naming is legacy; application code uses "WorkoutPlan").

```sql
CREATE TABLE IF NOT EXISTS workout_templates (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  tags                TEXT,                 -- JSON array of strings, e.g. '["push","strength"]'
  default_weight_unit TEXT,                 -- 'lbs' or 'kg'
  source_markdown     TEXT,                 -- Original LMWF markdown for reprocessing
  created_at          TEXT NOT NULL,        -- ISO 8601
  updated_at          TEXT NOT NULL,        -- ISO 8601
  is_favorite         INTEGER DEFAULT 0     -- Boolean: 0 or 1 (added via ALTER)
);
```

---

### template_exercises

Exercises within a workout plan.

```sql
CREATE TABLE IF NOT EXISTS template_exercises (
  id                   TEXT PRIMARY KEY,
  workout_template_id  TEXT NOT NULL,
  exercise_name        TEXT NOT NULL,
  order_index          INTEGER NOT NULL,     -- 0-based display order
  notes                TEXT,
  equipment_type       TEXT,                 -- Freeform: "barbell", "kettlebell", etc.
  group_type           TEXT,                 -- 'superset' or 'section'
  group_name           TEXT,                 -- E.g. "Superset: Arms"
  parent_exercise_id   TEXT,                 -- Self-ref FK for superset/section children
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
);
```

---

### template_sets

Target sets within a planned exercise.

```sql
CREATE TABLE IF NOT EXISTS template_sets (
  id                    TEXT PRIMARY KEY,
  template_exercise_id  TEXT NOT NULL,
  order_index           INTEGER NOT NULL,     -- 0-based position within exercise
  target_weight         REAL,                 -- NULL or 0 = bodyweight
  target_weight_unit    TEXT,                 -- 'lbs' or 'kg'
  target_reps           INTEGER,
  target_time           INTEGER,              -- Seconds, for time-based exercises
  target_rpe            INTEGER,              -- 1-10
  rest_seconds          INTEGER,
  tempo                 TEXT,                 -- e.g. "3-0-1-0"
  is_dropset            INTEGER DEFAULT 0,    -- Boolean
  is_per_side           INTEGER DEFAULT 0,    -- Boolean (added via ALTER)
  is_amrap              INTEGER DEFAULT 0,    -- Boolean (added via ALTER)
  notes                 TEXT,                 -- Set-level notes (added via ALTER)
  FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
);
```

---

### workout_sessions

Actual workout instances (in-progress, completed, or canceled).

```sql
CREATE TABLE IF NOT EXISTS workout_sessions (
  id                   TEXT PRIMARY KEY,
  workout_template_id  TEXT,                  -- FK to workout_templates; NULL if custom
  name                 TEXT NOT NULL,
  date                 TEXT NOT NULL,          -- ISO date: YYYY-MM-DD
  start_time           TEXT,                  -- ISO 8601 datetime
  end_time             TEXT,                  -- ISO 8601 datetime
  duration             INTEGER,               -- Seconds
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'canceled'
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
);
```

---

### session_exercises

Exercises within a workout session.

```sql
CREATE TABLE IF NOT EXISTS session_exercises (
  id                   TEXT PRIMARY KEY,
  workout_session_id   TEXT NOT NULL,
  exercise_name        TEXT NOT NULL,
  order_index          INTEGER NOT NULL,
  notes                TEXT,
  equipment_type       TEXT,
  group_type           TEXT,                 -- 'superset' or 'section'
  group_name           TEXT,
  parent_exercise_id   TEXT,                 -- Self-ref FK
  status               TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed', 'skipped'
  FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
);
```

---

### session_sets

Individual sets within a session exercise, tracking both target and actual performance.

```sql
CREATE TABLE IF NOT EXISTS session_sets (
  id                   TEXT PRIMARY KEY,
  session_exercise_id  TEXT NOT NULL,
  order_index          INTEGER NOT NULL,
  parent_set_id        TEXT,                  -- Self-ref for drop sets
  drop_sequence        INTEGER,               -- 0 = main, 1 = first drop, etc.
  -- Target/Planned values (copied from template at session creation)
  target_weight        REAL,
  target_weight_unit   TEXT,
  target_reps          INTEGER,
  target_time          INTEGER,               -- Seconds
  target_rpe           INTEGER,
  rest_seconds         INTEGER,
  -- Actual performance values (user input during workout)
  actual_weight        REAL,
  actual_weight_unit   TEXT,
  actual_reps          INTEGER,
  actual_time          INTEGER,               -- Seconds
  actual_rpe           INTEGER,
  -- Metadata
  completed_at         TEXT,                  -- ISO 8601 datetime
  status               TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'skipped', 'failed'
  notes                TEXT,
  tempo                TEXT,
  is_dropset           INTEGER DEFAULT 0,     -- Boolean
  is_per_side          INTEGER DEFAULT 0,     -- Boolean (added via ALTER)
  FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
);
```

---

### user_settings

Singleton preferences table. Exactly one row.

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id                          TEXT PRIMARY KEY,
  default_weight_unit         TEXT NOT NULL DEFAULT 'lbs',
  enable_workout_timer        INTEGER DEFAULT 1,
  auto_start_rest_timer       INTEGER DEFAULT 1,       -- Added via ALTER
  theme                       TEXT DEFAULT 'auto',
  notifications_enabled       INTEGER DEFAULT 1,
  custom_prompt_addition      TEXT,                     -- Added via ALTER
  anthropic_api_key           TEXT,                     -- Added via ALTER (always NULL; real key in Keychain)
  anthropic_api_key_status    TEXT DEFAULT 'not_set',   -- Added via ALTER
  healthkit_enabled           INTEGER DEFAULT 0,        -- Added via ALTER
  live_activities_enabled     INTEGER DEFAULT 1,        -- Added via ALTER
  keep_screen_awake           INTEGER DEFAULT 1,        -- Added via ALTER
  show_open_in_claude_button  INTEGER DEFAULT 0,        -- Added via ALTER
  home_tiles                  TEXT,                     -- Added via ALTER; JSON array of exercise names
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);
```

**Default row** (created during migration if not present):
```sql
INSERT INTO user_settings (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled, created_at, updated_at)
VALUES (<uuid>, 'lbs', 1, 1, 'auto', 1, <now>, <now>);
```

---

### gyms

Gym locations.

```sql
CREATE TABLE IF NOT EXISTS gyms (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  is_default  INTEGER DEFAULT 0,     -- Boolean; only one should be 1
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

**Default row** (created during migration if no gyms exist):
```sql
INSERT INTO gyms (id, name, is_default, created_at, updated_at)
VALUES (<uuid>, 'My Gym', 1, <now>, <now>);
```

---

### gym_equipment

Equipment availability per gym.

```sql
CREATE TABLE IF NOT EXISTS gym_equipment (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  is_available    INTEGER DEFAULT 1,
  last_checked_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  gym_id          TEXT                   -- Added via ALTER; FK to gyms (application-level)
);
```

---

### sync_metadata

Device sync state (tables created but sync functionality is stubbed out).

```sql
CREATE TABLE IF NOT EXISTS sync_metadata (
  id                   TEXT PRIMARY KEY,
  device_id            TEXT NOT NULL,
  last_sync_date       TEXT,
  server_change_token  TEXT,
  sync_enabled         INTEGER DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
```

---

### sync_queue

Pending sync operations queue.

```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id              TEXT PRIMARY KEY,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  operation       TEXT NOT NULL,
  payload         TEXT NOT NULL,
  attempts        INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  created_at      TEXT NOT NULL
);
```

---

### sync_conflicts

Sync conflict resolution records.

```sql
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id           TEXT PRIMARY KEY,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  local_data   TEXT NOT NULL,
  remote_data  TEXT NOT NULL,
  resolution   TEXT NOT NULL,
  resolved_at  TEXT,
  created_at   TEXT NOT NULL
);
```

---

## Indexes

```sql
-- Workout plan lookups
CREATE INDEX IF NOT EXISTS idx_template_exercises_workout    ON template_exercises(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_template_sets_exercise        ON template_sets(template_exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_favorite    ON workout_templates(is_favorite);

-- Session lookups
CREATE INDEX IF NOT EXISTS idx_session_exercises_session     ON session_exercises(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_name        ON session_exercises(exercise_name);
CREATE INDEX IF NOT EXISTS idx_session_sets_exercise         ON session_sets(session_exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status       ON workout_sessions(status);

-- Equipment lookups
CREATE INDEX IF NOT EXISTS idx_gym_equipment_name            ON gym_equipment(name);
CREATE INDEX IF NOT EXISTS idx_gym_equipment_gym             ON gym_equipment(gym_id);
CREATE INDEX IF NOT EXISTS idx_gyms_default                  ON gyms(is_default);

-- Sync lookups
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity             ON sync_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity         ON sync_conflicts(entity_type, entity_id);
```

---

## Column Type Conventions

| SQLite Type | TypeScript Type | Notes |
|-------------|----------------|-------|
| `TEXT` | `string` | All IDs are UUIDs as text |
| `TEXT` (JSON) | `string[]` / `object` | `tags`, `home_tiles` stored as JSON strings |
| `INTEGER` | `boolean` | 0 = false, 1 = true |
| `INTEGER` | `number` | Reps, time (seconds), RPE |
| `REAL` | `number` | Weight values |
| `TEXT` | `string` (ISO 8601) | All date/datetime fields |

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
| `gyms` | `gym_equipment` | Gym store deletes equipment before gym; no DB-level FK |

### Transactions

- `createWorkoutPlan`: Wrapped in `BEGIN/COMMIT` (rollback on error)
- `updateWorkoutPlan`: Wrapped in `BEGIN/COMMIT`; deletes all exercises then re-inserts
- `createSessionFromPlan`: Wrapped in `BEGIN/COMMIT`
- All other mutations are single-statement (implicit transaction)
