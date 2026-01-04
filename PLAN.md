# LiftMark2 - Fitness Tracking App Implementation Plan

## Executive Summary

This plan outlines the complete implementation strategy for LiftMark2, a cross-platform fitness tracking mobile application focused on iOS initially with future Android support. The app will enable users to import workouts via markdown, track their training sessions in real-time, and monitor progress over time.

---

## 1. Technology Stack Recommendation

### Recommended: React Native + Expo (SDK 52+)

**Rationale:**

**Pros:**
- **Faster Development Cycle**: Expo provides managed workflow with instant updates, built-in tooling, and streamlined deployment
- **TypeScript Native Support**: Perfect alignment with your requirement for type safety
- **Excellent Developer Experience**: Hot reload, debugging tools, and comprehensive documentation
- **Easy Testing**: Strong ecosystem for Jest, React Testing Library, Detox for E2E
- **Future-Proof**: React Native's new architecture (0.74+) has significantly improved performance
- **Community & Libraries**: Largest ecosystem for cross-platform mobile development
- **Easier Onboarding**: More developers familiar with React/JavaScript than Dart/Flutter
- **File System Access**: Easy markdown file import via expo-file-system and expo-document-picker

**Cons:**
- Slightly larger bundle sizes than Flutter (mitigated with optimization)
- Minor performance overhead vs native (negligible for this use case)

**Why Not Flutter:**
While Flutter offers superior performance for graphics-heavy apps, React Native + Expo is better suited for this project because:
- Your app is data-focused, not graphics-intensive
- JavaScript/TypeScript ecosystem is more accessible
- Faster iteration and testing cycles
- Better integration with markdown parsing libraries
- React Native's new architecture (2024-2026) has closed the performance gap significantly

**Core Stack:**
```
- Framework: React Native 0.76+ (New Architecture enabled)
- Platform: Expo SDK 52+
- Language: TypeScript 5.0+
- Navigation: React Navigation 7.x
- State Management: Zustand (lightweight, TypeScript-first)
- Styling: NativeWind (Tailwind CSS for React Native)
- Database: SQLite (via expo-sqlite) for local persistence
- Date/Time: date-fns (lightweight, tree-shakeable)
- Testing: Jest + React Testing Library + Detox
```

---

## 2. Markdown Import Format Specification

### Overview

The app uses **LiftMark Workout Format (LMWF)** - a markdown-based format designed to be:
- **LLM-Friendly**: Simple, structured format that any LLM can generate
- **Human-Readable**: Users can manually create/edit workouts
- **Extensible**: Support for future features without breaking changes
- **Validation**: Clear error messages for malformed input

### Format Documentation

**📄 Complete specification:** See [`MARKDOWN_SPEC.md`](./MARKDOWN_SPEC.md)

**📋 Quick reference:** See [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md)

**📝 Changelog:** See [`SPEC_CHANGES.md`](./SPEC_CHANGES.md)

### Key Format Features

- **Flexible headers**: Workout can be any header level (H1-H6), exercises one level below
- **Freeform notes**: Natural text instead of metadata tags
- **Default units**: `@units: lbs` or `@units: kg` at workout level
- **Supersets**: Nested headers with "superset" in name
- **Section grouping**: Nested headers for warmup/cooldown (without "superset" in name)
- **Time-based sets**: Support for duration exercises (e.g., `60s`, `45 lbs x 60s`)
- **Minimal syntax**: `225 x 5` instead of `225 lbs x 5 reps`

### Example Workout

```markdown
# Push Day
@tags: strength, push
@units: lbs

Feeling strong today, going for PRs.

## Bench Press
- 135 x 5 @rest: 120s
- 185 x 5 @rest: 180s
- 225 x 5 @rpe: 8

## Superset: Chest Finisher

### Cable Fly
- 30 x 15 @rest: 30s

### Dumbbell Pullover
- 50 x 15 @rest: 90s
```

### Import Workflow
1. User selects markdown file or pastes text
2. Parser validates format against LMWF spec
3. Show preview with editable fields
4. User confirms or edits
5. Save to database as WorkoutTemplate (including original markdown in `sourceMarkdown`)
6. Navigate to workout detail or start workout

**Note:** The original markdown text is stored in `WorkoutTemplate.sourceMarkdown` for:
- **Reprocessing**: If parser is updated, can reparse with new logic
- **Export fidelity**: Can export exact original format
- **Error recovery**: If parsing had issues, can fix and reparse
- **Version upgrades**: Support future spec changes without data loss

---

## 3. Data Model / Schema

### Entity Relationship Design

