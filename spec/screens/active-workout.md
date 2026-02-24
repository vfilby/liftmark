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
| Exercise card | `exercise-card-{index}` | View |
| Exercise timer start | `exercise-timer-start-button` | Button |
| Exercise timer done | `exercise-timer-done-button` | Button |
| YouTube link | `youtube-link-{exerciseName}` | Link |

## User Interactions

### Set Completion
- **Tap current set** → no-op (already expanded)
- **Edit weight/reps fields** → updates edit values; weight propagates to remaining pending sets in same exercise
- **Complete button visibility**: The checkmark complete button is hidden when `targetTime != nil` (timed sets). Timed sets are completed exclusively via the ExerciseTimerView Done button. The Skip button remains visible for all set types.
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
- **Background resilience**: Rest timer uses wall-clock `Date()` timestamps internally (not counter-based). A `startDate` is recorded on timer start, and `remainingSeconds` is computed as `max(0, totalSeconds - elapsed)` where `elapsed = Date().timeIntervalSince(startDate)`. The 1-second Timer is kept only for UI updates. The timer responds to `scenePhase` changes to recalculate on foreground return.

### Exercise Timer (timed sets)
- ExerciseTimer component appears for sets with `targetTime`
- **Tap Start** → begins counting up toward target
- **Tap Pause** → pauses timer; elapsed time is frozen
- **Done button** → visible immediately once the timer is started (including at 0:00 elapsed), whether the timer is running or paused. Always uses success (green) styling to be visually consistent with the "Complete Set" button. Logs the current elapsed time as `actualTime`.
- **Background resilience**: Exercise timer uses wall-clock `Date()` timestamps. A `startDate` is set on start/resume. On pause, elapsed time is accumulated into `pausedElapsed` and `startDate` is cleared. Total elapsed = `pausedElapsed + (startDate != nil ? Date().timeIntervalSince(startDate!) : 0)`. The timer responds to `scenePhase` changes to recalculate on foreground return.
- **On set completion (timed sets)**:
  - If the exercise timer was started (elapsed > 0): log `actualTime` as the elapsed seconds from the timer at the moment of completion. If the timer is running, capture the current elapsed time. If the timer is paused, capture the paused elapsed time.
  - If the exercise timer was NOT started (completed via the set checkmark without starting the timer): log `actualTime` as the `targetTime` value from the plan.
  - **After logging**: the timer is dismissed and reset to 0. If there is a next timed set, a fresh timer appears ready for the next set.

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
- **Tap pencil icon** on exercise → opens Edit Exercise sheet with two tabs:
  - **Form tab** (default): structured fields for name, equipment, notes, and an editable list of sets (weight/reps/time fields, add set, delete set via swipe, reorder via drag)
  - **Markdown tab**: TextEditor with exercise in LMWF format (`## Name`, `@type: equipment`, notes, `- weight x reps`); parsed on save via MarkdownParser
- **Segmented picker** (`edit-exercise-mode-picker`) toggles between Form and Markdown tabs
- Switching tabs syncs data: Form→Markdown regenerates LMWF, Markdown→Form parses the text
- **Save** (`edit-exercise-save`) → updates exercise name/notes/equipment + applies set changes (add/update/delete)
- **Cancel** (`edit-exercise-cancel`) → dismisses without saving

| Element | testID | Type |
|---------|--------|------|
| Mode picker | `edit-exercise-mode-picker` | Picker |
| Name field | `edit-exercise-name` | TextField |
| Equipment field | `edit-exercise-equipment` | TextField |
| Notes field | `edit-exercise-notes` | TextEditor |
| Form container | `edit-exercise-form` | Form |
| Markdown editor | `edit-exercise-markdown` | TextEditor |
| Markdown view | `edit-exercise-markdown-view` | View |
| Add Set button | `edit-exercise-add-set` | Button |
| Save button | `edit-exercise-save` | Button |
| Cancel button | `edit-exercise-cancel` | Button |
| Set weight field | `edit-set-weight-{index}` | TextField |
| Set reps field | `edit-set-reps-{index}` | TextField |

### Add Exercise
- **Tap "+" in header** → opens AddExerciseModal with markdown template
- Enter exercise markdown → **Save** → parses and adds exercise to session

### Superset Display
- Superset exercises are grouped into a **single combined card** showing all children together
- The superset parent (`groupType == .superset`, empty sets) provides the card header with a purple circular icon (arrow.triangle.2.circlepath), a solid purple "SUPERSET" capsule tag, and the superset title
- Children (`parentExerciseId` pointing to parent) are grouped under the parent card
- The card subtitle lists children with their display numbers (e.g., "3. Tricep Pushdown + 4. Overhead Extension")
- Sets are displayed **interleaved round-robin**: child A set 1, child B set 1, child A set 2, child B set 2, etc.
- Each set row shows the exercise name label to identify which exercise it belongs to
- The superset parent and its children are NOT rendered as separate standalone cards
- **Exercise numbering**: Superset parents and section headers are excluded from the numbered badge index. Only exercises with sets (regular exercises and superset children) receive a sequential number. A superset with 2 children counts as 2 exercises in the numbering sequence.
- **Session creation**: When creating a session from a plan, `parentExerciseId` must be mapped from plan exercise IDs to the corresponding session exercise IDs so superset grouping is preserved

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

### Live Activities (iOS)
- **On appear**: If `liveActivitiesEnabled` setting is true and Live Activities are available, starts a Live Activity showing the current workout state (exercise name, set progress, overall progress).
- **On set completion**: Updates the Live Activity with the new current exercise/set and progress. If a rest timer starts, includes rest timer countdown in the Live Activity.
- **On set skip**: Updates the Live Activity with the new current exercise/set and progress.
- **On finish**: Ends the Live Activity with a "Workout Complete" message.
- **On discard**: Ends the Live Activity with a "Workout Discarded" message.
- All Live Activity calls are guarded behind `settingsStore.settings?.liveActivitiesEnabled == true` and `LiveActivityService.shared.isAvailable()`.

### YouTube Links
- **Tap external link icon** (`youtube-link-{exerciseName}`) next to exercise name → opens YouTube search

## Navigation
- Back (via Pause) → previous screen
- `/workout/summary` — after finishing workout

## Error/Empty States
- **No active session**: LoadingView with "Loading workout..."
- **Store error**: Alert dialog with error message

## SetRow Component
Renders individual sets with multiple visual states:
- **Pending**: Shows target weight/reps (e.g., "135 lbs x 5"), neutral styling
- **Current (active form)**: Blue highlight, weight/reps input fields pre-filled with target values, Skip and Complete buttons. Uses consistent padding (spacingXS vertical, spacingSM horizontal) matching other set rows. Larger fonts (.title3.monospacedDigit() for inputs) and 44pt minimum tap targets. Layout is two rows: top row has inputs + skip button, bottom row has a full-width "Complete Set" button to separate it from skip and provide a large tap target.
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
