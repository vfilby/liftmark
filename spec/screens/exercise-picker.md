# Exercise Picker Modal

## Purpose
Modal for selecting an exercise by name. Shows exercises from user history first, then common exercises, with search filtering and free-text entry for new exercise names.

## Route
N/A — This is a reusable component (`ExercisePickerModal`), not a route. Used by the Home screen for max lift tile configuration.

## Layout
- **Backdrop**: Semi-transparent overlay (tap to dismiss)
- **Modal content** (bottom sheet style, max 70% height):
  1. Header: "Choose Exercise" title + Cancel button
  2. Search input with placeholder "Search or type exercise name..."
  3. Free-text entry row (conditional — shown when search text doesn't exactly match any exercise)
  4. Exercise list (FlatList)

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Modal container | `exercise-picker-modal` | View |
| Cancel button | `exercise-picker-cancel` | TouchableOpacity |
| Search input | `exercise-picker-search` | TextInput |
| Free-text entry | `exercise-picker-free-entry` | TouchableOpacity |
| Exercise option | `exercise-option-{exerciseName}` | TouchableOpacity |

## Data Dependencies
- **exerciseHistoryRepository**: `getAllExercisesWithHistory()` — loads user's exercise history names
- **COMMON_EXERCISES**: Static list of 18 common exercises (Squat, Deadlift, Bench Press, etc.)

## User Interactions
- **Tap backdrop** → calls `onCancel`
- **Tap Cancel** → calls `onCancel`
- **Type in search** → filters exercise list by substring match (case-insensitive)
- **Press return on search** → if search text is non-empty, calls `onSelect` with trimmed search text
- **Tap exercise from list** → calls `onSelect` with exercise name
- **Tap "Add {searchText}"** (free-text entry) → calls `onSelect` with trimmed search text; only shown when no exact match exists

## Props
- `visible` — controls modal visibility
- `onSelect(exerciseName: string)` — callback when exercise is chosen
- `onCancel()` — callback when modal is dismissed

## State
- `search` — current search input text (reset on open)
- `userExercises` — exercise names from user's workout history (loaded on open)

## Computed Values
- `getFilteredExercises()` — merges user exercises with common exercises (deduped), filtered by search term. User exercises appear first, then common exercises not in user history.
- `exactMatch` — whether any filtered exercise exactly matches the search text (controls free-text entry visibility)

## Error/Empty States
- **No exercises found** (no search text + empty list): "No exercises found" centered text
- **No matches for search**: Only free-text entry row shown (if search text is non-empty)
