# Active Workout Screen

## Purpose
Primary workout execution screen. Displays all exercises and sets for the active session, allows completing/skipping sets with weight/rep input, manages rest timers and exercise timers, and supports editing exercises and adding new ones mid-workout.

## Route
`/workout/active` — Navigated to after starting or resuming a workout.

## Layout
- **Header**: Custom header with Pause button (left), workout name (center), Add Exercise button + Finish button (right)
- **Progress bar**: Below header showing completed/total sets
- **Body**: ScrollView of exercise sections, each containing SetRow components
- **Modals**: EditExerciseModal, AddExerciseModal (overlaid)

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `active-workout-screen` | View |
| Header | `active-workout-header` | View |
| Pause button | `active-workout-pause-button` | TouchableOpacity |
| Add exercise button | `active-workout-add-exercise-button` | TouchableOpacity |
| Finish button | `active-workout-finish-button` | TouchableOpacity |
| Progress section | `active-workout-progress` | View |
| Scroll content | `active-workout-scroll` | ScrollView |

## Data Dependencies
- **sessionStore**: `activeSession`, `restTimer`, `exerciseTimer`, `isLoading`, `error`, `resumeSession`, `pauseSession`, `completeWorkout`, `cancelWorkout`, `completeSet`, `skipSet`, `startRestTimer`, `stopRestTimer`, `tickRestTimer`, `startExerciseTimer`, `stopExerciseTimer`, `clearExerciseTimer`, `tickExerciseTimer`, `getProgress`, `getTrackableExercises`, `updateExercise`, `addExercise`, `addSetToExercise`, `deleteSetFromExercise`, `updateSetTarget`
- **settingsStore**: `settings` (reads `keepScreenAwake`, `autoStartRestTimer`)
- **audioService**: `preloadSounds()`, `unloadSounds()`, `playTick()`, `playComplete()`
- **expo-keep-awake**: `useKeepAwake()` (conditional on settings)

## User Interactions

### Set Completion
- **Tap current set** → no-op (already expanded)
- **Edit weight/reps fields** → updates edit values; weight propagates to remaining pending sets in same exercise
- **Tap "Complete"** → records actual values from input fields, advances to next set
  - **Critical**: The actual values saved MUST be whatever the user has entered in the input fields at the time of tapping "Complete". If the user edited weight from 225 to 230, save 230. If the user edited reps from 5 to 6, save 6. The input fields are the source of truth, not the original target values.
  - If rest seconds defined and auto-start enabled: starts rest timer automatically
  - If rest seconds defined and auto-start disabled: shows Start/Skip rest suggestion
  - If all sets complete: triggers Finish flow
- **Tap "Skip"** → marks set as skipped, advances

### Set Editing (completed/skipped sets)
- **Tap completed/skipped set** → opens inline edit form
- **Tap "Update"** → saves changes to completed set
- **Tap again** → closes edit form

### Rest Timer
- After set completion with rest seconds: rest timer or suggestion appears inline after the completed set
- **Tap "Start"** → starts countdown timer with audio ticks at 3/2/1s
- **Tap "Skip"** → dismisses rest suggestion
- **Tap "Stop"** → stops running timer
- Timer completion plays completion sound, clears "Up Next" preview
- **Auto-dismiss on next set**: If a rest timer is currently running and the user completes or skips the next set before the timer finishes, the running rest timer is dismissed. If the newly completed set also has `restSeconds` defined, a new rest timer starts for that set's rest duration. The user's action of completing the next set implicitly signals they are done resting.

### Exercise Timer (timed sets)
- ExerciseTimer component appears for sets with `targetTime`
- **Tap Start** → begins counting up toward target
- **Tap Stop** → stops timer; elapsed time used as actual time on Complete
- **On set completion (timed sets)**:
  - If the exercise timer was started: log `actualTime` as the elapsed seconds from the timer at the moment of completion (do not reset before capturing)
  - If the exercise timer was NOT started: log `actualTime` as the `targetTime` value

### Plate Calculator
- For barbell exercises: shows plate breakdown in blue info box above inputs

