# LiftMark Workout Format - Quick Reference

## Minimal Example

```markdown
# Push Day

## Bench Press
- 135 x 5
- 185 x 5
- 225 x 5

## Overhead Press
- 95 x 8
- 115 x 8
- 135 x 6
```

---

## Complete Example

```markdown
# Push Day
@tags: strength, upper
@units: lbs

Feeling strong today, going for a PR on bench.

## Bench Press

Focus on leg drive and bar path.

- 135 x 5 @rest: 90s
- 185 x 5 @rest: 120s
- 225 x 5 @rest: 180s
- 245 x 3 @rest: 180s
- 265 x 1

## Incline Dumbbell Press
- 70 x 10 @rest: 90s
- 80 x 8 @rest: 90s
- 80 x 8 @rest: 90s

## Superset: Chest Finisher

### Cable Fly
- 30 x 15 @rest: 30s
- 30 x 15 @rest: 30s

### Dumbbell Pullover
- 50 x 15 @rest: 90s
- 50 x 15 @rest: 90s

## Tricep Pushdown
- 60 x 15
- 70 x 12
- 80 x 10
- 60 x AMRAP @dropset
```

---

## Syntax Summary

### Workout Header
```markdown
# [Workout Name]              # Any header level (H1-H6)
@tags: tag1, tag2             # Optional tags
@units: lbs|kg                # Optional default weight units

Freeform notes here.          # Optional notes
```

### Exercise Header
```markdown
## [Exercise Name]            # One level below workout
@type: [equipment]            # Optional freeform equipment type

Freeform notes here.          # Optional notes
```

### Set Formats

**Standard sets:**
```markdown
- 225 x 5                     # Weight x reps (unit assumed)
- 225 lbs x 5                 # Explicit pounds
- 100 kg x 5                  # Kilograms
```

**Bodyweight:**
```markdown
- 10                          # Bodyweight reps
- bw x 10                     # Explicit bodyweight
```

**Time-based:**
```markdown
- 60s                         # 60 seconds (bodyweight)
- 45 lbs x 60s                # 45 lbs for 60 seconds
- 45 lbs for 60s              # Alternative syntax
```

**AMRAP:**
```markdown
- 135 x AMRAP                 # As many reps as possible
- AMRAP                       # Bodyweight AMRAP
```

**Default units:**
```markdown
# Push Day
@units: kg                    # Sets default to kg for this workout

## Bench Press
- 100 x 5                     # Uses kg (from @units)
- 110 kg x 5                  # Explicit kg (redundant but allowed)
- 225 lbs x 3                 # Override with explicit lbs
```

---

## Modifiers

All modifiers are optional and go at the end of the set line:

| Modifier | Format | Example |
|----------|--------|---------|
| Rest | `@rest: [time]s` or `@rest: [time]m` | `@rest: 180s` or `@rest: 3m` |
| Drop set | `@dropset` | `@dropset` |

**Deprecated** (still parsed for backward compatibility — use freeform notes instead):

| Modifier | Format | Example |
|----------|--------|---------|
| RPE | `@rpe: 1-10` | `@rpe: 8` |
| Tempo | `@tempo: X-X-X-X` | `@tempo: 3-0-1-0` |

**Combining modifiers:**
```markdown
- 225 lbs x 5 @rest: 180s
- 185 lbs x 8 @rest: 90s @dropset
```

---

## Special Cases

### Supersets

Use nested headers - the parent header is the superset name, children are the exercises:

```markdown
## Superset: Arms

### Bicep Curl
- 30 lbs x 12
- 30 lbs x 12

### Tricep Extension
- 40 lbs x 12
- 40 lbs x 12
```

**Multiple supersets:**
```markdown
## Superset 1

### Cable Fly
- 30 lbs x 15

### Dumbbell Pullover
- 50 lbs x 15

## Superset 2

### Lateral Raise
- 20 lbs x 12

### Face Pull
- 40 lbs x 15
```

### Drop Sets

```markdown
## Lateral Raise
- 20 lbs x 12
- 15 lbs x 10 @dropset
- 10 lbs x 8 @dropset
```

### Warmup and Cooldown

Use section grouping (nested headers without "superset" in the name):

```markdown
# Push Day

## Warmup
### Arm Circles
- 10

### Band Pull-Aparts
- 20

## Bench Press
- 225 x 5

## Cooldown
### Stretching
- 60s

### Foam Rolling
- 2m
```

**Note**: Headers containing "superset" = exercises performed together. Headers without "superset" = section grouping.

### Multiple Workouts in One Document

```markdown
# Training Log

## Week 1

### Monday: Push
@tags: upper

#### Bench Press
- 225 x 5

### Tuesday: Pull
@tags: upper

#### Deadlift
- 315 x 5
```

---

## Common Patterns

### Progressive Overload
```markdown
## Squat
- 135 x 5 @rest: 90s
- 185 x 5 @rest: 120s
- 225 x 5 @rest: 180s
- 245 x 3 @rest: 180s
- 265 x 1
```

### Volume Training
```markdown
## Bench Press
- 185 x 8 @rest: 90s
- 185 x 8 @rest: 90s
- 185 x 8 @rest: 90s
- 185 x 8 @rest: 90s
- 185 x 8 @rest: 90s
```

### Pyramid Sets
```markdown
## Incline Press
- 135 x 12
- 155 x 10
- 175 x 8
- 195 x 6
- 175 x 8
- 155 x 10
- 135 x 12
```

### Circuit Training
```markdown
## Push-ups
- 20 @rest: 30s

## Squats
- 20 @rest: 30s

## Pull-ups
- 10 @rest: 30s

## Burpees
- 10 @rest: 90s
```

---

## Tips

### For Manual Writing
- Start minimal, add details as needed
- Use shortcuts: `225 x 5` instead of `225 lbs x 5 reps`
- Add notes for form cues or how you felt
- Use freeform notes to track RPE, tempo, or other details

### For LLM Generation
- Prompts work best when you specify:
  - Training goal (strength, hypertrophy, endurance)
  - Experience level (beginner, intermediate, advanced)
  - Available equipment
  - Time constraints

**Example prompt:**
```
Create a 3-day upper/lower split for intermediate strength training
in LiftMark format. Focus on compound movements with 5x5 scheme.
Include RPE and rest times.
```

---

## Validation Quick Check

✅ **Valid workout:**
- Has a header
- Has at least one exercise (sub-header)
- Each exercise has at least one set (list item with `-`)

❌ **Invalid:**
- No header
- No exercises
- Exercise with no sets
- Negative weights
- RPE outside 1-10 range

---

**Spec Version:** 1.1
**Last Updated:** 2026-02-17
