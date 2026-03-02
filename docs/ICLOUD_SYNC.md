# iCloud Sync & CloudKit Schema Management

## Container

- **Container ID**: `iCloud.com.eff3.liftmark.v2`
- **Team ID**: `43DNX2P3T6`
- **Dashboard**: https://icloud.developer.apple.com

## Schema is Permanent

CloudKit production schema changes are **irreversible**:

- You **cannot delete** a field once deployed to production
- You **cannot change** a field's type once deployed to production
- You **cannot delete** a record type once deployed to production
- You **can add** new fields to existing record types
- You **can add** new record types

Think carefully before deploying schema changes. Test thoroughly in the development environment first.

## Schema File

The canonical schema lives at `/cloudkit-schema.ckdb` in the repo root. This file should always match what's deployed to production.

## Making Schema Changes

### 1. Edit the schema file

Update `cloudkit-schema.ckdb` with the new fields or record types. You can only **add** fields/types, never remove or change existing ones.

### 2. Import to development

```bash
xcrun cktool import-schema \
  --team-id 43DNX2P3T6 \
  --container-id iCloud.com.eff3.liftmark.v2 \
  --environment development \
  --file cloudkit-schema.ckdb
```

You may need a management token first:
```bash
# Get token from CloudKit Dashboard → Settings → Tokens & Keys
xcrun cktool save-token --type management
```

### 3. Test in development

Run a debug build from Xcode on a real device. Debug builds hit the **development** environment. Verify sync works correctly with the new schema.

### 4. Deploy to production

In the CloudKit Dashboard:
1. Select container `iCloud.com.eff3.liftmark.v2`
2. Verify development schema looks correct
3. Deploy Schema to Production

**There is no undo.** Double-check everything.

### 5. Export and verify

After deploying, export the production schema and compare:

```bash
xcrun cktool export-schema \
  --team-id 43DNX2P3T6 \
  --container-id iCloud.com.eff3.liftmark.v2 \
  --environment production \
  --output-file cloudkit-schema-prod-export.ckdb
```

## Schema Design Decisions

### REFERENCE vs STRING for foreign keys

All parent-child foreign keys use `REFERENCE` type with `CKRecord.Reference`. This enables:
- Referential integrity (child can't reference nonexistent parent)
- Cascade deletes (deleting a parent auto-deletes children)

The one exception is `WorkoutSession.workoutPlanId` which is `STRING`. This is intentional: sessions must survive plan deletion since they represent historical workout data.

### attributes LIST<STRING> for set flags

`PlannedSet` and `SessionSet` use an `attributes` field (LIST<STRING>) instead of individual boolean fields. Values include `"dropset"`, `"perSide"`, `"amrap"`. This allows adding new set attributes without adding permanent schema fields.

### TIMESTAMP for dates

All date fields use CloudKit's native `TIMESTAMP` type. The Swift code converts between ISO 8601 strings (stored in SQLite) and native `Date` objects (stored in CloudKit).

### Environments

- **Development**: Used by Xcode debug builds. Schema can be reset here.
- **Production**: Used by TestFlight and App Store builds. Schema is permanent.

## Record Types

| Record Type | Purpose |
|---|---|
| Gym | User's gyms |
| GymEquipment | Equipment at a gym |
| WorkoutPlan | Workout templates |
| PlannedExercise | Exercises within a plan |
| PlannedSet | Sets within a planned exercise |
| WorkoutSession | Completed/in-progress workouts |
| SessionExercise | Exercises within a session |
| SessionSet | Sets within a session exercise |
| UserSettings | User preferences (singleton) |

## Sync Architecture

Phase 1 (current): Full upload/download with last-writer-wins conflict resolution.

Upload and download happen in dependency order (parents before children). Deletes happen in reverse order (children before parents). First sync never deletes local records.
