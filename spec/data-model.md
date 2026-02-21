# LiftMark Data Model

> Canonical reference for all domain entities, their fields, types, constraints, defaults, relationships, and business rules.
>
> Source of truth: `src/types/workout.ts`

---

## Enums & Literal Types

| Name | Values | Usage |
|------|--------|-------|
| `WeightUnit` | `'lbs' \| 'kg'` | Weight measurement throughout the app |
| `SetStatus` | `'pending' \| 'completed' \| 'skipped' \| 'failed'` | SessionSet lifecycle |
| `ExerciseStatus` | `'pending' \| 'in_progress' \| 'completed' \| 'skipped'` | SessionExercise lifecycle |
| `SessionStatus` | `'in_progress' \| 'completed' \| 'canceled'` | WorkoutSession lifecycle |
| `GroupType` | `'superset' \| 'section'` | Exercise grouping. `'superset'` = performed together; `'section'` = organizational heading |
| `Theme` | `'light' \| 'dark' \| 'auto'` | UI theme preference |
| `ApiKeyStatus` | `'verified' \| 'invalid' \| 'not_set'` | Anthropic API key verification state |
| `ChartMetricType` | `'maxWeight' \| 'totalVolume' \| 'reps' \| 'time'` | Exercise history chart metric selector |
| `Trend` | `'improving' \| 'stable' \| 'declining'` | Exercise progress direction (based on last 5 sessions, >5% threshold) |

---

## Entities

### WorkoutPlan

A reusable workout template that defines exercises and target sets. Created from LMWF markdown or AI generation.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key, generated via `expo-crypto` |
| `name` | `string` | Yes | — | From `# Heading` in LMWF |
| `description` | `string` | No | `undefined` | Freeform notes from markdown |
| `tags` | `string[]` | Yes | `[]` | From `@tags:` directive; stored as JSON string in DB |
| `defaultWeightUnit` | `'lbs' \| 'kg'` | No | `undefined` | From `@units:` directive |
| `sourceMarkdown` | `string` | No | `undefined` | Original LMWF text for reprocessing |
| `createdAt` | `string` | Yes | — | ISO 8601 datetime |
| `updatedAt` | `string` | Yes | — | ISO 8601 datetime |
| `isFavorite` | `boolean` | No | `false` | Pinned to favorites list |
| `exercises` | `PlannedExercise[]` | Yes | `[]` | Ordered list of exercises |

**DB table**: `workout_templates`

---

### PlannedExercise

An exercise within a WorkoutPlan, defining what to perform and in what order.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `workoutPlanId` | `string` | Yes | — | FK → `workout_templates.id` (CASCADE delete) |
| `exerciseName` | `string` | Yes | — | Freeform exercise name |
| `orderIndex` | `number` | Yes | — | 0-based position in workout |
| `notes` | `string` | No | `undefined` | Freeform notes from markdown |
| `equipmentType` | `string` | No | `undefined` | Freeform equipment (e.g., "barbell", "kettlebell") |
| `groupType` | `'superset' \| 'section'` | No | `undefined` | Grouping semantics |
| `groupName` | `string` | No | `undefined` | E.g., "Superset: Arms" or "Warmup" |
| `parentExerciseId` | `string` | No | `undefined` | FK → `template_exercises.id` (CASCADE); links child to superset/section parent |
| `sets` | `PlannedSet[]` | Yes | `[]` | Ordered list of target sets |

**DB table**: `template_exercises`

**Business rules**:
- Superset parent exercises (`groupType = 'superset'`) have no sets of their own; their children hold the sets.
- Section parents (`groupType = 'section'`) are organizational headers only.
- `orderIndex` determines display and execution order.

---

### PlannedSet

