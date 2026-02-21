# Accessibility / Test IDs

This document is the **contract** between the LiftMark specification and E2E tests. Every `testID` used in the codebase is listed here, organized by screen. E2E tests reference these IDs via `by.id()` to locate elements.

Implementations on any platform must attach these identifiers to the corresponding UI elements to maintain E2E test compatibility.

---

## Tab Bar

| ID | Element Type | Purpose |
|----|-------------|---------|
| `tab-home` | Pressable | Home tab button |
| `tab-workouts` | Pressable | Plans tab button |
| `tab-history` | Pressable | Workouts (history) tab button |
| `tab-settings` | Pressable | Settings tab button |

---

## Home Screen (`(tabs)/index`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `home-screen` | View | Root container for the home screen |
| `resume-workout-banner` | TouchableOpacity | Banner to resume an active workout session |
| `max-lift-tile-{index}` | TouchableOpacity | Max lift display tile (0-3 by default). Long-press to customize. |
| `recent-plans` | View | Container for the recent plans section |
| `empty-state` | View | Empty state when no plans exist |
| `workout-card-{plan.id}` | TouchableOpacity | A recent plan card (navigates to workout detail) |
| `button-import-workout` | TouchableOpacity | "Create Plan" button (navigates to import modal) |

### Exercise Picker Modal (shown on tile long-press)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `exercise-picker-modal` | View | Modal container |
| `exercise-picker-cancel` | TouchableOpacity | Cancel button to dismiss the modal |
| `exercise-picker-search` | TextInput | Search input to filter exercises |
| `exercise-picker-free-entry` | TouchableOpacity | Button to use the search text as a custom exercise name |
| `exercise-option-{name}` | TouchableOpacity | A selectable exercise in the list (e.g., `exercise-option-Pull-Up`) |

---

## Plans Screen (`(tabs)/workouts`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `workouts-screen` | View | Root container for the plans screen |
| `search-input` | TextInput | Search input to filter plans by name |
| `filter-toggle` | TouchableOpacity | Expand/collapse filter controls |
| `switch-filter-favorites` | Switch | Toggle to show only favorited plans |
| `switch-filter-equipment` | Switch | Toggle to filter by available equipment |
| `gym-option-{gym.id}` | TouchableOpacity | Gym selector option within equipment filter |
| `workout-list` | FlatList | List of workout plan cards |
| `workout-{plan.id}` | View | Outer container for a plan card |
| `favorite-{plan.id}` | TouchableOpacity | Heart icon to toggle plan favorite status |
| `workout-card-{plan.id}` | TouchableOpacity | Tappable content area of a plan card |
| `workout-card-index-{index}` | View | Indexed wrapper for plan card content |
| `delete-{plan.id}` | TouchableOpacity | Delete button (revealed on swipe) |
| `empty-state` | View | Empty state container |
| `button-import-empty` | TouchableOpacity | "Import Plan" button in empty state |
| `button-setup-equipment` | TouchableOpacity | "Set Up Equipment" button when equipment filter shows no results |

---

## History Screen (`(tabs)/history`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `history-screen` | View | Root container for the history screen |
| `history-export-button` | TouchableOpacity | Export all sessions button in header |
| `history-list` | FlatList | List of completed session cards |
| `history-session-card` | TouchableOpacity | A completed session card |
| `history-empty-state` | View | Empty state when no sessions exist |

---

