# CloudKit Sync Service Specification

## Purpose

Provide iCloud sync capabilities via CloudKit for data synchronization across devices. This enables users to access their workout data on multiple iOS devices signed into the same iCloud account.

Both the React Native (Expo) app and the native Swift app MUST support iCloud sync using the same CloudKit container, record types, and data format. A user should be able to sync data between any combination of app versions.

## iCloud Container

- **Container identifier**: `iCloud.com.eff3.liftmark`
- **Database**: Private database (user's own data, not shared)
- Both apps MUST use the same container identifier

## Entitlements

All iOS app targets (React Native and Swift) MUST include the following entitlements:

```xml
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
  <string>iCloud.com.eff3.liftmark</string>
</array>
<key>com.apple.developer.icloud-services</key>
<array>
  <string>CloudDocuments</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
  <string>iCloud.com.eff3.liftmark</string>
</array>
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)com.eff3.liftmark</string>
```

### Current Entitlement Status

| App Target | File | Status |
|------------|------|--------|
| React Native | `react-ios/ios/LiftMark/LiftMark.entitlements` | Complete |
| Swift | `swift-ios/LiftMark/LiftMark.entitlements` | **Missing** — only has HealthKit entitlements |

**Action required**: Add iCloud entitlements to `swift-ios/LiftMark/LiftMark.entitlements`.

## Account Status

The service can report the current iCloud account status as one of:

- `available` — iCloud account is signed in and accessible.
- `noAccount` — No iCloud account configured on the device.
- `restricted` — iCloud access is restricted (e.g., parental controls).
- `couldNotDetermine` — Status could not be determined.
- `temporarilyUnavailable` — iCloud is temporarily unavailable (map to `couldNotDetermine` in app logic).
- `error` — An error occurred checking status.

### Account Status Implementation Notes

- **Swift**: Use `CKContainer.accountStatus()` async API. Handle `temporarilyUnavailable` by mapping to `couldNotDetermine`.
- **React Native**: Use the `expo-cloudkit` native module which wraps the same Swift APIs.
- **Simulator handling**: On simulator, CloudKit may fail. Return `noAccount` for simulator-specific errors rather than crashing.

## CloudKit Record Types

All apps MUST use these exact CloudKit record type names and field mappings. This is the shared contract that enables cross-app sync.

### Record Type: `WorkoutPlan`

Maps to the `WorkoutPlan` entity in the data model.

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `name` | String | `name` |
| `planDescription` | String | `description` |
| `tags` | String (JSON array) | `tags` |
| `defaultWeightUnit` | String | `defaultWeightUnit` |
| `sourceMarkdown` | String | `sourceMarkdown` |
| `isFavorite` | Int64 (0/1) | `isFavorite` |
| `createdAt` | Date | `createdAt` |
| `updatedAt` | Date | `updatedAt` |

**Record ID**: Use the entity's `id` (UUID string) as the CloudKit record name.

**Note**: Field is named `planDescription` (not `description`) because `description` is reserved in some CloudKit contexts.

### Record Type: `PlannedExercise`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `workoutPlanId` | Reference (`WorkoutPlan`) | `workoutPlanId` |
| `exerciseName` | String | `exerciseName` |
| `orderIndex` | Int64 | `orderIndex` |
| `notes` | String | `notes` |
| `equipmentType` | String | `equipmentType` |
| `groupType` | String | `groupType` |
| `groupName` | String | `groupName` |
| `parentExerciseId` | String | `parentExerciseId` |

### Record Type: `PlannedSet`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `plannedExerciseId` | Reference (`PlannedExercise`) | `plannedExerciseId` |
| `orderIndex` | Int64 | `orderIndex` |
| `targetWeight` | Double | `targetWeight` |
| `targetWeightUnit` | String | `targetWeightUnit` |
| `targetReps` | Int64 | `targetReps` |
| `targetTime` | Int64 | `targetTime` |
| `targetRpe` | Double | `targetRpe` |
| `restSeconds` | Int64 | `restSeconds` |
| `tempo` | String | `tempo` |
| `isDropset` | Int64 (0/1) | `isDropset` |
| `isPerSide` | Int64 (0/1) | `isPerSide` |
| `isAmrap` | Int64 (0/1) | `isAmrap` |
| `notes` | String | `notes` |

### Record Type: `WorkoutSession`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `workoutPlanId` | String | `workoutPlanId` |
| `name` | String | `name` |
| `date` | String (ISO date) | `date` |
| `startTime` | Date | `startTime` |
| `endTime` | Date | `endTime` |
| `duration` | Int64 | `duration` |
| `notes` | String | `notes` |
| `status` | String | `status` |

**Note**: `workoutPlanId` is stored as a plain String (not a CKReference) because the referenced plan may have been deleted.

### Record Type: `SessionExercise`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `workoutSessionId` | Reference (`WorkoutSession`) | `workoutSessionId` |
| `exerciseName` | String | `exerciseName` |
| `orderIndex` | Int64 | `orderIndex` |
| `notes` | String | `notes` |
| `equipmentType` | String | `equipmentType` |
| `groupType` | String | `groupType` |
| `groupName` | String | `groupName` |
| `parentExerciseId` | String | `parentExerciseId` |
| `status` | String | `status` |

### Record Type: `SessionSet`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `sessionExerciseId` | Reference (`SessionExercise`) | `sessionExerciseId` |
| `orderIndex` | Int64 | `orderIndex` |
| `parentSetId` | String | `parentSetId` |
| `dropSequence` | Int64 | `dropSequence` |
| `targetWeight` | Double | `targetWeight` |
| `targetWeightUnit` | String | `targetWeightUnit` |
| `targetReps` | Int64 | `targetReps` |
| `targetTime` | Int64 | `targetTime` |
| `targetRpe` | Double | `targetRpe` |
| `restSeconds` | Int64 | `restSeconds` |
| `actualWeight` | Double | `actualWeight` |
| `actualWeightUnit` | String | `actualWeightUnit` |
| `actualReps` | Int64 | `actualReps` |
| `actualTime` | Int64 | `actualTime` |
| `actualRpe` | Double | `actualRpe` |
| `completedAt` | Date | `completedAt` |
| `status` | String | `status` |
| `notes` | String | `notes` |
| `tempo` | String | `tempo` |
| `isDropset` | Int64 (0/1) | `isDropset` |
| `isPerSide` | Int64 (0/1) | `isPerSide` |

### Record Type: `UserSettings`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `defaultWeightUnit` | String | `defaultWeightUnit` |
| `enableWorkoutTimer` | Int64 (0/1) | `enableWorkoutTimer` |
| `autoStartRestTimer` | Int64 (0/1) | `autoStartRestTimer` |
| `theme` | String | `theme` |
| `notificationsEnabled` | Int64 (0/1) | `notificationsEnabled` |
| `customPromptAddition` | String | `customPromptAddition` |
| `healthKitEnabled` | Int64 (0/1) | `healthKitEnabled` |
| `liveActivitiesEnabled` | Int64 (0/1) | `liveActivitiesEnabled` |
| `keepScreenAwake` | Int64 (0/1) | `keepScreenAwake` |
| `showOpenInClaudeButton` | Int64 (0/1) | `showOpenInClaudeButton` |
| `homeTiles` | String (JSON array) | `homeTiles` |
| `updatedAt` | Date | `updatedAt` |

**Record ID**: Fixed value `"user-settings"` (singleton).

**Note**: `anthropicApiKey` is NEVER synced. It is stored in platform-native secure storage only. `anthropicApiKeyStatus` is also not synced — each device verifies independently.

### Record Type: `Gym`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `name` | String | `name` |
| `isDefault` | Int64 (0/1) | `isDefault` |
| `createdAt` | Date | `createdAt` |
| `updatedAt` | Date | `updatedAt` |

### Record Type: `GymEquipment`

| CloudKit Field | Type | Maps To |
|----------------|------|---------|
| `gymId` | Reference (`Gym`) | `gymId` |
| `name` | String | `name` |
| `isAvailable` | Int64 (0/1) | `isAvailable` |
| `lastCheckedAt` | Date | `lastCheckedAt` |
| `createdAt` | Date | `createdAt` |
| `updatedAt` | Date | `updatedAt` |

## Sync Strategy

### Phase 1: Full Upload/Download (Current Target)

The initial sync implementation uses a simple full-state approach:

1. **Upload**: Serialize all local entities → save as CloudKit records
2. **Download**: Fetch all CloudKit records → deserialize → merge into local database
3. **Conflict resolution**: Last-writer-wins based on `updatedAt` timestamp
4. **Trigger**: Manual "Sync Now" button only (no automatic background sync)

This phase prioritizes correctness and simplicity over efficiency.

### Phase 2: Change Tracking (Future)

Future enhancement using the existing `sync_queue` and `sync_metadata` tables:

- Track local changes via repository hooks (`afterCreateHook`, `afterUpdateHook`, `afterDeleteHook`)
- Use CloudKit `serverChangeToken` for incremental fetch
- Support `CKSubscription` for push notifications on remote changes
- Automatic sync on app launch and background refresh

### Phase 3: Real-Time Sync (Future)

- `CKDatabaseSubscription` for real-time change notifications
- Background app refresh for periodic sync
- Optimistic UI updates with conflict resolution

## Sync Order

Entities must be synced in dependency order to satisfy foreign key constraints:

**Upload order**:
1. `Gym`
2. `GymEquipment`
3. `WorkoutPlan`
4. `PlannedExercise`
5. `PlannedSet`
6. `WorkoutSession`
7. `SessionExercise`
8. `SessionSet`
9. `UserSettings`

**Download order**: Same order (parent records before children).

## Conflict Resolution (Phase 1)

Simple last-writer-wins strategy:

1. Compare local `updatedAt` with remote `updatedAt`
2. If remote is newer → overwrite local
3. If local is newer → overwrite remote
4. If equal → no action needed

For `UserSettings` (singleton): merge field-by-field, taking the newer value for each field independently.

## Delete Handling

Deletes are handled by comparing local and remote record sets:

- Record exists locally but not remotely → was deleted on another device → delete locally
- Record exists remotely but not locally → was deleted on this device → delete remotely
- **Safety**: Never auto-delete during the first sync on a new device. On first sync, only merge (add missing records to both sides).

### First Sync Detection

A device is performing its "first sync" when `sync_metadata.last_sync_date` is NULL. In this case:
- Download all remote records and merge with local data
- Upload all local records that don't exist remotely
- Do NOT delete any records on either side
- Set `last_sync_date` after successful completion

## Error Handling

- All sync operations return safe default values on failure (null, empty collections, or false); they never throw exceptions.
- Errors are logged via the app's Logger for debugging.
- Simulator and development environment errors are treated as non-fatal and result in degraded but functional behavior.
- Network errors should be retried with exponential backoff (max 3 attempts).
- CloudKit rate limiting (CKError.requestRateLimited) should respect the `retryAfterSeconds` value.

## UI Requirements

The iCloud Sync settings screen (see `spec/screens/settings.md`, sub-screen: iCloud Sync) MUST display meaningful content at all times. An empty screen is a bug. At minimum, the screen must show:

1. The current iCloud account status (with a colored badge and human-readable description)
2. Explanatory text about what iCloud Sync does
3. Guidance for the user based on their current status (e.g., "Sign in to iCloud to enable sync")

See `spec/screens/settings.md` for the complete iCloud Sync sub-screen layout specification.

## Service Interface

Both platforms MUST implement a CloudKit service with the following capabilities:

```
CloudKitService {
  // Account
  initialize() → bool
  getAccountStatus() → AccountStatus

  // CRUD
  saveRecord(record) → record | null
  fetchRecord(recordId, recordType) → record | null
  fetchRecords(recordType) → record[]
  deleteRecord(recordId, recordType) → bool

  // Sync (Phase 1)
  syncAll() → SyncResult
}

SyncResult {
  success: bool
  uploaded: number
  downloaded: number
  conflicts: number
  errors: string[]
  timestamp: datetime
}
```

## Implementation Checklist

### Swift App (swift-ios)

- [ ] Add iCloud entitlements to `swift-ios/LiftMark/LiftMark.entitlements`
- [ ] Add iCloud capability in Xcode project settings
- [ ] Verify `CloudKitService.swift` uses container `iCloud.com.eff3.liftmark`
- [ ] Implement `syncAll()` method using the record type mappings above
- [ ] Wire up Sync Settings UI to actual sync operations
- [ ] Test on physical device (CloudKit requires real iCloud account)

### React Native App (react-ios)

- [ ] Verify entitlements are correct (already done)
- [ ] Implement `syncAll()` in `cloudKitService.ts`
- [ ] Add sync progress UI to the sync settings screen
- [ ] Wire up "Sync Now" button to `syncAll()`
- [ ] Test on physical device

### Shared

- [ ] Verify both apps can read records written by the other
- [ ] Test conflict resolution with simultaneous edits
- [ ] Test first-sync behavior on a new device
- [ ] Test sync with large datasets (100+ workout plans, 500+ sessions)
