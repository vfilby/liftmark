# Live Activities Service Specification

## Purpose

Display workout progress on the iOS Lock Screen and Dynamic Island via Live Activities. This gives users at-a-glance workout status without unlocking their device or navigating back to the app.

## Public API

### `isLiveActivityAvailable(): boolean`

Check whether Live Activities are available on the current device. Requires iOS 16.2 or later with a dev build.

### `startWorkoutLiveActivity(session, exercise, setIndex, progress)`

Start a new Live Activity displaying the current workout state. If an existing activity is running, it is ended before starting the new one.

### `updateWorkoutLiveActivity(session, exercise, setIndex, progress, restTimer?)`

Update the running Live Activity with current workout state. Supports both active set and rest timer display modes.

### `endWorkoutLiveActivity(message?)`

End the running Live Activity. An optional completion message is displayed briefly before the activity dismisses.

## Behavior Rules

### Availability

- Only available on iOS 16.2 and later.
- Requires the `LiveWorkouts` widget extension to be compiled and embedded in the app.
- Availability is checked via `ActivityAuthorizationInfo().areActivitiesEnabled`.

### OS-Level Permission

Live Activities can be disabled at the OS level by the user (Settings > LiftMark > Live Activities). The service must check this permission:

- **`areActivitiesEnabled` (via `ActivityAuthorizationInfo`)**: Returns whether the OS allows this app to show Live Activities.
- If disabled at the OS level, the app's Live Activities toggle in Settings must be **grayed out** with a helper message directing the user to system Settings to re-enable (see Settings Screen spec).
- The permission check must be performed each time the Settings screen appears, not cached from a previous check.
- When Live Activities are disabled at the OS level, calling `startWorkoutLiveActivity()` is a no-op (silent failure) — this must never affect workout functionality.

### Activity Lifecycle

- The service tracks the current activity reference internally.
- **Singleton enforcement**: At most one Live Activity may exist at any time. Before starting a new activity, all existing activities must be fully ended first.
- **Awaited cleanup before creation**: `startWorkoutLiveActivity()` must await the termination of any existing activity before requesting a new one. The end and start operations must not race — the previous activity must be confirmed ended before `Activity.request()` is called.
- **Orphan cleanup on start**: When starting a new activity, the service must iterate `Activity<WorkoutActivityAttributes>.activities` and end any activities not tracked by the current reference. This handles activities orphaned by crashes, force-quits, or lost references.
- Activities are ended when the workout completes, is cancelled, or is paused.
- **Dismissal on pause**: When the user pauses a workout (dismissing the active workout screen without completing or cancelling), the Live Activity must be ended. A new activity is started when the workout is resumed.
- **Force-quit recovery**: If the app is force-quit during an active workout, orphaned Live Activities are cleaned up on the next `startWorkoutLiveActivity()` call via the orphan cleanup described above.

### Display States

The Live Activity has two visual states, both designed to give users enough information to perform their workout without opening the app.

#### Content State Data

The `WorkoutActivityAttributes.ContentState` carries structured fields rather than pre-formatted strings:

| Field | Type | Description |
|-------|------|-------------|
| `isRestTimer` | `Bool` | Whether the activity is showing rest timer mode |
| `exerciseName` | `String` | Current exercise name (active set) or "Rest" (rest mode) |
| `setInfo` | `String` | "Set X/Y" for current exercise |
| `weightReps` | `String` | Formatted weight × reps (e.g., "185 lbs × 5") |
| `nextExerciseName` | `String?` | Name of the next exercise (nil if last exercise) |
| `nextSetDetail` | `String?` | Next set's weight × reps (e.g., "135 lbs × 8") |
| `progress` | `Double` | 0.0–1.0 ratio of completed sets to total sets |
| `timerEndDate` | `Date?` | Timer target date (rest mode only) |

#### 1. Active Set State

Shows complete details for the current set so users can perform it without opening the app:

- **Lock screen / banner (expanded)**:
  - Top row: Exercise name (left), "Set X/Y" (right)
  - Middle row: Weight × reps (e.g., "185 lbs × 5")
  - Bottom area: "Next: [exercise name]" and progress bar
- **Dynamic Island expanded**: Same layout as lock screen
- **Dynamic Island compact**: Dumbbell icon (leading), percentage complete (trailing)
- **Dynamic Island minimal**: Dumbbell icon