A single target set within a PlannedExercise.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `plannedExerciseId` | `string` | Yes | — | FK → `template_exercises.id` (CASCADE) |
| `orderIndex` | `number` | Yes | — | 0-based position within exercise |
| `targetWeight` | `number` | No | `undefined` | `undefined` or `0` = bodyweight |
| `targetWeightUnit` | `'lbs' \| 'kg'` | No | `undefined` | Only set when `targetWeight` is specified |
| `targetReps` | `number` | No | `undefined` | Rep count target |
| `targetTime` | `number` | No | `undefined` | Seconds, for time-based exercises |
| `targetRpe` | `number` | No | `undefined` | Rate of Perceived Exertion, 1-10 |
| `restSeconds` | `number` | No | `undefined` | Rest period after this set |
| `tempo` | `string` | No | `undefined` | Tempo notation, e.g., "3-0-1-0" |
| `isDropset` | `boolean` | No | `false` | Drop set indicator |
| `isPerSide` | `boolean` | No | `false` | Per-side indicator for unilateral exercises |
| `isAmrap` | `boolean` | No | `false` | As Many Reps As Possible indicator |
| `notes` | `string` | No | `undefined` | Additional notes from set line (e.g., "forward", "each side") |

**DB table**: `template_sets`

**Business rules**:
- A set is either rep-based (`targetReps`) or time-based (`targetTime`), not both.
- `isAmrap` overrides `targetReps` — the rep count becomes a minimum/suggestion.
- `isDropset` indicates this set is part of a drop-set sequence with decreasing weight.

---

### WorkoutSession

An actual workout instance being performed or already completed. Created from a WorkoutPlan.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `workoutPlanId` | `string` | No | `undefined` | FK → `workout_templates.id` (SET NULL on delete); null if custom/imported |
| `name` | `string` | Yes | — | Copied from plan name at session creation |
| `date` | `string` | Yes | — | ISO date (YYYY-MM-DD) |
| `startTime` | `string` | No | `undefined` | ISO 8601 datetime |
| `endTime` | `string` | No | `undefined` | ISO 8601 datetime, set on completion |
| `duration` | `number` | No | `undefined` | Seconds, calculated on completion |
| `notes` | `string` | No | `undefined` | User notes |
| `exercises` | `SessionExercise[]` | Yes | `[]` | Ordered list of exercises |
| `status` | `'in_progress' \| 'completed' \| 'canceled'` | Yes | `'in_progress'` | Session lifecycle state |

**DB table**: `workout_sessions`

**Business rules**:
- Only one session can have `status = 'in_progress'` at a time (enforced by application logic, not DB constraint).
- `duration` is computed as `endTime - startTime` in seconds on completion.
- Deleting a plan sets `workoutPlanId` to NULL (preserves session history).

---

### SessionExercise

An exercise within an active or completed workout session.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `workoutSessionId` | `string` | Yes | — | FK → `workout_sessions.id` (CASCADE) |
| `exerciseName` | `string` | Yes | — | Copied from plan or user-entered |
| `orderIndex` | `number` | Yes | — | 0-based position |
| `notes` | `string` | No | `undefined` | |
| `equipmentType` | `string` | No | `undefined` | |
| `groupType` | `'superset' \| 'section'` | No | `undefined` | |
| `groupName` | `string` | No | `undefined` | |
| `parentExerciseId` | `string` | No | `undefined` | FK → `session_exercises.id` (CASCADE) |
| `sets` | `SessionSet[]` | Yes | `[]` | Ordered list of sets |
| `status` | `'pending' \| 'in_progress' \| 'completed' \| 'skipped'` | Yes | `'pending'` | |

**DB table**: `session_exercises`

**Business rules**:
- Exercise status auto-completes when all its sets are `'completed'` or `'skipped'`.
- "Trackable" exercises are those with `sets.length > 0` (excludes superset parent headers).

---

### SessionSet