```typescript
// Core Entities:
// - Workout Template (reusable workout plans)
// - Workout Session (actual performed workouts)
// - Exercise (exercise definitions)
// - Set (individual sets with performance data)

interface WorkoutTemplate {
  id: string; // UUID
  name: string;
  description?: string; // Freeform notes from markdown
  tags: string[]; // e.g., ["push", "strength"]
  defaultWeightUnit?: 'lbs' | 'kg'; // @units from markdown
  sourceMarkdown?: string; // Original markdown text for reprocessing
  createdAt: string; // ISO date
  updatedAt: string;
  exercises: TemplateExercise[];
}

interface TemplateExercise {
  id: string;
  workoutTemplateId: string;
  exerciseName: string; // Reference to Exercise.name or custom
  orderIndex: number; // Order in workout
  notes?: string; // Freeform notes from markdown
  equipmentType?: string; // Optional freeform equipment (e.g., "barbell", "resistance band", "kettlebell")
  groupType?: 'superset' | 'section'; // 'superset' = performed together, 'section' = organizational grouping
  groupName?: string; // E.g., "Superset: Arms" or "Warmup"
  parentExerciseId?: string; // For exercises that are part of a superset/section
  sets: TemplateSet[];
}

interface TemplateSet {
  id: string;
  templateExerciseId: string;
  orderIndex: number;
  targetWeight?: number; // undefined or 0 = bodyweight only
  targetWeightUnit?: 'lbs' | 'kg'; // Only set when targetWeight is specified
  targetReps?: number;
  targetTime?: number; // seconds for time-based exercises
  targetRpe?: number; // 1-10
  restSeconds?: number;
  tempo?: string; // e.g., "3-0-1-0"
  isDropset?: boolean; // Drop set indicator
}

interface WorkoutSession {
  id: string;
  workoutTemplateId?: string; // null if custom/imported
  name: string;
  date: string; // ISO date
  startTime?: string; // ISO datetime
  endTime?: string; // ISO datetime
  notes?: string;
  tags: string[];
  exercises: SessionExercise[];
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
}

interface SessionExercise {
  id: string;
  workoutSessionId: string;
  exerciseName: string;
  orderIndex: number;
  notes?: string;
  equipmentType?: string;
  groupType?: 'superset' | 'section'; // 'superset' = performed together, 'section' = organizational grouping
  groupName?: string; // E.g., "Superset: Arms" or "Warmup"
  parentExerciseId?: string;
  sets: SessionSet[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface SessionSet {
  id: string;
  sessionExerciseId: string;
  orderIndex: number;

  // Drop Set Support
  parentSetId?: string; // Links to parent set for drop sets
  dropSequence?: number; // 0 = main set, 1 = first drop, 2 = second drop, etc.

  // Planned/Target
  targetWeight?: number; // undefined or 0 = bodyweight only
  targetWeightUnit?: 'lbs' | 'kg'; // Only set when targetWeight is specified
  targetReps?: number;
  targetTime?: number; // For time-based exercises
  targetRpe?: number;
  restSeconds?: number;

  // Actual Performance
  actualWeight?: number; // undefined or 0 = bodyweight only
  actualWeightUnit?: 'lbs' | 'kg'; // Only set when actualWeight is specified
  actualReps?: number;
  actualTime?: number;
  actualRpe?: number;

  // Metadata
  completedAt?: string; // ISO datetime
  status: 'pending' | 'completed' | 'skipped' | 'failed';
  notes?: string;
  tempo?: string; // e.g., "3-0-1-0"
  isDropset?: boolean; // Flag indicating this set is part of a drop set
}

// Exercise Catalog (for suggestions & history aggregation)
interface Exercise {
  id: string;
  name: string;
  category?: string; // Optional freeform category (e.g., "chest", "legs", "cardio")
  muscleGroups?: string[]; // Optional list (e.g., ["chest", "triceps"])
  equipmentType?: string; // Optional freeform equipment
  description?: string;
  isCustom: boolean; // true if user-created
  createdAt: string;
}

// User Preferences
interface UserSettings {
  id: string;
  defaultWeightUnit: 'lbs' | 'kg';
  defaultRestTime: number; // seconds
  enableRestTimer: boolean;
  enableWorkoutTimer: boolean;
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### SQLite Schema

```sql
-- Workout Templates
CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT, -- Freeform notes from markdown
  tags TEXT, -- JSON array
  default_weight_unit TEXT, -- lbs or kg
  source_markdown TEXT, -- Original markdown for reprocessing/export
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Template Exercises
CREATE TABLE template_exercises (
  id TEXT PRIMARY KEY,
  workout_template_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  notes TEXT, -- Freeform notes from markdown
  equipment_type TEXT,
  group_type TEXT, -- 'superset' or 'section'
  group_name TEXT, -- E.g., "Superset: Arms" or "Warmup"
  parent_exercise_id TEXT, -- For exercises in a superset/section
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
);

-- Template Sets
CREATE TABLE template_sets (
  id TEXT PRIMARY KEY,
  template_exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  target_weight REAL, -- NULL or 0 = bodyweight only
  target_weight_unit TEXT, -- lbs or kg (only set when target_weight is specified)
  target_reps INTEGER,
  target_time INTEGER, -- For time-based exercises (seconds)
  target_rpe INTEGER, -- 1-10
  rest_seconds INTEGER,
  tempo TEXT, -- e.g., "3-0-1-0"
  is_dropset INTEGER DEFAULT 0, -- Boolean flag
  FOREIGN KEY (template_exercise_id) REFERENCES template_exercises(id) ON DELETE CASCADE
);

-- Workout Sessions
CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY,
  workout_template_id TEXT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  notes TEXT,
  tags TEXT, -- JSON array
  status TEXT NOT NULL,
  FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
);

CREATE INDEX idx_workout_sessions_date ON workout_sessions(date DESC);

-- Session Exercises
CREATE TABLE session_exercises (
  id TEXT PRIMARY KEY,
  workout_session_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  notes TEXT,
  equipment_type TEXT,
  group_type TEXT, -- 'superset' or 'section'
  group_name TEXT,
  parent_exercise_id TEXT,
  status TEXT NOT NULL,
  FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
);

-- Session Sets
CREATE TABLE session_sets (
  id TEXT PRIMARY KEY,
  session_exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  parent_set_id TEXT, -- Links to parent set for drop sets
  drop_sequence INTEGER DEFAULT 0, -- 0 = main set, 1 = first drop, 2 = second drop, etc.
  target_weight REAL, -- NULL or 0 = bodyweight only
  target_weight_unit TEXT, -- lbs or kg (only set when target_weight is specified)
  target_reps INTEGER,
  target_time INTEGER, -- For time-based exercises
  target_rpe INTEGER,
  rest_seconds INTEGER,
  actual_weight REAL, -- NULL or 0 = bodyweight only
  actual_weight_unit TEXT, -- lbs or kg (only set when actual_weight is specified)
  actual_reps INTEGER,
  actual_time INTEGER,
  actual_rpe INTEGER,
  completed_at TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  tempo TEXT, -- e.g., "3-0-1-0"
  is_dropset INTEGER DEFAULT 0, -- Boolean flag indicating this set is part of a drop set
  FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_set_id) REFERENCES session_sets(id) ON DELETE CASCADE
);

CREATE INDEX idx_session_sets_parent ON session_sets(parent_set_id, drop_sequence);

-- Exercise Catalog
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  muscle_groups TEXT, -- JSON array
  equipment_type TEXT,
  description TEXT,
  is_custom INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_exercises_name ON exercises(name);

