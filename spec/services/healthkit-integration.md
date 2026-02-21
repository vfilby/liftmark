# HealthKit Integration Service Specification

## Purpose

Save completed workouts to Apple Health as strength training workout samples. This provides users with unified health data tracking by bridging LiftMark workout sessions into the iOS Health ecosystem.

## Public API

### `isHealthKitAvailable(): boolean`

Check if HealthKit is available on the current device. Returns `false` on non-iOS platforms.

### `requestHealthKitAuthorization(): Promise<boolean>`

Request write permission for workout data from the user. Returns `true` if authorization is granted.

### `isHealthKitAuthorized(): Promise<boolean>`

Check the current authorization status for writing workout data.

### `saveWorkoutToHealthKit(session): Promise<{success, healthKitId?, error?}>`

Save a completed workout session to Apple Health. Returns an object indicating success or failure, with an optional HealthKit identifier on success or error details on failure.

### `calculateWorkoutVolume(session): number`

Calculate total workout volume as the sum of (weight x reps) for all completed sets in the session.

## Behavior Rules

- Only available on iOS devices.
- The native HealthKit module is loaded lazily to avoid crashes when running on platforms where it is not available.
- Workouts are saved with activity type `WorkoutActivityType.traditionalStrengthTraining`.
- Saved workout metadata includes:
  - `HKExternalUUID`: the LiftMark session ID, enabling deduplication.
  - `TotalVolumeLbs`: total volume in pounds, included only when greater than 0.
- Workout duration is derived from `session.startTime` and `session.endTime`.
- This service is called during `completeWorkout()` in the session store. Failure to save to HealthKit does not block workout completion.

## Authorization Flow

HealthKit authorization is a multi-step process with OS-level permission gates. The app must handle all states correctly:

### Initial Authorization Request

When the user first enables the HealthKit toggle:
1. Call `requestHealthKitAuthorization()` — this triggers the iOS system permission dialog
2. The system dialog shows which data types the app wants to write (workout samples)
3. If the user grants permission → toggle turns on, setting is persisted, workouts will be saved to Health going forward
4. If the user denies permission → toggle stays off, app shows an explanatory message

### Ongoing Authorization Checks

Each time the Settings screen appears, the app must check the current authorization status via `isHealthKitAuthorized()`:
- **Authorized**: Toggle is on and enabled
- **Not determined**: Toggle is off and enabled (tapping will trigger the authorization request)
- **Denied**: Toggle is off and **disabled** (grayed out). Show helper text explaining how to re-enable in system Settings (see Settings Screen spec for UI details)

### Automatic Workout Saving

When HealthKit is enabled and authorized:
- `completeWorkout()` in the session store automatically calls `saveWorkoutToHealthKit(session)`
- The workout appears in Apple Health as a strength training workout
- If the save fails, the workout is still completed normally in LiftMark — the error is logged but not shown to the user

## Platform Requirements

- iOS only.
- Requires `@kingstinct/react-native-healthkit` native module.
- Requires a dev build (not compatible with Expo Go).

## Dependencies

- `@kingstinct/react-native-healthkit` native module.
- Session data from the session store.

## Error Handling

- All public methods return structured results; they never throw exceptions.
- `saveWorkoutToHealthKit` returns `{success: false, error: string}` on any failure.
- Errors are logged but do not propagate to the caller as exceptions.
