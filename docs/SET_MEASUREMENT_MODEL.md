# SetMeasurement Data Model

## Overview

SetMeasurement decouples exercise metrics (weight, reps, time, distance, RPE) from the set record itself. Instead of fixed columns like `targetWeight`, `actualReps`, etc., measurements are stored as rows in a `set_measurements` table, typed by `kind` and `role`.

This eliminates CloudKit schema drift when new metric types are added and cleanly models multi-metric sets (weighted planks, drop sets, distance+time).

## Data Model

### SetMeasurement (storage)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `set_id` | TEXT FK | References `session_sets.id` or `template_sets.id` |
| `parent_type` | TEXT | `"session"` or `"planned"` — disambiguates the FK |
| `role` | TEXT | `"target"` or `"actual"` |
| `kind` | TEXT | `"weight"`, `"reps"`, `"time"`, `"distance"`, `"rpe"` |
| `value` | REAL | Numeric value (reps stored as Double, cast to Int on read) |
| `unit` | TEXT? | `"lbs"`, `"kg"`, `"m"`, `"km"`, `"mi"`, `"ft"`, `"yd"`, `"s"` — nil for dimensionless (reps, RPE) |
| `group_index` | INT | Groups co-recorded measurements into entries. 0 for normal sets; 0..N for drop sets. |
| `updated_at` | TEXT? | ISO8601 timestamp for CloudKit sync |

**Indexes:**
- `idx_set_measurements_set ON set_measurements(set_id, parent_type)`
- `idx_set_measurements_group ON set_measurements(set_id, group_index)`

### SessionSet (simplified)

After migration, SessionSet loses all target*/actual* columns. Retains:

| Column | Kept | Notes |
|--------|------|-------|
| `id` | Yes | |
| `session_exercise_id` | Yes | FK to exercise |
| `order_index` | Yes | Display order |
| `status` | Yes | pending/completed/skipped/failed |
| `completed_at` | Yes | When the set was completed |
| `rest_seconds` | Yes | Rest timer after this set |
| `notes` | Yes | User notes |
| `side` | Yes | "left"/"right" for per-side sets |
| `is_per_side` | Yes | Boolean flag |
| `is_dropset` | Yes | Boolean flag — indicates entries have groupIndex > 0 |
| `is_amrap` | **Add** | Move from CloudKit `attributes` to dedicated column (consistency with PlannedSet) |
| `updated_at` | Yes | Sync timestamp |
| `parent_set_id` | **Remove** | Replaced by groupIndex on measurements |
| `drop_sequence` | **Remove** | Replaced by groupIndex on measurements |
| `target_weight` | **Remove** | Now in set_measurements |
| `target_weight_unit` | **Remove** | Now in set_measurements |
| `target_reps` | **Remove** | Now in set_measurements |
| `target_time` | **Remove** | Now in set_measurements |
| `target_distance` | **Remove** | Now in set_measurements |
| `target_distance_unit` | **Remove** | Now in set_measurements |
| `target_rpe` | **Remove** | Now in set_measurements |
| `actual_weight` | **Remove** | Now in set_measurements |
| `actual_weight_unit` | **Remove** | Now in set_measurements |
| `actual_reps` | **Remove** | Now in set_measurements |
| `actual_time` | **Remove** | Now in set_measurements |
| `actual_distance` | **Remove** | Now in set_measurements |
| `actual_distance_unit` | **Remove** | Now in set_measurements |
| `actual_rpe` | **Remove** | Now in set_measurements |
| `tempo` | **Remove** | Deprecated in LMWF spec; kept in local DB only via notes |

### PlannedSet (simplified)

Same pattern. Loses all target* columns. Retains: `id`, `template_exercise_id`, `order_index`, `rest_seconds`, `is_dropset`, `is_per_side`, `is_amrap`, `notes`, `updated_at`.

## Swift Facade Types

Views don't interact with SetMeasurement rows directly. The repository assembles them into typed facade types:

```swift
struct SetEntry {
    let groupIndex: Int
    let target: EntryValues?    // nil if no prescription
    let actual: EntryValues?    // nil if not yet completed
}

struct EntryValues {
    let weight: (value: Double, unit: WeightUnit)?
    let reps: Int?
    let time: Int?              // seconds
    let distance: (value: Double, unit: DistanceUnit)?
    let rpe: Int?
}
```

SessionSet and PlannedSet model types gain an `entries: [SetEntry]` property. For normal sets, `entries.count == 1`. For drop sets, `entries.count == N` (one per drop).

Backward-compatible computed accessors like `set.targetWeight` resolve to `entries.first?.target?.weight?.value` for code that doesn't need to think about entries.

## GroupIndex Semantics

`groupIndex` identifies which "recording" within a set measurements belong to. Measurements sharing the same `(setId, groupIndex)` were recorded together as one entry.

