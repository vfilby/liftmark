# Bug Fix: Weight Parsing for Sets Without Units

## Issue
Workouts imported with weights but no explicit units (e.g., `45 x 10` instead of `45 lbs x 10`) were showing all weights as 0.

## Root Cause
The markdown parser had this incorrect logic:
```typescript
weight: weightUnit === 'bw' || !weightUnit ? undefined : weight
```

This condition treated **missing units** the same as **bodyweight sets**, discarding the weight value in both cases.

## Examples of Affected Workouts

### Before Fix (Broken):
```markdown
# Chest Press
@units: lbs

### Barbell Bench Press
- 45 x 10   ← Imported as weight: 0
- 65 x 8    ← Imported as weight: 0
- 85 x 6    ← Imported as weight: 0
```

### After Fix (Correct):
```markdown
# Chest Press
@units: lbs

### Barbell Bench Press
- 45 x 10   ← Imported as weight: 45 ✓
- 65 x 8    ← Imported as weight: 65 ✓
- 85 x 6    ← Imported as weight: 85 ✓
```

## Fix Details

Changed condition from:
```typescript
weight: weightUnit === 'bw' || !weightUnit ? undefined : weight
```

To:
```typescript
weight: weightUnit === 'bw' ? undefined : weight
```

Now the parser correctly handles:
- `bw x 10` → weight: undefined (bodyweight)
- `45 x 10` → weight: 45, weightUnit: undefined (uses workout's `@units` default)
- `45 lbs x 10` → weight: 45, weightUnit: 'lbs' (explicit unit)

## Files Changed
- `src/services/MarkdownParser.ts` (3 locations fixed)

## Testing
- All existing tests pass (27/27)
- No breaking changes
- Backward compatible with explicit units

## Commit
```
fix: preserve weight values when unit is not specified in set notation
Commit: 0a73959
```
