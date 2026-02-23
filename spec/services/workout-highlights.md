# Workout Highlights Service Specification

## Purpose

Calculate post-workout achievements from a completed session by comparing against historical data. Highlights are displayed on the Workout Summary screen to celebrate progress.

## Public API

### `calculateWorkoutHighlights(session): Promise<WorkoutHighlight[]>`

Accepts a completed `WorkoutSession` and returns an array of highlights. Runs all four detection algorithms in parallel and merges results. Returns an empty array if no highlights are detected. Never throws — errors in any detector are caught and that detector's results are silently omitted.

## Types

### WorkoutHighlight

| Field   | Type   | Description |
|---------|--------|-------------|
| type    | `'pr' \| 'weight_increase' \| 'volume_increase' \| 'streak'` | Highlight category |
| emoji   | string | Display emoji for the highlight |
| title   | string | Short title (e.g., "New PR!") |
| message | string | Human-readable detail message |

### ExercisePR

| Field        | Type    | Description |
|--------------|---------|-------------|
| exerciseName | string  | Name of the exercise |
| newWeight    | number  | Weight achieved in this session |
| newReps      | number  | Reps at the new weight |
| oldWeight    | number? | Previous best weight (null if first time) |
| oldReps      | number? | Reps at the previous best |
| unit         | string  | Weight unit (lbs/kg) |

### VolumeComparison

| Field              | Type   | Description |
|--------------------|--------|-------------|
| currentVolume      | number | Total volume this session |
| previousVolume     | number | Total volume of the comparison session |
| percentageIncrease | number | Percentage improvement |

## Detection Algorithms

### 1. Personal Records (type: `pr`)

Compares the current session's max weight per exercise against the all-time best weight from the exercise history repository.

**Logic:**
1. For each exercise in the session, find the maximum `actualWeight` across all completed sets.
2. Query the all-time best weight for that exercise name from the database.
3. A PR is triggered when:
   - The current max weight **exceeds** the all-time best, OR
   - No prior history exists for the exercise (first-time lift).

**Display:**
- First-time PR: emoji `🎉`, title "First PR!", message includes exercise name and weight.
- New PR: emoji `🏆`, title "New PR!", message includes exercise name, old weight, and new weight.

### 2. Weight Increases (type: `weight_increase`)

Detects per-exercise weight increases compared to the most recent prior session containing that exercise. This is distinct from PRs — a weight increase is relative to the last time the exercise was performed, not the all-time best.

**Logic:**
1. Fetch the last 10 completed sessions.
2. For each exercise in the current session, find the most recent prior session that included the same exercise name.
3. Compare the max weight in the current session vs. the max weight in that prior session.
4. Report as a weight increase if the current max is higher.

**Display:**
- Emoji: `💪`, title: "Weight Increase!", message includes exercise name, old weight, and new weight.

### 3. Volume Improvement (type: `volume_increase`)

Compares the total training volume of the current session against the most comparable recent session.

**Logic:**
1. Fetch the last 10 completed sessions.
2. Find the most recent session that matches by either:
   - Same `workoutPlanId` (preferred), OR
   - Same session name.
3. Calculate total volume for both sessions: `SUM(actualWeight × actualReps)` across all completed sets.
4. Report as a volume increase if the current session's volume is **more than 5%** higher than the comparison session.

**Display:**
- Emoji: `📈`, title: "Volume Increase!", message includes the rounded percentage increase.

### 4. Workout Streak (type: `streak`)

Counts consecutive calendar days with at least one completed workout, ending with the current session's date.

**Logic:**
1. Fetch the last 30 completed sessions, sorted by date descending.
2. Group by calendar date (multiple sessions on the same day count as one).
3. Starting from the current session's date, count consecutive days working backward.
4. Report as a streak if the count is **2 or more** days.

**Display:**
- Emoji: `🔥`, title: "Consistency!", message includes streak length.
- If streak is 7 or more days, message uses weeks (e.g., "2 week streak").
- Otherwise, message uses days (e.g., "3 day streak").

## Summary Screen Integration

Highlights are displayed on the Workout Summary screen in a vertical list. Each highlight shows a colored left border:

| Highlight Type    | Border Color |
|-------------------|-------------|
| `pr`              | Green       |
| `weight_increase` | Blue        |
| `volume_increase` | Blue        |
| `streak`          | Orange      |

If no highlights are detected, the highlights section is hidden entirely.

## Dependencies

- Exercise history repository (for all-time best weights).
- Session repository (for recent sessions lookup).

## Error Handling

- The top-level `calculateWorkoutHighlights` function catches all errors from individual detectors and returns partial results. If all detectors fail, returns an empty array.
- No user-visible errors are shown for highlight calculation failures.
