# Customize Home Tiles Flow

## Preconditions

- The Home screen is loaded with user settings.
- The settings store is initialized with default or previously saved tile configuration.

## Default Tiles

The default configuration displays four tiles:

1. Squat
2. Deadlift
3. Bench Press
4. Overhead Press

## Flow Steps

1. The Home screen displays 4 max lift tiles in a 2x2 grid.
2. Each tile shows:
   - The exercise name.
   - The best weight from workout history, or a dash ("--") if no history exists for that exercise.
3. User long presses a tile (400ms hold duration).
4. Haptic feedback is triggered on long press recognition.
5. The `ExercisePickerModal` opens.
6. The exercise picker displays:
   - A search input field at the top.
   - A list of common exercises.
   - A cancel button.
7. User selects an exercise through one of these methods:
   - **Select from list**: Tap a common exercise from the list.
   - **Search and select**: Type in the search field to filter exercises, then tap a result.
   - **Custom entry**: Enter a custom exercise name via free text entry.
   - **Cancel**: Close the modal without making changes.
8. On selection: the `homeTiles` array in settings is updated with the new exercise name, and the change is saved to the database.
9. The tile immediately updates to show the new exercise name and its best weight (if available).

## Best Weight Lookup

- The best weight for each tile is retrieved from `getExerciseBestWeights()`.
- Matching is case-insensitive against exercise names in workout history.

## Persistence

- Tile configuration is stored in `user_settings.home_tiles` as a JSON array.
- The configuration persists across app restarts.

## Variations

- **No workout history for exercise**: The tile displays a dash ("--") instead of a weight value.
- **Custom exercise name**: Any free text can be entered as an exercise name, not limited to the preset list.
- **Search with no results**: The search field filters the common exercises list; if no matches, the user can enter a custom name.
- **All tiles customized**: All four tiles can be changed independently from their defaults.

## Error Handling

| Scenario | Behavior |
|---|---|
| Long press not held long enough | No action; normal tap behavior applies |
| Settings save failure | Error logged; previous tile configuration retained |
| Exercise history lookup failure | Tile displays dash ("--") for the weight value |
| Empty exercise name submitted | Selection is not applied |

## Postconditions

- The updated tile configuration is saved in the settings store and persisted to the `user_settings` table in SQLite.
- Each tile displays the correct best weight from history if available, using case-insensitive matching.
- The configuration survives app restarts.
