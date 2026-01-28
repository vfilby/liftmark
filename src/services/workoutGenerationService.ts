/**
 * Workout Generation Service
 *
 * This service handles AI-powered workout generation using the Anthropic Claude API.
 * It assembles user context (history, preferences, equipment) into structured prompts,
 * calls the Claude API, and parses responses into WorkoutTemplate objects.
 *
 * Prompt Engineering Decisions:
 *
 * 1. **Context-First Architecture**: We front-load the prompt with concrete user data
 *    (recent workout history, PRs, equipment) before asking for generation. This grounds
 *    the AI in reality and prevents generic "beginner workout" responses.
 *
 * 2. **Token Efficiency**: We use the existing `generateWorkoutHistoryContext()` function
 *    which provides abbreviated exercise names and compact formatting to maximize the
 *    amount of history we can include without hitting token limits.
 *
 * 3. **Format Constraints**: The LiftMark Workout Format (LMWF) is explicitly specified
 *    with examples. This ensures the AI output can be parsed by the existing MarkdownParser.
 *
 * 4. **Progressive Enhancement**: User preferences flow through three layers:
 *    - Base: Equipment availability and weight unit
 *    - Middle: Workout history and PRs (auto-generated context)
 *    - Top: Custom prompt additions (user-specified goals/preferences)
 *
 * 5. **Response Validation**: We expect the AI to output pure LMWF markdown. The existing
 *    MarkdownParser acts as our validator - if it can't parse, the generation failed.
 */

import { generateWorkoutHistoryContext } from './workoutHistoryService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGymStore } from '@/stores/gymStore';
import { parseWorkout } from './MarkdownParser';
import { WorkoutTemplate } from '@/types/workout';
import { createWorkoutTemplate } from '@/db/repository';

/**
 * User context for workout generation
 */
export interface WorkoutGenerationContext {
  // User preferences
  defaultWeightUnit: 'lbs' | 'kg';
  customPromptAddition?: string;

  // Historical context
  recentWorkouts: string;

  // Equipment/location context
  availableEquipment: string[];
  currentGym?: string;
}

/**
 * Parameters for workout generation request
 */
export interface WorkoutGenerationParams {
  // User's goal or intent (e.g., "upper body strength", "leg day", "full body")
  intent: string;

  // Optional constraints
  duration?: 'short' | 'medium' | 'long'; // ~30min, ~60min, ~90min
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  focusAreas?: string[]; // e.g., ["chest", "back", "legs"]

  // Override equipment availability for this specific workout
  equipmentOverride?: string[];
}

/**
 * Builds the complete prompt for Claude API workout generation
 *
 * @param context - User context including history, preferences, equipment
 * @param params - Specific parameters for this workout generation
 * @returns Complete prompt string ready for Claude API
 */
