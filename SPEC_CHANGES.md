# Markdown Spec Changes - Summary

## Changes Made Based on Feedback

### 1. ✅ Freeform Notes Instead of @notes Metadata

**Before:**
```markdown
# Workout: Push Day
@notes: Feeling strong today
```

**After:**
```markdown
# Push Day

Feeling strong today. Sleep was good, nutrition on point.
```

**Rationale**: More natural markdown style, easier for humans to write and LLMs to generate.

---

### 2. ✅ Optional @type for Exercises

**Before:**
```markdown
## Bench Press
@type: barbell  ← Required
- 225 x 5
```

**After:**
```markdown
## Bench Press  ← @type is now completely optional
- 225 x 5
```

**Rationale**: Type can often be inferred from exercise name, reduces boilerplate.

---

### 3. ✅ Time-Based Exercises with Weight Support

**New Syntax:**
```markdown
## Plank
- 60s                    # Bodyweight plank for 60 seconds
- 45 lbs x 60s           # Weighted plank (45lb plate) for 60 seconds
- 45 lbs for 45s         # Alternative "for" syntax
```

**Use Case**: Weighted planks, weighted holds, farmer carries with time duration.

---

### 4. ✅ Flexible Header Levels

**Before:**
- Workout MUST be H1: `# Workout: Name`
- Exercise MUST be H2: `## Exercise`

**After:**
- Workout can be ANY level (H1-H6)
- Exercise must be ONE level below workout
- Enables embedding in existing markdown documents

**Example:**
```markdown
# Training Log

## Week 1

### Day 1: Push     ← Workout (H3)
#### Bench Press    ← Exercise (H4)
- 225 x 5

### Day 2: Pull     ← Workout (H3)
#### Deadlift       ← Exercise (H4)
- 315 x 5
```

---

### 5. ✅ Removed @date Requirement

**Before:**
```markdown
# Workout: Push Day
@date: 2026-01-15  ← Required or defaults to import date
```

**After:**
```markdown
# Push Day
# No date field needed
```

**Rationale**:
- Import date ≠ workout date
- User sets workout date in the app after import
- Reduces confusion and boilerplate

---

### 6. ✅ Name = Header Text (No Prefix)

**Before:**
```markdown
# Workout: Push Day  ← Required "Workout:" prefix
```

**After:**
```markdown
# Push Day  ← Clean, just the name
```

**Rationale**: More natural markdown, less typing, cleaner appearance.

---

### 7. ✅ Superset Support via Nested Headers

**Approach: Use nested headers for superset grouping**

```markdown
## Superset: Arms

### Bicep Curl
- 30 lbs x 12
- 30 lbs x 12

### Tricep Extension
- 40 lbs x 12
- 40 lbs x 12
```

**Rationale**:
- Clean, natural markdown structure
- Easy to parse (parent header = superset, children = exercises)
- No need for special `@superset` metadata flags
- Clearly groups related exercises together
- Supports naming supersets ("Arms", "Finisher", "Superset 1", etc.)

---

### 8. ✅ Simplified Modifiers

**Removed RIR (Reps in Reserve):**
```markdown
# Before - redundant
- 225 x 5 @rpe: 8 @rir: 2

# After - just use RPE
- 225 x 5 @rpe: 8
```

**Rationale**: RIR and RPE express the same thing. RPE 8 ≈ 2 RIR. Keep it simple.

**Dropset as Flag:**
```markdown
# Before
- 60 lbs x 15 @dropset: true

# After
- 60 lbs x 15 @dropset
```

**Rationale**: Presence of `@dropset` is enough. No need for `: true`.

**AMRAP Implies Failure:**
```markdown
# Before
- 135 x AMRAP @failure: true

# After
- 135 x AMRAP  # Failure implied
```

**Rationale**: AMRAP (As Many Reps As Possible) inherently means going to failure. Redundant to add `@failure` flag.

**Tempo Format with Dashes:**
```markdown
# Before - harder to parse
- 185 x 8 @tempo: 3010

# After - clear separation
- 185 x 8 @tempo: 3-0-1-0
```

**Rationale**: Using dashes (X-X-X-X) makes parsing easier and clearer. Each number represents:
- 1st: Eccentric (lowering) - 3 seconds
- 2nd: Pause at bottom - 0 seconds
- 3rd: Concentric (lifting) - 1 second
- 4th: Pause at top - 0 seconds

---

## Parser Behavior Updates

### Smart Header Detection

The parser now uses **structural analysis** instead of rigid header levels:

```markdown
# My Notes               ← Not a workout (no sets below)

## Week 1                ← Not a workout (no sets below)

### Monday: Push         ← WORKOUT (has exercises with sets)
#### Bench Press         ← Exercise (has sets)
- 225 x 5

#### Rows                ← Exercise (has sets)
- 135 x 10
```

**Detection Logic:**
1. Scan document for headers with child headers containing list items (sets)
2. Those headers = workouts
3. Their child headers (one level down) with sets = exercises
4. Everything else = ignored or treated as notes

---

## Benefits of Changes

### For Users
- ✅ More natural markdown writing
- ✅ Less boilerplate and metadata
- ✅ Can embed workouts in existing notes
- ✅ Cleaner, more readable format

### For LLMs
- ✅ Simpler format to generate
- ✅ Fewer rigid rules to follow
- ✅ More forgiving parsing
- ✅ Natural language notes encouraged

### For Developers
- ✅ Parser is more flexible
- ✅ Better error messages possible
- ✅ Supports real-world markdown documents
- ✅ Easier to extend in future

---

## Migration Path

**Old format (v0.9) still works:**
```markdown
# Workout: Push Day
@date: 2026-01-15
@notes: Feeling good
@tags: push

## Bench Press
@type: barbell
- 225 lbs x 5 reps
```

**New format (v1.0) is cleaner:**
```markdown
# Push Day
@tags: push

Feeling good today.

## Bench Press
- 225 x 5
```

**Both parse correctly** - the parser is backward compatible where possible.

---

### 9. ✅ Default Weight Units

**New Syntax:**
```markdown
# Push Day
@units: lbs

## Bench Press
- 135 x 5       # Uses lbs (from @units)
- 185 x 5       # Uses lbs (from @units)
- 100 kg x 3    # Explicit kg overrides default
```

**Rationale**: Different users prefer different weight systems. Some use pounds exclusively, others use kilograms. Setting a default at the workout level reduces repetition while still allowing per-set overrides.

**Valid Values**:
- `@units: lbs` - Sets pounds as default
- `@units: kg` - Sets kilograms as default
- Omit `@units` - No default, units must be specified per set (or defaults to bodyweight)

---

## What Stayed the Same

- ✅ Set format: `- [weight] [unit] x [reps]`
- ✅ Modifiers: `@rpe`, `@rest`, `@tempo`, `@failure`, `@dropset`
- ✅ Tags: `@tags: tag1, tag2, tag3`
- ✅ Units: `lbs`, `kg`, `bw`
- ✅ AMRAP support: `- 135 x AMRAP`
- ✅ List items with `-` for sets

---

## Open Questions

1. **Superset notation**: Is `@superset` flag clear enough? Or prefer nested headers only?
2. **Additional modifiers**: Any other modifiers needed? (e.g., `@percentage: 75%` for percentage-based training)
3. **Units**: Support for other units like bodyweight percentage, 1RM percentage?
4. **Strictness**: How forgiving should parser be with typos and variations?

---

**Version:** 1.0
**Last Updated:** 2026-01-03
