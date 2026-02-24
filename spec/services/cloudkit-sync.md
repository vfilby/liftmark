# CloudKit Sync Service Specification

## Purpose

Provide iCloud sync capabilities via CloudKit for data synchronization across devices. This enables users to access their workout data on multiple iOS devices signed into the same iCloud account.

> **Note**: iCloud sync is currently stubbed and not yet fully implemented. The service provides account status checking and the settings UI, but actual data synchronization is not yet operational.

## Account Status

The service can report the current iCloud account status as one of:

- `available` — iCloud account is signed in and accessible.
- `noAccount` — No iCloud account configured on the device.
- `restricted` — iCloud access is restricted (e.g., parental controls).
- `couldNotDetermine` — Status could not be determined.
- `error` — An error occurred checking status.

## UI Requirements

The iCloud Sync settings screen (see Settings Screen spec, sub-screen: iCloud Sync) MUST display meaningful content at all times. An empty screen is a bug. At minimum, the screen must show:
1. The current iCloud account status (with a colored badge and human-readable description)
2. Explanatory text about what iCloud Sync does
3. Guidance for the user based on their current status (e.g., "Sign in to iCloud to enable sync")

See `spec/screens/settings.md` for the complete iCloud Sync sub-screen layout specification.

## Error Handling

- All operations return safe default values on failure (null, empty collections, or false); they never throw exceptions.
- Errors are logged for debugging purposes.
- Simulator and development environment errors are treated as non-fatal and result in degraded but functional behavior.