export function buildWorkoutGenerationPrompt(
  context: WorkoutGenerationContext,
  params: WorkoutGenerationParams
): string {
  const equipment = params.equipmentOverride || context.availableEquipment;
  const equipmentList = equipment.length > 0
    ? equipment.join(', ')
    : 'full commercial gym equipment';

  const durationGuidance = {
    short: '~30 minutes (4-5 exercises, 12-15 working sets total)',
    medium: '~60 minutes (6-8 exercises, 18-24 working sets total)',
    long: '~90 minutes (8-10 exercises, 25-30 working sets total)',
  }[params.duration || 'medium'];

  const difficultyGuidance = params.difficulty
    ? `Target difficulty: ${params.difficulty}. `
    : '';

  const focusAreasText = params.focusAreas && params.focusAreas.length > 0
    ? `Focus areas: ${params.focusAreas.join(', ')}. `
    : '';

  return `You are a professional strength coach creating a personalized workout for an athlete.

# USER CONTEXT

## Recent Training History
${context.recentWorkouts}

## Current Gym & Equipment
Gym: ${context.currentGym || 'Default gym'}
Available equipment: ${equipmentList}

## Preferences
- Weight unit: ${context.defaultWeightUnit}
${context.customPromptAddition ? `- Custom notes: ${context.customPromptAddition}` : ''}

# WORKOUT REQUEST

Generate a workout for: ${params.intent}

${difficultyGuidance}${focusAreasText}Target duration: ${durationGuidance}

# REQUIREMENTS

1. **Progression**: Base exercises and weights on the user's recent training history and PRs
2. **Equipment**: Only use equipment from the available list above
3. **Specificity**: Address the user's stated intent (${params.intent})
4. **Recovery**: Consider recency and volume of similar movements in recent workouts
5. **Format**: Output ONLY in LiftMark Workout Format (LMWF) - see spec below

# LIFTMARK WORKOUT FORMAT (LMWF) SPECIFICATION

The output must be valid LMWF markdown that can be parsed automatically.

## Structure:
\`\`\`markdown
# Workout Name
@tags: tag1, tag2, tag3
@units: ${context.defaultWeightUnit}

Optional freeform description or notes here.

## Exercise Name
Optional exercise notes here
- weight x reps @modifier: value
- weight x reps @modifier: value

## Another Exercise
- weight x reps
\`\`\`

## Supported Set Formats:
- \`135 x 5\` - Weight and reps
- \`x 10\` - Bodyweight for reps
- \`60s\` or \`1m 30s\` - Time-based (planks, cardio)
- \`1 mile\` or \`500m\` - Distance-based

## Supported Modifiers:
- \`@rest: 120s\` - Rest period in seconds
- \`@rpe: 8\` - Rate of perceived exertion (1-10)
- \`@tempo: 3-0-1-0\` - Eccentric-pause-concentric-pause in seconds
- \`@dropset\` - Indicates a drop set
- \`@per-side\` - Weight/reps are per side (e.g., single-leg movements)
- \`@amrap\` - As many reps as possible

## Supersets and Grouping:
Use nested headers for supersets/circuits:
\`\`\`markdown
## Superset: Upper Body

### Bench Press
- 185 x 8 @rest: 30s

### Barbell Row
- 155 x 8 @rest: 120s
\`\`\`

## Example Complete Workout:
\`\`\`markdown
# Push Day - Strength Focus
@tags: push, strength, upper-body
@units: ${context.defaultWeightUnit}

Heavy compound movements with accessory work for hypertrophy.

## Bench Press
Work up to a heavy triple
- 135 x 8 @rest: 90s
- 185 x 5 @rest: 120s
- 205 x 3 @rest: 180s
- 225 x 3 @rpe: 8 @rest: 300s

## Incline Dumbbell Press
- 60 x 10 @rest: 90s
- 70 x 8 @rest: 90s
- 70 x 8 @rest: 90s

## Superset: Chest & Triceps

### Cable Fly
- 40 x 12 @rest: 30s
- 40 x 12 @rest: 30s

### Overhead Tricep Extension
- 50 x 15 @rest: 90s
- 50 x 15 @rest: 90s
\`\`\`

# OUTPUT INSTRUCTIONS

Generate ONLY the workout in LMWF format above. Do not include any preamble, explanation, or additional text outside the markdown format. The output should be ready to parse and save directly.`;
}

/**
 * Gathers all necessary context for workout generation
 *
 * @param recentWorkoutCount - Number of recent workouts to include in context (default: 5)
 * @returns Complete context object ready for prompt building
 */
export async function gatherWorkoutGenerationContext(
  recentWorkoutCount: number = 5
): Promise<WorkoutGenerationContext> {
  // Get user settings
  const settings = useSettingsStore.getState().settings;

  // Use defaults if settings not loaded yet
  const defaultWeightUnit = settings?.defaultWeightUnit ?? 'lbs';
  const customPromptAddition = settings?.customPromptAddition;

  // Generate workout history context
  const recentWorkouts = await generateWorkoutHistoryContext(recentWorkoutCount);

  // Get available equipment at default gym
  const defaultGym = useGymStore.getState().defaultGym;
  const equipmentStore = useEquipmentStore.getState();
  const availableEquipment = defaultGym?.id
    ? equipmentStore.getEquipmentForGym(defaultGym.id).map(e => e.name)
    : [];

  return {
    defaultWeightUnit,
    customPromptAddition,
    recentWorkouts,
    availableEquipment,
    currentGym: defaultGym?.name,
  };
}