-- User Settings
CREATE TABLE user_settings (
  id TEXT PRIMARY KEY,
  default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
  default_rest_time INTEGER NOT NULL DEFAULT 180,
  enable_rest_timer INTEGER DEFAULT 1,
  enable_workout_timer INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'auto',
  notifications_enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### ID Generation Strategy

**All entities use UUIDs (v4) for primary keys.**

**Rationale:**
- ✅ **Globally unique** - No collisions across devices or users
- ✅ **Client-side generation** - Can create IDs offline without coordination
- ✅ **Future-proof for sync** - Essential for multi-device cloud sync
- ✅ **Security** - Non-sequential, unpredictable IDs
- ✅ **Standard format** - Widely supported across platforms

**Implementation:**

```typescript
// src/utils/id.ts
import { randomUUID } from 'expo-crypto';

/**
 * Generates a UUID v4 for use as primary key
 * @returns UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateId(): string {
  return randomUUID();
}

// Usage example
import { generateId } from '@/utils/id';

const workout: WorkoutTemplate = {
  id: generateId(),
  name: 'Push Day',
  createdAt: new Date().toISOString(),
  // ...
};
```

**Storage:**
- UUIDs stored as `TEXT` in SQLite
- Format: `"550e8400-e29b-41d4-a716-446655440000"` (36 characters with hyphens)
- SQLite indexes TEXT PRIMARY KEYs efficiently

**Performance:**
- Marginal overhead vs INTEGER (~36 bytes vs 8 bytes per ID)
- Negligible for expected data volumes (hundreds to thousands of workouts)
- Index performance difference unnoticeable in mobile SQLite

**Alternative considered:**
- Auto-incrementing integers: Rejected due to sync complications and collision risk
- ULIDs: Rejected as UUIDs are more standard and well-supported in Expo/React Native

---

### Drop Set Tracking

Drop sets are tracked using linked `SessionSet` records. The main set and all drops share the same `orderIndex` but are distinguished by `dropSequence`.

**Example: Lateral Raise Drop Set**

Markdown plan:
```markdown
## Lateral Raise
- 20 lbs x AMRAP @dropset
```

During workout, user performs:
- 20 lbs × 12 reps (to failure)
- Drop to 15 lbs × 8 reps (to failure)
- Drop to 10 lbs × 6 reps (to failure)

**Stored as 3 linked SessionSet records:**

```typescript
// Main set (the planned one)
{
  id: 'set-1',
  sessionExerciseId: 'ex-1',
  orderIndex: 0,
  parentSetId: null,
  dropSequence: 0,
  targetWeight: 20,
  targetWeightUnit: 'lbs',
  targetReps: undefined,  // AMRAP
  actualWeight: 20,
  actualWeightUnit: 'lbs',
  actualReps: 12,
  isDropset: true,
  status: 'completed'
}

// First drop (created during workout)
{
  id: 'set-1a',
  sessionExerciseId: 'ex-1',
  orderIndex: 0,  // Same as parent
  parentSetId: 'set-1',
  dropSequence: 1,
  targetWeight: undefined,  // Not planned
  targetWeightUnit: undefined,
  targetReps: undefined,
  actualWeight: 15,
  actualWeightUnit: 'lbs',
  actualReps: 8,
  isDropset: true,
  status: 'completed'
}

// Second drop (created during workout)
{
  id: 'set-1b',
  sessionExerciseId: 'ex-1',
  orderIndex: 0,  // Same as parent
  parentSetId: 'set-1',
  dropSequence: 2,
  targetWeight: undefined,
  targetWeightUnit: undefined,
  targetReps: undefined,
  actualWeight: 10,
  actualWeightUnit: 'lbs',
  actualReps: 6,
  isDropset: true,
  status: 'completed'
}
```

**Querying drop sets:**

```typescript
// Get all drops for a set (ordered)
const drops = await db.query(
  'SELECT * FROM session_sets WHERE parent_set_id = ? ORDER BY drop_sequence',
  [mainSetId]
);

// Get complete drop set (main + all drops)
const completeDropSet = await db.query(
  'SELECT * FROM session_sets WHERE id = ? OR parent_set_id = ? ORDER BY drop_sequence',
  [mainSetId, mainSetId]
);
```

**Benefits:**
- Each drop fully tracked individually
- Can analyze drop patterns over time
- Clean data model with clear relationships
- Supports planned vs actual for each drop
- Easy to display in UI (group by orderIndex)

---

## 4. App Architecture

### Folder Structure

```
/LiftMark2
├── .expo/
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── build.yml
├── assets/
│   ├── fonts/
│   ├── images/
│   └── splash/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Text.tsx
│   │   ├── workout/
│   │   │   ├── ExerciseCard.tsx
│   │   │   ├── SetRow.tsx
│   │   │   ├── WorkoutCard.tsx
│   │   │   └── RestTimer.tsx
│   │   ├── history/
│   │   │   ├── WorkoutHistoryItem.tsx
│   │   │   ├── ExerciseProgressChart.tsx
│   │   │   └── StatCard.tsx
│   │   └── import/
│   │       ├── MarkdownPreview.tsx
│   │       └── ValidationError.tsx
│   │
│   ├── screens/              # Screen components
│   │   ├── home/
│   │   │   └── HomeScreen.tsx
│   │   ├── workout/
│   │   │   ├── WorkoutListScreen.tsx
│   │   │   ├── WorkoutDetailScreen.tsx
│   │   │   ├── ActiveWorkoutScreen.tsx
│   │   │   └── CreateWorkoutScreen.tsx
│   │   ├── import/
│   │   │   └── ImportWorkoutScreen.tsx
│   │   ├── history/
│   │   │   ├── WorkoutHistoryScreen.tsx
│   │   │   └── ExerciseHistoryScreen.tsx
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   │
│   ├── navigation/           # Navigation configuration
│   │   ├── RootNavigator.tsx
│   │   ├── MainTabNavigator.tsx
│   │   ├── WorkoutStackNavigator.tsx
│   │   └── types.ts
│   │
│   ├── store/               # State management (Zustand)
│   │   ├── useWorkoutStore.ts
│   │   ├── useActiveWorkoutStore.ts
│   │   ├── useHistoryStore.ts
│   │   ├── useSettingsStore.ts
│   │   └── useTimerStore.ts
│   │
│   ├── database/            # Database layer
│   │   ├── client.ts
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.ts
│   │   │   └── index.ts
│   │   └── repositories/
│   │       ├── WorkoutRepository.ts
│   │       ├── ExerciseRepository.ts
│   │       └── SettingsRepository.ts
│   │
│   ├── services/            # Business logic layer
│   │   ├── MarkdownParser.ts
│   │   ├── WorkoutService.ts
│   │   ├── HistoryService.ts
│   │   ├── ExportService.ts
│   │   └── NotificationService.ts
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useWorkout.ts
│   │   ├── useActiveWorkout.ts
│   │   ├── useExerciseHistory.ts
│   │   ├── useRestTimer.ts
│   │   └── useTheme.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── date.ts
│   │   ├── validation.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── workout.ts
│   │   ├── exercise.ts
│   │   ├── database.ts
│   │   └── navigation.ts
│   │
│   └── theme/               # Theme configuration
│       ├── colors.ts
│       ├── typography.ts
│       ├── spacing.ts
│       └── index.ts
│
├── __tests__/               # Test files
│   ├── unit/
│   │   ├── services/
│   │   ├── utils/
│   │   └── components/
│   ├── integration/
│   │   ├── database/
│   │   └── stores/
│   └── e2e/
│       ├── workout-flow.test.ts
│       ├── import-flow.test.ts
│       └── history-flow.test.ts
│
├── App.tsx                  # App entry point
├── app.json                 # Expo configuration
├── babel.config.js
├── tsconfig.json
├── jest.config.js
├── .detoxrc.js
├── package.json
└── README.md
```

### State Management Strategy

**Zustand Stores:**

1. **useWorkoutStore** - Workout templates CRUD
2. **useActiveWorkoutStore** - Current workout session state
3. **useHistoryStore** - Workout history and caching
4. **useSettingsStore** - User preferences
5. **useTimerStore** - Rest timer and workout timer state

**Why Zustand:**
- Minimal boilerplate compared to Redux
- TypeScript-first design
- No Provider wrapping needed
- Easy to test
- Excellent performance with React Native

### Navigation Structure

```typescript
Root Navigator (Stack)
├── Main Tabs (Bottom Tabs)
│   ├── Home Tab
│   ├── Workouts Tab (Stack)
│   │   ├── Workout List
│   │   └── Workout Detail
│   ├── History Tab (Stack)
│   │   ├── Workout History
│   │   └── Exercise History Detail
│   └── Settings Tab
├── Active Workout (Full Screen, Persistent)
│   └── Active Workout Screen
└── Import Workout (Modal)
    └── Import Screen
```

---

## 5. Screen Specifications

### 5.1 Home Screen
**Purpose:** Quick actions and today's overview

**Components:**
- Today's date and greeting
- "Start Quick Workout" button
- "Import Workout" button
- Recent workout templates (3 most recent)
- Today's workout if scheduled
- Weekly stats summary (workouts completed this week)

**Actions:**
- Navigate to workout detail
- Start new workout
- Import from markdown

**Theme Support:** Full light/dark mode with themed cards and backgrounds

---

### 5.2 Workouts Tab

#### 5.2.1 Workout List Screen
**Purpose:** Browse and manage workout templates

**Components:**
- Search bar (filter by name/tags)
- Filter chips (by tags)
- Workout template cards showing:
  - Name
  - Exercise count
  - Last performed date
  - Tags
- FAB (Floating Action Button): Import workout
- Empty state: "Import your first workout"

**Actions:**
- Tap card → Navigate to workout detail
- Long press → Quick actions (duplicate, delete, export)
- FAB → Open Import Workout modal

---

#### 5.2.2 Workout Detail Screen
**Purpose:** View template details and start workout

**Components:**
- Header: Workout name, edit button
- Tags row
- Description/notes section
- Exercise list (collapsible):
  - Exercise name
  - Equipment type icon
  - Set count and target ranges (e.g., "3 sets × 5 reps @ 225 lbs")
- Bottom buttons:
  - "Start Workout" (primary)
  - "Export" (secondary)
  - "Duplicate" (creates copy that can be re-imported after editing)

**Actions:**
- Start workout → Navigate to Active Workout screen
- Export → Share as markdown (allows editing externally and re-importing)
- Duplicate → Export as markdown for editing

---

#### 5.2.3 Active Workout Screen (Full Screen, Persistent)
**Purpose:** Real-time workout tracking with persistent state

**Critical Requirements:**
- ✅ **NOT a modal** - Full screen with dedicated navigation entry
- ✅ **Persistent state** - Survives app kill/restart
- ✅ **Auto-save** - Workout state saved to database every 30s and on app background
- ✅ **Recovery** - On app launch, check for in-progress workout and prompt to resume
- ✅ **Prevent dismissal** - Confirmation dialog if user tries to exit (back button/gesture)

**Navigation:**
- Accessible from bottom tab bar when workout is active
- Badge indicator on tab shows active workout
- Deep link directly to active workout on app restart

**Layout:**
- **Header:**
  - Workout name
  - Total time elapsed (continues even if app backgrounded)
  - Menu button (pause/resume, cancel workout with confirmation)

- **Exercise Cards (scrollable):**
  - Exercise name with expand/collapse
  - Notes display
  - Set rows:
    - Checkbox (complete/incomplete)
    - Set number
    - Target (e.g., "225 × 5")
    - Input fields for actual weight/reps
    - RPE selector (1-10, optional)
    - Rest timer button
  - Add set button (for drop sets or extra sets)

- **Rest Timer (overlay when active):**
  - Large countdown display
  - Progress ring
  - Skip/Add 15s/30s buttons
  - Dismiss button
  - Background notification when app minimized

- **Bottom Bar:**
  - Previous exercise button
  - Current exercise indicator (e.g., "2/5")
  - Next exercise button
  - Finish workout button (with summary confirmation)

**Interactions:**
- Tap checkbox → Mark set complete, auto-fill target values, start rest timer
- Edit fields → Update actual performance, trigger auto-save
- Rest timer → Countdown with notification when complete (works in background)
- Swipe between exercises (optional)
- Finish → Show summary, confirm save, mark session complete

**State Management:**
- Active workout stored in `WorkoutSession` with `status: 'in_progress'`
- All set completions immediately saved to database
- Zustand store tracks UI state (expanded exercises, active timer)
- On app restart: Query for `in_progress` sessions and restore state

**Auto-save Strategy:**
- Save to database every 30 seconds
- Save on any set completion
- Save when app goes to background
- Save before app kill (via app state listeners)

---

#### 5.2.4 Create/Edit Workout Screen (DEFERRED - Post-Launch)
**Purpose:** Build custom workout templates

**Deferred Rationale:**
- Users can easily generate workouts via third-party LLM tools (ChatGPT, Claude, etc.)
- Import workflow provides full functionality for v1.0
- Complex UI with significant development time
- Better to validate core import/tracking flow first with real users
- Can be added in Phase 9 (Advanced Features) based on user feedback

**Components (Future):**
- Name input
- Description textarea
- Tags input (chips)
- Exercise list builder:
  - Add exercise button
  - Exercise search/autocomplete
  - Reorder handles (drag/drop)
  - Remove button
  - For each exercise:
    - Sets builder
    - Add/remove sets
    - Weight, reps, rest inputs
    - Notes textarea
- Save/Cancel buttons

**Actions (Future):**
- Add exercise → Search modal with suggestions
- Reorder → Drag handles
- Save → Validate and store template

**Workaround for v1.0:**
- Users generate workouts in ChatGPT/Claude/etc using LMWF format
- Copy/paste into Import Workout screen
- Edit by re-generating markdown and re-importing
- Export existing workout as markdown, edit externally, re-import

---

### 5.3 History Tab

#### 5.3.1 Workout History Screen
**Purpose:** View past workout sessions

**Components:**
- Calendar month view (optional, collapsed by default)
- Filters: Date range, workout type, tags
- List of completed workouts (grouped by week):
  - Date and time
  - Workout name
  - Duration
  - Exercise count
  - Volume summary (total weight × reps)
- Empty state: "No workouts yet"

**Actions:**
- Tap workout → View session detail (read-only workout view)
- Swipe → Quick actions (delete, repeat workout)

---

#### 5.3.2 Exercise History Screen
**Purpose:** Track progress for specific exercise

**Components:**
- Exercise selector dropdown
- Date range selector
- Progress chart:
  - Line chart: Max weight over time
  - Volume chart: Total volume (weight × reps)
  - Rep PR tracking
- Table view:
  - Date
  - Sets performed
  - Weight/reps details
  - RPE average
- Personal records section (PRs):
  - Max weight (1RM estimate)
  - Max reps at weight
  - Max volume in session

**Actions:**
- Change exercise → Update charts
- Tap data point → Navigate to that workout session
- Export data → CSV/markdown

---

### 5.4 Import Workout Screen (Modal)
**Purpose:** Import workouts from markdown

**Components:**
- Tab selector: "Paste Text" / "Select File"
- Text input (multiline) or file picker
- "Parse" button
- Preview section (after parsing):
  - Editable workout details
  - Exercise list with set details
  - Validation errors highlighted
- "Import Workout" / "Cancel" buttons

**Actions:**
- Parse → Validate markdown, show errors or preview
- Edit preview → Modify parsed data
- Import → Save to database, navigate to workout detail

---

### 5.5 Settings Screen
**Purpose:** User preferences and app info

**Sections:**
- **Units:**
  - Default weight unit (lbs/kg)
- **Timers:**
  - Enable rest timer (toggle)
  - Default rest time (seconds)
  - Enable workout timer (toggle)
- **Appearance:**
  - Theme (light/dark/auto)
- **Notifications:**
  - Enable notifications (toggle)
- **Data:**
  - Export all data (JSON/markdown)
  - Import data
  - Clear all data (with confirmation)
- **About:**
  - Version
  - GitHub link
  - Privacy policy

---

## 6. Testing Strategy

### Testing Pyramid

```
        /\
       /  \     E2E Tests (10%)
      /____\    - Critical user flows
     /      \
    /  Inte  \  Integration Tests (30%)
   /  gration \  - Store + DB interactions
  /____________\ - Service layer tests
 /              \
/   Unit Tests   \ Unit Tests (60%)
\_________________\ - Components, utils, parsers
```

### 6.1 Unit Tests (Jest + React Testing Library)

**Target Coverage: 80%+**

**What to Test:**

1. **Components:**
   - Rendering with various props
   - User interactions (button presses, input changes)
   - Conditional rendering
   - Theme switching

2. **Services:**
   - MarkdownParser: Valid/invalid formats, edge cases
   - WorkoutService: CRUD operations
   - HistoryService: Aggregations and calculations

3. **Utils:**
   - Date formatters
   - Validation functions
   - Unit converters (lbs ↔ kg)

4. **Hooks:**
   - Custom hooks with mock stores
   - Timer logic
   - Data fetching

**Example Test:**
```typescript
// __tests__/unit/services/MarkdownParser.test.ts
describe('MarkdownParser', () => {
  it('should parse valid workout markdown', () => {
    const markdown = `# Workout: Test\n## Squats\n- 225 x 5`;
    const result = MarkdownParser.parse(markdown);
    expect(result.success).toBe(true);
    expect(result.workout.name).toBe('Test');
    expect(result.workout.exercises).toHaveLength(1);
  });

  it('should return errors for invalid format', () => {
    const markdown = `# Invalid`;
    const result = MarkdownParser.parse(markdown);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('No exercises found');
  });
});
```

---

### 6.2 Integration Tests

**What to Test:**

1. **Database + Repository:**
   - CRUD operations with real SQLite
   - Migrations
   - Foreign key constraints
   - Query performance

2. **Store + Service Integration:**
   - Store actions trigger correct service calls
   - State updates correctly after async operations
   - Error handling propagates to UI

3. **Navigation Flows:**
   - Screen transitions
   - Parameter passing
   - Modal dismissal

**Example Test:**
```typescript
// __tests__/integration/stores/useWorkoutStore.test.ts
describe('useWorkoutStore', () => {
  beforeEach(() => {
    initTestDatabase();
  });

  it('should create and retrieve workout template', async () => {
    const { result } = renderHook(() => useWorkoutStore());

    await act(async () => {
      await result.current.createTemplate({
        name: 'Test Workout',
        exercises: [/* ... */]
      });
    });

    const templates = result.current.templates;
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Test Workout');
  });
});
```

---

### 6.3 E2E Tests (Detox)

**Testing Best Practices:**

**IMPORTANT: Always use `testID` props for Detox selectors**
- ✅ **DO:** Use `by.id('element-test-id')` with `testID` prop
- ❌ **DON'T:** Use `by.text()` or `by.label()` (brittle, breaks with text changes)
- **Rationale:**
  - Test IDs are stable and won't break when UI text changes
  - Works across localization/i18n
  - More performant and reliable
  - Explicit contract between tests and components

**Naming Convention for Test IDs:**
```typescript
// Pattern: {screen}-{component}-{identifier}
testID="workouts-tab"              // Navigation tab
testID="workout-card-0"             // List item (with index)
testID="start-workout-btn"          // Action button
testID="set-checkbox-0-0"           // Nested item (exercise-0, set-0)
testID="rest-timer"                 // Unique component
testID="exercise-name-input"        // Form field
```

**Adding Test IDs to Components:**
```typescript
// Example: Button with testID
<Pressable testID="start-workout-btn" onPress={handleStart}>
  <Text>Start Workout</Text>
