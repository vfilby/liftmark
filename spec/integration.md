# Integration Specification

This document specifies how the app's layers connect end-to-end. It covers persistence lifecycle, data flow through stores, navigation wiring, and the import/export pipeline. Any implementation must satisfy these integration contracts — having individual components (database, views, services) is not sufficient; they must be connected as described here.

## Persistence Lifecycle

### App Launch

On app launch, the following MUST happen in order:

1. **Database initialization** — Open or create the SQLite database. Run any pending migrations. Seed default data (default gym, default settings) if first launch.
2. **Store hydration** — Each store loads its data from the database:
   - `WorkoutPlanStore.loadPlans()` → `WorkoutPlanRepository.getAll()`
   - `SessionStore.loadSessions()` → `SessionRepository.getCompletedSessions()` + `SessionRepository.getActiveSession()`
   - `SettingsStore.loadSettings()` → Read `user_settings` table
   - `GymStore.loadGyms()` → Read `gyms` table
3. **UI renders** — Views read from stores (which are now populated) and display data.

### Data Mutation Flow

All data mutations follow this pattern:

```
User action → View → Store method → Repository method → SQLite → Store reloads → View updates
```

Example: User deletes a workout plan
1. View calls `planStore.deletePlan(id)`
2. Store calls `repository.delete(id)` (SQL DELETE with cascade)
3. Store calls `repository.getAll()` to reload
4. Store's `@Observable` properties update
5. View re-renders automatically

**Critical rule**: Views NEVER talk to repositories directly. All data access goes through stores.

### Active Session Persistence

The active workout session is the most complex persistence flow. Every user action during a workout must persist immediately (crash recovery):

| User Action | Store Method | Repository Method | What's Persisted |
|-------------|-------------|-------------------|-----------------|
| Start workout | `startSession(planId)` | `createSessionFromPlan(planId)` | New session row (status=active), copied exercises and sets with target values |
| Complete a set | `updateSet(setId, actual)` | `updateSessionSet(setId, actualValues)` | `actual_weight`, `actual_reps`, `actual_time`, `actual_rpe`, `status=completed`, `completed_at` |
| Skip a set | `skipSet(setId)` | `updateSessionSet(setId, {status: "skipped"})` | `status=skipped` |
| Edit set targets | `updateSetTarget(setId, targets)` | `updateSessionSetTarget(setId, targets)` | Modified `target_weight`, `target_reps`, etc. |
| Add exercise | `addExercise(sessionId, exercise)` | `insertSessionExercise(exercise)` + `insertSessionSet()` for each set | New exercise and set rows |
| Edit exercise | `updateExercise(exercise)` | `updateSessionExercise(exercise)` | Exercise name, notes, equipment |
| Finish workout | `completeSession()` | `complete(sessionId)` | `status=completed`, `end_time`, calculated `duration` |
| Cancel workout | `cancelSession()` | `cancel(sessionId)` | `status=canceled` |

**Required SessionRepository methods** (must exist in any implementation):
- `updateSessionSet(setId, actualValues)` — Update a single set's actual values and status
- `updateSessionSetTarget(setId, targetValues)` — Modify target values for a set
- `insertSessionExercise(exercise)` — Add an exercise to an active session
- `insertSessionSet(set)` — Add a set to a session exercise
- `updateSessionExercise(exercise)` — Update exercise metadata
- `deleteSessionSet(setId)` — Remove a set
- `deleteSessionExercise(exerciseId)` — Remove an exercise and its sets

These are NOT optional. Without them, the active workout screen cannot function.

---

## Navigation Wiring

### Required Navigation Paths

Every navigation path listed here must be functional end-to-end. "Functional" means: the user can tap/interact, the app navigates to the correct screen, and that screen displays real data (not placeholder text).

#### Home Tab → Start Workout
1. Home screen shows recent plans (from `WorkoutPlanStore`)
2. Tap a plan → navigates to Workout Detail screen (passing plan ID)
3. Workout Detail shows exercises/sets (loaded from `WorkoutPlanStore.getPlan(id)`)
4. Tap "Start Workout" → creates session via `SessionStore.startSession(planId)` → navigates to Active Workout screen
5. Active Workout shows exercises with target values (from `SessionStore.activeSession`)
6. Complete sets → data persists (see Active Session Persistence above)
7. Tap "Finish" → `SessionStore.completeSession()` → navigates to Workout Summary
8. Workout Summary shows stats (from the just-completed session)
9. Tap "Done" → returns to Home (which now shows updated history data)

#### Home Tab → Resume Workout
1. If `SessionStore.activeSession` is not nil, Home shows a "Resume Workout" banner
2. Tap banner → navigates directly to Active Workout screen
3. Active Workout displays the session's current state (some sets completed, others pending)

