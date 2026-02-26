# HealthKit Integration Service Specification

## Purpose

Save completed workouts to Apple Health as strength training workout samples. This provides users with unified health data tracking by bridging LiftMark workout sessions into the iOS Health ecosystem.

## Public API

### `isHealthKitAvailable(): boolean`

Check if HealthKit is available on the current device. Returns `false` on non-iOS platforms or devices without Health support.

### `requestAuthorization(): boolean`

Request write permission for workout data from the user. Returns `true` if authorization is granted.

### `isAuthorized(): boolean`

Check the current authorization status for writing workout data.

### `saveWorkout(session): {success, healthKitId?, error?}`

Save a completed workout session to Apple Health. Returns an object indicating success or failure, with an optional HealthKit identifier on success or error details on failure.

### `calculateWorkoutVolume(session): number`

Calculate total workout volume as the sum of (weight × reps) for all completed sets in the session.

## Behavior Rules

- Only available on iOS devices with HealthKit support.
- HealthKit must be loaded safely — the app must not crash on platforms or devices where HealthKit is unavailable.
- Workouts are saved with activity type `traditionalStrengthTraining`.
- Saved workout metadata includes:
  - `HKExternalUUID`: the LiftMark session ID, enabling deduplication across saves.
  - `TotalVolumeLbs`: total volume in pounds, included only when greater than 0.
- Workout duration is derived from `session.startTime` and `session.endTime`.
- Saving to HealthKit is triggered after workout completion. Failure does **not** block workout completion or show an error to the user — failures are logged silently.

## Authorization Flow

HealthKit authorization is a multi-step process with OS-level permission gates. The app must handle all states correctly.

### Initial Authorization Request

When the user first enables the HealthKit toggle in Settings:
1. Request HealthKit write authorization — this triggers the iOS system permission dialog
2. The system dialog shows which data types the app wants to write (workout samples)
3. If the user grants permission → toggle turns on, setting is persisted, workouts will be saved to Health going forward
4. If the user denies permission → toggle stays off, app shows an explanatory message

### Ongoing Authorization Checks

Each time the Settings screen appears, the app must check the current authorization status:
- **Authorized**: Toggle is on and enabled
- **Not determined**: Toggle is off and enabled (tapping will trigger the authorization request)
- **Denied**: Toggle is off and **disabled** (grayed out). Show helper text explaining how to re-enable in system Settings, plus a button to open the system Health settings (see Settings Screen spec for UI details)

### Automatic Workout Saving

When HealthKit is enabled and authorized:
- Workout completion triggers a HealthKit save with the completed session data
- The workout appears in Apple Health as a strength training workout
- If the save fails, the workout is still completed normally in LiftMark — the error is logged but not shown to the user

## iOS Requirements

### Entitlements
- `com.apple.developer.healthkit: true`
- `com.apple.developer.healthkit.access: ["health-records"]`
- `com.apple.developer.healthkit.background-delivery: true`

### Info.plist Keys
- `NSHealthShareUsageDescription`: User-facing explanation of why the app reads health data (e.g., "LiftMark reads your workout history to track progress.")
- `NSHealthUpdateUsageDescription`: User-facing explanation of why the app writes health data (e.g., "LiftMark saves your completed workouts to Apple Health.")

## Dependencies

- iOS HealthKit framework.
- Completed workout session data (exercises, sets, timestamps).
- User setting: `healthKitEnabled` (boolean, default `false`).

## Error Handling

- All public methods return structured results; they never throw unhandled exceptions.
- `saveWorkout` returns `{success: false, error: string}` on any failure.
- Errors are logged internally but do not propagate to the UI or block other operations.

## Testing & Validation

### Automated Tests (Simulator-Safe)

These tests run in CI on the iOS simulator where HealthKit is not available. They validate all logic that does not require a real HealthKit store.

#### Volume Calculation
- Multiple completed sets — verify correct sum of (weight × reps)
- Skipped sets are excluded from volume
- Pending sets are excluded from volume
- Failed sets are excluded from volume
- Bodyweight exercises (no weight) produce zero volume
- Empty session produces zero volume
- Sets with weight but no reps produce zero volume
- Volume accumulates correctly across multiple exercises
- Mixed status sets — only completed sets contribute

#### Graceful Degradation (HealthKit Unavailable)
- Availability check returns `false` without crashing
- Authorization check returns `false` when HealthKit is unavailable
- Authorization request returns `false` when HealthKit is unavailable
- Save returns `{success: false}` with a descriptive error message when HealthKit is unavailable — does not crash or throw

### Device-Only Validation (Manual)

These scenarios cannot be automated in the simulator and must be tested on a physical device with a provisioning profile that includes the HealthKit entitlement.

1. **First-time authorization**: Enable the toggle in Settings → iOS system dialog appears → grant → toggle stays on, status shows "Connected"
2. **Deny authorization**: Enable toggle → deny in system dialog → toggle stays off, status shows denied state
3. **Revoke in system Settings**: After granting, go to iOS Settings > Health > Data Access > LiftMark → revoke → return to app → toggle is disabled/grayed, "Open Health Settings" button appears
4. **Workout save**: With HealthKit enabled, complete a workout → open Apple Health → verify the strength training workout appears with correct duration and metadata
5. **Deduplication**: Complete the same workout flow twice → only one entry should appear in Health (matched by `HKExternalUUID`)
6. **Failure does not block**: Simulate HealthKit failure (e.g., revoke permission mid-workout) → workout still completes normally in LiftMark