</Pressable>

// Example: List item with dynamic ID
<FlatList
  data={workouts}
  renderItem={({ item, index }) => (
    <WorkoutCard
      testID={`workout-card-${index}`}
      workout={item}
    />
  )}
/>

// Example: Input field
<TextInput
  testID="exercise-name-input"
  value={name}
  onChangeText={setName}
/>
```

**Critical Flows to Test:**

1. **Complete Workout Flow:**
   - Start app
   - Start a workout
   - Complete sets
   - Mark exercise complete
   - Finish workout
   - Verify in history

2. **Import Flow:**
   - Open import modal
   - Paste valid markdown
   - Parse and preview
   - Import workout
   - Start imported workout

3. **History Flow:**
   - View workout history
   - Filter by date
   - View exercise history
   - See progress chart

4. **Theme Switching:**
   - Navigate through all screens
   - Switch theme in settings
   - Verify all screens update

**Example Test:**
```typescript
// __tests__/e2e/workout-flow.test.ts
describe('Complete Workout Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should complete a full workout', async () => {
    // Navigate to workouts
    await element(by.id('workouts-tab')).tap();

    // Select workout
    await element(by.id('workout-card-0')).tap();

    // Start workout
    await element(by.id('start-workout-btn')).tap();

    // Complete first set
    await element(by.id('set-checkbox-0-0')).tap();

    // Verify rest timer appears
    await expect(element(by.id('rest-timer'))).toBeVisible();

    // Skip rest
    await element(by.id('skip-rest-btn')).tap();

    // Finish workout
    await element(by.id('finish-workout-btn')).tap();

    // Verify in history
    await element(by.id('history-tab')).tap();
    await expect(element(by.text('Test Workout'))).toBeVisible();
  });
});
```

---

### 6.4 Testing Infrastructure

**CI/CD Pipeline (GitHub Actions):**

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3

  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx expo prebuild
      - run: npm run test:e2e:ios
```

