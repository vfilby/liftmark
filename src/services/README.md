# MarkdownParser Service

Complete implementation of the LiftMark Workout Format (LMWF) parser.

## Overview

The `MarkdownParser` service parses markdown text into structured `WorkoutTemplate` objects according to the LMWF specification (v1.0). It supports all LMWF features including flexible header levels, freeform notes, metadata tags, supersets, and comprehensive set formats.

## Features

### Supported LMWF Features

1. **Flexible Header Levels**
   - Workout can be any header level (H1-H6)
   - Exercises are automatically detected one level below workout
   - Supports nested document structures (training logs, weekly plans)

2. **Freeform Notes**
   - Any text after headers becomes notes
   - Both workout-level and exercise-level notes
   - Preserves markdown formatting

3. **Metadata Support**
   - `@tags: tag1, tag2, tag3` - Workout categorization
   - `@units: lbs|kg` - Default weight units for the workout
   - `@type: equipment` - Optional equipment type for exercises

4. **Comprehensive Set Formats**
   - Weight x Reps: `225 lbs x 5`, `100 kg x 8`
   - Bodyweight: `x 10`, `bw x 12`, `15` (single number)
   - Time-based: `60s`, `2m`, `45 lbs x 60s`, `45 lbs for 60s`
   - AMRAP: `AMRAP`, `135 x AMRAP`, `bw x AMRAP`

5. **Set Modifiers**
   - `@rpe: 8` - Rate of Perceived Exertion (1-10)
   - `@rest: 180s` or `@rest: 3m` - Rest period
   - `@tempo: 3-0-1-0` - Tempo notation
   - `@dropset` - Drop set indicator

6. **Supersets & Sections**
   - Superset: Headers containing "superset" with nested exercises
   - Section grouping: Headers without "superset" (e.g., "Warmup", "Cooldown")

7. **Validation & Error Handling**
   - Clear error messages with line numbers
   - Non-blocking warnings for potential typos
   - Partial parsing with error collection

## Usage

### Basic Import and Parse

```typescript
import { parseWorkout } from './services/MarkdownParser';

const markdown = `
# Push Day
@tags: push, strength

## Bench Press
- 135 x 5
- 185 x 5
- 225 x 5

## Overhead Press
- 95 x 8
- 115 x 8
`;

const result = parseWorkout(markdown);

if (result.success && result.data) {
  const workout = result.data;
  console.log('Workout:', workout.name);
  console.log('Tags:', workout.tags);
  console.log('Exercises:', workout.exercises.length);

  // Access exercises and sets
  workout.exercises.forEach(exercise => {
    console.log(`${exercise.exerciseName}: ${exercise.sets.length} sets`);
    exercise.sets.forEach(set => {
      console.log(`  ${set.targetWeight}${set.targetWeightUnit} x ${set.targetReps}`);
    });
  });
} else {
  console.error('Parse errors:', result.errors);
}
```

### Parse Result Structure

```typescript
interface ParseResult<T> {
  success: boolean;      // true if parsing succeeded
  data?: T;              // WorkoutTemplate if successful
  errors?: string[];     // Critical errors (blocks save)
  warnings?: string[];   // Non-critical issues (typos, etc.)
}
```

### Example: Simple Workout

```typescript
const simple = `
# Full Body A
@tags: beginner, full-body

First week back, keeping it light.

## Squat
- 135 x 5
- 135 x 5
- 135 x 5

## Bench Press
- 95 x 5
- 95 x 5
- 95 x 5
`;

const result = parseWorkout(simple);
// result.data.name === "Full Body A"
// result.data.tags === ["beginner", "full-body"]
// result.data.description === "First week back, keeping it light."
// result.data.exercises.length === 2
```

### Example: With Default Units

```typescript
const withUnits = `
# Push Day
@units: kg

## Bench Press
- 100 x 5      # Uses kg (from @units)
- 110 x 5      # Uses kg
- 120 kg x 3   # Explicit kg (redundant but allowed)
- 225 lbs x 1  # Override with explicit lbs
`;

const result = parseWorkout(withUnits);
// result.data.defaultWeightUnit === "kg"
// Sets without explicit units use workout default
```

### Example: Supersets

```typescript
const superset = `
# Chest & Triceps

## Bench Press
- 185 lbs x 10
- 205 lbs x 8

## Superset: Chest Finisher

### Cable Fly
- 30 lbs x 15
- 30 lbs x 15

### Dumbbell Pullover
- 50 lbs x 15
- 50 lbs x 15
`;

const result = parseWorkout(superset);
// result.data.exercises will contain:
// 1. Bench Press (regular exercise)
// 2. Superset: Chest Finisher (parent grouping)
// 3. Cable Fly (child of superset)
// 4. Dumbbell Pullover (child of superset)

// Access superset exercises:
const supersetExercises = result.data.exercises.filter(
  e => e.groupType === 'superset' && e.parentExerciseId
);
```

### Example: Bodyweight & Time-Based

```typescript
const bodyweight = `
# Calisthenics

## Pull-ups
- 10
- 8
- AMRAP