- **Normal set (185 lbs x 5):** All measurements at groupIndex=0.
- **Drop set (225x10 -> 185x6 -> 135x4):** Three groups (0, 1, 2), each with weight+reps.
- **Weighted plank (25 lbs x 60s):** Both weight and time at groupIndex=0.
- **Bodyweight AMRAP (12 reps):** Single reps measurement at groupIndex=0.

## Examples

### Normal rep set: "bench 185 lbs x 5, did 185 x 4"

```
SessionSet(id=S1, status=completed, restSeconds=120)
  Measurement(setId=S1, role=target, kind=weight,  value=185, unit=lbs, groupIndex=0)
  Measurement(setId=S1, role=target, kind=reps,    value=5,             groupIndex=0)
  Measurement(setId=S1, role=actual, kind=weight,  value=185, unit=lbs, groupIndex=0)
  Measurement(setId=S1, role=actual, kind=reps,    value=4,             groupIndex=0)
```

### Drop set: "225x10 -> 185x6 -> 135x4"

```
SessionSet(id=S2, status=completed, isDropset=true, restSeconds=180)
  Measurement(setId=S2, role=actual, kind=weight, value=225, unit=lbs, groupIndex=0)
  Measurement(setId=S2, role=actual, kind=reps,   value=10,            groupIndex=0)
  Measurement(setId=S2, role=actual, kind=weight, value=185, unit=lbs, groupIndex=1)
  Measurement(setId=S2, role=actual, kind=reps,   value=6,             groupIndex=1)
  Measurement(setId=S2, role=actual, kind=weight, value=135, unit=lbs, groupIndex=2)
  Measurement(setId=S2, role=actual, kind=reps,   value=4,             groupIndex=2)
```

### Per-side dumbbell press: "30 lbs x 8 each side"

Per-side expansion is unchanged — two SessionSet rows, one per side:

```
SessionSet(id=S3L, side=left,  isPerSide=true)
  Measurement(setId=S3L, role=actual, kind=weight, value=30, unit=lbs, groupIndex=0)
  Measurement(setId=S3L, role=actual, kind=reps,   value=8,            groupIndex=0)

SessionSet(id=S3R, side=right, isPerSide=true, restSeconds=60)
  Measurement(setId=S3R, role=actual, kind=weight, value=30, unit=lbs, groupIndex=0)
  Measurement(setId=S3R, role=actual, kind=reps,   value=8,            groupIndex=0)
```

### Distance run: "5K in 25 min target, did 26:30"

```
SessionSet(id=S4, status=completed)
  Measurement(setId=S4, role=target, kind=distance, value=5000, unit=m, groupIndex=0)
  Measurement(setId=S4, role=target, kind=time,     value=1500, unit=s, groupIndex=0)
  Measurement(setId=S4, role=actual, kind=distance, value=5000, unit=m, groupIndex=0)
  Measurement(setId=S4, role=actual, kind=time,     value=1590, unit=s, groupIndex=0)
```

## Query Patterns

### Load all measurements for a session

```sql
SELECT m.* FROM set_measurements m
JOIN session_sets s ON m.set_id = s.id
WHERE m.parent_type = 'session'
  AND s.session_exercise_id IN (
    SELECT id FROM session_exercises WHERE workout_session_id = ?
  )
ORDER BY m.set_id, m.group_index, m.role, m.kind
```

### Assembly in Swift

```swift
let bySet = Dictionary(grouping: measurements, by: \.setId)
for set in sets {
    let measurements = bySet[set.id] ?? []
    let entries = buildEntries(measurements)  // group by groupIndex, pivot by kind
    // ... attach entries to set
}
```

## CloudKit Sync

### SetMeasurement record type

```
RECORD TYPE SetMeasurement (
    setId       REFERENCE QUERYABLE,
    parentType  STRING,
    role        STRING,
    kind        STRING QUERYABLE,
    value       DOUBLE,
    unit        STRING,
    groupIndex  INT64,
    updatedAt   TIMESTAMP QUERYABLE SORTABLE
)
```

### Dual-read window

During the transition period, the CKRecordMapper accepts both old-format records (with target*/actual* fields on SessionSet/PlannedSet) and new-format records (SetMeasurement). Old-format records are converted to measurements on merge. New code only writes SetMeasurement records.

After one release cycle (all devices upgraded), the old fields can be removed from the CloudKit schema.

## Migration

### Database migration (V next)

1. Create `set_measurements` table.
2. For each row in `session_sets`: extract target*/actual* columns into measurement rows with `parent_type='session'`, `group_index=0`.
3. For each row in `template_sets`: extract target* columns into measurement rows with `parent_type='planned'`, `group_index=0`.
4. Drop the target*/actual* columns from both tables (SQLite requires table rebuild via CREATE TABLE AS).

### No drop set coalescing needed

The `parent_set_id` and `drop_sequence` columns exist in the schema but are never populated by current code. Migration simply removes these unused columns. Future drop set support uses `group_index` on measurements.
