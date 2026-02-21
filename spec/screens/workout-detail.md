# Workout Detail Screen

## Purpose
Display full details of a workout plan template — exercises, sets, tags, metadata — with actions to start the workout, reprocess from markdown, and toggle favorite.

## Route
`/workout/[id]` — Dynamic route. Accessed by tapping a plan card from Home or Workouts screens.

## Layout
- **Body**: WorkoutDetailView component (ScrollView) containing:
  1. **Header card**: Plan name, favorite button, description, tags, meta stats (exercises count, total sets, units), Start Workout button, Reprocess button
  2. **Exercises section**: Grouped by sections (warmup/cooldown/default) with exercise cards showing set details
- **Footer**: None (Start button is in header card)

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Loading state | `workout-detail-loading` | View |
| Detail view container | `workout-detail-view` | ScrollView |
| Favorite button | `favorite-button-detail` | TouchableOpacity |
| Start Workout button | `start-workout-button` | TouchableOpacity |
| Exercise card (single) | `exercise-{exercise.id}` | View |
| Superset card | `superset-{globalIndex}` | View |
| Set row | `set-{set.id}` | View |

## Data Dependencies
- **workoutPlanStore**: `selectedPlan`, `loadPlan`, `reprocessPlan`, `isLoading`, `error`, `clearError`
- **sessionStore**: `startWorkout`, `checkForActiveSession`
- **repository**: `toggleFavoritePlan`

## User Interactions
- **Tap favorite heart** → toggles favorite, reloads plan
- **Tap "Start Workout"** → checks for active session → starts workout → navigates to `/workout/active`
  - If active session exists: alert with "Resume Workout" option
- **Tap "Reprocess from Markdown"** → confirmation alert → re-parses plan from original markdown
- **Tap YouTube icon** on exercise name → opens YouTube search for that exercise

## Navigation
- `/workout/active` — after starting workout or resuming existing
- Back (via router.back()) — on error

## State
- `isStarting` — disables Start button during workout creation
- `isReprocessing` — disables Reprocess button during re-parse

## Error/Empty States
- **Plan not loaded**: LoadingView
- **Load error**: Alert with error message, navigates back on dismiss

## WorkoutDetailView Component Details

### Header
- Plan name (large, bold)
- Favorite toggle (heart icon, red when favorited)
- Optional description text
- Tags as pill badges
- Meta stats row: Exercises count, Total Sets, Units (if set)

### Exercise Cards
- Numbered with section-colored index
- Exercise name with YouTube search link
- Equipment type (if set)
- Notes (italic, if present)
- Sets listed with: set number, reps @ weight unit, time, RPE, rest, tempo, dropset, per-side modifiers

### Section Headers
- Styled divider lines with section name
- Color-coded: warmup (sectionWarmup), cooldown (sectionCooldown), default (primary)

### Supersets
- Purple "SUPERSET" badge
- Multiple exercise names joined with "&"
- Interleaved set display across exercises
