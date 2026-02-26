# Fix 9 Issues — Implementation Plan

## How to Resume
Tell Claude: "Implement the plan in `prompts/fix-9-issues-plan.md` using a team of 4 parallel agents."

## Overview
8 issues (issue 4 was not a defect) organized into 4 parallel workstreams. Each follows `prompts/fix-issue.md`: spec → E2E tests → code → unit tests → E2E verification.

## Verification Commands
```bash
# Unit tests
cd /Users/vfilby/Projects/LiftMark/swift-ios && xcodebuild test -scheme LiftMark -project LiftMark.xcodeproj -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.2' -only-testing:LiftMarkTests 2>&1 | tail -30

# E2E tests
cd /Users/vfilby/Projects/LiftMark/swift-ios && xcodebuild test -scheme LiftMark -project LiftMark.xcodeproj -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.2' -only-testing:LiftMarkUITests 2>&1 | tail -30
```

---

## Workstream A: Active Workout UX (Issues 1, 2, 3, 9)
**Agent name:** ux-agent
**Constraint:** Sequential — all touch ActiveWorkoutView.swift and SetRowView.swift

### Issue 1: Remove duplicate complete buttons for timed exercises
**Files:** `SetRowView.swift`, `spec/screens/active-workout.md`, `e2e-spec/scenarios/ux-improvements.yaml`
**Problem:** Timed exercises show both a checkmark (SetRowView) AND a Done button (ExerciseTimerView). Only timer Done should complete timed sets.
**Fix:** In `SetRowView.swift` `currentSetContent`, wrap the checkmark Button in `if set.targetTime == nil { ... }`. Skip button stays visible for all sets.
**Spec:** Clarify that timed sets use ExerciseTimerView as sole completion; SetRowView checkmark hidden when `targetTime != nil`.

### Issue 2: Expand current set UI for more room
**Files:** `SetRowView.swift`, `spec/screens/active-workout.md`
**Problem:** Current set row is cramped — small tap targets.
**Fix:** When `isCurrent == true`: increase `.padding(.vertical, ...)` from `spacingXS` to `spacingSM` or `spacingMD`, use `.font(.title3.monospacedDigit())` for inputs, ensure checkmark/skip buttons are at least 44×44pt (`.frame(width: 44, height: 44)`).
**Spec:** Add requirement for 44pt minimum tap targets and visual distinction for active set.

### Issue 3: Replace modal EditSetSheet with inline editing
**Files:** `SetRowView.swift`, `ActiveWorkoutView.swift`, `spec/screens/active-workout.md`
**Problem:** Tapping completed/skipped set opens modal sheet. Should edit inline.
**Fix:**
- `SetRowView.swift`: Add `let onSave: (Double?, Int?) -> Void` parameter. When `onEdit()` fires, set `isEditing = true` showing inline TextFields + Update/Cancel. Update button calls `onSave(weight, reps)` then sets `isEditing = false`.
- `ActiveWorkoutView.swift`: Remove `EditSetSheet` struct entirely. Remove `showEditSet` and `editingSetInfo` @State vars. Remove `.sheet(isPresented: $showEditSet)` modifier. In `ActiveExerciseCard`, change `onEditSet` to be a no-op or toggle, and add `onSaveSet: (Int, Double?, Int?) -> Void` callback. Pass `onSave` to SetRowView.
- Wire `onSaveSet` in ActiveWorkoutView to call `sessionStore.completeSet(...)` with the edited values.

### Issue 9: Timers work in background (wall-clock timestamps)
**Files:** `RestTimerView.swift` (contains both RestTimerView and ExerciseTimerView), `spec/screens/active-workout.md`
**Problem:** `Timer.scheduledTimer` stops when app backgrounded.
**Fix for RestTimerView:**
- Replace `@State private var remainingSeconds: Int` with `@State private var startDate: Date = Date()`
- Keep the 1-second Timer for UI updates, but compute: `let elapsed = Int(Date().timeIntervalSince(startDate))` and `remainingSeconds = max(0, totalSeconds - elapsed)`
- Add `@Environment(\.scenePhase) var scenePhase` and `.onChange(of: scenePhase) { if scenePhase == .active { /* timer tick recalculates automatically */ } }`

**Fix for ExerciseTimerView:**
- Replace `@State private var elapsedSeconds: Int = 0` with `@State private var startDate: Date?` and `@State private var pausedElapsed: TimeInterval = 0`
- When running: `elapsed = Date().timeIntervalSince(startDate!) + pausedElapsed`
- On pause: `pausedElapsed += Date().timeIntervalSince(startDate!); startDate = nil`
- On resume: `startDate = Date()` (pausedElapsed already accumulated)
- On stop/reset: `startDate = nil; pausedElapsed = 0`
- Add scenePhase handling same as RestTimerView

---

## Workstream B: Exercise Editing & YouTube (Issues 5, 6)
**Agent name:** edit-agent
**Constraint:** Issue 5 before 6

### Issue 5: YouTube links in specs and tests
**Files:** `WorkoutDetailView.swift`, `ActiveWorkoutView.swift`, `spec/screens/workout-detail.md`, `e2e-spec/scenarios/ux-improvements.yaml`
**Problem:** YouTube links exist in code but not in spec or tests.
**Fix:**
- Add `.accessibilityIdentifier("youtube-link-\(exercise.exerciseName)")` to the YouTube `Link` in `WorkoutDetailView.swift` (~line 230) and `ActiveWorkoutView.swift` (`ActiveExerciseCard` ~line 408).
- Create/update `spec/screens/workout-detail.md` with YouTube link requirement.
- Add E2E test asserting `youtube-link-*` identifier exists on workout detail screen.