## Settings Screen (`(tabs)/settings`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `settings-screen` | ScrollView | Root container for settings |
| `settings-loading` | View | Loading state container |
| `button-theme-light` | TouchableOpacity | Light theme selector |
| `button-theme-dark` | TouchableOpacity | Dark theme selector |
| `button-theme-auto` | TouchableOpacity | Auto theme selector |
| `workout-settings-button` | TouchableOpacity | Navigate to workout settings sub-screen |
| `gym-item` | TouchableOpacity | A gym list item (navigates to gym detail) |
| `set-default-{gym.id}` | TouchableOpacity | Set a gym as default |
| `add-gym-button` | TouchableOpacity | Add a new gym |
| `sync-settings-button` | TouchableOpacity | Navigate to iCloud sync settings |
| `switch-healthkit` | Switch | Toggle Apple Health integration |
| `healthkit-status-label` | Text | Shows HealthKit authorization status or instructions |
| `healthkit-open-settings` | Button | Opens iOS Settings > Health (visible only when denied) |
| `switch-live-activities` | Switch | Toggle Live Activities |
| `live-activities-status-label` | Text | Shows Live Activities permission status or instructions |
| `live-activities-open-settings` | Button | Opens app system Settings (visible only when disabled at OS level) |
| `input-custom-prompt` | TextInput | Custom AI prompt addition input |
| `input-api-key` | TextInput | Anthropic API key input |
| `toggle-api-key-visibility` | TouchableOpacity | Show/hide API key text |
| `save-api-key-button` | TouchableOpacity | Save the entered API key |
| `remove-api-key-button` | TouchableOpacity | Remove the stored API key |
| `open-claude-button` | TouchableOpacity | Open Anthropic console in browser |
| `button-options-section` | View | Section for button option settings |
| `switch-show-open-in-claude` | Switch | Toggle "always show Open in Claude" button |
| `debug-logs-button` | TouchableOpacity | Navigate to debug logs screen |

---

## Workout Detail Screen (`workout/[id]`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `workout-detail-loading` | View | Loading state container |
| `workout-detail-view` | ScrollView | Main detail view (from WorkoutDetailView component) |
| `favorite-button-detail` | TouchableOpacity | Toggle favorite status |
| `start-workout-button` | TouchableOpacity | Start a workout session from this plan |
| `superset-{index}` | View | Superset group container |
| `exercise-{exercise.id}` | View | Exercise container |
| `set-{set.id}` | View | Individual set display |

---

## Active Workout Screen (`workout/active`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `active-workout-screen` | View | Root container |
| `active-workout-header` | View | Header bar container |
| `active-workout-pause-button` | TouchableOpacity | Pause the workout and go back |
| `active-workout-add-exercise-button` | TouchableOpacity | Open the add exercise modal |
| `active-workout-finish-button` | TouchableOpacity | Finish the workout |
| `active-workout-progress` | View | Progress bar and text container |
| `active-workout-scroll` | ScrollView | Scrollable exercise content |

---

## Workout Summary Screen (`workout/summary`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `workout-summary-screen` | View | Root container |
| `workout-summary-scroll` | ScrollView | Scrollable summary content |
| `workout-summary-success-header` | View | Success header with checkmark |
| `workout-summary-highlights` | View | Workout highlights / achievements section |
| `workout-summary-stats` | View | Stats grid (duration, sets, reps, volume) |
| `workout-summary-completion` | View | Completion rate card |
| `workout-summary-exercises` | View | Per-exercise summary list |
| `workout-summary-done-button` | TouchableOpacity | Done button (returns to home) |

---

## History Detail Screen (`history/[id]`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `history-detail-screen` | View | Root container |
| `history-detail-view` | ScrollView | Detail view (from HistoryDetailView component) |

---

## Import Workout Modal (`modal/import`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `import-modal` | View | Root container |
| `button-cancel` | TouchableOpacity | Cancel and dismiss the modal |
| `button-import` | TouchableOpacity | Import the entered markdown |
| `button-copy-prompt` | TouchableOpacity | Copy AI prompt to clipboard |
| `button-generate` | TouchableOpacity | Generate workout via Anthropic API |
| `button-open-claude` | TouchableOpacity | Copy prompt and open Claude.ai |
| `input-markdown` | TextInput | Markdown input field |

---

