# Exercise Dictionary

> Canonical exercise definitions for name normalization and aggregation. Maps naming variants to a single canonical form so that history, PR detection, and max weight tiles merge data correctly.
>
> Source of truth: [`exercise-dictionary.json`](exercise-dictionary.json)

---

## Schema

Each entry in `exercise-dictionary.json` has:

| Field | Type | Description |
|-------|------|-------------|
| `canonical` | `string` | Display-preferred name (e.g., "Bench Press") |
| `aliases` | `string[]` | Lowercase naming variants (e.g., `["barbell bench press", "flat bench"]`) |
| `muscleGroups` | `string[]` | Primary and secondary muscle groups |
| `category` | `string` | One of: `compound`, `isolation`, `bodyweight`, `cardio` |

## Aliasing Rules

### What counts as an alias

Only **naming variants of the same movement** are aliased:

- "Back Squat" = "Barbell Squat" = "Squat" (same barbell movement)
- "OHP" = "Military Press" = "Overhead Press" (same standing barbell press)
- "RDL" = "Romanian Deadlift" (abbreviation)

### What stays separate

Different equipment or movement patterns are **not** aliased:

- "Dumbbell Bench Press" ≠ "Bench Press" (different equipment)
- "Incline Bench Press" ≠ "Bench Press" (different angle)
- "Front Squat" ≠ "Squat" (different bar position, different stimulus)
- "Sumo Deadlift" ≠ "Deadlift" (different stance)

### Conservative by default

When uncertain whether two names are the same movement, keep them separate. Users can always rename exercises in their workout plans to consolidate data.

## How Apps Use the Dictionary

### Aggregation only — stored names never change

The dictionary is used for **display and aggregation**. Exercise names stored in the database are never modified. When querying history, the app:

1. Fetches raw exercise names from the database
2. Maps each name to its canonical form via `getCanonicalName()`
3. Merges/deduplicates results by canonical name
4. Displays the canonical name to the user

### Lookup API (React Native)

Module: `react-ios/src/data/exerciseDictionary.ts`

| Function | Returns | Description |
|----------|---------|-------------|
| `getCanonicalName(name)` | `string` | Canonical name, or original if unknown |
| `isSameExercise(a, b)` | `boolean` | Whether two names map to the same canonical |
| `getAliases(name)` | `string[]` | All lowercase aliases for SQL IN clauses |
| `getExerciseDefinition(name)` | `ExerciseDefinition \| null` | Full definition or null |

### Normalized query functions

Repository functions with `*Normalized()` suffix use the dictionary to merge results across aliases:

- `getExerciseBestWeightsNormalized()` — merges max weights by canonical name
- `getMostFrequentExerciseNormalized()` — expands exclusion list to all aliases
- `getExerciseHistoryNormalized()` — queries across all aliases via SQL IN clause
- `getExerciseSessionHistoryNormalized()` — same approach
- `getExerciseProgressMetricsNormalized()` — same approach
- `getAllExercisesWithHistoryNormalized()` — deduplicates by canonical name

Original (non-normalized) functions remain for backward compatibility.

## Cross-Platform Usage

The JSON dictionary at `spec/data/exercise-dictionary.json` is the shared source of truth. Both the React Native and Swift apps should import it and build their own lookup structures at app startup.

The dictionary file should be updated when new common exercises or aliases are identified. Changes are backward-compatible — adding new entries or aliases never breaks existing data.
