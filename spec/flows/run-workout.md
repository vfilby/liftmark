# Run Workout Flow

## Preconditions

- At least one workout plan exists in the database.
- No other workout session is currently active (only one active session allowed at a time).

## Flow Steps

1. User taps a workout card on the Home screen, navigating to the workout detail screen.
2. User taps the **Start Workout** button.
3. `sessionStore.startWorkout(plan)` creates a new session from the plan via `createSessionFromPlan()`.
4. The system checks for an existing active session. If one exists, an error is thrown.
5. **Navigation to Active Workout**: The app MUST navigate to the active workout screen (`/workout/active`). This is a critical navigation transition — the user must see the active workout UI after tapping "Start Workout". If the session is created but the screen does not change, the workout is effectively unusable.
6. The active workout screen is displayed showing:
   - Current exercise name.
   - Set information with **weight AND reps** (e.g., "135 lbs x 5"). Weight must not be omitted.
   - Progress indicator across all exercises and sets.
6. User works through sets using the following actions:
   - **completeSet()**: Saves actual values from the input fields for the set, marks it as completed, and auto-advances to the next set. As exercises are completed, they collapse to a compact summary. The active exercise remains expanded. Users can tap to expand collapsed exercises.
   - **skipSet()**: Marks the set as skipped and auto-advances to the next set.
7. Navigation between sets and exercises:
   - `goToNextSet()` / `goToPreviousSet()` for sequential navigation.
   - `goToExercise()` for jumping to a specific exercise.
8. **Rest timer**: `startRestTimer()` begins after set completion, counts down to zero, and auto-stops. If a rest timer is running when the user completes the next set, the timer is dismissed. If the newly completed set has rest seconds defined, a new rest timer starts for that set's rest duration.
9. **Exercise timer**: For time-based sets, tracks elapsed time versus target duration. When completing a timed set, if the exercise timer was started, the elapsed time is recorded as `actualTime`. If the exercise timer was not started, `targetTime` is used as the default `actualTime`.
10. User taps the **Finish** button to end the workout.
    - If incomplete sets remain, a "Finish Anyway" confirmation dialog is shown.
    - If the majority of sets were skipped (>50% skipped out of total), the Finish flow shows a "Discard Workout?" dialog with options: "Discard" (destructive, cancels session without logging), "Log Anyway" (completes normally), "Cancel" (returns to workout).
11. `completeWorkout()` executes:
    - Saves `endTime`, `duration`, and sets `status='completed'`.
    - Saves the workout to HealthKit if the integration is enabled.
    - Ends the Live Activity notification.
12. The summary screen displays workout stats. User taps **Done** to return to the Home screen.

## State Management

The Zustand `sessionStore` tracks:

- `activeSession`: The current workout session object.
- `currentExerciseIndex`: Index of the active exercise.
- `currentSetIndex`: Index of the active set within the current exercise.
- `restTimer`: Countdown state for rest periods.
- `exerciseTimer`: Elapsed time state for time-based sets.

## Session Lifecycle

```
in_progress → completed
in_progress → canceled
```

## Set Actions During Workout

| Action | Description |
|---|---|
| `updateSetValues()` | Edit weight/reps for a set before completing it |
| `addSetToExercise()` | Add extra sets to the current exercise |
| `deleteSetFromExercise()` | Remove a set from the current exercise |
| `updateSetTarget()` | Change target weight/reps values |
| `updateExercise()` | Change exercise name, equipment, or notes |
| `addExercise()` | Add a new exercise to the active workout |

## Variations

- **Time-based sets**: The exercise timer tracks elapsed time against a target rather than counting reps. On completion, `actualTime` is set to the timer's elapsed seconds if started, or `targetTime` if not started.
- **All sets completed**: The Finish button proceeds without confirmation.
- **Partially completed workout**: The "Finish Anyway" confirmation is shown listing incomplete sets.
- **Majority skipped workout**: If >50% of sets are skipped, a "Discard Workout?" dialog offers to cancel without logging.
- **Cancel workout**: The session status is set to `canceled` instead of `completed`.
- **Adding exercises mid-workout**: New exercises are appended to the session via `addExercise()`.
- **Exercise collapse**: Completed exercises automatically collapse to a compact summary; users can tap to expand.

## Error Handling

| Scenario | Behavior |
|---|---|
| Active session already exists | Error thrown when attempting to start a new workout |
| Database save failure on set completion | Error surfaced to user |
| HealthKit save failure | Workout still completes; HealthKit error is logged but does not block |
| Live Activity end failure | Workout still completes; error is logged |

## Postconditions

- The completed session is stored in the SQLite database with all set data.
- The session is visible in the History tab.
- If HealthKit integration is enabled, the workout is saved to Apple Health.
- The Live Activity notification is ended.
- The `activeSession` in `sessionStore` is cleared.