#### 2. Rest Timer State

Shows a countdown timer and previews the next set so users know what's coming:

- **Lock screen / banner (expanded)**:
  - Top row: "Rest" label (left), countdown timer (right)
  - Timer color: Green when time remaining, red when timer has expired (counting up past zero)
  - Middle row: Next exercise name and its set details (weight × reps)
  - Bottom area: Progress bar
- **Dynamic Island expanded**: Same layout as lock screen
- **Dynamic Island compact**: Dumbbell icon (leading), countdown timer (trailing, green/red color)
- **Dynamic Island minimal**: Dumbbell icon

#### Timer Color Logic

The rest timer uses `timerEndDate` with SwiftUI's `Text(date, style: .timer)`. Color is determined by comparing `timerEndDate` against the current time:
- `timerEndDate > now` → green (time remaining)
- `timerEndDate <= now` → red (expired, counting up)

Note: The system `.timer` style automatically counts down to the target date, then counts up past it.

### Progress Bar

The progress bar displays the ratio of completed sets to total sets in the workout.

### Completion Message

When the workout ends, the Live Activity shows a final state before dismissing:
- **Completed**: title "Workout Complete", subtitle "Great job!"
- **Discarded**: title "Workout Discarded", subtitle "Workout not saved"
- **Paused**: no message (activity is silently ended)

### Integration Points

The service is called from the session store during these actions:
- `startWorkout` → `startWorkoutLiveActivity()`
- `resumeSession` → `startWorkoutLiveActivity()`
- `completeSet` → `updateWorkoutLiveActivity()`
- `skipSet` → `updateWorkoutLiveActivity()`
- `startRestTimer` → `updateWorkoutLiveActivity()`
- `tickRestTimer` → `updateWorkoutLiveActivity()`
- `stopRestTimer` → `updateWorkoutLiveActivity()`
- `completeWorkout` → `endWorkoutLiveActivity()`
- `cancelWorkout` → `endWorkoutLiveActivity()`
- `pauseWorkout` (dismiss active workout) → `endWorkoutLiveActivity()`

## Platform Requirements

- iOS 16.2 or later.
- ActivityKit framework (main app).
- WidgetKit framework (widget extension).
- The `LiveWorkouts` widget extension must be configured in `project.yml` and embedded in the main app.
- The widget extension must use the same `WorkoutActivityAttributes` type as the main app (shared source file included in both targets).

## Dependencies

- ActivityKit / WidgetKit (system frameworks).
- Session store for workout state.
- Shared `WorkoutActivityAttributes` type (in `Shared/WorkoutActivityAttributes.swift`).

## Error Handling

All operations silently catch and discard errors. Live Activities are an optional enhancement; failures must never affect workout functionality.

## Tests

### Singleton Enforcement
- Starting a Live Activity when one already exists must end the existing activity before creating a new one.
- After `startWorkoutLiveActivity()`, `Activity<WorkoutActivityAttributes>.activities` must contain exactly one activity.
- Calling `startWorkoutLiveActivity()` twice in rapid succession must not produce two simultaneous activities.

### Orphan Cleanup
- If orphaned activities exist (e.g., from a previous crash), `startWorkoutLiveActivity()` must end them all before creating a new activity.
- After orphan cleanup, only the newly created activity should be active.

### Pause/Resume Lifecycle
- Pausing a workout (dismissing the active workout screen) must end the Live Activity.
- Resuming a paused workout must start a new Live Activity.
- Pause → Resume must never result in duplicate activities.

### End Lifecycle
- `endWorkoutLiveActivity()` must set the internal activity reference to nil.
- After `endWorkoutLiveActivity()`, no Live Activities for this app should be active.
- Calling `endWorkoutLiveActivity()` when no activity exists is a no-op (no crash).

### Display State Content
- Active set state must include: exercise name, set number/total, formatted weight × reps, next exercise name, and progress.
- Rest timer state must include: "Rest" as exercise name, timer end date, next exercise name with its set details, and progress.
- When there is no next exercise (last exercise in workout), `nextExerciseName` and `nextSetDetail` must be nil.
- Widget UI must show green timer color when time remains and red when timer has expired.

### Race Condition Prevention
- The end-then-start sequence in `startWorkoutLiveActivity()` must be serialized — the new activity must not be requested until the previous one is confirmed ended.
