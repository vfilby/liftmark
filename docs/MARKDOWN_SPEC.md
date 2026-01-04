# LiftMark Workout Format (LMWF) Specification v1.0

## Overview

The LiftMark Workout Format (LMWF) is a markdown-based format designed for easy workout creation and import. It's optimized to be:

- **LLM-Friendly**: Simple structure that AI assistants can easily generate
- **Human-Readable**: Clear syntax that humans can write and edit
- **Flexible**: Supports simple to advanced workout tracking
- **Extensible**: Easy to add new features without breaking existing workouts

---

## Table of Contents

1. [Basic Structure](#basic-structure)
2. [Workout Header](#workout-header)
3. [Exercise Blocks](#exercise-blocks)
4. [Set Format](#set-format)
5. [Modifiers](#modifiers)
6. [Examples](#examples)
7. [Validation Rules](#validation-rules)
8. [Edge Cases](#edge-cases)
9. [Future Extensions](#future-extensions)

---

## Basic Structure

Every workout follows this hierarchical structure:

```
# [Workout Name]
[Optional freeform notes/description]

## [Exercise Name]
[Optional freeform notes]
- [Set 1]
- [Set 2]
- [Set N]

## [Next Exercise]
...
```

**Key Principles:**
- **Flexible Headers**: Workout can be any header level (H1-H6), exercise must be one level below
- **Freeform Notes**: Any text between headers is treated as notes
- **Minimal Metadata**: No required `@` metadata, keep it simple
- **Name = Header**: The header text is the name (no "Workout:" prefix needed)

---

## Workout Header

### Required
- Any header level (H1-H6) - The header text is the workout name

### Optional Metadata
- `@tags: [tag1, tag2, ...]` - Comma-separated tags for organization
- `@units: [lbs|kg]` - Default weight unit for this workout (if not specified on individual sets)
- **Freeform notes**: Any text after the header (before first exercise) is treated as workout notes

### Examples

**Minimal:**
```markdown
# Push Day
```

**With freeform notes:**
```markdown
## Push Day A

Feeling strong today, going for PRs on bench.
Sleep was good, nutrition on point.

## Bench Press
- 225 x 5
```

**With tags:**
```markdown
### Push Day A
@tags: push, strength, upper

Ready to hit some PRs today!

## Bench Press
- 225 x 5
```

**With default units:**
```markdown
# Push Day
@units: kg

Prefer using kilograms - easier for tracking.

## Bench Press
- 100 x 5       # Uses kg (from @units)
- 110 x 5       # Uses kg (from @units)
- 120 kg x 3    # Explicit kg (redundant but allowed)
- 225 lbs x 1   # Override with explicit lbs

## Overhead Press
- 50 x 8        # Uses kg (from @units)
- 55 x 8        # Uses kg (from @units)
```

**Multiple workouts in one document:**
```markdown
# My Training Log

## Week 1

### Day 1: Push
@tags: push

Great session, felt strong.

#### Bench Press
- 225 x 5
- 245 x 3

#### Overhead Press
- 135 x 8

### Day 2: Pull
@tags: pull

Tired but got through it.

#### Deadlift
- 315 x 5
- 365 x 3
```

---

## Exercise Blocks

### Required
- Header one level below workout header - The header text is the exercise name

### Optional Metadata
- `@type: [equipment]` - Freeform equipment type (e.g., `barbell`, `dumbbell`, `cable`, `resistance band`, `kettlebell`) - completely optional
- **Freeform notes**: Any text after the exercise header (before first set) is treated as exercise notes

### Examples

**Simple exercise:**
```markdown
## Bench Press
- 135 x 5
- 185 x 5
- 225 x 5
```

**With freeform notes:**
```markdown
## Bench Press

Retract scapula, touch chest on every rep.
Focus on driving through the floor.

- 135 lbs x 5 reps
- 185 lbs x 5 reps
- 225 lbs x 5 reps
```

**With optional type:**
```markdown
## Bench Press
@type: barbell

- 135 lbs x 5 reps
- 185 lbs x 5 reps

## Band Pull-Apart
@type: resistance band

- 20 reps
- 20 reps
```

**Superset (nested headers):**
```markdown
## Superset: Arms

### Dumbbell Curl
- 30 lbs x 12
- 30 lbs x 12
- 30 lbs x 10

### Tricep Extension
- 40 lbs x 12
- 40 lbs x 12
- 40 lbs x 12
```

**Multiple supersets:**
```markdown
## Superset 1

### Cable Fly
- 30 lbs x 15
- 30 lbs x 15

### Dumbbell Pullover
- 50 lbs x 15
- 50 lbs x 15

## Superset 2

### Lateral Raise
- 20 lbs x 12
- 20 lbs x 12

### Face Pull
- 40 lbs x 15
- 40 lbs x 15
```

---

## Set Format

### Basic Syntax

```
- [weight] [unit] x [reps] [reps_unit] [@modifiers]
```

### Components

1. **Weight** (optional for bodyweight):
   - Number (integer or decimal)
   - Can be omitted for bodyweight exercises

2. **Unit**:
   - `lbs` - Pounds
   - `kg` - Kilograms
   - `bw` - Bodyweight (can be omitted if no weight specified)

3. **Reps**:
   - Number (integer)
   - `AMRAP` - As Many Reps As Possible
   - Can be omitted for time-based exercises

4. **Reps Unit** (optional):
   - `reps` - Repetitions (default, can be omitted)
   - `s` or `sec` - Seconds (for time-based)
   - `m` or `min` - Minutes

### Flexible Formats

All of these are valid:

```markdown
# Minimal (assumes reps, no unit)
- 225 x 5

# Explicit
- 225 lbs x 5 reps

# Kilograms
- 100 kg x 5 reps

# Bodyweight
- bw x 10
- x 10          # Bodyweight implied
- 10            # Single number = bodyweight reps

# Time-based (duration exercises)
- 60s           # 60 seconds (plank, hold)
- 2m            # 2 minutes
- 90 sec        # 90 seconds

# Time-based with weight
- 45 lbs x 60s  # Weighted plank with 45lb plate for 60 seconds
- 100 kg x 30s  # Weighted holds
- 25 lbs for 45s # Alternative "for" syntax

# AMRAP
- 135 x AMRAP
- bw x AMRAP
```

---

## Modifiers

Modifiers provide additional context for each set. They use `@key: value` format at the end of the set line.

### Available Modifiers

| Modifier | Values | Description | Example |
|----------|--------|-------------|---------|
| `@rpe` | 1-10 | Rate of Perceived Exertion (10 = max effort) | `@rpe: 8` |
| `@rest` | Number + `s`/`m` | Rest period after set | `@rest: 180s` or `@rest: 3m` |
| `@tempo` | X-X-X-X | Tempo (eccentric-pause-concentric-pause) in seconds | `@tempo: 3-0-1-0` |
| `@dropset` | flag | Drop set indicator (presence = true) | `@dropset` |

### Examples

```markdown
# RPE tracking
- 225 lbs x 5 reps @rpe: 7
- 245 lbs x 5 reps @rpe: 9
- 265 lbs x 3 reps @rpe: 10  # Max effort

# Rest periods
- 315 lbs x 3 reps @rest: 3m
- 315 lbs x 3 reps @rest: 180s

# Tempo
- 185 lbs x 8 reps @tempo: 3-0-1-0 @rest: 90s

# Multiple modifiers
- 225 lbs x 5 reps @rpe: 8 @rest: 180s

# AMRAP (to failure implied)
- 135 lbs x AMRAP
- bw x AMRAP @rpe: 10

# Drop set
- 100 lbs x 12 reps
- 70 lbs x 10 reps @dropset
- 50 lbs x 8 reps @dropset
```

---

## Examples

### Example 1: Beginner Full Body

```markdown
# Full Body A
@tags: beginner, full-body

First week back, keeping it light and focusing on form.

## Squat
- 135 x 5
- 135 x 5
- 135 x 5

## Bench Press
- 95 x 5
- 95 x 5
- 95 x 5

## Barbell Row
- 85 x 8
- 85 x 8
- 85 x 8
```

### Example 2: Advanced Powerlifting

```markdown
# Squat Day - Week 3 Heavy
@tags: powerlifting, squat, heavy

Competition prep, 4 weeks out. Feeling good, bodyweight at 220.

## Low Bar Squat

Competition depth, belt on work sets starting at 315.

- 135 lbs x 5 reps @rpe: 4 @rest: 60s
- 225 lbs x 5 reps @rpe: 5 @rest: 90s
- 315 lbs x 3 reps @rpe: 6 @rest: 120s
- 365 lbs x 1 reps @rpe: 7 @rest: 180s
- 405 lbs x 3 reps @rpe: 8 @rest: 300s
- 405 lbs x 3 reps @rpe: 9 @rest: 300s
- 405 lbs x 3 reps @rpe: 9.5 @rest: 300s

## Pause Squat

2 second pause at bottom, no belt.

- 315 lbs x 3 reps @tempo: 3-2-3-0 @rest: 180s
- 315 lbs x 3 reps @tempo: 3-2-3-0 @rest: 180s
- 315 lbs x 3 reps @tempo: 3-2-3-0 @rest: 180s

## Front Squat
- 225 lbs x 5 reps @rest: 120s
- 225 lbs x 5 reps @rest: 120s
- 225 lbs x 5 reps @rest: 120s

## Leg Curl
- 90 lbs x 12 reps @rest: 60s
- 90 lbs x 12 reps @rest: 60s
- 90 lbs x 12 reps @rest: 60s
```

### Example 3: Bodybuilding with Supersets

```markdown
# Chest & Triceps
@tags: bodybuilding, push, hypertrophy

## Barbell Bench Press
- 135 lbs x 12 reps @rest: 90s
- 185 lbs x 10 reps @rest: 90s
- 205 lbs x 8 reps @rest: 90s
- 205 lbs x 8 reps @rest: 90s

## Incline Dumbbell Press
- 70 lbs x 12 reps @rest: 90s
- 75 lbs x 10 reps @rest: 90s
- 75 lbs x 9 reps @rest: 90s

## Superset: Chest Finisher

### Cable Fly
- 30 lbs x 15 reps @rest: 30s
- 30 lbs x 15 reps @rest: 30s
- 30 lbs x 12 reps @rest: 30s

### Dumbbell Pullover
- 50 lbs x 15 reps @rest: 90s
- 50 lbs x 15 reps @rest: 90s
- 50 lbs x 15 reps @rest: 90s

## Tricep Pushdown

Final set is a drop set.

- 60 lbs x 15 reps @rest: 60s
- 70 lbs x 12 reps @rest: 60s
- 80 lbs x 10 reps @rest: 60s
- 60 lbs x 15 reps @dropset
```

### Example 4: Bodyweight & Time-Based

```markdown
# Calisthenics
@tags: bodyweight, calisthenics

## Pull-ups
- 10 @rest: 120s
- 8 @rest: 120s
- 6 @rest: 120s
- AMRAP

## Dips
- 12 @rest: 90s
- 10 @rest: 90s
- 8 @rest: 90s

## Plank

Adding weight on last two sets.

- 60s @rest: 30s
- 45 lbs x 60s @rest: 30s
- 45 lbs for 45s

## Weighted Plank Hold
- 45 lbs for 45s @rest: 60s
- 25 lbs for 60s

## Hanging Leg Raise
- 15 @rest: 60s
- 12 @rest: 60s
- 10 @rest: 60s
```

### Example 5: CrossFit/HIIT Circuit

```markdown
# Workout: EMOM 20
@date: 2026-01-15
@tags: crossfit, conditioning, EMOM
@notes: Every minute on the minute for 20 minutes

## Kettlebell Swing
@type: other
@circuit: A
- 53 lbs x 15 reps

## Box Jump
@type: bodyweight
@circuit: A
- 24 inches x 10 reps

## Burpee
@type: bodyweight
@circuit: A
- 10

## Row
@type: machine
@circuit: A
- 200m
```

### Example 6: Olympic Lifting

```markdown
# Workout: Snatch Technique
@date: 2026-01-15
@tags: weightlifting, snatch, technique

## Snatch
@type: barbell
@notes: Focus on third pull, fast elbows
- 45 lbs x 5 reps @rest: 90s
- 75 lbs x 3 reps @rest: 90s
- 95 lbs x 2 reps @rest: 120s
- 115 lbs x 2 reps @rest: 150s
- 135 lbs x 1 reps @rest: 180s
- 155 lbs x 1 reps @rest: 180s
- 165 lbs x 1 reps @rest: 180s
- 165 lbs x 1 reps @rest: 180s

## Snatch Pull
@type: barbell
- 175 lbs x 3 reps @rest: 120s
- 185 lbs x 3 reps @rest: 120s
- 185 lbs x 3 reps @rest: 120s

## Overhead Squat
@type: barbell
- 95 lbs x 5 reps @rest: 90s
- 115 lbs x 3 reps @rest: 90s
- 135 lbs x 3 reps @rest: 90s
- 135 lbs x 3 reps @rest: 90s
```

### Example 7: Multiple Workouts in One Document

```markdown
# My Training Log - January 2026

## Week 1

### Monday: Upper Body
@tags: push, upper

Great session today!

#### Bench Press
- 225 x 5
- 245 x 3
- 265 x 1

#### Rows
- 135 x 10
- 155 x 8
- 175 x 6

### Wednesday: Lower Body
@tags: legs, squat

Legs still sore from Monday.

#### Squat
- 315 x 5
- 335 x 5
- 355 x 3

#### Romanian Deadlift
- 225 x 10
- 225 x 10

### Friday: Full Body
@tags: conditioning

Quick conditioning session.

#### Kettlebell Swings
- 53 lbs x 20
- 53 lbs x 20
- 53 lbs x 15

#### Burpees
- 10
- 10
- 8
```

### Example 8: Workout with Warmup and Cooldown

```markdown
# Push Day
@tags: strength, push

## Warmup

### Arm Circles
- 10 reps

### Band Pull-Aparts
- 20 reps

### Light Bench Press
- 45 lbs x 10
- 95 lbs x 5

## Bench Press
- 135 lbs x 5 @rest: 120s
- 185 lbs x 5 @rest: 180s
- 225 lbs x 5 @rpe: 8 @rest: 180s
- 245 lbs x 3 @rpe: 9

## Overhead Press
- 95 lbs x 8 @rest: 90s
- 115 lbs x 8 @rest: 90s
- 135 lbs x 6 @rpe: 8

## Cooldown

### Chest Stretch
- 60s

### Shoulder Stretch
- 60s

### Foam Rolling
- 2m
```

### Example 9: Rehabilitation/Physical Therapy

```markdown
# Knee Rehab - Day 3
@tags: rehab, knee, physical-therapy

No pain during exercises, feeling good. PT says I can progress weight next week.

## Terminal Knee Extension
- 10 lbs x 20 reps @rest: 30s
- 10 lbs x 20 reps @rest: 30s
- 10 lbs x 20 reps @rest: 30s

## Wall Sit
- 30s @rest: 60s
- 30s @rest: 60s
- 30s @rest: 60s

## Single Leg Balance

Eyes closed on last set.

- 45s @rest: 30s
- 45s @rest: 30s
- 30s

## Leg Curl
- 20 lbs x 15 reps @rest: 45s
- 20 lbs x 15 reps @rest: 45s
```

---

## Validation Rules

### Required Elements
1. ✅ Must have workout header (any header level H1-H6)
2. ✅ Must have at least one exercise (one level below workout header)
3. ✅ Each exercise must have at least one set

### Format Rules
4. ✅ Workout name cannot be empty
5. ✅ Exercise names cannot be empty
6. ✅ Sets must start with `-` (list item)
7. ✅ Weight must be positive number (if provided)
8. ✅ Reps must be positive number or "AMRAP" (if provided)
9. ✅ Time must be positive number with valid unit (s/sec/m/min)
10. ✅ RPE must be between 1-10 (if provided)
11. ✅ Rest time must be positive number (if provided)
12. ✅ Tempo must be X-X-X-X format with single digits (if provided)
13. ✅ Default units must be "lbs" or "kg" (if provided)

### Warnings (non-blocking)
- ⚠️ Duplicate exercise names (suggests merge or rename)
- ⚠️ Very high rep count (>100, might be typo)
- ⚠️ Very short rest (<10s, might be typo)
- ⚠️ Very long rest (>10m, might be typo)

### Error Examples

**Invalid - No workout header:**
```markdown
## Squats
- 225 x 5
```
❌ Error: Missing workout header (must have a header above exercises)

**Invalid - No exercises:**
```markdown
# Empty Workout
@tags: test

Some notes but no exercises.
```
❌ Error: Workout must contain at least one exercise

**Invalid - No sets:**
```markdown
# Workout: Test
## Bench Press
```
❌ Error: Exercise "Bench Press" has no sets

**Invalid - Negative weight:**
```markdown
# Workout: Test
## Squat
- -135 x 5
```
❌ Error: Weight cannot be negative

**Invalid - Invalid RPE:**
```markdown
# Workout: Test
## Bench Press
- 225 x 5 @rpe: 11
```
❌ Error: RPE must be between 1-10

**Invalid - Invalid units:**
```markdown
# Workout: Test
@units: pounds

## Bench Press
- 225 x 5
```
❌ Error: Default units must be "lbs" or "kg"

---

## Edge Cases

### Handling Ambiguity

**Case 1: Single number - is it reps or weight?**
```markdown
- 10
```
**Interpretation:** 10 bodyweight reps (weight requires unit)

**Case 2: Number with unit only**
```markdown
- 135 lbs
```
**Interpretation:** Invalid - must have reps or time

**Case 3: Mixed units in same exercise**
```markdown
## Dumbbell Press
- 50 lbs x 10
- 25 kg x 8
```
**Interpretation:** Valid - parser respects per-set units

**Case 4: Extra whitespace**
```markdown
## Squat
-    225   lbs  x   5   reps   @rpe:  8
```
**Interpretation:** Valid - parser is whitespace-tolerant

**Case 5: Bodyweight meaning - Does weight include user's bodyweight?**
```markdown
## Squat
- 225 lbs x 5     # 225 lbs barbell, bodyweight not counted

## Pull-up
- 10              # Bodyweight only
- 25 lbs x 8      # Bodyweight + 25lb weight belt

## Plank
- 60s             # Bodyweight only
- 45 lbs x 45s    # Bodyweight + 45lb plate on back
```
**Interpretation:** Weight always represents **external/additional resistance only**. User's bodyweight is never included in the weight number. This convention works for all exercises:
- **Barbell exercises** (Squat, Bench, Deadlift): Weight = bar + plates
- **Bodyweight + load** (Pull-up, Dip, Plank): Weight = additional resistance
- **Bodyweight only**: No weight specified, or weight = 0

**Why this works:** For progress tracking, we only care about changes in external load over time, not absolute total load. Consistency within an exercise is what matters.

**Case 6: Markdown formatting in notes**
```markdown
# Workout: Test
@notes: This is **bold** and *italic*

## Squat
@notes: Focus on *depth* and **power**
- 225 x 5
```
**Interpretation:** Valid - preserve markdown in notes for display

**Case 7: Special characters in names**
```markdown
## Barbell Back Squat (Low Bar)
- 315 x 5

## DB Bench Press - 30° Incline
- 80 x 10
```
**Interpretation:** Valid - allow special characters in names

---

## Parsing Strategy

### Parser Behavior

1. **Case Insensitive Units**: `LBS`, `lbs`, `Lbs` all valid
2. **Whitespace Tolerant**: Multiple spaces, tabs handled
3. **Line Endings**: Support CRLF, LF, CR
4. **UTF-8 Encoding**: Support international characters
5. **Partial Parse**: Continue parsing after non-critical errors
6. **Error Recovery**: Provide helpful error messages with line numbers

### Parsing Steps

1. **Split into lines** and normalize line endings
2. **Identify workout header(s)**:
   - If user selects specific header → that's the workout
   - If importing whole document → find all headers that have sub-headers with sets
   - Headers with child headers containing list items (sets) are workouts
3. **Extract workout metadata**:
   - Lines starting with `@` immediately after header
   - All other text until next header = freeform notes
4. **Identify exercises** (headers one level below workout):
   - Must have at least one set (list item with `-`)
5. **For each exercise**:
   - Extract `@` metadata lines
   - Collect freeform notes (text before first set)
   - Parse sets (lines starting with `-`)
6. **Validate structure** against rules
7. **Return parse result** with data + errors/warnings

### Header Level Detection

**Strategy**: Flexible header detection based on document structure

```markdown
# Training Log              ← Not a workout (no sets under it)

## Week 1                   ← Not a workout (no sets under it)

### Day 1: Push             ← WORKOUT (has exercises with sets)
#### Bench Press            ← Exercise (has sets)
- 225 x 5

### Day 2: Pull             ← WORKOUT
#### Deadlift               ← Exercise
- 315 x 5
```

**Detection Logic**:
1. A header is a workout if it has child headers that contain list items (sets)
2. A header is an exercise if it's one level below a workout and has list items
3. A header containing "superset" (case-insensitive) with child exercises = superset
4. A header with child exercises but no "superset" in name = section grouping (warmup, cooldown, etc.)
5. This allows workouts to be embedded in any document structure

**Superset vs Section Grouping Example**:
```markdown
### Push Day              ← Workout (has exercises below)

#### Warmup               ← Section (no "superset" in name)
##### Arm Circles         ← Exercise (warmup exercise)
- 10

#### Bench Press          ← Exercise (main work)
- 225 x 5

#### Superset: Chest      ← Superset (contains "superset")
##### Cable Fly           ← Exercise (part of superset)
- 30 x 15

##### Pullover            ← Exercise (part of superset)
- 50 x 15

#### Cooldown             ← Section (no "superset" in name)
##### Stretching          ← Exercise (cooldown)
- 60s
```

**Key Rule**: If header name contains "superset" (case-insensitive), it's a superset. Otherwise, it's a section grouping.

### Parse Result Structure

```typescript
interface ParseResult {
  success: boolean;
  workout?: WorkoutTemplate;
  errors: ParseError[];
  warnings: ParseWarning[];
}

interface ParseError {
  line: number;
  message: string;
  code: string;
}

interface ParseWarning {
  line: number;
  message: string;
  code: string;
}
```

---

## Future Extensions

### Potential v2.0 Features

**Plates calculation:**
```markdown
- 315 lbs x 5 @plates: 45,45,25,10
```

**Cardio tracking:**
```markdown
## Running
@type: cardio
- 5km in 25m @pace: 5:00/km @heart_rate: 165
```

**Complex set schemes:**
```markdown
## Bench Press
- 225 x 5,5,5 @rest_between: 10s  # Cluster set
- 135 x 20 @pause: 5,10,15        # Rest-pause set
```

**Video references:**
```markdown
## Squat
@video: https://youtube.com/watch?v=xyz
- 315 x 5
```

**Workout programming:**
```markdown
# Workout: Week 1 - Day 1
@program: 5/3/1
@week: 1
@cycle: 1
```

---

## LLM Prompt Template

When asking an LLM to generate a workout, use this template:

```
Create a workout in LiftMark Workout Format (LMWF) for [describe workout goal/type].

Format requirements:
- Start with workout name as a header: # [Workout Name]
- Add @tags if relevant
- Add @units: lbs or @units: kg to set default weight units (optional)
- Freeform notes go after the header
- Each exercise is one header level below: ## [Exercise Name]
- Exercise notes are freeform text after exercise header
- Sets format: - [weight] [unit] x [reps] or - [weight] [unit] for [time]
- If @units is set, weight units can be omitted: - [weight] x [reps]
- Optional modifiers: @rpe (1-10), @rest (time), @tempo (X-X-X-X), @dropset (flag)
- For supersets, use nested headers (e.g., ## Superset: Arms, then ### Exercise1, ### Exercise2)
- AMRAP implies to failure (no need for separate failure flag)

Example:
# Push Day
@tags: strength, push
@units: lbs

Feeling good today, going for PRs.

## Bench Press

Focus on bar path and leg drive.

- 135 x 5 @rest: 120s
- 185 x 5 @rest: 180s
- 225 x 5 @rpe: 8

## Plank
- 45 for 60s
- 45 for 45s
```

---

## Changelog

### Version 1.0 (2026-01-03)
- Initial specification
- Basic workout structure
- Exercise and set format
- Modifiers: rpe, rest, tempo, failure, dropset, rir
- Superset and circuit support

---

## License

This specification is part of the LiftMark2 project.

---

## Design Decisions Made

Based on user feedback, the following design decisions were implemented:

1. ✅ **Freeform Notes**: Notes are now freeform text after headers, not `@notes:` metadata
2. ✅ **Optional Type**: `@type` is completely optional for exercises
3. ✅ **Time-based with Weight**: Supports `45 lbs x 60s` and `45 lbs for 60s` for weighted holds
4. ✅ **Flexible Headers**: Workouts can be any header level (H1-H6), exercises one level below
5. ✅ **No Date Required**: Date removed - import date and workout date are handled separately
6. ✅ **Name = Header**: Header text is the name, no prefix needed
7. ✅ **Superset Support**: Uses nested headers (e.g., `## Superset: Arms` with `### Exercise` children)
8. ✅ **Simplified Modifiers**:
   - Only `@rpe` (removed `@rir` - redundant with RPE)
   - `@dropset` is a flag, not `@dropset: true`
   - AMRAP implies failure, no `@failure` flag needed

## Open Questions for Review

1. **Modifiers**: Are there any critical modifiers missing? (e.g., percentage-based loading, cluster sets)
2. **Units**: Should we support other units (plates, bodyweight %, 1RM %, etc.)?
3. **Internationalization**: Should we support localized units/terms?
4. **Parsing Strictness**: How forgiving should the parser be with typos/variations?

---

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Status:** Draft - Ready for Review
