# History Detail Screen

## Purpose
Detailed view of a completed workout session showing date/time, stats, exercises with set results, inline exercise history charts, and exercise history bottom sheet. Supports sharing and deletion.

## Route
`/history/[id]` — Dynamic route accessed by tapping a session card in History.

## Layout
- **Header**: Native stack header with session name as title, share button in headerRight
- **Body**: HistoryDetailView component (ScrollView) containing:
  1. Header card (date, time, duration)
  2. Stats grid (sets, reps, volume)
  3. Exercises section with expandable trend charts
  4. Notes section (if present)
  5. Delete button (if onDelete provided)
- **Overlay**: ExerciseHistoryBottomSheet (when viewing exercise details)

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `history-detail-screen` | View |
| Detail view container | `history-detail-view` | ScrollView |

## Data Dependencies
- **sessionRepository**: `getWorkoutSessionById()`, `deleteSession()`
- **workoutExportService**: `exportSingleSessionAsJson()`
- **exerciseHistoryRepository**: `getExerciseHistory()`, `getExerciseSessionHistory()`, `getExerciseProgressMetrics()`
- **expo-sharing**: `shareAsync()`

## User Interactions
- **Tap share button (header)** → exports single session as JSON → share sheet
- **Tap "Show trends" toggle** on exercise → expands/collapses inline ExerciseHistoryChart
- **Tap "Details" button** under chart → opens ExerciseHistoryBottomSheet
- **Tap "Delete Workout"** → confirmation alert → deletes session → navigates back

## Navigation
- Back — via stack navigation

## State
- `session` — loaded WorkoutSession object
- `isLoading` — initial load state
- `expandedExercises` — Set of exercise names with expanded charts
- `historyData` — Map of exercise name to history data points (lazy loaded)
- `loadingHistory` — Set of exercise names currently loading
- `selectedMetrics` — Map of exercise name to selected chart metric
- `bottomSheetExercise` — exercise name for bottom sheet (null = hidden)

## Error/Empty States
- **Loading**: "Loading workout..." text
- **Not found**: "Workout not found" error text
- **No history for exercise**: "No History" disabled trend header
- **Export failure**: Alert with error message
- **Delete failure**: Alert with error message

## HistoryDetailView Component

### Header Card
- Full date (weekday, month, day, year)
- Start time + duration

### Stats Grid
- Sets (completed count)
- Reps (total)
- Volume (total weight x reps, or "-" if 0)

### Exercise Cards
- Numbered exercises with name + optional equipment type
- Supersets: group name + individual exercise names, interleaved sets
- Each set: numbered badge (green check for completed, yellow dash for skipped) + weight x reps or "Skipped"
- Trend header: "Show trends" / "No History" / "Loading..."
- Expanded chart: ExerciseHistoryChart with metric selector
- "Details" button opens bottom sheet

## ExerciseHistoryBottomSheet
- Full-screen bottom sheet overlay with backdrop
- Header: exercise name + close button
- Summary stats card: Sessions | Max Weight | Avg Reps | Total Volume
- Session history list (FlatList): date, workout name, volume, per-set breakdown with target/actual values
- Loading/empty states