#### Plans Tab → Import → Use
1. Plans tab shows all plans (from `WorkoutPlanStore`)
2. Tap "+" or Import button → presents Import modal
3. User pastes LMWF markdown or uses AI generation
4. Tap "Import" → `MarkdownParser.parseWorkout()` → `WorkoutPlanStore.createPlan()` → modal dismisses
5. Plans tab now shows the new plan
6. User can tap it → Workout Detail → Start Workout (same flow as above)

#### History Tab → View → Export
1. History tab shows completed sessions grouped by date (from `SessionStore.sessions`)
2. Tap a session → History Detail screen (passing session ID)
3. History Detail shows exercises, sets, and stats (from `SessionStore`)
4. Tap exercise name → shows Exercise History bottom sheet/chart
5. Tap export → `WorkoutExportService.exportSessionAsJson()` → share sheet

#### Settings → Manage Gyms
1. Settings screen shows gym list (from `GymStore`)
2. Tap a gym → Gym Detail screen (passing gym ID)
3. Gym Detail shows equipment (from `EquipmentStore.loadEquipment(gymId)`)
4. Add/remove/toggle equipment → persists via `EquipmentStore`

### Navigation Parameters

| Source → Destination | Parameter | Type | Source |
|---------------------|-----------|------|--------|
| Plans list → Workout Detail | planId | String | Selected plan's ID |
| Workout Detail → Active Workout | planId | String | Current plan's ID (session created during navigation) |
| Home resume → Active Workout | (none) | — | Uses `SessionStore.activeSession` |
| History list → History Detail | sessionId | String | Selected session's ID |
| Settings → Gym Detail | gymId | String | Selected gym's ID |
| Import modal → Plans list | (none) | — | Plan created, modal dismissed, list reloads from store |

---

## Import/Export Pipeline

### Import Flow (LMWF Markdown → Database)

```
Markdown text
  → MarkdownParser.parseWorkout(text)
  → LMWFParseResult { success, data: WorkoutPlan?, errors, warnings }
  → If success: WorkoutPlanStore.createPlan(plan)
    → WorkoutPlanRepository.create(plan)
      → INSERT into workout_templates, template_exercises, template_sets
  → Store reloads, UI updates
```

**Validation requirements:**
- Parser must return errors for: no workout header, no exercises, malformed set notation
- Parser must return warnings for: unusual rep counts (>100), very short rest (<10s)
- UI must display errors and warnings before allowing import
- UI must show preview (plan name, exercise count, set count) before import

### Import Sources

| Source | How it works |
|--------|-------------|
| Clipboard paste | Read system clipboard, paste into text editor |
| File import (share extension) | Receive `liftmark://` URL → `FileImportService.readSharedFile()` → paste into editor |
| AI generation | User enters prompt → `WorkoutGenerationService` builds context → `AnthropicService.generateWorkout()` → LMWF markdown → paste into editor |
| Direct typing | User types LMWF markdown directly |

All sources converge at the same point: markdown text in the editor → parse → preview → import.

### Export Flow (Database → JSON File)

```
SessionStore.sessions
  → WorkoutExportService.exportSessionsAsJson(sessions)
  → JSON file written to caches directory
  → Share sheet presented with file URL
```

**Export format**: See `spec/data/import-export-schema.md` for the canonical JSON schema.

**Requirements:**
- Export must strip internal database IDs (not portable)
- Export must include app version and export timestamp
- Export must sanitize filenames (no special characters)
- Single session export and bulk export must both be supported

### Database Backup/Restore

```
Backup:  DatabaseBackupService.exportDatabase()
  → Copy SQLite file to caches with timestamp filename
  → Return file URL for sharing

Restore: DatabaseBackupService.importDatabase(fileURL)
  → Validate SQLite magic header
  → Validate required tables exist
  → Create safety backup of current database
  → Replace current database file
  → If failure: restore from safety backup
  → Reinitialize database connection
  → Reload all stores
```

---

## Cross-Cutting Concerns

### Error Handling in Data Flow

| Layer | Error Strategy |
|-------|---------------|
| Repository | Throws on SQLite errors (constraint violations, connection issues) |
| Store | Catches repository errors, logs them, sets error state for UI |
| View | Reads store error state, displays alerts or error messages |
| Service | Returns Result types or throws; caller decides how to present |

### Data Consistency

- All multi-row mutations use database transactions (plan creation, session creation)
- Foreign keys with CASCADE DELETE ensure referential integrity
- Stores reload from database after every mutation (not optimistic updates)
- Active session is always persisted — app can crash and resume

### Offline Operation

- The app is fully functional offline (all data is local SQLite)
- CloudKit sync (if enabled) queues changes for later upload
- AI generation requires network (shows appropriate error if offline)
- HealthKit writes are local (iOS handles sync to iCloud Health)