## Gym Detail Screen (`gym/[id]`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `gym-detail-screen` | View | Root container |
| `input-gym-name` | TextInput | Gym name edit input |
| `edit-gym-name-button` | TouchableOpacity | Enter gym name edit mode |
| `save-gym-name` | TouchableOpacity | Save edited gym name |
| `cancel-edit-gym-name` | TouchableOpacity | Cancel gym name edit |
| `set-default-button` | TouchableOpacity | Set this gym as the default |
| `switch-equipment-{item.id}` | Switch | Toggle equipment availability |
| `button-remove-equipment-{item.id}` | TouchableOpacity | Remove an equipment item |
| `preset-equipment-button` | TouchableOpacity | Open preset equipment selection modal |
| `preset-{item}` | TouchableOpacity | A preset equipment checkbox item |
| `save-presets-button` | TouchableOpacity | Save preset equipment selection |
| `input-new-equipment` | TextInput | Custom equipment name input |
| `button-add-equipment` | TouchableOpacity | Add custom equipment |
| `delete-gym-button` | TouchableOpacity | Delete this gym |

---

## iCloud Sync Screen (`settings/sync`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `sync-settings-screen` | View | Root container |
| `sync-status-badge` | View | Colored badge showing iCloud status |
| `sync-status-label` | Text | Human-readable status text |
| `sync-status-description` | Text | Detailed explanation of current status |
| `switch-enable-sync` | Switch | Toggle sync on/off |
| `sync-last-synced` | Text | Timestamp of last sync |
| `sync-now-button` | Button | Manual sync trigger |
| `sync-check-status` | Button | Refresh iCloud status |
| `sync-info-text` | Text | Explanatory description about iCloud Sync |

---

## Workout Settings Screen (`settings/workout`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `workout-settings-screen` | View | Root container |
| `button-unit-lbs` | TouchableOpacity | Select pounds as default unit |
| `button-unit-kg` | TouchableOpacity | Select kilograms as default unit |
| `switch-workout-timer` | Switch | Toggle rest timer visibility |
| `switch-auto-start-rest` | Switch | Toggle auto-start rest timer |
| `switch-keep-screen-awake` | Switch | Toggle keep screen awake during workouts |

---

## Debug Logs Screen (`settings/debug-logs`)

| ID | Element Type | Purpose |
|----|-------------|---------|
| `debug-logs-screen` | View | Root container |
| `debug-logs-actions` | View | Action buttons container |
| `debug-logs-export` | TouchableOpacity | Export logs to clipboard |
| `debug-logs-clear` | TouchableOpacity | Clear all logs |
| `debug-logs-loading` | View | Loading state container |
| `debug-logs-list` | ScrollView | Log entries list |
| `debug-logs-empty` | Text | Empty state text |

---

## E2E Test Coverage Analysis

### IDs Used in E2E Tests

The following IDs are referenced in E2E test files under `e2e/`:

| ID | Test Files |
|----|-----------|
| `home-screen` | workout-flow, import-via-workouts, history-export, detail-settings, tabs, smoke, active-workout-focused, home-tiles, share-target-import, import-flow-robust, history-flow-robust, import-simple |
| `max-lift-tile-0` | workout-flow, import-via-workouts, history-export, detail-settings, tabs, smoke, active-workout-focused, home-tiles, share-target-import, import-flow-robust, history-flow-robust, import-simple |
| `max-lift-tile-1` | home-tiles |
| `max-lift-tile-2` | home-tiles |
| `max-lift-tile-3` | home-tiles |
| `tab-home` | workout-flow, import-flow-robust |
| `tab-workouts` | import-via-workouts, tabs, import-flow-robust |
| `tab-history` | history-export, detail-settings, tabs, active-workout-focused, history-flow-robust |
| `tab-settings` | tabs, detail-settings |
| `button-import-workout` | workout-flow, history-export, active-workout-focused, import-flow-robust, history-flow-robust, import-simple |
| `input-markdown` | workout-flow, history-export, active-workout-focused, share-target-import, import-flow-robust, history-flow-robust, import-simple |
| `button-import` | workout-flow, history-export, active-workout-focused, share-target-import, import-flow-robust, history-flow-robust, import-simple |
| `button-cancel` | import-flow-robust |
| `start-workout-button` | workout-flow, history-export, active-workout-focused, history-flow-robust |
| `active-workout-progress` | workout-flow, active-workout-focused |
| `active-workout-finish-button` | workout-flow, history-export, active-workout-focused, history-flow-robust |
| `workout-summary-done-button` | workout-flow, history-export, active-workout-focused, history-flow-robust |
| `history-screen` | history-export, detail-settings, tabs, active-workout-focused, history-flow-robust |
| `history-export-button` | history-export |
| `history-session-card` | detail-settings, history-flow-robust |
| `history-detail-screen` | detail-settings |
| `workouts-screen` | import-via-workouts |
| `search-input` | tabs |
| `settings-screen` | tabs |
| `exercise-picker-modal` | home-tiles |
| `exercise-picker-search` | home-tiles |
| `exercise-picker-cancel` | home-tiles |
| `exercise-picker-free-entry` | home-tiles |
| `exercise-option-{name}` | home-tiles (e.g., `exercise-option-Pull-Up`, `exercise-option-Lat Pulldown`) |

