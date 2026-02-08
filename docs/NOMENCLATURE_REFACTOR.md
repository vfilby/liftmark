# Nomenclature Refactoring: Workout Terminology

## Problem Statement

The term "workout" is currently overloaded in the codebase, referring to two distinct concepts:

1. **WorkoutTemplate** - A plan/blueprint for a workout (what you intend to do)
2. **WorkoutSession** - A recorded workout (what you actually did)

This creates confusion in both the code and UI. Users and developers need clear, distinct terminology.

## Current State

### Type Definitions (`src/types/workout.ts`)
- `WorkoutTemplate` - The plan/blueprint with exercises and target sets
- `WorkoutSession` - The actual recorded performance with completed exercises
- Related types: `TemplateExercise`, `SessionExercise`, `TemplateSet`, `SessionSet`

### Usage Statistics
- `WorkoutTemplate`: **368 occurrences** across 19 files
- `WorkoutSession`: **226 occurrences** across 18 files

### User-Facing Areas
- **Workouts Tab** (`app/(tabs)/workouts.tsx`) - Shows WorkoutTemplate list (the plans)
- **History Tab** (`app/(tabs)/history.tsx`) - Shows WorkoutSession list (recorded workouts)
- **Active Workout** (`app/workout/active.tsx`) - Records a WorkoutSession
- **Import Modal** (`app/modal/import.tsx`) - Creates WorkoutTemplates from markdown

## Proposed Nomenclature

### Option 1: WorkoutPlan / Workout (RECOMMENDED)

**Names:**
- `WorkoutPlan` (or `Plan`) - The blueprint/template
- `Workout` (or keep `WorkoutSession`) - The recorded session

**Pros:**
- "Plan" is intuitive and commonly used in fitness apps
- Clear distinction: you follow a plan, you record a workout
- User-friendly terminology
- "Workout" is shorter and more natural than "WorkoutSession"

**Related type renames:**
- `WorkoutTemplate` → `WorkoutPlan`
- `TemplateExercise` → `PlannedExercise` or `PlanExercise`
- `TemplateSet` → `PlannedSet` or `PlanSet`
- `WorkoutSession` → `Workout` (optional, could keep as is)
- `SessionExercise` → `WorkoutExercise` (if renaming WorkoutSession)
- `SessionSet` → `WorkoutSet` (if renaming WorkoutSession)

### Option 2: Program / Workout

**Names:**
- `WorkoutProgram` (or `Program`) - The blueprint/template
- `Workout` - The recorded session

**Pros:**
- "Program" is also common in fitness (though typically implies multi-week plans)
- Still clear distinction

**Cons:**
- "Program" can imply a longer-term training plan (e.g., "12-week program")
- Might be confusing if single workout templates are called "programs"

### Option 3: Routine / Workout

**Names:**
- `WorkoutRoutine` (or `Routine`) - The blueprint/template
- `Workout` - The recorded session

**Pros:**
- "Routine" is familiar to fitness enthusiasts
- Clear distinction

**Cons:**
- "Routine" sometimes implies habitual/repeated workouts
- Less intuitive than "plan" for newcomers

## Recommendation

**Use Option 1: WorkoutPlan / Workout**

### Specific Renaming Strategy

#### Type Names (TypeScript)
```typescript
// BEFORE
WorkoutTemplate → WorkoutPlan
TemplateExercise → PlannedExercise
TemplateSet → PlannedSet

// KEEP AS IS (or optionally simplify)
WorkoutSession → Workout (optional)
SessionExercise → WorkoutExercise (if renaming WorkoutSession)
SessionSet → WorkoutSet (if renaming WorkoutSession)
```

#### Database Tables (SQL)
```sql
-- BEFORE → AFTER
workout_templates → workout_plans
template_exercises → planned_exercises
template_sets → planned_sets

-- KEEP AS IS (or optionally simplify)
workout_sessions → workouts (optional)
session_exercises → workout_exercises (if renaming)
session_sets → workout_sets (if renaming)
```

#### Function Names
```typescript
// BEFORE → AFTER
getAllWorkoutTemplates() → getAllWorkoutPlans()
getWorkoutTemplateById() → getWorkoutPlanById()
createWorkoutTemplate() → createWorkoutPlan()
toggleFavoriteTemplate() → toggleFavoritePlan()
```

#### UI Text
```typescript
// BEFORE → AFTER
"Workout Templates" → "Workout Plans" or "Plans"
"Start Template" → "Start Plan"
"Template Name" → "Plan Name"
"My Templates" → "My Plans"
```

## Scope of Changes

### High Priority (Core Types & Database)
1. **Type definitions** (`src/types/workout.ts`)
   - Rename interfaces and types
   - Update all related types

2. **Database schema**
   - Create migration script to rename tables
   - Update all SQL queries