## Plank
- 60s
- 45 lbs x 60s  # Weighted plank
`;

const result = parseWorkout(bodyweight);
// Pull-ups sets have targetReps only (no weight)
// Plank sets have targetTime (in seconds)
```

### Example: Advanced with Modifiers

```typescript
const advanced = `
# Squat Day

## Low Bar Squat
- 135 lbs x 5 @rpe: 4 @rest: 60s
- 225 lbs x 5 @rpe: 5 @rest: 90s
- 315 lbs x 3 @rpe: 6 @rest: 120s
- 405 lbs x 3 @rpe: 8 @rest: 300s

## Pause Squat
- 315 lbs x 3 @tempo: 3-2-3-0 @rest: 180s

## Leg Curl
- 90 lbs x 12
- 70 lbs x 10 @dropset
- 50 lbs x 8 @dropset
`;

const result = parseWorkout(advanced);
// Access modifiers:
const set = result.data.exercises[0].sets[0];
// set.targetRpe === 4
// set.restSeconds === 60
```

## Data Model

### WorkoutTemplate

```typescript
interface WorkoutTemplate {
  id: string;                    // Generated UUID
  name: string;                  // From header text
  description?: string;          // Freeform notes
  tags: string[];                // From @tags
  defaultWeightUnit?: 'lbs' | 'kg'; // From @units
  sourceMarkdown?: string;       // Original markdown (for re-parsing)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  exercises: TemplateExercise[];
}
```

### TemplateExercise

```typescript
interface TemplateExercise {
  id: string;
  workoutTemplateId: string;
  exerciseName: string;          // From header text
  orderIndex: number;            // Position in workout
  notes?: string;                // Freeform notes
  equipmentType?: string;        // From @type
  groupType?: 'superset' | 'section';
  groupName?: string;            // E.g., "Superset: Arms"
  parentExerciseId?: string;     // For grouped exercises
  sets: TemplateSet[];
}
```

### TemplateSet

```typescript
interface TemplateSet {
  id: string;
  templateExerciseId: string;
  orderIndex: number;
  targetWeight?: number;         // undefined = bodyweight
  targetWeightUnit?: 'lbs' | 'kg';
  targetReps?: number;
  targetTime?: number;           // seconds
  targetRpe?: number;            // 1-10
  restSeconds?: number;
  tempo?: string;                // e.g., "3-0-1-0"
  isDropset?: boolean;
}
```

## Validation

### Critical Errors (Prevent Save)

1. No workout header found
2. No exercises in workout
3. Exercise has no sets
4. Negative weight
5. Invalid reps/time (non-positive)
6. Invalid RPE (not 1-10)
7. Invalid @units (not lbs/kg)
8. Invalid set format
9. Invalid tempo format
10. Invalid rest time format

### Warnings (Non-Blocking)

1. Very high rep count (>100) - possible typo
2. Very short rest (<10s) - possible typo
3. Very long rest (>10m) - possible typo
4. Unknown modifiers - forward compatibility

## Error Handling

All errors include line numbers for easy debugging:

```typescript
const result = parseWorkout(invalidMarkdown);

if (!result.success) {
  result.errors?.forEach(error => {
    console.error(error); // "Line 15: Weight cannot be negative"
  });
}

// Warnings don't prevent success
if (result.warnings && result.warnings.length > 0) {
  result.warnings.forEach(warning => {
    console.warn(warning); // "Line 10: Very high rep count (150). Double-check for typos."
  });
}
```

## Implementation Details

### Parsing Strategy

1. **Line Preprocessing**: Normalize line endings, detect headers, lists, metadata
2. **Workout Detection**: Find headers with child exercises (flexible levels)
3. **Metadata Extraction**: Parse @tags, @units, @type
4. **Notes Collection**: Freeform text between headers
5. **Exercise Parsing**: Detect regular vs grouped (superset/section)
6. **Set Parsing**: Regex-based with comprehensive format support
7. **Validation**: Continuous error/warning collection
8. **UUID Generation**: All entities get unique IDs

### Regex Patterns

The parser uses multiple regex patterns for set parsing:

1. **Weight x Reps**: `(\d+(?:\.\d+)?)\s*(lbs?|kgs?|bw)?\s*(?:x|for)\s*(\d+|amrap)`
2. **Bodyweight**: `(?:(bw|x)\s*)?x\s*(\d+|amrap)`
3. **Time/Reps Only**: `(\d+)\s*(s|sec|m|min)?`

### Case Insensitivity

- Units: `LBS`, `lbs`, `Lbs` all valid
- Keywords: `AMRAP`, `amrap`, `Amrap` all valid
- Metadata: `@RPE`, `@rpe` both valid

### Whitespace Tolerance

Parser handles:
- Multiple spaces/tabs
- Extra whitespace around operators
- Different line endings (CRLF, LF, CR)

## Testing

See `__tests__/MarkdownParser.example.ts` for comprehensive examples including:

- Simple workouts
- Supersets and sections
- Bodyweight exercises
- Time-based exercises
- Advanced powerlifting with all modifiers
- Multi-workout documents

## Specification

Full LMWF specification: `/MARKDOWN_SPEC.md`

