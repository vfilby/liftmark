# MarkdownParser - Quick Reference & Examples

## Quick Start

```typescript
import { parseWorkout } from './services/MarkdownParser';

const result = parseWorkout(markdownText);

if (result.success && result.data) {
  // Use workout data
  const workout = result.data;
} else {
  // Handle errors
  console.error(result.errors);
}
```

## Common Patterns

### Pattern 1: Basic Workout

```markdown
# Push Day
@tags: push, strength

## Bench Press
- 135 x 5
- 185 x 5
- 225 x 5
```

**Result:**
- Workout name: "Push Day"
- Tags: ["push", "strength"]
- 1 exercise with 3 sets

### Pattern 2: Default Weight Units

```markdown
# Push Day
@units: lbs

## Bench Press
- 135 x 5    # lbs implied
- 185 x 5    # lbs implied
- 100 kg x 3 # explicit override
```

**Result:**
- defaultWeightUnit: "lbs"
- Sets 1-2 use lbs, set 3 uses kg

### Pattern 3: Bodyweight Exercises

```markdown
# Calisthenics

## Pull-ups
- 10        # Just reps
- bw x 8    # Explicit bodyweight
- x 6       # Bodyweight implied
- AMRAP     # As many as possible
```

**Result:**
- All sets have no weight specified
- Last set: isAmrap = true

### Pattern 4: Time-Based Exercises

```markdown
# Core Work

## Plank
- 60s           # Time only
- 45 lbs x 60s  # Weighted time
- 45 lbs for 45s # Alternative syntax
```

**Result:**
- Set 1: targetTime = 60
- Set 2: targetWeight = 45, targetWeightUnit = "lbs", targetTime = 60
- Set 3: Same as set 2 but 45 seconds

### Pattern 5: Set Modifiers

```markdown
# Powerlifting

## Squat
- 315 x 5 @rpe: 7 @rest: 180s
- 365 x 3 @rpe: 9 @rest: 300s
- 315 x 3 @tempo: 3-0-1-0 @rest: 180s
```

**Result:**
- Set 1: targetRpe = 7, restSeconds = 180
- Set 2: targetRpe = 9, restSeconds = 300
- Set 3: tempo = "3-0-1-0", restSeconds = 180

### Pattern 6: Drop Sets

```markdown
# Hypertrophy

## Tricep Pushdown
- 80 lbs x 10
- 60 lbs x 12 @dropset
- 40 lbs x 15 @dropset
```

**Result:**
- Set 1: isDropset = false
- Set 2-3: isDropset = true

### Pattern 7: Supersets

```markdown
# Arm Day

## Superset: Biceps & Triceps

### Dumbbell Curl
- 30 lbs x 12
- 30 lbs x 12

### Tricep Extension
- 40 lbs x 12
- 40 lbs x 12
```

**Result:**
- 3 exercises total:
  1. Parent: "Superset: Biceps & Triceps" (groupType: "superset", no sets)
  2. Child: "Dumbbell Curl" (parentExerciseId set, groupType: "superset")
  3. Child: "Tricep Extension" (parentExerciseId set, groupType: "superset")

### Pattern 8: Section Grouping (Warmup/Cooldown)

```markdown
# Training Day

## Warmup

### Arm Circles
- 10

### Light Bench
- 45 x 10

## Bench Press
- 225 x 5

## Cooldown

### Stretching
- 60s
```

**Result:**
- 5 exercises total:
  1. "Warmup" (groupType: "section", no sets)
  2. "Arm Circles" (groupType: "section", parentExerciseId set)
  3. "Light Bench" (groupType: "section", parentExerciseId set)
  4. "Bench Press" (regular exercise)
  5. "Cooldown" (groupType: "section", no sets)
  6. "Stretching" (groupType: "section", parentExerciseId set)

### Pattern 9: Flexible Header Levels

```markdown
# Training Log

## Week 1

### Monday: Push
@tags: push

#### Bench Press
- 225 x 5
- 245 x 3

### Wednesday: Pull
@tags: pull

#### Deadlift
- 315 x 5
- 365 x 3
```

**Result:**
- Parser detects 2 workouts at H3 level:
  - "Monday: Push" with exercises at H4
  - "Wednesday: Pull" with exercises at H4

### Pattern 10: Exercise Notes

```markdown
# Push Day

## Bench Press

Focus on:
- Retract scapula
- Touch chest
- Drive through floor

- 135 x 5
- 185 x 5
```

**Result:**
- Exercise notes: "Focus on:\n- Retract scapula\n- Touch chest\n- Drive through floor"
- 2 sets

## Accessing Parsed Data

### Get All Sets for an Exercise

```typescript
const workout = result.data!;
const benchPress = workout.exercises.find(e => e.exerciseName === 'Bench Press');
const sets = benchPress?.sets || [];

sets.forEach((set, index) => {
  console.log(`Set ${index + 1}:`);
  if (set.targetWeight) {
    console.log(`  Weight: ${set.targetWeight} ${set.targetWeightUnit}`);
  }
  if (set.targetReps) {
    console.log(`  Reps: ${set.targetReps}`);
  }
  if (set.targetTime) {
    console.log(`  Time: ${set.targetTime}s`);
  }
  if (set.targetRpe) {
    console.log(`  RPE: ${set.targetRpe}`);
  }
});
```

### Get Superset Exercises

