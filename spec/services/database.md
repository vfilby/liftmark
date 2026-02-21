# Database Service Specification

## Purpose

SQLite database layer providing persistent storage for all app data. This includes the database lifecycle, schema management, versioned migrations, and repository-pattern data access for workout plans, sessions, and exercise history.

## Components

### Database Initialization (`db/index.ts`)

#### `getDatabase(): Promise<SQLiteDatabase>`

Get or create the singleton database instance. On first call, opens the database and runs any pending migrations.

#### `closeDatabase(): Promise<void>`

Close the database connection and clear the singleton reference.

#### `clearDatabase(): Promise<void>`

Delete all data from the database. Intended for development and testing use only.

### Schema

The database uses versioned migrations. The current schema version is v1.

#### Tables

| Table | Purpose |
|---|---|
| `workout_templates` | Workout plan definitions. Fields: id, name, description, tags (JSON), default_weight_unit, source_markdown, is_favorite. |
| `template_exercises` | Exercises within a plan. Fields: id, workout_template_id (FK), exercise_name, order_index, notes, equipment_type, group_type, group_name, parent_exercise_id. |
| `template_sets` | Sets within an exercise template. Fields: id, template_exercise_id (FK), order_index, target_weight, target_weight_unit, target_reps, target_time, target_rpe, rest_seconds, tempo, is_dropset, is_per_side. |
| `user_settings` | Single-row settings. Fields: weight unit, timer preferences, theme, API key status, home_tiles (JSON), and others. |
| `gyms` | Gym locations. Fields: id, name, is_default. |
| `gym_equipment` | Equipment inventory per gym. Fields: id, gym_id (FK), name, is_available, last_checked_at. |
| `workout_sessions` | Workout execution records. Fields: id, workout_template_id (FK), name, date, start_time, end_time, duration, notes, status. |
| `session_exercises` | Exercises within a session. Mirrors template_exercises structure plus status field. |
| `session_sets` | Sets within a session exercise. Mirrors template_sets plus actual values, completed_at, and status. |
| `sync_metadata` | Tracks sync state for CloudKit integration. |
| `sync_queue` | Queued changes pending sync. |
| `sync_conflicts` | Detected sync conflicts. |

#### Default Data Migrations

On first run, the database creates:
- A default gym named "My Gym".
- Default user settings row.
- Migrates any orphaned equipment records to the default gym.

---

### Plan Repository (`db/repository.ts`)

Provides CRUD and query operations for workout plans (templates).

#### CRUD Operations

- `getAllWorkoutPlans()` — Retrieve all plans with their exercises and sets.
- `getWorkoutPlanById(id)` — Retrieve a single plan by ID.
- `createWorkoutPlan(plan)` — Create a new plan within a transaction.
- `updateWorkoutPlan(plan)` — Update an existing plan within a transaction.
- `deleteWorkoutPlan(id)` — Delete a plan and its associated exercises and sets.

#### Search and Filter

- `searchWorkoutPlans(query)` — Full-text search across plan names and descriptions.
- `getWorkoutPlansByTag(tag)` — Filter plans by tag.

#### Favorites

- `toggleFavoritePlan(id)` — Toggle the favorite status of a plan.
- `setFavoritePlan(id, isFavorite)` — Set favorite status explicitly.

#### Performance

- Uses transactions for create and update operations to ensure data consistency.
- Batch loads exercises and sets using 2 queries instead of N+1 pattern.

---

### Session Repository (`db/sessionRepository.ts`)

Provides data access for workout sessions (execution records).

#### Session Lifecycle

- `createSessionFromPlan(planId)` — Create a new session by copying the plan structure, including target values for each set.
- `getActiveSession()` — Retrieve the currently active (in-progress) session.
- `getWorkoutSessionById(id)` — Retrieve a specific session.
- `getCompletedSessions()` — Retrieve all completed sessions.
- `getRecentSessions(limit?)` — Retrieve recent sessions.

#### Session Updates

- `updateSession(session)` — Update session metadata (notes, status, times).
- `updateSessionSet(setId, actualValues)` — Record actual values for a completed set.
- `updateSessionSetTarget(setId, targetValues)` — Modify target values for a set.
- `deleteSessionSet(setId)` — Remove a set from a session.
- `updateSessionExercise(exercise)` — Update exercise metadata.
- `insertSessionExercise(exercise)` — Add an exercise to a session.
- `insertSessionSet(set)` — Add a set to a session exercise.

#### History and Analytics

- `getExerciseBestWeights(exerciseName)` — Get personal bests for an exercise.
- `getExerciseHistory(exerciseName)` — Get historical data for an exercise.
- `getMostFrequentExercise()` — Get the most commonly performed exercise.

#### Performance

- Uses the same batch loading pattern as the plan repository for exercises and sets.

---

### Exercise History Repository (`db/exerciseHistoryRepository.ts`)

Provides data access optimized for exercise history analysis and charting.

#### `getExerciseHistory(exerciseName)`

Returns chronological data points for charting, aggregated per session (not per set).

#### `getExerciseSessionHistory(exerciseName)`

Returns detailed set-level data grouped by session, for drill-down views.

#### `getExerciseProgressMetrics(exerciseName)`

Returns aggregated statistics with trend detection. Trends are classified as: improving, stable, or declining.

#### `getExerciseStats(exerciseName)`

Returns summary statistics for dashboard display.

#### `getAllExercisesWithHistory()`

Returns a list of all exercise names that have at least one completed session record.

## Dependencies

- `expo-sqlite` for database access.
- `generateId()` from `utils/id` for creating unique identifiers.

## Error Handling

- Database operations may throw exceptions on SQLite errors (e.g., constraint violations, connection issues).
- Callers are responsible for error handling at the store or UI layer.
- Transactions are used for multi-statement operations to ensure atomicity; if any statement fails, the entire transaction is rolled back.