3. **Repository layer** (`src/db/repository.ts`, `src/db/sessionRepository.ts`)
   - Rename functions
   - Update SQL queries

4. **Stores** (`src/stores/workoutStore.ts`, `src/stores/sessionStore.ts`)
   - Rename state properties
   - Update action names

### Medium Priority (Services & Components)
5. **Services**
   - `src/services/MarkdownParser.ts` - Update function signatures
   - `src/services/workoutGenerationService.ts` - Update return types
   - `src/services/workoutHistoryService.ts` - Update parameters

6. **Components**
   - `src/components/WorkoutDetailView.tsx` - Could rename to `WorkoutPlanDetailView.tsx`
   - Update prop types and internal references

### Low Priority (UI & Documentation)
7. **Screen files** (`app/(tabs)/*.tsx`, `app/workout/*.tsx`)
   - Update imports
   - Update UI text strings

8. **Documentation** (`docs/*.md`, `README.md`, `PLAN.md`)
   - Update all references
   - Update examples

9. **Tests** (`src/__tests__/*.test.ts`)
   - Update test names
   - Update mock data

## Implementation Strategy

### Phase 1: Type System (Non-Breaking)
1. Add new type aliases alongside old ones
```typescript
// Temporary aliases for migration
export type WorkoutPlan = WorkoutTemplate;
export type PlannedExercise = TemplateExercise;
export type PlannedSet = TemplateSet;
```

### Phase 2: Database Migration
1. Create migration script to:
   - Rename tables (with data preservation)
   - Rename columns
   - Update indexes

2. Test migration thoroughly on backup database

### Phase 3: Code Updates
1. Update repository layer (database interface)
2. Update stores (state management)
3. Update services (business logic)
4. Update components (UI)
5. Update screens (navigation/routing)

### Phase 4: Cleanup
1. Remove old type aliases
2. Update all documentation
3. Update tests
4. Final verification

## Migration Script Example

```typescript
// Migration: Rename workout_templates to workout_plans
export async function migrateWorkoutNomenclature(db: SQLiteDatabase) {
  await db.execAsync(`
    -- Rename tables
    ALTER TABLE workout_templates RENAME TO workout_plans;
    ALTER TABLE template_exercises RENAME TO planned_exercises;
    ALTER TABLE template_sets RENAME TO planned_sets;

    -- Update column names
    ALTER TABLE planned_exercises RENAME COLUMN workout_template_id TO workout_plan_id;
    ALTER TABLE planned_sets RENAME COLUMN template_exercise_id TO planned_exercise_id;
    ALTER TABLE workout_sessions RENAME COLUMN workout_template_id TO workout_plan_id;

    -- Update indexes
    DROP INDEX IF EXISTS idx_template_exercises_workout_template;
    CREATE INDEX idx_planned_exercises_workout_plan ON planned_exercises(workout_plan_id);
  `);
}
```

## Questions to Resolve

1. **Should we also rename WorkoutSession to Workout?**
   - Pro: Simpler, more natural
   - Con: Might cause confusion if both are called "workout"
   - Recommendation: Keep as `WorkoutSession` or use `RecordedWorkout` to maintain clarity

2. **Should database tables be renamed or just code types?**
   - Pro (rename DB): Consistency across all layers
   - Con (rename DB): Requires migration, potential downtime
   - Recommendation: Rename both for full consistency

3. **What about file names?**
   - `workoutStore.ts` → `workoutPlanStore.ts`?
   - `WorkoutDetailView.tsx` → `WorkoutPlanDetailView.tsx`?
   - Recommendation: Update for consistency

4. **How to handle the transition period?**
   - Use type aliases?
   - Big bang migration?
   - Gradual migration with both names?
   - Recommendation: Use type aliases during development, then remove after full migration

## Estimated Effort

- **Type definitions**: 1-2 hours
- **Database migration**: 2-3 hours (including testing)
- **Repository layer**: 2-3 hours
- **Stores**: 1-2 hours
- **Services**: 2-3 hours
- **Components**: 3-4 hours
- **Screens**: 2-3 hours
- **Tests**: 2-3 hours
- **Documentation**: 1-2 hours

**Total estimated effort**: 16-25 hours

## Next Steps

1. **Confirm nomenclature decision**
   - WorkoutPlan vs Program vs Routine?
   - Workout vs WorkoutSession for recorded sessions?

2. **Plan migration strategy**
   - Phased approach vs big bang?
   - Type aliases for transition?

3. **Create detailed task breakdown**
   - Create subtasks for each file/module
   - Assign priorities

4. **Write comprehensive tests**
   - Ensure database migration preserves data
   - Verify all type changes compile

5. **Update user-facing documentation**
   - Help text
   - Tooltips
   - Error messages
