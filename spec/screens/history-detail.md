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
| Trend toggle | `trend-toggle-{exerciseName}` | Button |
| Exercise card | `exercise-card-{exerciseName}` | View |
| Delete button | `delete-session-button` | Button |
| Share button | `share-session-button` | Button |

## User Interactions
- **Tap share button (header)** → exports single session as JSON → share sheet
- **Tap "Show trends" toggle** on exercise → expands/collapses inline ExerciseHistoryChart
- **Tap "Details" button** under chart → opens ExerciseHistoryBottomSheet
- **Tap "Delete Workout"** → confirmation alert → deletes session → navigates back

## Navigation
- Back — via stack navigation

## Error/Empty States
- **Loading**: "Loading workout..." text
- **Not found**: "Workout not found" error text
- **No history for exercise**: "No History" disabled trend header (greyed out, no chevron)
- **Export failure**: Alert titled "Export Failed" with error description. Export failures must show a user-visible alert, not fail silently.
- **Delete failure**: Alert with error message

## HistoryDetailView Component

### Header Card
- Full date (weekday, month, day, year)
- Start time + duration

### Stats Grid
- Sets (completed count)
- Reps (total)
- Volume (total weight x reps, or "-" if 0)

### Section Display
- Workouts may contain organizational sections (e.g., Warmup, Main Workout, Cool Down).
- Section headers (`groupType == .section`, empty sets) are **not** rendered as exercise cards — they are displayed as styled dividers with the section name (matching WorkoutDetailView's style: colored horizontal lines with uppercase section name).
- Section color: orange for warmup variants, light blue for cooldown variants, primary for others.
- Exercises within sections are rendered as individual numbered exercise cards.
- Section headers and superset parents are excluded from exercise numbering.

### Exercise Cards
- Numbered exercises with name + optional equipment type
- Supersets: purple SUPERSET capsule badge + group name + individual exercise names, interleaved sets
- Each set: status badge (green ✓ for completed, yellow − for skipped) + weight x reps or "Skipped"

### Exercise Trend (inline, per exercise)

Each exercise card includes a collapsible trend section at the bottom:

#### Collapsed State (default)
- Tappable row with chart icon + "Show trends" label + trend direction arrow (↗ ↘ →) + chevron
- Trend direction computed from comparing recent 3 sessions vs older 3 sessions (>2% change = trending)
- Trend arrow color: green (↗ improving), red (↘ declining), grey (→ stable)

#### Expanded State
- **ExerciseHistoryChartView** — a line chart (Swift Charts) showing historical performance:
  - **Metric picker** (segmented control): toggles between available metrics based on exercise type:
    - Weighted exercises: Max Weight (default) | Volume | Reps
    - Bodyweight exercises: Reps (default) | Volume
    - Timed exercises: Time (default)
  - **Line chart** (200pt height): LineMark + PointMark + AreaMark (gradient fill), catmull-rom interpolation, X-axis = dates, Y-axis = metric value (auto-scale, excludes zero)
  - **Stats row** (shown when ≥2 data points): Current | Best | Change (% from first to latest, colored green/red)
- **"Details" button** below chart → opens ExerciseHistoryBottomSheet for full session-by-session breakdown

#### No History State
- "No History" label, disabled/greyed styling, no chevron, not tappable

### Data Source
- `ExerciseHistoryRepository.getHistory(forExercise:)` returns `[ExerciseHistoryPoint]` with:
  - `date`, `workoutName`, `maxWeight`, `avgReps`, `totalVolume`, `setsCount`, `avgTime`, `maxTime`, `unit`
- One data point per completed session containing that exercise
- Ordered by date descending

## ExerciseHistoryBottomSheet
- Full-screen bottom sheet (NavigationStack) with exercise name as title + "Done" button
- **Summary stats card**: Sessions | Max Weight | Avg Reps | Total Volume (4-column grid)
- **ExerciseHistoryChartView**: Same chart component as inline, but in the sheet context
- **Session list**: Each row shows:
  - Workout name + formatted date
  - Stats: max weight (with unit), set count, volume
  - Icon labels (scalemass, number, chart.bar)
- Loading/empty states ("No history for this exercise" with chart icon)