**Test Commands:**
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e:ios": "detox test --configuration ios",
    "test:e2e:android": "detox test --configuration android",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

---

## 7. Coding Standards & Best Practices

### 7.1 Component Development

**Test IDs (Critical for E2E Testing):**
- ✅ **ALWAYS** add `testID` prop to interactive elements (buttons, inputs, touchables, cards)
- ✅ Use kebab-case naming: `testID="workout-card-0"`
- ✅ Follow pattern: `{screen}-{component}-{identifier}`
- ❌ **NEVER** rely on text content or labels in Detox tests
- **Benefits:**
  - Stable tests that survive UI text changes
  - Works with internationalization/localization
  - Explicit test contract with components
  - Better test performance

**Example:**
```typescript
// ✅ Good: All interactive elements have testID
export function WorkoutCard({ workout, index }: Props) {
  return (
    <Pressable testID={`workout-card-${index}`} onPress={onPress}>
      <Text testID={`workout-name-${index}`}>{workout.name}</Text>
      <Button testID={`start-workout-btn-${index}`} onPress={onStart}>
        Start
      </Button>
    </Pressable>
  );
}

// ❌ Bad: No testID props
export function WorkoutCard({ workout }: Props) {
  return (
    <Pressable onPress={onPress}>
      <Text>{workout.name}</Text>
      <Button onPress={onStart}>Start</Button>
    </Pressable>
  );
}
```

