# Workout Summary Screen

## Purpose
Post-workout celebration screen showing completion stats, highlights (PRs, streaks, volume increases), and per-exercise breakdown.

## Route
`/workout/summary` — Navigated to via `router.replace()` after completing a workout.

## Layout
- **Header**: Share button (share icon) in headerRight
- **Body**: ScrollView containing:
  1. Success header card (checkmark + "Workout Complete!" + workout name, centered and single-line with auto-scaling text)
  2. Workout Highlights (conditional — PRs, streaks, volume/weight increases)
  3. Stats grid (2x2: Duration, Sets Completed, Total Reps, Total Volume)
  4. Completion card (sets completed, sets skipped, completion rate %)
  5. Notes card (pre-filled with any notes entered during the session; tappable "Add" / "Edit" button opens `SessionNotesSheet`)
  6. Exercise summary list (per-exercise set counts)
- **Footer**: Fixed "Done" button pinned to bottom

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `workout-summary-screen` | View |
| Share button (header) | `share-session-button` | TouchableOpacity |
| Scroll view | `workout-summary-scroll` | ScrollView |
| Success header | `workout-summary-success-header` | View |
| Highlights section | `workout-summary-highlights` | View |
| Stats grid | `workout-summary-stats` | View |
| Completion card | `workout-summary-completion` | View |
| Notes card | `workout-summary-notes` | View |
| Notes edit button | `workout-summary-notes-edit-button` | Button |
| Exercise list | `workout-summary-exercises` | View |
| Done button | `workout-summary-done-button` | TouchableOpacity |

## User Interactions
- **Tap share button (header)** → exports completed session as JSON via `exportSingleSessionAsJson` → share sheet
- **Tap "Done"** → clears session from store → navigates to `/(tabs)` (home)
- **Tap YouTube icon** on exercise → opens YouTube search for that exercise
- **Tap "Add" / "Edit" on Notes card** → opens `SessionNotesSheet`. Pre-filled with any notes captured during the session. Saving updates the completed session record via `SessionStore.updateSessionNotes`. Notes belong to the completed session; they never mutate the source plan.

## Navigation
- `/(tabs)` — via Done button (uses `router.replace`)

## Data Source
- The completed session is passed directly to `WorkoutSummaryView` as a parameter, not looked up from the sessions array.
- `ActiveWorkoutView` captures the session before calling `completeSession()` and passes it to the summary view.
- When navigated to via `AppDestination.workoutSummary` (e.g., from HomeView), the most recently completed session (`sessions.first`, since sessions are sorted newest-first) is used as a fallback.
- This ensures the summary always shows the correct session regardless of how many completed sessions exist or their sort order.

## Computed Values
- Duration formatted from the passed session's `duration`
- Total weight/reps/volume computed from trackable exercises
- Per-exercise completed/skipped set counts
- Completion rate percentage

## Error/Empty States
- **No session provided and no completed sessions**: Shows empty state
- **No highlights**: Highlights section hidden (not rendered)
- **Highlight calculation error**: Silently falls back to empty highlights array
- **Export failure**: Alert titled "Export Failed" with error description. Export failures must show a user-visible alert, not fail silently.

## Section Handling
- Section header exercises (`groupType == .section`, empty sets) and superset parent exercises (`groupType == .superset`, empty sets) are excluded from the exercise summary list.
- Section children (exercises with `parentExerciseId` pointing to a section header) are shown as regular exercises with sequential numbering.

## WorkoutHighlights Component
Renders when highlights array is non-empty:
- Header: "Highlights" with sparkle emoji
- Each highlight: colored left border (green for PR, blue for increase, orange for streak) + emoji + title + message
- Highlight types:
  - `pr` — "New PR!" or "First PR!" with old/new weight comparison
  - `weight_increase` — "Weight Increase!" with old/new comparison
  - `volume_increase` — "Volume Increase!" with percentage
  - `streak` — "Consistency!" with day/week count

## Tests
- **Completed sessions sorted correctly**: `getCompleted()` returns sessions ordered by `end_time` descending (most recently completed first), so `sessions.first` is always the newest completed session.
- **Summary shows correct session**: When multiple completed sessions exist, the summary screen displays the session that was just completed, not an older one.
