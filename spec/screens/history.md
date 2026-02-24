# History Screen

## Purpose
Display a chronological list of completed workout sessions with stats. Supports pull-to-refresh, JSON export, and tablet split-view.

## Route
`/(tabs)/history` — Third tab in the bottom tab bar.

## Layout
- **Header**: Tab header with export button (share icon) in headerRight
- **Body** (phone): FlatList of session cards with pull-to-refresh
- **Body** (tablet): SplitView with session list on left, HistoryDetailView on right
- **Footer**: None

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `history-screen` | View |
| Export button (header) | `history-export-button` | TouchableOpacity |
| History list | `history-list` | FlatList |
| Session card | `history-session-card` | TouchableOpacity |
| Empty state | `history-empty-state` | View |

## User Interactions
- **Tap session card** → phone: navigates to `/history/{session.id}`; tablet: selects in split view
- **Pull to refresh** → reloads completed sessions
- **Tap export button (header)** → confirmation alert → exports all sessions as JSON → share sheet
- **Screen focus** → auto-refreshes session list

## Navigation
- `/history/{id}` — phone session card tap

## Error/Empty States
- **Loading**: LoadingView with "Loading history..." message
- **No sessions**: "No Workouts Yet" / "Complete a workout to see it here"
- **Export empty**: "Nothing to Export" alert if ExportError
- **Export failure**: "Export Failed" alert with error message

## Session Card Content
Each card shows:
- Session name + relative date (Today, Yesterday, weekday, or formatted date)
- Start time + duration
- Stats row: completed sets | exercise count | total volume (if > 0)