### 7.2 TypeScript Standards

**Strict Mode:**
- Enable all strict TypeScript flags
- No `any` types (use `unknown` if necessary)
- Explicit return types on functions
- Proper null/undefined handling

**Type Safety:**
```typescript
// ✅ Good: Explicit types, proper null handling
interface WorkoutCardProps {
  workout: WorkoutTemplate;
  index: number;
  onPress: (id: string) => void;
}

function WorkoutCard({ workout, index, onPress }: WorkoutCardProps): JSX.Element {
  const handlePress = useCallback(() => {
    onPress(workout.id);
  }, [workout.id, onPress]);

  return <Pressable testID={`workout-card-${index}`} onPress={handlePress} />;
}

// ❌ Bad: Implicit any, no return type
function WorkoutCard({ workout, index, onPress }) {
  return <Pressable onPress={() => onPress(workout.id)} />;
}
```

### 7.3 State Management

**Zustand Best Practices:**
- Keep stores focused (one concern per store)
- Use selectors to prevent unnecessary re-renders
- Async actions return promises
- Persist only necessary state

**Example:**
```typescript
// ✅ Good: Focused store with selectors
export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      templates: [],
      activeWorkoutId: null,

      addTemplate: async (template: WorkoutTemplate) => {
        await db.insertTemplate(template);
        set((state) => ({ templates: [...state.templates, template] }));
      },

      // Selector
      getTemplateById: (id: string) => {
        return get().templates.find(t => t.id === id);
      },
    }),
    { name: 'workout-store' }
  )
);

// Usage with selector to prevent re-renders
const template = useWorkoutStore(state => state.getTemplateById(id));
```

### 7.4 Performance

**Optimization Rules:**
- Use `React.memo()` for expensive list items
- Use `useCallback()` for functions passed as props
- Use `useMemo()` for expensive calculations
- Implement `FlatList` with `keyExtractor` and `getItemLayout`
- Avoid inline object/array creation in render

