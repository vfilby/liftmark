# Migration Strategy

> How LiftMark manages SQLite schema evolution. Covers the versioned migration system, existing migrations, rules, and testing approach.
>
> Source of truth: `src/db/index.ts`

---

## Migration System

### Architecture

LiftMark uses a **forward-only versioned migration system** with a `schema_version` table tracking the current version.

```
schema_version (single row)
└── version: INTEGER  →  compared against CURRENT_SCHEMA_VERSION constant
```

### Execution Flow

1. Database opened via `getDatabase()`
2. `PRAGMA foreign_keys = ON` enabled
3. `runMigrations()` called:
   a. Create `schema_version` table if not exists
   b. Read current version (insert `0` if no row exists)
   c. Compare against `CURRENT_SCHEMA_VERSION` (currently `1`)
   d. Run each pending migration function sequentially
   e. Update `schema_version` to `CURRENT_SCHEMA_VERSION`

```typescript
const CURRENT_SCHEMA_VERSION = 1;

async function runMigrations(database) {
  // Create version tracking
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0)'
  );

  // Get current version
  const row = await database.getFirstAsync('SELECT version FROM schema_version LIMIT 1');
  let currentVersion = row?.version ?? 0;

  // Skip if up to date
  if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

  // Run pending migrations
  if (currentVersion < 1) await migrateToV1(database);
  // Future: if (currentVersion < 2) await migrateToV2(database);

  // Update version
  await database.runAsync('UPDATE schema_version SET version = ?', [CURRENT_SCHEMA_VERSION]);
}
```

---

## Existing Migrations

### Migration V1: Full Initial Schema

**Version**: 0 → 1

This is a consolidated migration that serves dual purposes:
1. **New databases**: Creates the complete schema from scratch
2. **Existing databases**: Idempotent transition to the versioned system (uses `CREATE IF NOT EXISTS` and `ALTER TABLE` with try/catch)

#### Tables Created (via CREATE IF NOT EXISTS)

| Table | Purpose |
|-------|---------|
| `workout_templates` | Workout plan definitions |
| `template_exercises` | Exercises within plans |
| `template_sets` | Target sets within exercises |
| `user_settings` | User preferences (singleton) |
| `gyms` | Gym locations |
| `gym_equipment` | Equipment availability |
| `workout_sessions` | Workout instances |
| `session_exercises` | Session exercise records |
| `session_sets` | Session set records (target + actual) |
| `sync_metadata` | Sync state tracking |
| `sync_queue` | Pending sync operations |
| `sync_conflicts` | Conflict resolution records |

#### Indexes Created

| Index | Table | Column(s) |
|-------|-------|-----------|
| `idx_template_exercises_workout` | `template_exercises` | `workout_template_id` |
| `idx_template_sets_exercise` | `template_sets` | `template_exercise_id` |
| `idx_gym_equipment_name` | `gym_equipment` | `name` |
| `idx_gym_equipment_gym` | `gym_equipment` | `gym_id` |
| `idx_gyms_default` | `gyms` | `is_default` |
| `idx_session_exercises_session` | `session_exercises` | `workout_session_id` |
| `idx_session_exercises_name` | `session_exercises` | `exercise_name` |
| `idx_session_sets_exercise` | `session_sets` | `session_exercise_id` |
| `idx_workout_sessions_status` | `workout_sessions` | `status` |
| `idx_workout_templates_favorite` | `workout_templates` | `is_favorite` |
| `idx_sync_queue_entity` | `sync_queue` | `entity_type, entity_id` |
| `idx_sync_conflicts_entity` | `sync_conflicts` | `entity_type, entity_id` |

#### Column Additions (via ALTER TABLE)

These are wrapped in individual try/catch blocks — if a column already exists, the error is silently ignored. This provides idempotency for databases that had columns added before the versioned migration system.

