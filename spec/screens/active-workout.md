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
- **Tap "Complete"** → records actual values, advances to next set
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

### Exercise Timer (timed sets)
- ExerciseTimer component appears for sets with `targetTime`
- **Tap Start** → begins counting up toward target
- **Tap Stop** → stops timer; elapsed time used as actual time on Complete

### Plate Calculator
- For barbell exercises: shows plate breakdown in blue info box above inputs

### Header Actions
- **Tap "Pause"** → confirmation alert → saves progress → navigates back
- **Tap "+" (Add Exercise)** → opens AddExerciseModal
- **Tap "Finish"** → if remaining sets: 3-option alert (Continue / Finish Anyway / Discard)
  - Finish Anyway → completes workout → navigates to `/workout/summary`
  - Discard → cancels workout → navigates back
  - All complete → directly completes → navigates to `/workout/summary`

### Exercise Editing
- **Tap pencil icon** on exercise → opens EditExerciseModal
- Modal allows: rename exercise, change equipment, edit notes, add/delete/modify sets
- **Save** → updates exercise + set targets in session store

### Add Exercise
- **Tap "+" in header** → opens AddExerciseModal with markdown template
- Enter exercise markdown → **Save** → parses and adds exercise to session

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

| Set State | Weight Display | Reps Display |
|-----------|---------------|-------------|
| Pending | Target weight + unit (e.g., "135 lbs") | Target reps (e.g., "x 5") |
| Current | Pre-filled in weight input field | Pre-filled in reps input field |
| Completed | Actual weight + unit | Actual reps |
| Skipped | "Skipped" label (no weight/reps) | — |

### Rest Timer inline
- Shows after the last completed set when rest is needed
- Running timer: circular countdown display with Stop button
- Suggestion: "Rest: Xs" with Start/Skip buttons

### Rest Placeholder
- Between pending sets that have rest seconds: faint "--- Rest Xs ---" divider