**Example:**
```typescript
// ✅ Good: Memoized list item
const WorkoutCard = React.memo(({ workout, onPress }: Props) => {
  const handlePress = useCallback(() => {
    onPress(workout.id);
  }, [workout.id, onPress]);

  return <Pressable testID={`workout-card-${workout.id}`} onPress={handlePress} />;
});

// ✅ Good: Optimized FlatList
<FlatList
  data={workouts}
  keyExtractor={(item) => item.id}
  renderItem={({ item, index }) => (
    <WorkoutCard
      testID={`workout-card-${index}`}
      workout={item}
      onPress={handlePress}
    />
  )}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 7.5 Error Handling

**Consistent Error Patterns:**
```typescript
// ✅ Good: Proper error handling with user feedback
async function importWorkout(markdown: string): Promise<Result<WorkoutTemplate>> {
  try {
    const parsed = MarkdownParser.parse(markdown);

    if (!parsed.success) {
      return {
        success: false,
        errors: parsed.errors,
      };
    }

    const template = await db.insertTemplate(parsed.workout);

    return {
      success: true,
      data: template,
    };
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      errors: ['Unexpected error during import. Please try again.'],
    };
  }
}
```

### 7.6 Accessibility

**Requirements:**
- All interactive elements have accessible labels
- Proper semantic components (`<Button>` not `<Pressable>` for actions)
- Sufficient color contrast (WCAG AA)
- Screen reader support

```typescript
// ✅ Good: Accessible button
<Pressable
  testID="start-workout-btn"
  accessibilityLabel="Start workout"
  accessibilityRole="button"
  onPress={handleStart}
>
  <Text>Start Workout</Text>
</Pressable>
```

---

## 8. Phased Implementation Approach

### Phase 0: Project Setup (Week 1)
**Goal:** Development environment ready

**Tasks:**
- [ ] Initialize Expo project with TypeScript
- [ ] Configure ESLint, Prettier, TypeScript strict mode
- [ ] Set up folder structure
- [ ] Install core dependencies (navigation, state, database)
- [ ] Configure NativeWind (Tailwind)
- [ ] Set up theme system (light/dark)
- [ ] Initialize SQLite database
- [ ] Create migrations system
- [ ] Set up Jest and testing utilities
- [ ] Configure Detox for E2E tests
- [ ] Set up GitHub Actions for CI

**Deliverable:** Empty app with navigation scaffold and tests running

---

### Phase 1: Data Layer & Core Services (Week 2)
**Goal:** Database and business logic foundation

**Tasks:**
- [ ] Implement SQLite schema and migrations
- [ ] Build database repositories (WorkoutRepository, etc.)
- [ ] Create TypeScript types and interfaces
- [ ] Implement MarkdownParser service with tests
- [ ] Build WorkoutService with CRUD operations
- [ ] Set up Zustand stores
- [ ] Write unit tests for services (80%+ coverage)
- [ ] Write integration tests for DB + repositories

**Deliverable:** Working data layer with comprehensive tests

---

### Phase 2: Markdown Import & Workout Templates (Week 3)
**Goal:** Users can import and view workouts

**Tasks:**
- [ ] Build Import Workout screen UI (modal)
- [ ] Implement file picker and text paste
- [ ] Connect MarkdownParser to UI
- [ ] Build workout preview component
- [ ] Implement validation and error display
- [ ] Create Workout List screen
- [ ] Create Workout Detail screen
- [ ] Implement export workout as markdown
- [ ] Add duplicate workout functionality (exports for editing)
- [ ] Add search and filtering
- [ ] Add delete workout functionality
- [ ] **Add `testID` props to all interactive components** (buttons, inputs, cards, tabs)
- [ ] Write component tests
- [ ] Write E2E test for import → view → export flow (using `by.id()` selectors only)

**Deliverable:** Users can import markdown workouts, view them, and export/duplicate for editing

---

### Phase 3: Active Workout Tracking (Week 4-5)
**Goal:** Core workout tracking functionality

**Tasks:**
- [ ] Build Active Workout screen UI
- [ ] Implement set completion logic
- [ ] Build rest timer component
- [ ] Implement workout timer
- [ ] Add auto-save draft functionality
- [ ] Build exercise navigation (prev/next)
- [ ] Implement finish workout flow
- [ ] Save completed session to database
- [ ] Add notifications for rest timer
- [ ] **Add `testID` props to all workout UI elements** (set checkboxes, timers, exercise cards)
- [ ] Write component tests
- [ ] Write integration tests for active workout store
- [ ] Write E2E test for complete workout flow (using `by.id()` selectors only)

**Deliverable:** Users can track workouts in real-time

---

### Phase 4: Workout History (Week 6)
**Goal:** View past workouts and progress

**Tasks:**
- [ ] Build Workout History screen
- [ ] Implement date filtering and grouping
- [ ] Build session detail view (read-only)
- [ ] Create Exercise History screen
- [ ] Implement exercise selector
- [ ] Build progress charts (react-native-chart-kit or Victory)
- [ ] Calculate and display PRs (personal records)
- [ ] Implement volume calculations
- [ ] Add export functionality (CSV/markdown)
- [ ] Write component tests
- [ ] Write E2E test for history flow

**Deliverable:** Users can review workout history and track progress

---

### Phase 5: Home Screen & Polish (Week 7)
**Goal:** Cohesive user experience

**Tasks:**
- [ ] Build Home screen with quick actions
- [ ] Add recent workouts display
- [ ] Implement weekly stats
- [ ] Build Settings screen
- [ ] Add data export/import
- [ ] Implement theme switching
- [ ] Add empty states for all screens
- [ ] Polish loading states and transitions
- [ ] Add haptic feedback
- [ ] Optimize performance (memoization, virtualization)
- [ ] Comprehensive theme testing (light/dark on all screens)

**Deliverable:** Complete, polished app ready for beta

---

### Phase 6: Testing & Bug Fixes (Week 8)
**Goal:** Production-ready quality

**Tasks:**
- [ ] Increase test coverage to 80%+
- [ ] Run E2E tests on physical devices
- [ ] Performance profiling and optimization
- [ ] Memory leak testing
- [ ] Accessibility audit (screen readers, contrast)
- [ ] User testing with 5-10 beta users
- [ ] Bug fixes from testing
- [ ] Documentation (README, code comments)
- [ ] Prepare App Store assets (screenshots, description)

**Deliverable:** Production-ready app

---

### Phase 7: Launch Preparation (Week 9)
**Goal:** App Store deployment

**Tasks:**
- [ ] EAS Build configuration for iOS
- [ ] App Store Connect setup
- [ ] Privacy policy and terms
- [ ] App Store screenshots and preview video
- [ ] Submit for TestFlight beta
- [ ] Beta testing round (2 weeks)
- [ ] Final bug fixes
- [ ] Submit to App Store review

**Deliverable:** App live on App Store

---

### Future Phases (Post-Launch)

**Phase 8: Android Support**
- Configure EAS for Android
- Test on Android devices
- Play Store submission

**Phase 9: Advanced Features**
- **Create/Edit Workout Screen** (in-app workout builder) - *priority based on user feedback*
- Workout programs (multi-week plans)
- Cloud sync (optional backend)
- Exercise library with videos/images
- Social features (share workouts)
- Advanced analytics (1RM calculator, volume trends)
- Apple Health / Google Fit integration

---

## 9. Technical Considerations

### 9.1 Performance Optimization

**Strategies:**
- Use `React.memo()` for expensive components
- Implement FlatList virtualization for long lists
- Debounce search inputs
- Lazy load charts and heavy components
- Use SQLite prepared statements
- Index frequently queried database columns
- Implement pagination for workout history (load 20 at a time)

---

### 9.2 Data Persistence Strategy

**Offline-First:**
- All data stored locally in SQLite
- No network required for core functionality
- Optional cloud sync in future phases

**Data Integrity:**
- Foreign key constraints in SQLite
- Validation at service layer
- Zustand middleware for state persistence
- Auto-save drafts for active workouts

---

### 9.3 Theme Implementation

**Approach:**
- NativeWind with custom dark mode config
- Themed components using `useColorScheme()` hook
- Theme toggle in settings with AsyncStorage persistence
- All colors defined in `/src/theme/colors.ts`

**Color Palette (Example):**
```typescript
// Light mode
background: '#FFFFFF'
surface: '#F5F5F5'
primary: '#3B82F6'
text: '#1F2937'