A single set within a session exercise, tracking both target and actual performance.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `sessionExerciseId` | `string` | Yes | — | FK → `session_exercises.id` (CASCADE) |
| `orderIndex` | `number` | Yes | — | 0-based position |
| `parentSetId` | `string` | No | `undefined` | FK → `session_sets.id` (CASCADE); links drop-set children |
| `dropSequence` | `number` | No | `undefined` | 0 = main set, 1 = first drop, 2 = second drop, etc. |
| **Target values** | | | | *Copied from PlannedSet at session creation* |
| `targetWeight` | `number` | No | `undefined` | |
| `targetWeightUnit` | `'lbs' \| 'kg'` | No | `undefined` | |
| `targetReps` | `number` | No | `undefined` | |
| `targetTime` | `number` | No | `undefined` | Seconds |
| `targetRpe` | `number` | No | `undefined` | |
| `restSeconds` | `number` | No | `undefined` | |
| **Actual values** | | | | *Entered by user during workout* |
| `actualWeight` | `number` | No | `undefined` | |
| `actualWeightUnit` | `'lbs' \| 'kg'` | No | `undefined` | |
| `actualReps` | `number` | No | `undefined` | |
| `actualTime` | `number` | No | `undefined` | Seconds |
| `actualRpe` | `number` | No | `undefined` | |
| **Metadata** | | | | |
| `completedAt` | `string` | No | `undefined` | ISO 8601 datetime |
| `status` | `'pending' \| 'completed' \| 'skipped' \| 'failed'` | Yes | `'pending'` | |
| `notes` | `string` | No | `undefined` | |
| `tempo` | `string` | No | `undefined` | |
| `isDropset` | `boolean` | No | `false` | |
| `isPerSide` | `boolean` | No | `false` | |

**DB table**: `session_sets`

**Business rules**:
- On completion, if no `actualWeight`/`actualReps` are provided, values are copied from targets.
- Drop sets link via `parentSetId` + `dropSequence` for ordering.
- Completing a set automatically advances the session to the next pending set.

---

### UserSettings

Singleton row for user preferences.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `defaultWeightUnit` | `'lbs' \| 'kg'` | Yes | `'lbs'` | |
| `enableWorkoutTimer` | `boolean` | Yes | `true` | |
| `autoStartRestTimer` | `boolean` | Yes | `true` | |
| `theme` | `'light' \| 'dark' \| 'auto'` | Yes | `'auto'` | |
| `notificationsEnabled` | `boolean` | Yes | `true` | |
| `customPromptAddition` | `string` | No | `undefined` | Appended to AI workout generation prompts |
| `anthropicApiKey` | `string` | No | `undefined` | Stored in secure storage (Keychain), NOT in DB |
| `anthropicApiKeyStatus` | `'verified' \| 'invalid' \| 'not_set'` | No | `'not_set'` | Status stored in DB |
| `healthKitEnabled` | `boolean` | Yes | `false` | Sync to Apple Health |
| `liveActivitiesEnabled` | `boolean` | Yes | `true` | Show on lock screen |
| `keepScreenAwake` | `boolean` | Yes | `true` | During active workouts |
| `showOpenInClaudeButton` | `boolean` | Yes | `false` | Always show "Open in Claude" button |
| `homeTiles` | `string[]` | No | `['Squat', 'Deadlift', 'Bench Press', 'Overhead Press']` | Custom home screen max lift tiles; stored as JSON |
| `createdAt` | `string` | Yes | — | ISO 8601 |
| `updatedAt` | `string` | Yes | — | ISO 8601 |

**DB table**: `user_settings`

**Business rules**:
- Exactly one row exists; initialized on first migration.
- `anthropicApiKey` is verified via API call before storing; status reflects last verification result.
- The actual API key is stored in iOS Keychain via `secureStorage`, not in SQLite.

---

### Gym

A gym location for organizing equipment availability.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `name` | `string` | Yes | — | e.g., "Home Gym", "LA Fitness" |
| `isDefault` | `boolean` | Yes | `false` | Only one gym should be default at a time |
| `createdAt` | `string` | Yes | — | ISO 8601 |
| `updatedAt` | `string` | Yes | — | ISO 8601 |

**DB table**: `gyms`

**Business rules**:
- A default gym ("My Gym") is created during initial migration.
- Cannot delete the last gym.
- Setting a new default unsets all other gyms' `isDefault` first.

---

### GymEquipment

