# View History Flow

## Preconditions

- At least one completed workout session exists in the database (for non-empty state).

## Flow Steps

1. User navigates to the **History** tab.
2. The screen loads completed sessions from `getCompletedSessions()`, ordered by date descending (most recent first).
3. Each session card displays:
   - Workout name.
   - Date and time of the session.
   - Duration.
   - Stats: total sets, number of exercises, total volume.
4. User taps a session card:
   - **Phone**: Navigates to the history detail screen.
   - **Tablet**: Shows the session detail in a split view on the right side.
5. The detail screen displays the full workout breakdown with all exercises and their sets.
6. The header includes a share button for exporting the single session as JSON.
7. A delete option is available in the detail view, with a confirmation dialog before deletion.

## Export Sub-flow

1. User taps the export button in the history tab header.
2. A confirmation dialog is shown displaying the number of sessions to export.
3. `exportSessionsAsJson()` creates a JSON file in the cache directory.
4. The system share sheet opens via `shareAsync()` for the user to save or send the file.
5. If no sessions exist, a "Nothing to Export" alert is shown instead.

## Variations

- **Empty state**: The screen displays "No Workouts Yet" with the message "Complete a workout to see it here."
- **Tablet layout**: A SplitView is used with the session list on the left and session detail on the right. The currently selected session is highlighted in the list.
- **Single session export**: The share button in the detail view exports only that specific session.
- **Bulk export**: The header export button exports all completed sessions.

## Error Handling

| Scenario | Behavior |
|---|---|
| No completed sessions | Empty state message displayed |
| Database load failure | Error surfaced to the user |
| Export file creation failure | Error alert shown |
| Share sheet cancelled | No action taken, file remains in cache |
| Delete session failure | Error alert shown, session remains |

## Postconditions

- The user can view all completed workout sessions with full detail.
- Exported sessions are available as JSON files via the system share sheet.
- Deleted sessions are removed from the database and no longer appear in the list.
