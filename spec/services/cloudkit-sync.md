# CloudKit Sync Service Specification

## Purpose

Provide iCloud sync capabilities via CloudKit for data synchronization across devices. This enables users to access their workout data on multiple iOS devices signed into the same iCloud account.

## Public API

The service is implemented as a singleton class (`CloudKitService`).

### `initialize(): Promise<boolean>`

Initialize the CloudKit connection. Returns `true` on success.

### `getAccountStatus(): Promise<string>`

Check the current iCloud account status. Returns one of:
- `'available'` — iCloud account is signed in and accessible.
- `'noAccount'` — No iCloud account configured on the device.
- `'restricted'` — iCloud access is restricted (e.g., parental controls).
- `'couldNotDetermine'` — Status could not be determined.
- `'error'` — An error occurred checking status.

### `saveRecord(record): Promise<CloudKitRecord | null>`

Save a record to CloudKit. Returns the saved record with server-assigned metadata, or `null` on failure.

### `fetchRecord(recordId, recordType): Promise<CloudKitRecord | null>`

Fetch a single record by its ID and type. Returns the record or `null` if not found or on failure.

### `fetchRecords(recordType): Promise<CloudKitRecord[]>`

Fetch all records of a given type. Returns an array of records, or an empty array on failure.

### `deleteRecord(recordId, recordType): Promise<boolean>`

Delete a record by its ID and type. Returns `true` on success, `false` on failure.

## Behavior Rules

- Auto-initializes on the first operation if `initialize()` has not been called explicitly.
- In simulator and development environments, CloudKit errors are handled gracefully; `getAccountStatus()` returns `'noAccount'` rather than failing.
- The local database includes sync-related tables (`sync_metadata`, `sync_queue`, `sync_conflicts`) for tracking sync state, though the sync hooks are currently stubbed and not actively syncing.

## Dependencies

- `expo-cloudkit` native module.

## Error Handling

- All methods return `null`, an empty array, or `false` on failure; they never throw exceptions.
- Errors are logged to the console for debugging purposes.
- Simulator and development environment errors are treated as non-fatal and result in degraded but functional behavior.
