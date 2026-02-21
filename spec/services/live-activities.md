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
- Requires a dev build (not compatible with Expo Go).
- The `expo-live-activity` module is loaded lazily to avoid crashes when not available.

### Activity Lifecycle

- The service tracks the current activity ID internally.
- Before starting a new activity, any existing activity is ended first.
- Activities are ended when the workout completes or is cancelled.

### Display States

The Live Activity has two visual states:

1. **Active set**: Shows the exercise name, "Set X/Y", weight and reps, and a progress bar.
2. **Rest timer**: Shows "Rest", a preview of the next exercise, and a countdown timer.

### Progress Bar

The progress bar displays the ratio of completed sets to total sets in the workout.

### Completion Message

When the workout ends, the completion message format is: `"{sets} sets - {minutes} min"`.

### Integration Points

The service is called from the session store during these actions:
- `startWorkout`
- `resumeSession`
- `completeSet`
- `skipSet`
- `startRestTimer`
- `tickRestTimer`
- `stopRestTimer`
- `completeWorkout`
- `cancelWorkout`

## Platform Requirements

- iOS 16.2 or later.
- `expo-live-activity` native module.
- Dev build required (not compatible with Expo Go).

## Dependencies

- `expo-live-activity` native module.
- Session store for workout state.

## Error Handling

All operations silently catch and discard errors. Live Activities are an optional enhancement; failures must never affect workout functionality.
