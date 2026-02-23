# Exercise History Service Specification

## Purpose

Query and aggregate per-exercise historical data for charting trends and displaying detailed session breakdowns. Powers the inline exercise history chart on the History Detail screen and the Exercise History Bottom Sheet.

## Public API

### `getExerciseHistory(exerciseName, limit?): Promise<ExerciseHistoryPoint[]>`

Fetch aggregated per-session data for a named exercise, suitable for charting.

**Parameters:**
- `exerciseName` — Exact exercise name to query.
- `limit` — Maximum number of sessions to return. Default: 10.

**Query logic:**
1. Select from completed sessions joined to session exercises and session sets.
2. Filter to sessions with status `completed` and sets with status `completed`.
3. Match on `exerciseName` (exact match).
4. Group by session (one row per session).
5. Order by session date descending, limit to `limit` rows.
6. Reverse the result to chronological order (oldest first) for charting.

**Aggregations per session:**

| Field       | Aggregation | Description |
|-------------|-------------|-------------|
| maxWeight   | `MAX(actual_weight)` | Heaviest set in the session |
| avgReps     | `AVG(actual_reps)` | Average reps, rounded to 1 decimal |
| totalVolume | `SUM(actual_weight × actual_reps)` | Total volume, rounded to integer |
| setsCount   | `COUNT(sets)` | Number of completed sets |
| avgTime     | `AVG(actual_time)` | Average time in seconds, rounded |
| maxTime     | `MAX(actual_time)` | Longest time in seconds, rounded |
| unit        | `COALESCE(actual_weight_unit, target_weight_unit, 'lbs')` | Weight unit |

### `getExerciseSessionHistory(exerciseName, limit?): Promise<ExerciseSessionDetail[]>`

Fetch detailed set-level data for the Exercise History Bottom Sheet.

Returns an array of sessions, each containing the session date, workout name, total volume, and an array of individual sets with both target and actual values.

### `getExerciseProgressMetrics(exerciseName): Promise<ProgressMetrics>`

Fetch overall statistics and trend direction for an exercise. Returns total sessions, max weight, average reps, total volume, and a trend indicator.

### `getAllExercisesWithHistory(): Promise<string[]>`

Returns all distinct exercise names that appear in completed sessions. Used by the Exercise Picker to build the user's exercise list.

### `getExerciseBestWeights(): Promise<Record<string, { weight: number, unit: string }>>`

Returns the all-time maximum weight lifted for each exercise. Used by the Workout Highlights service for PR detection and by the Home Tiles for displaying best lifts.

## Types

### ExerciseHistoryPoint

| Field       | Type   | Description |
|-------------|--------|-------------|
| date        | string | Session date (YYYY-MM-DD) |
| startTime   | string? | Session start time |
| workoutName | string | Name of the session |
| maxWeight   | number | Heaviest completed set weight |
| avgReps     | number | Average reps across completed sets |
| totalVolume | number | Sum of weight × reps |
| setsCount   | number | Number of completed sets |
| avgTime     | number | Average time in seconds |
| maxTime     | number | Max time in seconds |
| unit        | string | Weight unit (`lbs` or `kg`) |

### ChartMetricType

`'maxWeight' | 'totalVolume' | 'reps' | 'time'`

Used by the chart component to select which metric to display on the primary axis.

## Chart Data Assembly

The chart component receives `ExerciseHistoryPoint[]` and renders a line chart with the following behavior:

### Exercise Type Detection

The chart auto-detects the exercise type from the data:

| Condition | Type | Default Metric |
|-----------|------|----------------|
| Any point has `maxWeight > 0` | Weighted | `maxWeight` |
| Any point has `maxTime > 0` or `avgTime > 0` | Timed | `time` |
| Neither | Bodyweight | `reps` |

### Metric Selection

- For **weighted** exercises: user can toggle between `maxWeight` and `totalVolume`. A secondary reps line is always shown.
- For **timed** exercises: metric is fixed to `time`.
- For **bodyweight** exercises: metric is fixed to `reps`.

### Dual Axis (Weighted Exercises)

When displaying weighted exercises, the chart shows two lines:
1. **Primary axis:** The selected metric (weight or volume).
2. **Secondary axis:** Reps, scaled to fit the primary axis range.

Scaling factor: `maxPrimaryValue / maxRepsValue`. Actual rep numbers are shown as data point labels.

### Statistics Box

Displayed below the chart with three values:
- **Current:** The most recent data point's value.
- **Best:** The maximum value across all data points.
- **Change:** Percentage change from the previous session to the current session.

## Dependencies

- SQLite database (workout_sessions, session_exercises, session_sets tables).

## Error Handling

- Database query errors propagate as exceptions.
- If no history exists for an exercise, returns an empty array (chart shows empty state).
