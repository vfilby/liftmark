# Logger Service Specification

## Purpose

Structured logging service with persistent SQLite storage for diagnosing issues in production and TestFlight builds where console access is not available. Provides log export for user-submitted bug reports.

## Public API

The logger is a **singleton** instance. All methods are called on the shared instance.

### `debug(category, message, metadata?)`
### `info(category, message, metadata?)`
### `warn(category, message, metadata?)`

Standard log methods. Write a log entry at the specified level.

### `error(category, message, error?, metadata?)`

Error-level log. If an `Error` object is provided, its `stack` property is captured as the `stackTrace` field.

### `getLogs(limit?, level?, category?): Promise<LogEntry[]>`

Query stored logs. Default limit is 100. Optional filters by level and/or category. Results ordered by timestamp descending (newest first).

### `exportLogs(): Promise<string>`

Returns a JSON string containing device information, export timestamp, and up to 1000 log entries. Intended for sharing via the Settings debug screen.

**Export format:**
```json
{
  "deviceInfo": { ... },
  "exportedAt": "<ISO 8601 timestamp>",
  "entries": [ ... ]
}
```

### `clearLogs(): Promise<void>`

Deletes all log entries from the database.

### `getDeviceInformation(): DeviceInfo`

Returns a copy of the device information object.

### `getLogStats(): Promise<LogStats>`

Returns aggregate counts: total entries, counts by level, and counts by category.

## Types

### LogLevel

`'debug' | 'info' | 'warn' | 'error'`

### LogCategory

`'navigation' | 'routing' | 'app' | 'database' | 'network' | 'user_action' | 'error_boundary' | 'logger'`

### LogEntry

| Field      | Type    | Description |
|------------|---------|-------------|
| id         | number? | Auto-increment ID |
| timestamp  | string  | ISO 8601 timestamp |
| level      | LogLevel | Log severity |
| category   | LogCategory | Functional area |
| message    | string  | Log message |
| metadata   | object? | Arbitrary JSON metadata |
| stackTrace | string? | Error stack trace (error level only) |

### DeviceInfo

| Field        | Type    | Description |
|--------------|---------|-------------|
| platform     | string  | OS name (e.g., "ios") |
| osVersion    | string  | OS version string |
| appVersion   | string  | App version from constants |
| buildType    | string  | One of: `development`, `expo-go`, `preview`, `production` |
| isSimulator  | boolean | Whether running in simulator |
| deviceModel  | string? | Device model identifier |

## Storage

### Schema

Table: `app_logs`

| Column      | Type    | Notes |
|-------------|---------|-------|
| id          | INTEGER | Primary key, auto-increment |
| timestamp   | TEXT    | ISO 8601 |
| level       | TEXT    | LogLevel value |
| category    | TEXT    | LogCategory value |
| message     | TEXT    | Log message |
| metadata    | TEXT    | JSON string, nullable |
| stack_trace | TEXT    | Nullable |
| device_info | TEXT    | JSON string |
| created_at  | TEXT    | ISO 8601 |

**Indexes:** `timestamp DESC`, `level`, `category`.

### Startup Behavior

1. **Queue buffering:** Logs written before the database is ready are buffered in memory (max 100 entries, FIFO — oldest dropped when full). Buffered entries are flushed once the database is initialized.
2. **Log retention:** On initialization, delete all entries older than 7 days.
3. **Console passthrough:** In development builds, all log calls also write to the platform console (`console.log`, `console.warn`, `console.error`).

## Dependencies

- SQLite database (separate `app_logs` table, not the main data tables).
- Platform constants for device info and build type detection.

## Error Handling

- Logging methods never throw. If a write fails, the error is silently dropped (a logger that crashes the app defeats its purpose).
- `getLogs`, `exportLogs`, `clearLogs`, and `getLogStats` propagate database errors.