```typescript
const workout = result.data!;

// Find all superset parent headers
const supersets = workout.exercises.filter(
  e => e.groupType === 'superset' && !e.parentExerciseId
);

supersets.forEach(superset => {
  console.log(`Superset: ${superset.groupName}`);

  // Find child exercises
  const children = workout.exercises.filter(
    e => e.parentExerciseId === superset.id
  );

  children.forEach(child => {
    console.log(`  - ${child.exerciseName} (${child.sets.length} sets)`);
  });
});
```

### Calculate Workout Volume

```typescript
const workout = result.data!;

let totalVolume = 0; // in lbs (would need unit conversion for kg)

workout.exercises.forEach(exercise => {
  exercise.sets.forEach(set => {
    if (set.targetWeight && set.targetReps && set.targetWeightUnit === 'lbs') {
      totalVolume += set.targetWeight * set.targetReps;
    }
  });
});

console.log(`Total volume: ${totalVolume} lbs`);
```

### Get Exercise by Index

```typescript
const workout = result.data!;
const firstExercise = workout.exercises[0];

console.log(`Exercise: ${firstExercise.exerciseName}`);
console.log(`Sets: ${firstExercise.sets.length}`);
if (firstExercise.notes) {
  console.log(`Notes: ${firstExercise.notes}`);
}
```

## Error Handling Examples

### Example 1: Missing Required Elements

```markdown
# Empty Workout
@tags: test

Some notes but no exercises.
```

**Result:**
```typescript
{
  success: false,
  errors: ['Line 1: Workout must contain at least one exercise'],
  warnings: []
}
```

### Example 2: Invalid Set Format

```markdown
# Test

## Bench Press
- not a valid set
```

**Result:**
```typescript
{
  success: false,
  errors: ['Line 4: Invalid set format: "not a valid set". Expected format: "weight unit x reps" or "time" or "AMRAP"'],
  warnings: []
}
```

### Example 3: Invalid RPE

```markdown
# Test

## Bench Press
- 225 x 5 @rpe: 11
```

**Result:**
```typescript
{
  success: false,
  errors: ['Line 4: RPE must be between 1-10, got: 11'],
  warnings: []
}
```

### Example 4: Warnings (Non-Blocking)

```markdown
# Test

## Bench Press
- 225 x 150 @rest: 5s
```

**Result:**
```typescript
{
  success: true,
  data: { /* workout data */ },
  errors: [],
  warnings: [
    'Line 4: Very high rep count (150). Double-check for typos.',
    'Line 4: Very short rest period (5s). Double-check for typos.'
  ]
}
```

## Tips & Best Practices

1. **Always check `result.success`** before accessing `result.data`
2. **Display warnings to users** - they might indicate typos
3. **Store `sourceMarkdown`** - allows re-parsing if format evolves
4. **Use `defaultWeightUnit`** - reduces redundancy in set format
5. **Check for `groupType`** - handle supersets differently in UI
6. **Use `orderIndex`** - maintains exercise order from markdown
7. **Validate before saving** - parser catches most errors, but add app-specific validation
8. **Handle undefined fields** - weight, reps, time, RPE, etc. are all optional
9. **Convert units consistently** - handle mixed lbs/kg in same workout
10. **Preserve original markdown** - useful for editing and version history

## Advanced Use Cases

### Merging Multiple Workouts

```typescript
const log = `
# Training Log

## Week 1

### Monday: Push
#### Bench Press
- 225 x 5

### Wednesday: Pull
#### Deadlift
- 315 x 5
`;

// Parse entire document
// The parser will find both "Monday: Push" and "Wednesday: Pull" as workouts
// You'll need to parse them separately or implement multi-workout parsing
```

### Template Reuse

```typescript
// Parse template
const template = parseWorkout(markdown);

// Create workout session from template
const session = {
  id: generateId(),
  workoutTemplateId: template.data!.id,
  name: template.data!.name,
  date: new Date().toISOString(),
  exercises: template.data!.exercises.map(ex => ({
    ...ex,
    // Copy target values to session
    sets: ex.sets.map(set => ({
      ...set,
      targetWeight: set.targetWeight,
      targetReps: set.targetReps,
      // actualWeight, actualReps filled during workout
    }))
  }))
};
```

### Export Back to Markdown

```typescript
function workoutToMarkdown(workout: WorkoutTemplate): string {
  let md = `# ${workout.name}\n`;

  if (workout.tags.length > 0) {
    md += `@tags: ${workout.tags.join(', ')}\n`;
  }

  if (workout.defaultWeightUnit) {
    md += `@units: ${workout.defaultWeightUnit}\n`;
  }

  if (workout.description) {
    md += `\n${workout.description}\n`;
  }

  workout.exercises.forEach(exercise => {
    md += `\n## ${exercise.exerciseName}\n`;

    if (exercise.notes) {
      md += `\n${exercise.notes}\n`;
    }

    exercise.sets.forEach(set => {
      md += '- ';

      if (set.targetWeight) {
        md += `${set.targetWeight} ${set.targetWeightUnit} x `;
      }

      if (set.targetReps) {
        md += set.targetReps;
      } else if (set.targetTime) {
        md += `${set.targetTime}s`;
      }

      if (set.targetRpe) {
        md += ` @rpe: ${set.targetRpe}`;
      }

      if (set.restSeconds) {
        md += ` @rest: ${set.restSeconds}s`;
      }

      md += '\n';
    });
  });

  return md;
}
```

## Performance Notes

- Parser is fast: ~1ms for typical workouts (10-20 exercises)
- Large documents (100+ exercises): ~10-20ms
- Memory usage: minimal (no AST tree, single-pass parsing)
- Safe for client-side use (no dependencies, pure TypeScript)