// Dark mode
background: '#111827'
surface: '#1F2937'
primary: '#60A5FA'
text: '#F9FAFB'
```

---

### 8.4 Accessibility

**Requirements:**
- All interactive elements have accessible labels
- Sufficient color contrast (WCAG AA)
- Support for larger text sizes
- Screen reader compatibility
- Haptic feedback for important actions

---

### 8.5 Error Handling

**Strategy:**
- Try/catch in all async operations
- User-friendly error messages
- Error boundary for crash recovery
- Logging for debugging (console in dev, Sentry in prod)
- Graceful degradation (e.g., timer fails → continue workout)

---

## 10. Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-file-system": "~18.0.0",
    "expo-document-picker": "~13.0.0",
    "react-native": "0.76.5",
    "react": "18.3.1",
    "react-navigation": "^7.0.0",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "@react-navigation/native-stack": "^7.0.0",
    "zustand": "^5.0.0",
    "nativewind": "^4.0.0",
    "date-fns": "^4.1.0",
    "zod": "^3.23.0",
    "react-native-chart-kit": "^6.12.0",
    "expo-notifications": "~0.30.0"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.0.0",
    "detox": "^20.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.57.0",
    "prettier": "^3.0.0"
  }
}
```

---

## 11. Success Metrics

**Development Metrics:**
- Test coverage: 80%+
- Build time: < 5 minutes
- App size: < 50 MB
- Startup time: < 2 seconds

**Quality Metrics:**
- Zero critical bugs at launch
- All E2E flows pass on iOS
- Accessibility score: AA or better
- Performance: 60 FPS during workout tracking

**User Metrics (Post-Launch):**
- 90%+ workout completion rate
- < 5% crash rate
- Positive App Store reviews
- Active usage 3+ times per week

---

## 12. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migrations fail | High | Extensive testing, migration rollback support |
| Performance issues during workout | High | Profiling in Phase 6, optimize critical path |
| Markdown parsing edge cases | Medium | Comprehensive test suite, clear error messages |
| iOS App Store rejection | High | Follow HIG guidelines, privacy policy, TestFlight beta |
| Scope creep | Medium | Strict phase boundaries, defer features to post-launch |

---

## 13. Next Steps

1. **Review this plan** - Approve or request changes
2. **Set up development environment** - Install Expo, configure IDE
3. **Start Phase 0** - Initialize project with recommended stack
4. **Weekly check-ins** - Review progress and adjust timeline
5. **Beta testing** - Recruit 5-10 users for Phase 6 testing

---

## Appendix A: Sample Markdown Workouts

### Example 1: Simple Full Body Workout

```markdown
# Full Body A
@tags: full-body, strength
@units: lbs

First workout back after deload, feeling fresh.

## Squat
- 135 x 5 @rest: 120s
- 185 x 5 @rest: 180s
- 225 x 5 @rest: 180s
- 225 x 5 @rest: 180s
- 225 x 5 @rest: 180s

## Bench Press
- 135 x 5 @rest: 120s
- 185 x 5 @rest: 180s
- 205 x 5 @rest: 180s

## Barbell Row
- 135 x 8 @rest: 120s
- 155 x 8 @rest: 120s
- 155 x 8 @rest: 120s
```

### Example 2: Push Day with Supersets

```markdown
# Push Day
@tags: push, hypertrophy
@units: lbs

## Bench Press

Focus on controlled tempo and full range of motion.

- 135 x 10 @rest: 90s
- 185 x 8 @rest: 120s
- 205 x 6 @rpe: 8 @rest: 180s
- 205 x 6 @rpe: 9 @rest: 180s

## Incline Dumbbell Press
- 70 x 10 @rest: 90s
- 75 x 8 @rest: 90s
- 75 x 8 @rest: 90s

## Superset: Chest and Triceps

### Cable Fly
- 30 x 15 @rest: 30s
- 30 x 15 @rest: 30s
- 30 x 12 @rest: 30s

### Tricep Pushdown
- 50 x 15 @rest: 60s
- 60 x 12 @rest: 60s
- 70 x 10 @dropset
```

### Example 3: Bodyweight with Warmup/Cooldown

```markdown
# Calisthenics
@tags: bodyweight, functional

## Warmup

### Jump Rope
- 60s
- 60s

### Arm Circles
- 10
- 10

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
- 60s @rest: 30s
- 45 lbs x 45s @rest: 30s
- 45 lbs for 30s

## Cooldown

### Stretching
- 2m

### Foam Rolling
- 3m
```