| # | Statement | Default |
|---|-----------|---------|
| 1 | `ALTER TABLE user_settings ADD COLUMN auto_start_rest_timer INTEGER` | `DEFAULT 1` |
| 2 | `ALTER TABLE user_settings ADD COLUMN custom_prompt_addition TEXT` | — |
| 3 | `ALTER TABLE template_sets ADD COLUMN is_per_side INTEGER` | `DEFAULT 0` |
| 4 | `ALTER TABLE session_sets ADD COLUMN is_per_side INTEGER` | `DEFAULT 0` |
| 5 | `ALTER TABLE user_settings ADD COLUMN healthkit_enabled INTEGER` | `DEFAULT 0` |
| 6 | `ALTER TABLE user_settings ADD COLUMN live_activities_enabled INTEGER` | `DEFAULT 1` |
| 7 | `ALTER TABLE user_settings ADD COLUMN keep_screen_awake INTEGER` | `DEFAULT 1` |
| 8 | `ALTER TABLE user_settings ADD COLUMN anthropic_api_key TEXT` | — |
| 9 | `ALTER TABLE gym_equipment ADD COLUMN gym_id TEXT` | — |
| 10 | `ALTER TABLE user_settings ADD COLUMN anthropic_api_key_status TEXT` | `DEFAULT 'not_set'` |
| 11 | `ALTER TABLE user_settings ADD COLUMN show_open_in_claude_button INTEGER` | `DEFAULT 0` |
| 12 | `ALTER TABLE workout_templates ADD COLUMN is_favorite INTEGER` | `DEFAULT 0` |
| 13 | `ALTER TABLE user_settings ADD COLUMN home_tiles TEXT` | — |

#### Data Migrations

After schema changes, V1 performs two data migrations:

**1. Default Gym Creation**
- If no gyms exist, creates a default gym named "My Gym" with `is_default = 1`
- If orphaned equipment exists (`gym_id IS NULL`), assigns it to the new default gym

**2. Default Settings Initialization**
- If no user settings row exists, inserts default settings:
  - `default_weight_unit`: `'lbs'`
  - `enable_workout_timer`: `1`
  - `auto_start_rest_timer`: `1`
  - `theme`: `'auto'`
  - `notifications_enabled`: `1`

---

## Migration Rules

### Forward-Only

- Migrations only move the version forward. There is no rollback/downgrade mechanism.
- Each migration function runs exactly once per database (version check prevents re-execution).

### No Data Loss

- `CREATE TABLE IF NOT EXISTS` ensures tables aren't recreated if they exist.
- `ALTER TABLE ADD COLUMN` with try/catch ensures columns aren't duplicated.
- Foreign key `ON DELETE SET NULL` on `workout_sessions.workout_template_id` preserves session history when plans are deleted.
- Foreign key `ON DELETE CASCADE` on child tables ensures referential integrity without orphans.

### Idempotency

- The V1 migration is fully idempotent — running it multiple times produces the same result.
- All `CREATE` statements use `IF NOT EXISTS`.
- All `ALTER TABLE` additions are wrapped in try/catch (column exists = silently skip).
- Data migrations check for existing data before inserting defaults.

### Atomicity

- The migration system does NOT wrap the entire migration in a transaction.
- Individual data operations (default gym creation, settings init) are individual statements.
- If a migration partially fails, the version is NOT updated, so the migration will be retried on next app launch.

---

## Adding a New Migration

To add migration V2:

1. Increment `CURRENT_SCHEMA_VERSION` to `2`
2. Add a new `migrateToV2()` function
3. Add the version check in `runMigrations()`:
   ```typescript
   if (currentVersion < 2) await migrateToV2(database);
   ```
4. The new function runs only for databases at version 1 (or below)

### Pattern for New Migrations

```typescript
async function migrateToV2(database: SQLite.SQLiteDatabase): Promise<void> {
  // New tables
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS new_table (
      id TEXT PRIMARY KEY,
      ...
    );
  `);

  // New columns on existing tables
  try {
    await database.runAsync('ALTER TABLE existing_table ADD COLUMN new_col TEXT');
  } catch {
    // Column already exists
  }

  // Data migrations
  // ...
}
```

---

## Testing Strategy

### Unit Tests

- Migration logic is tested indirectly through repository tests that exercise CRUD operations.
- The database is initialized fresh for each test suite, running all migrations from version 0.

### Manual Testing

- Database backup/restore (`databaseBackupService.ts`) provides a safety net for testing migrations on real data.
- The `clearDatabase()` utility deletes all data rows (preserving schema) for development resets.

### Import Validation

- `validateDatabaseFile()` in `databaseBackupService.ts` checks:
  1. File exists and has content
  2. File >= 1024 bytes
  3. SQLite magic header (first 16 bytes)
- After import, `getDatabase()` is called which triggers the migration system, upgrading imported databases to the current schema version.

### Edge Cases

- **Fresh install**: Version 0 → runs V1 → creates all tables, indexes, and default data
- **Pre-versioned database**: No `schema_version` table → created, version set to 0, runs V1 → idempotent creation handles existing tables/columns
- **Current version**: Version matches `CURRENT_SCHEMA_VERSION` → migrations skipped entirely
- **Imported older database**: After file copy, `getDatabase()` detects lower version → runs pending migrations to upgrade