Equipment availability at a specific gym.

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | UUID | Primary key |
| `gymId` | `string` | Yes | — | FK → `gyms.id` (application-level cascade on delete) |
| `name` | `string` | Yes | — | Equipment name; UNIQUE constraint in DB |
| `isAvailable` | `boolean` | Yes | `true` | Whether currently available |
| `lastCheckedAt` | `string` | No | `undefined` | ISO 8601, updated when toggling availability |
| `createdAt` | `string` | Yes | — | ISO 8601 |
| `updatedAt` | `string` | Yes | — | ISO 8601 |

**DB table**: `gym_equipment`

**Business rules**:
- `name` has a UNIQUE constraint in the database.
- Equipment deleted when its gym is deleted (application-level cascade).
- Preset equipment categories available for quick-add: Free Weights, Benches & Racks, Machines, Cardio, Other.

---

### Exercise (Catalog — Type Only)

A catalog entry for exercise suggestions and history aggregation. Defined as a TypeScript interface but **not currently persisted to a dedicated table** — exercise names are stored inline on PlannedExercise/SessionExercise.

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `id` | `string` | Yes | UUID |
| `name` | `string` | Yes | — |
| `category` | `string` | No | `undefined` |
| `muscleGroups` | `string[]` | No | `undefined` |
| `equipmentType` | `string` | No | `undefined` |
| `description` | `string` | No | `undefined` |
| `isCustom` | `boolean` | Yes | — |
| `createdAt` | `string` | Yes | — |

---

## Relationships

```
WorkoutPlan 1──* PlannedExercise 1──* PlannedSet
     │
     │ (FK, SET NULL on delete)
     ▼
WorkoutSession 1──* SessionExercise 1──* SessionSet
                                              │
                                              │ (self-ref for drop sets)
                                              ▼
                                         SessionSet (parent_set_id)

Gym 1──* GymEquipment

PlannedExercise ──> PlannedExercise (parent_exercise_id, self-ref for supersets/sections)
SessionExercise ──> SessionExercise (parent_exercise_id, self-ref for supersets/sections)
```

---

## Sync Infrastructure (Tables Exist, Functionality Removed)

Three sync-related tables were created in migration V1 but their hook implementations are currently empty stubs:

- **`sync_metadata`**: Device sync state tracking (device_id, last_sync_date, server_change_token)
- **`sync_queue`**: Pending sync operations (entity_type, entity_id, operation, payload, attempts)
- **`sync_conflicts`**: Conflict resolution records (local_data, remote_data, resolution)

---

## Preset Equipment Constants

Defined in `src/types/workout.ts` as `PRESET_EQUIPMENT`:

| Category | Items |
|----------|-------|
| **Free Weights** | Barbell, Dumbbells, Kettlebells, Weight Plates, EZ Curl Bar |
| **Benches & Racks** | Flat Bench, Incline Bench, Adjustable Bench, Squat Rack, Power Rack, Smith Machine |
| **Machines** | Cable Machine, Lat Pulldown, Leg Press, Leg Curl, Leg Extension, Chest Press Machine, Shoulder Press Machine, Row Machine |
| **Cardio** | Treadmill, Stationary Bike, Rowing Machine, Elliptical, Stair Climber |
| **Other** | Pull-up Bar, Dip Station, Resistance Bands, TRX/Suspension Trainer, Medicine Ball, Battle Ropes, Foam Roller |

---

## Legacy Aliases (Deprecated)

The codebase is transitioning from "Template" naming to "Plan" naming:

| Deprecated | Current |
|------------|---------|
| `WorkoutTemplate` | `WorkoutPlan` |
| `TemplateExercise` | `PlannedExercise` |
| `TemplateSet` | `PlannedSet` |
| `useWorkoutStore` | `useWorkoutPlanStore` |
| `getAllWorkoutTemplates` | `getAllWorkoutPlans` |
| `createSessionFromTemplate` | `createSessionFromPlan` |

DB table names (`workout_templates`, `template_exercises`, `template_sets`) remain unchanged.
