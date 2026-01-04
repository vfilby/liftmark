# LiftMark - MVP

I have tried many different fitness apps and programs to help me create and track workouts but they tend to be limited in what they allow you to do and they make it difficult to import of export workouts.  I have spent nearly as much time "creating" or "tweaking" workouts as I have actually working out in some cases. I want something that gives me all the benefits of tracking without the tedium.

Liftmark let's you import workouts written in a simple text based format - LiftMark Workout Format (LMWF) - and create a structured workout that you can use to track during the workout and see historical stats as well.  

With GenAI at our finger tips it is incredibly easy to create and import workouts.

This is very, _very_ beta at this point.


## Usage

### Importing a Workout

1. Tap "Import Workout" on the home screen
2. Paste your workout in LMWF format:

```markdown
# Push Day A
@tags: push, chest, shoulders
@units: lbs

Bench Press
- 3x10 @135
- 3x8 @185
- @rest: 120s

Incline Dumbbell Press
- 3x12 @60
- @rpe: 8
```

3. Tap "Import" to save

### Viewing Workouts

- Browse all workouts on the "Workouts" tab
- Search by name or tags
- Tap a workout to view details
- Delete workouts by tapping the "Delete" button

### Settings

Configure your preferences:
- **Weight Unit**: LBS or KG (default for new workouts)
- **Theme**: Light, Dark, or Auto
- **Workout Timer**: Enable/disable rest timer (Phase 3)
- **Notifications**: Enable/disable workout reminders

## Database Schema

### workout_templates
- `id` (TEXT PRIMARY KEY) - UUID
- `name` (TEXT) - Workout name
- `description` (TEXT) - Optional description
- `tags` (TEXT) - JSON array of tags
- `default_weight_unit` (TEXT) - 'lbs' or 'kg'
- `source_markdown` (TEXT) - Original markdown
- `created_at` (TEXT) - ISO timestamp
- `updated_at` (TEXT) - ISO timestamp

### template_exercises
- `id` (TEXT PRIMARY KEY) - UUID
- `workout_template_id` (TEXT FK) - References workout_templates
- `exercise_name` (TEXT) - Exercise name
- `order_index` (INTEGER) - Display order
- `notes` (TEXT) - Optional notes
- `equipment_type` (TEXT) - Equipment used
- `group_type` (TEXT) - 'superset' or 'section'
- `group_name` (TEXT) - Group identifier
- `parent_exercise_id` (TEXT FK) - For supersets

### template_sets
- `id` (TEXT PRIMARY KEY) - UUID
- `template_exercise_id` (TEXT FK) - References template_exercises
- `order_index` (INTEGER) - Set order
- `target_weight` (REAL) - Weight value
- `target_weight_unit` (TEXT) - 'lbs' or 'kg'
- `target_reps` (INTEGER) - Rep target
- `target_time` (INTEGER) - Time in seconds
- `target_rpe` (INTEGER) - RPE 1-10
- `rest_seconds` (INTEGER) - Rest time
- `tempo` (TEXT) - Tempo notation
- `is_dropset` (INTEGER) - 0 or 1

### user_settings
- `id` (TEXT PRIMARY KEY) - UUID
- `default_weight_unit` (TEXT) - 'lbs' or 'kg'
- `enable_workout_timer` (INTEGER) - 0 or 1
- `theme` (TEXT) - 'light', 'dark', 'auto'
- `notifications_enabled` (INTEGER) - 0 or 1
- `created_at` (TEXT) - ISO timestamp
- `updated_at` (TEXT) - ISO timestamp

## LMWF Parser

The markdown parser (`src/services/MarkdownParser.ts`) implements the complete LiftMark Workout Format v1.0 specification:

### Supported Features
- ✅ Flexible header levels (workouts can be any H level)
- ✅ Metadata (@tags, @units, @type)
- ✅ Freeform notes
- ✅ Set parsing (SetsxReps @Weight)
- ✅ Set modifiers (@rpe, @rest, @tempo, @dropset)
- ✅ Supersets and sections
- ✅ Equipment types
- ✅ Comprehensive validation with error messages
- ✅ Warning system for non-critical issues

See `src/services/PARSER_FEATURES.md` for full feature list.





## Future Roadmap

### Phase 3: Active Workout Tracking
- Start/stop workout sessions
- Track actual sets/reps/weight
- Rest timer
- Progress tracking

### Phase 4: History & Analytics
- Workout history
- Exercise history
- Progress charts
- Personal records

### Backlog
- Create/edit workouts in UI
- Export to markdown
- Workout templates library
- Social features
