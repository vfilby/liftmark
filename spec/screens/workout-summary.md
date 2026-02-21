# Workout Summary Screen

## Purpose
Post-workout celebration screen showing completion stats, highlights (PRs, streaks, volume increases), and per-exercise breakdown.

## Route
`/workout/summary` — Navigated to via `router.replace()` after completing a workout.

## Layout
- **Body**: ScrollView containing:
  1. Success header card (checkmark + "Workout Complete!" + workout name)
  2. Workout Highlights (conditional — PRs, streaks, volume/weight increases)
  3. Stats grid (2x2: Duration, Sets Completed, Total Reps, Total Volume)
  4. Completion card (sets completed, sets skipped, completion rate %)
  5. Exercise summary list (per-exercise set counts)
- **Footer**: Fixed "Done" button pinned to bottom

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `workout-summary-screen` | View |
| Scroll view | `workout-summary-scroll` | ScrollView |
| Success header | `workout-summary-success-header` | View |
| Highlights section | `workout-summary-highlights` | View |
| Stats grid | `workout-summary-stats` | View |
| Completion card | `workout-summary-completion` | View |
| Exercise list | `workout-summary-exercises` | View |
| Done button | `workout-summary-done-button` | TouchableOpacity |

## Data Dependencies
- **sessionStore**: `activeSession`, `pauseSession`, `getProgress`, `getTrackableExercises`
- **workoutHighlightsService**: `calculateWorkoutHighlights(session)` — computes PRs, volume increases, streaks, weight increases
- **WorkoutHighlights component**: renders highlight cards

## User Interactions
- **Tap "Done"** → clears session from store → navigates to `/(tabs)` (home)
- **Tap YouTube icon** on exercise → opens YouTube search for that exercise

## Navigation
- `/(tabs)` — via Done button (uses `router.replace`)

## State
- `highlights` — array of WorkoutHighlight objects (PRs, streaks, etc.)
- `loadingHighlights` — loading state while calculating highlights

## Computed Values
- Duration formatted from `activeSession.duration`
- Total weight/reps/volume computed from trackable exercises
- Per-exercise completed/skipped set counts
- Completion rate percentage

## Error/Empty States
- **No active session**: LoadingView, then redirects to home via `router.replace('/(tabs)')`
- **No highlights**: Highlights section hidden (not rendered)
- **Highlight calculation error**: Silently falls back to empty highlights array

## WorkoutHighlights Component
Renders when highlights array is non-empty:
- Header: "Highlights" with sparkle emoji
- Each highlight: colored left border (green for PR, blue for increase, orange for streak) + emoji + title + message
- Highlight types:
  - `pr` — "New PR!" or "First PR!" with old/new weight comparison
  - `weight_increase` — "Weight Increase!" with old/new comparison
  - `volume_increase` — "Volume Increase!" with percentage
  - `streak` — "Consistency!" with day/week count