### Issue 6: Edit exercise — structured form + markdown toggle
**Files:** `ActiveWorkoutView.swift`, `MarkdownParser.swift`, `SessionRepository.swift`, `spec/screens/active-workout.md`
**Problem:** EditExerciseSheet only edits name/equipment/notes.
**Fix:** Replace `EditExerciseSheet` (lines 529-602 of ActiveWorkoutView.swift) with new `EditExerciseView`:

**Structured tab:**
- Name TextField, equipment TextField, notes TextEditor
- List of sets: each row has weight/reps/time/rest/RPE editable fields
- Add Set button, Delete Set (swipe or button), Reorder via `.onMove`

**Markdown tab:**
- TextEditor pre-filled with LMWF markdown for the exercise
- Generate LMWF: `## {name} [{equipment}]\n> {notes}\n- {weight} x {reps}` etc.
- On save: parse with `MarkdownParser.parseWorkout()` wrapping in a dummy `# Workout\n{exerciseMarkdown}`

**Toggle:** `Picker("Mode", selection: $editMode) { Text("Form").tag(0); Text("Markdown").tag(1) }.pickerStyle(.segmented)`

**SessionRepository:** May need `replaceExerciseSets(exerciseId:, newSets:)` — check if SessionStore already has methods to update sets in bulk. The store has `updateExercise` and `updateSetTarget` — might be sufficient if called per-set.

---

## Workstream C: Live Activities (Issue 7)
**Agent name:** live-agent

### Issue 7: Wire up Live Activities
**Files:** `ActiveWorkoutView.swift`, `LiveActivityService.swift`, `spec/screens/active-workout.md`
**Problem:** LiveActivityService is fully implemented but never called.
**Fix:** Add a helper method to ActiveWorkoutView and call it from key points:

```swift
// Add to ActiveWorkoutView
private func updateLiveActivity(restTimer: (remainingSeconds: Int, nextExercise: SessionExercise?)? = nil) {
    guard settingsStore.settings?.liveActivitiesEnabled == true,
          LiveActivityService.shared.isAvailable(),
          let session else { return }

    let currentExercise = session.exercises.first { ex in ex.sets.contains { $0.status == .pending } }
    let currentSetIdx = currentExercise?.sets.firstIndex { $0.status == .pending } ?? 0

    LiveActivityService.shared.updateWorkoutActivity(
        session: session,
        exercise: currentExercise,
        setIndex: currentSetIdx,
        progress: (completed: completedSets, total: totalSets),
        restTimer: restTimer
    )
}
```

**Call sites:**
- `.onAppear` (after nil check): `startWorkoutActivity(...)`
- `completeSet()`: after `sessionStore.completeSet(...)`, call `updateLiveActivity(restTimer:)` if rest timer started, else `updateLiveActivity()`
- `skipSet()`: after `sessionStore.skipSet(...)`, call `updateLiveActivity()`
- Finish/Discard: before `navigateToSummary = true` or `dismiss()`, call `LiveActivityService.shared.endWorkoutActivity(message:)`

**IMPORTANT:** Minimize changes to existing code structure — other agents modify this file too.

---

## Workstream D: Database Import/Export (Issue 8)
**Agent name:** backup-agent

### Issue 8: Database import/export functional and tested
**Files:** `SettingsView.swift`, `DatabaseBackupService.swift`, `DatabaseManager.swift`, `spec/screens/settings.md` (create), unit tests
**Problem:** Export/import buttons in Settings do nothing.

**Fix in SettingsView.swift:**
- Add state: `@State private var exportURL: URL?`, `@State private var showExportError = false`, `@State private var showImportConfirm = false`, `@State private var importSourceURL: URL?`, `@State private var showImportResult = false`, `@State private var importResultMessage = ""`
- Export button: set `showExportConfirmation = true` → in handler, call `DatabaseBackupService.shared.exportDatabase()` to get URL, set `exportURL`, present via `.sheet` with `ShareLink` or `UIActivityViewController`
- Import button: attach `.fileImporter(isPresented: $showImportSheet, allowedContentTypes: [.database, .data])` → on result, store URL → show confirmation alert → on confirm, call validate then import → show result alert

**Fix in DatabaseBackupService.swift:**
- Read file first to understand API. Fix any `Thread.sleep` → use `Task { ... }` or `DispatchQueue.global().async`
- Ensure export returns a URL to the exported file
- Ensure import validates then replaces

**Fix in DatabaseManager.swift:**
- Verify close()/reopen() exist and work. If not, add them.

**Unit tests** in `swift-ios/LiftMarkTests/DatabaseBackupServiceTests.swift`:
- Test export produces a file
- Test validate accepts good .db, rejects bad file
- Test import replaces data

**E2E:** Test navigating to Settings and tapping Export button without crash.

---

## Team Structure

| Agent | Workstream | Tasks | Key Files |
|-------|-----------|-------|-----------|
| ux-agent | A | Issues 1→2→3→9 (sequential) | SetRowView, RestTimerView, ActiveWorkoutView |
| edit-agent | B | Issues 5→6 (sequential) | WorkoutDetailView, ActiveWorkoutView, MarkdownParser |
| live-agent | C | Issue 7 | ActiveWorkoutView, LiveActivityService |
| backup-agent | D | Issue 8 | SettingsView, DatabaseBackupService, DatabaseManager |

## Conflict Risk
- ActiveWorkoutView.swift is touched by ux-agent (issues 1,2,3), edit-agent (issue 6), and live-agent (issue 7).
- ux-agent makes structural changes (removing EditSetSheet). edit-agent replaces EditExerciseSheet. live-agent adds new calls.
- Mitigation: live-agent should only ADD a helper method and call sites, not restructure. edit-agent's EditExerciseSheet replacement is in a different section than ux-agent's EditSetSheet removal.