/**
 * Generates a workout using Claude API
 *
 * NOTE: This is a template/placeholder. Actual API integration will be implemented
 * in the parent feature (li-8wwt). This service provides the prompt building
 * infrastructure that the API client will use.
 *
 * @param params - Generation parameters
 * @returns Generated workout template
 */
export async function generateWorkoutWithAI(
  params: WorkoutGenerationParams
): Promise<WorkoutTemplate> {
  // 1. Gather context
  const context = await gatherWorkoutGenerationContext();

  // 2. Build prompt
  const prompt = buildWorkoutGenerationPrompt(context, params);

  // 3. Call Claude API (placeholder - will be implemented in li-8wwt)
  // const response = await callClaudeAPI(prompt);
  const response = '# Generated Workout\n\nPlaceholder for API response';

  // 4. Parse response into WorkoutTemplate
  const template = parseAIWorkoutResponse(response, context.defaultWeightUnit);

  // 5. Save to database
  await createWorkoutTemplate(template);

  return template;
}

/**
 * Parses AI-generated markdown response into a WorkoutTemplate
 *
 * @param markdown - Raw markdown response from Claude API
 * @param defaultWeightUnit - Default weight unit for the workout
 * @returns Parsed WorkoutTemplate ready for database
 * @throws Error if markdown cannot be parsed
 */
export function parseAIWorkoutResponse(
  markdown: string,
  defaultWeightUnit: 'lbs' | 'kg'
): WorkoutTemplate {
  try {
    // Use existing markdown parser
    const result = parseWorkout(markdown);

    // Check if parsing succeeded
    if (!result.success || !result.data) {
      const errorMessages = result.errors?.join('; ') || 'Unknown parse error';
      throw new Error(`Parse errors: ${errorMessages}`);
    }

    const template = result.data;

    // Ensure required fields are present
    if (!template.name || template.exercises.length === 0) {
      throw new Error('Invalid workout: missing name or exercises');
    }

    // Override weight unit if not specified in markdown
    if (!template.defaultWeightUnit) {
      template.defaultWeightUnit = defaultWeightUnit;
    }

    // Store the source markdown for reference
    template.sourceMarkdown = markdown;

    return template;
  } catch (error) {
    throw new Error(
      `Failed to parse AI workout response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates that a workout template meets quality standards
 *
 * @param template - Template to validate
 * @returns Validation result with any issues found
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export function validateGeneratedWorkout(template: WorkoutTemplate): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!template.name || template.name.trim().length === 0) {
    issues.push('Workout name is required');
  }

  if (template.exercises.length === 0) {
    issues.push('Workout must have at least one exercise');
  }

  // Exercise validation
  template.exercises.forEach((exercise, idx) => {
    if (!exercise.exerciseName || exercise.exerciseName.trim().length === 0) {
      issues.push(`Exercise ${idx + 1} is missing a name`);
    }

    if (exercise.sets.length === 0) {
      warnings.push(`Exercise "${exercise.exerciseName}" has no sets`);
    }

    // Set validation
    exercise.sets.forEach((set, setIdx) => {
      const hasWeight = set.targetWeight !== undefined;
      const hasReps = set.targetReps !== undefined;
      const hasTime = set.targetTime !== undefined;

      if (!hasWeight && !hasReps && !hasTime) {
        issues.push(
          `Exercise "${exercise.exerciseName}", set ${setIdx + 1}: must specify weight, reps, or time`
        );
      }

      // Weight without unit warning
      if (hasWeight && !set.targetWeightUnit) {
        warnings.push(
          `Exercise "${exercise.exerciseName}", set ${setIdx + 1}: weight specified without unit`
        );
      }

      // RPE range validation
      if (set.targetRpe !== undefined && (set.targetRpe < 1 || set.targetRpe > 10)) {
        issues.push(
          `Exercise "${exercise.exerciseName}", set ${setIdx + 1}: RPE must be between 1 and 10`
        );
      }
    });
  });

  // Quality warnings
  const totalWorkingSets = template.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  if (totalWorkingSets < 8) {
    warnings.push(`Low total volume: only ${totalWorkingSets} working sets`);
  }
  if (totalWorkingSets > 40) {
    warnings.push(`Very high volume: ${totalWorkingSets} working sets may be too much`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}
