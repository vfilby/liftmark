/**
 * LiftMark2 Type Definitions
 * Based on PLAN.md data model
 */

// Workout Template Types
export interface WorkoutTemplate {
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

export interface TemplateExercise {
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

export interface TemplateSet {
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
  isPerSide?: boolean; // Per side indicator (e.g., for unilateral exercises)
}

// Workout Session Types (for future implementation)
export interface WorkoutSession {
  id: string;
  workoutTemplateId?: string; // null if custom/imported
  name: string;
  date: string; // ISO date
  startTime?: string; // ISO datetime
  endTime?: string; // ISO datetime
  duration?: number; // seconds
  notes?: string;
  exercises: SessionExercise[];
  status: 'in_progress' | 'completed' | 'canceled';
}

export interface SessionExercise {
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

export interface SessionSet {
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
  isPerSide?: boolean; // Per side indicator (e.g., for unilateral exercises)
}

// Exercise Catalog (for suggestions & history aggregation)
export interface Exercise {
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
export interface UserSettings {
  id: string;
  defaultWeightUnit: 'lbs' | 'kg';
  enableWorkoutTimer: boolean;
  autoStartRestTimer: boolean;
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;
  customPromptAddition?: string; // Custom text appended to AI workout prompts
  healthKitEnabled: boolean; // Whether to sync workouts to Apple Health
  liveActivitiesEnabled: boolean; // Whether to show Live Activities on lock screen
  createdAt: string;
  updatedAt: string;
}

// Parser Result Types
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

export type WorkoutParseResult = ParseResult<WorkoutTemplate>;

// Database row types (snake_case for SQL)
export interface WorkoutTemplateRow {
  id: string;
  name: string;
  description: string | null;
  tags: string; // JSON array
  default_weight_unit: string | null;
  source_markdown: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExerciseRow {
  id: string;
  workout_template_id: string;
  exercise_name: string;
  order_index: number;
  notes: string | null;
  equipment_type: string | null;
  group_type: string | null;
  group_name: string | null;
  parent_exercise_id: string | null;
}

export interface TemplateSetRow {
  id: string;
  template_exercise_id: string;
  order_index: number;
  target_weight: number | null;
  target_weight_unit: string | null;
  target_reps: number | null;
  target_time: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  is_dropset: number; // SQLite boolean (0 or 1)
  is_per_side: number; // SQLite boolean (0 or 1)
}

export interface UserSettingsRow {
  id: string;
  default_weight_unit: string;
  enable_workout_timer: number; // SQLite boolean
  auto_start_rest_timer: number; // SQLite boolean
  theme: string;
  notifications_enabled: number; // SQLite boolean
  custom_prompt_addition: string | null;
  healthkit_enabled: number; // SQLite boolean
  live_activities_enabled: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

// Session database row types (snake_case for SQL)
export interface WorkoutSessionRow {
  id: string;
  workout_template_id: string | null;
  name: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
  notes: string | null;
  status: string;
}

export interface SessionExerciseRow {
  id: string;
  workout_session_id: string;
  exercise_name: string;
  order_index: number;
  notes: string | null;
  equipment_type: string | null;
  group_type: string | null;
  group_name: string | null;
  parent_exercise_id: string | null;
  status: string;
}

export interface SessionSetRow {
  id: string;
  session_exercise_id: string;
  order_index: number;
  parent_set_id: string | null;
  drop_sequence: number | null;
  // Target/Planned values
  target_weight: number | null;
  target_weight_unit: string | null;
  target_reps: number | null;
  target_time: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  // Actual performance values
  actual_weight: number | null;
  actual_weight_unit: string | null;
  actual_reps: number | null;
  actual_time: number | null;
  actual_rpe: number | null;
  // Metadata
  completed_at: string | null;
  status: string;
  notes: string | null;
  tempo: string | null;
  is_dropset: number; // SQLite boolean (0 or 1)
  is_per_side: number; // SQLite boolean (0 or 1)
}
