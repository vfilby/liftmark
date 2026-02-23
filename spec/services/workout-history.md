# Workout History Service Specification

## Purpose

Format workout history into compact text representations for use as context in AI workout generation prompts. Provides the AI model with information about the user's recent training and personal records so it can generate appropriately challenging workouts.

## Public API

### `generateWorkoutHistoryContext(recentCount?): Promise<string>`

Generates a complete history context string for inclusion in AI prompts. Default `recentCount` is 5.

**Logic:**
1. Fetch the most recent `recentCount` completed sessions and all-time best weights in parallel.
2. Format each recent session using `formatSessionCompact`.
3. Collect all exercise names that appear in the recent sessions.
4. From the best-weights data, filter to exercises that are **not** already represented in the recent sessions (to avoid duplication).
5. Append a "Personal Records" section with the remaining best-weight entries.
6. Join all lines with newlines and return.

**Output format:**
```
Recent Workouts:
2024-01-15 Push Day: Bench 185x8,205x5; Incline DB 60x10
2024-01-13 Pull Day: DL 315x5,335x3; Row 185x8

Personal Records:
Squat: 315 lbs
OHP: 155 lbs
```

### `formatSessionCompact(session): string`

Formats a single session as a one-line summary.

**Format:** `{date} {name}: {exercise1}; {exercise2}; ...`

- Date format: `YYYY-MM-DD`
- Exercises separated by semicolons.
- Each exercise formatted via `formatExerciseCompact`.

### `formatExerciseCompact(exercise): string`

Formats a single exercise with its completed sets.

**Format:** `{abbreviatedName} {set1},{set2},...`

- Only includes sets with status `completed`.
- Exercise name abbreviated via `abbreviateExerciseName`.
- Sets separated by commas.

### `formatSetCompact(set): string`

Formats a single set in the most compact representation.

| Set Type   | Format    | Example |
|------------|-----------|---------|
| Weighted   | `{weight}x{reps}` | `185x8` |
| Bodyweight | `bwx{reps}` | `bwx10` |
| Timed      | `{seconds}s` | `30s` |

Uses actual values with fallback to target values if actuals are missing.

### `abbreviateExerciseName(name): string`

Maps common exercise names to short abbreviations for compact display. Matching is case-insensitive.

| Full Name | Abbreviation |
|-----------|-------------|
| barbell bench press | Bench |
| bench press | Bench |
| incline bench press | Inc Bench |
| incline dumbbell press | Incline DB |
| dumbbell bench press | DB Bench |
| overhead press | OHP |
| strict press | OHP |
| military press | OHP |
| deadlift | DL |
| romanian deadlift | RDL |
| sumo deadlift | Sumo DL |
| back squat | Squat |
| squat | Squat |
| front squat | Front Squat |
| barbell row | Row |
| bent over row | Row |
| pendlay row | Pendlay |
| pull-up | Pull-up |
| chin-up | Chin-up |
| lat pulldown | Lat Pull |
| cable row | Cable Row |
| dumbbell curl | DB Curl |
| barbell curl | BB Curl |
| bicep curl | Curl |
| tricep pushdown | Tri Push |
| lateral raise | Lat Raise |
| face pull | Face Pull |
| leg press | Leg Press |
| leg curl | Leg Curl |

Names not in this table are returned unchanged.

### `hasWorkoutHistory(): Promise<boolean>`

Returns `true` if at least one completed session exists in the database. Used to determine whether to include history context in AI prompts.

## Dependencies

- Session repository (for recent sessions).
- Exercise history repository (for best weights).

## Error Handling

- If the database query fails, errors propagate as exceptions. The caller (AI generation service) is responsible for handling failures gracefully by omitting history context.
