# LiftMark 2.0 - MVP

A React Native fitness tracking application for managing workout templates using the LiftMark Workout Format (LMWF).

## MVP Features

### Implemented Features
- ✅ **Home Screen** - Quick overview with workout stats and quick actions
- ✅ **Import Workout** - Parse and save workouts from markdown format
- ✅ **Workout List** - Browse and search imported workouts
- ✅ **Workout Details** - View detailed workout information with exercises and sets
- ✅ **Settings** - Configure default units, theme, and preferences
- ✅ **Markdown Parser** - Full LMWF v1.0 spec compliance
- ✅ **SQLite Database** - Local storage with migrations
- ✅ **State Management** - Zustand stores for workouts and settings

### Features Not in MVP (Future Phases)
- ⏳ Active Workout Tracking (Phase 3)
- ⏳ Workout History (Phase 4)
- ⏳ Exercise History & Charts (Phase 4)
- ⏳ Create/Edit Workouts (Deferred)

## Tech Stack

- **Framework**: Expo SDK 54
- **Language**: TypeScript 5.9.2
- **Runtime**: React 19.1.0, React Native 0.81.5
- **Navigation**: Expo Router 6.0.21
- **Database**: expo-sqlite 16.0.10
- **State Management**: Zustand 5.0.9
- **ID Generation**: expo-crypto 15.0.8 (UUID v4)
- **Date Utilities**: date-fns 4.1.0

## Project Structure

```
/LiftMark2
├── app/                          # Expo Router screens
│   ├── (tabs)/                  # Tab navigation
│   │   ├── _layout.tsx          # Tab layout
│   │   ├── index.tsx            # Home screen
│   │   ├── workouts.tsx         # Workout list screen
│   │   └── settings.tsx         # Settings screen
│   ├── modal/                   # Modal screens
│   │   └── import.tsx           # Import workout modal
│   ├── workout/                 # Workout detail
│   │   └── [id].tsx            # Workout detail screen
│   └── _layout.tsx              # Root layout
├── src/
│   ├── db/                      # Database layer
│   │   ├── index.ts            # SQLite setup & migrations
│   │   └── repository.ts       # CRUD operations
│   ├── services/                # Business logic
│   │   ├── MarkdownParser.ts   # LMWF parser (1,038 lines)
│   │   ├── README.md
│   │   ├── PARSER_EXAMPLES.md
│   │   └── PARSER_FEATURES.md
│   ├── stores/                  # Zustand state
│   │   ├── workoutStore.ts     # Workout state & actions
│   │   └── settingsStore.ts    # Settings state & actions
│   ├── types/                   # TypeScript types
│   │   ├── workout.ts          # All type definitions
│   │   └── index.ts
│   └── utils/                   # Utilities
│       └── id.ts               # UUID generation
├── babel.config.js              # Babel with module resolver
├── tsconfig.json                # TypeScript config
├── package.json
└── app.json                     # Expo config
```

## Getting Started

### Prerequisites
- Node.js (v18 or later recommended)
- npm or yarn
- Expo Go app (for testing on physical device)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
- Scan the QR code with Expo Go (Android) or Camera app (iOS)
- Or press `i` for iOS simulator, `a` for Android emulator

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

## Testing

All screens include `testID` props for E2E testing with Detox (planned for future phase).

Example test IDs:
- `home-screen`
- `button-import-workout`
- `workout-list`
- `workout-card-{id}`
- `settings-screen`
- `switch-workout-timer`

## Known Issues

- Minor version mismatch warning for `react-native-screens` (4.19.0 vs expected 4.16.0) - functionality not affected

## Development Notes

### Path Aliases
The project uses `@/` as an alias for `src/`:
```typescript
import { useWorkoutStore } from '@/stores/workoutStore';
```

Configured in:
- `tsconfig.json` - TypeScript compilation
- `babel.config.js` - Runtime module resolution

### ID Generation
All entities use UUID v4 for primary keys:
```typescript
import { generateId } from '@/utils/id';
const id = generateId(); // Returns UUID v4 string
```

### Database Access
Always use `getDatabase()` to get the singleton instance:
```typescript
import { getDatabase } from '@/db';
const db = await getDatabase();
```

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

## License

MIT

## Author

Built with Claude Code