### Header Actions
- **Tap "Pause"** → confirmation alert → saves progress → navigates back
- **Tap "+" (Add Exercise)** → opens AddExerciseModal
- **Tap "Finish"** → behavior depends on workout state:
  - All complete → directly completes → navigates to `/workout/summary`
  - Incomplete sets remain → 3-option alert (Continue / Finish Anyway / Discard)
    - Finish Anyway → completes workout → navigates to `/workout/summary`
    - Discard → cancels workout → navigates back
  - **Majority skipped** → if >50% of total sets are skipped and <50% are completed, show a "Discard Workout?" confirmation with options:
    - "Discard" (destructive) → cancels session without logging, navigates back
    - "Log Anyway" → completes workout normally → navigates to `/workout/summary`
    - "Cancel" → returns to active workout

### Exercise Editing
- **Tap pencil icon** on exercise → opens EditExerciseModal
- Modal allows: rename exercise, change equipment, edit notes, add/delete/modify sets
- **Save** → updates exercise + set targets in session store

### Add Exercise
- **Tap "+" in header** → opens AddExerciseModal with markdown template
- Enter exercise markdown → **Save** → parses and adds exercise to session

### Exercise Collapse Behavior
- Completed exercises (all sets completed or skipped) automatically collapse to a compact summary showing: exercise name, completion status badge, and a brief summary (e.g., "3/3 sets completed")
- Collapsed exercises can be tapped to expand and view full set detail
- When an exercise's last set is completed, it collapses and scroll focus moves to the next exercise
- The currently active exercise (containing the current pending set) is always expanded
- User can manually expand/collapse any exercise

| Element | testID | Type |
|---------|--------|------|
| Collapsed exercise summary | `exercise-collapsed-{exerciseId}` | TouchableOpacity |
| Collapse/expand toggle | `exercise-toggle-{exerciseId}` | TouchableOpacity |

### YouTube Links
- **Tap external link icon** next to exercise name → opens YouTube search

## Navigation
- Back (via Pause) → previous screen
- `/workout/summary` — after finishing workout

## State
- `currentSetId` — first pending set (always shown expanded)
- `editingSetId` — which non-current set has edit form open
- `editValues` — map of set ID to { weight, reps, time } strings
- `suggestedRestSeconds` — rest time suggestion (before timer starts)
- `showUpNextPreview` — shows next set as compact "UP NEXT" preview
- `lastCompletedSetId` — positions rest timer after this set
- `editingExerciseId` / `editExerciseValues` / `editingExerciseSets` — exercise editing state
- `showAddExerciseModal` / `newExerciseMarkdown` — add exercise state
- `workoutSections` — memoized grouping of exercises into sections/supersets

## Error/Empty States
- **No active session**: LoadingView with "Loading workout..."
- **Store error**: Alert dialog with error message

## SetRow Component
Renders individual sets with multiple visual states:
- **Pending**: Shows target weight/reps (e.g., "135 lbs x 5"), neutral styling
- **Current (active form)**: Blue border, weight/reps input fields pre-filled with target values, Complete/Skip buttons
- **Up Next preview**: Compact single-line with "UP NEXT" label
- **Completed**: Green background, shows actual values (weight + reps), "Tap to edit"
- **Skipped**: Yellow/warning background, "Skipped", "Tap to edit"
- **Editing (completed/skipped)**: Expanded form with Update button

### Set Data Display Requirements

**Critical**: Every set row MUST display the weight when it exists in the set data (`targetWeight` for pending/current sets, `actualWeight` for completed sets). A set row that shows only reps (e.g., "x 5") when weight data exists (e.g., 135 lbs) is a bug. The weight is the primary data point for strength training and must always be visible.

Set rows must display contextually appropriate fields based on exercise type:
- **Weighted sets** (`targetWeight` exists): show weight field with unit (lbs/kg) and reps field
- **Timed sets** (`targetTime` exists, no `targetWeight`): show time field labeled as "time", not "weight"
- **Bodyweight rep sets** (no `targetWeight`, `targetReps` exists): show reps only, no weight field

| Set State | Weight Display | Reps Display | Time Display |
|-----------|---------------|-------------|-------------|
| Pending | Target weight + unit (e.g., "135 lbs") | Target reps (e.g., "x 5") | Target time (e.g., "60s") |
| Current | Pre-filled in weight input field | Pre-filled in reps input field | Pre-filled in time input field |
| Completed | Actual weight + unit | Actual reps | Actual time |
| Skipped | "Skipped" label (no weight/reps) | — | — |

### Rest Timer inline
- Shows after the last completed set when rest is needed
- Running timer: circular countdown display with Stop button
- Suggestion: "Rest: Xs" with Start/Skip buttons

### Rest Placeholder
- Between pending sets that have rest seconds: faint "--- Rest Xs ---" divider