### IDs in Code but NOT in E2E Tests

The following IDs exist in the codebase but are not currently referenced in any E2E test file. These represent **untested UI elements** that may need E2E coverage:

**Home Screen**: `resume-workout-banner`, `recent-plans`, `empty-state`

**Plans Screen**: `workouts-screen` (only in import-via-workouts), `filter-toggle`, `switch-filter-favorites`, `switch-filter-equipment`, `gym-option-{gym.id}`, `workout-list`, `workout-{plan.id}`, `favorite-{plan.id}`, `workout-card-{plan.id}`, `workout-card-index-{index}`, `delete-{plan.id}`, `button-import-empty`, `button-setup-equipment`

**History Screen**: `history-list`, `history-empty-state`

**Settings Screen**: `settings-loading`, `workout-settings-button`, `gym-item`, `set-default-{gym.id}`, `add-gym-button`, `input-custom-prompt`, `input-api-key`, `toggle-api-key-visibility`, `save-api-key-button`, `remove-api-key-button`, `open-claude-button`, `button-options-section`, `switch-show-open-in-claude`, `debug-logs-button`

**iCloud Sync Screen**: `sync-status-description`, `switch-enable-sync`, `sync-last-synced`, `sync-now-button`, `sync-check-status`

**Workout Detail**: `workout-detail-loading`, `workout-detail-view`, `favorite-button-detail`, `superset-{index}`, `exercise-{exercise.id}`, `set-{set.id}`

**Active Workout**: `active-workout-screen`, `active-workout-header`, `active-workout-pause-button`, `active-workout-add-exercise-button`, `active-workout-scroll`

**Workout Summary**: `workout-summary-screen`, `workout-summary-scroll`, `workout-summary-success-header`, `workout-summary-highlights`, `workout-summary-stats`, `workout-summary-completion`, `workout-summary-exercises`

**History Detail**: `history-detail-view`

**Import Modal**: `import-modal`, `button-copy-prompt`, `button-generate`, `button-open-claude`

**Gym Detail**: All IDs (`gym-detail-screen`, `input-gym-name`, `edit-gym-name-button`, `save-gym-name`, `cancel-edit-gym-name`, `set-default-button`, `switch-equipment-{item.id}`, `button-remove-equipment-{item.id}`, `preset-equipment-button`, `preset-{item}`, `save-presets-button`, `input-new-equipment`, `button-add-equipment`, `delete-gym-button`)

**Workout Settings**: All IDs (`workout-settings-screen`, `button-unit-lbs`, `button-unit-kg`, `switch-workout-timer`, `switch-auto-start-rest`, `switch-keep-screen-awake`)

**Debug Logs**: All IDs (`debug-logs-screen`, `debug-logs-actions`, `debug-logs-export`, `debug-logs-clear`, `debug-logs-loading`, `debug-logs-list`, `debug-logs-empty`)

### IDs in E2E Tests but NOT in Code

No orphaned IDs were found. All IDs used in E2E tests exist in the codebase.
