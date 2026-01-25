/**
 * Tests for Workout Generation Service
 *
 * These tests verify the prompt template structure, context gathering,
 * response parsing, and validation logic for AI-powered workout generation.
 */

import {
  buildWorkoutGenerationPrompt,
  gatherWorkoutGenerationContext,
  parseAIWorkoutResponse,
  validateGeneratedWorkout,
  WorkoutGenerationContext,
  WorkoutGenerationParams,
} from '../services/workoutGenerationService';
import { WorkoutTemplate } from '../types/workout';

// Mock dependencies
jest.mock('../services/workoutHistoryService', () => ({
  generateWorkoutHistoryContext: jest.fn().mockResolvedValue(
    `Recent workouts:
2024-01-15 Push Day: Bench 185x8,205x5; Incline DB 60x10,70x8
2024-01-12 Pull Day: Row 225x5; Lat Pulldown 180x10,170x12

Other exercise PRs: Squat: 405lbsx5, Deadlift: 495lbsx3`
  ),
}));

jest.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        defaultWeightUnit: 'lbs' as const,
        customPromptAddition: 'Focus on progressive overload',
      },
    }),
  },
}));

jest.mock('../stores/equipmentStore', () => ({
  useEquipmentStore: {
    getState: () => {
      const equipment = [
        {
          id: '1',
          gymId: 'gym1',
          name: 'Barbell',
          isAvailable: true,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '2',
          gymId: 'gym1',
          name: 'Dumbbells',
          isAvailable: true,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '3',
          gymId: 'gym1',
          name: 'Bench',
          isAvailable: true,
          createdAt: '',
          updatedAt: '',
        },
      ];

      return {
        equipment,
        getEquipmentForGym: (gymId: string) => equipment.filter(eq => eq.gymId === gymId),
      };
    },
  },
}));

jest.mock('../stores/gymStore', () => ({
  useGymStore: {
    getState: () => ({
      defaultGym: {
        id: 'gym1',
        name: 'Test Gym',
        isDefault: true,
        createdAt: '',
        updatedAt: '',
      },
    }),
  },
}));

jest.mock('../db/repository', () => ({
  createWorkoutTemplate: jest.fn().mockResolvedValue(undefined),
}));

describe('Workout Generation Service', () => {
  describe('buildWorkoutGenerationPrompt', () => {
    const baseContext: WorkoutGenerationContext = {
      defaultWeightUnit: 'lbs',
      customPromptAddition: 'Focus on progressive overload',
      recentWorkouts: `Recent workouts:
2024-01-15 Push Day: Bench 185x8,205x5`,
      availableEquipment: ['Barbell', 'Dumbbells', 'Bench'],
      currentGym: 'Test Gym',
    };

    const baseParams: WorkoutGenerationParams = {
      intent: 'upper body strength',
      duration: 'medium',
      difficulty: 'intermediate',
    };

    it('should include user context in prompt', () => {
      const prompt = buildWorkoutGenerationPrompt(baseContext, baseParams);

      expect(prompt).toContain('Recent workouts:');
      expect(prompt).toContain('2024-01-15 Push Day: Bench 185x8,205x5');
      expect(prompt).toContain('Test Gym');
      expect(prompt).toContain('Barbell, Dumbbells, Bench');
      expect(prompt).toContain('Weight unit: lbs');
      expect(prompt).toContain('Focus on progressive overload');
    });

    it('should include workout request parameters', () => {
      const prompt = buildWorkoutGenerationPrompt(baseContext, baseParams);

      expect(prompt).toContain('upper body strength');
      expect(prompt).toContain('intermediate');
      expect(prompt).toContain('~60 minutes');
    });

    it('should include LMWF format specification', () => {
      const prompt = buildWorkoutGenerationPrompt(baseContext, baseParams);

      expect(prompt).toContain('LIFTMARK WORKOUT FORMAT');
      expect(prompt).toContain('@tags:');
      expect(prompt).toContain('@units:');
      expect(prompt).toContain('@rest:');
      expect(prompt).toContain('@rpe:');
      expect(prompt).toContain('Superset');
    });

    it('should include format examples', () => {
      const prompt = buildWorkoutGenerationPrompt(baseContext, baseParams);

      expect(prompt).toContain('135 x 8');
      expect(prompt).toContain('x 10'); // bodyweight
      expect(prompt).toContain('60s'); // time-based
    });

    it('should handle missing optional context fields', () => {
      const minimalContext: WorkoutGenerationContext = {
        defaultWeightUnit: 'kg',
        recentWorkouts: 'No recent workouts',
        availableEquipment: [],
      };

      const prompt = buildWorkoutGenerationPrompt(minimalContext, {
        intent: 'leg day',
      });

      expect(prompt).toContain('full commercial gym equipment');
      expect(prompt).toContain('Weight unit: kg');
      expect(prompt).not.toContain('Custom notes:');
    });

    it('should respect equipment override', () => {
      const params: WorkoutGenerationParams = {
        intent: 'home workout',
        equipmentOverride: ['Dumbbells', 'Pull-up bar'],
      };

      const prompt = buildWorkoutGenerationPrompt(baseContext, params);

      expect(prompt).toContain('Available equipment: Dumbbells, Pull-up bar');
      // Note: The example workout in the format spec may contain "Barbell" as an illustration
      // We're just checking that the equipment list in USER CONTEXT is overridden
    });

    it('should provide duration guidance', () => {
      const shortPrompt = buildWorkoutGenerationPrompt(baseContext, {
        intent: 'quick workout',
        duration: 'short',
      });
      expect(shortPrompt).toContain('~30 minutes');
      expect(shortPrompt).toContain('4-5 exercises');

      const longPrompt = buildWorkoutGenerationPrompt(baseContext, {
        intent: 'long session',
        duration: 'long',
      });
      expect(longPrompt).toContain('~90 minutes');
      expect(longPrompt).toContain('8-10 exercises');
    });

    it('should include focus areas when specified', () => {
      const params: WorkoutGenerationParams = {
        intent: 'upper body',
        focusAreas: ['chest', 'back'],
      };

      const prompt = buildWorkoutGenerationPrompt(baseContext, params);

      expect(prompt).toContain('Focus areas: chest, back');
    });
  });

  describe('gatherWorkoutGenerationContext', () => {
    it('should gather all context from stores and services', async () => {
      const context = await gatherWorkoutGenerationContext(5);

      expect(context.defaultWeightUnit).toBe('lbs');
      expect(context.customPromptAddition).toBe('Focus on progressive overload');
      expect(context.recentWorkouts).toContain('Recent workouts:');
      expect(Array.isArray(context.availableEquipment)).toBe(true);
      expect(context.currentGym).toBe('Test Gym');
    });
  });

  describe('parseAIWorkoutResponse', () => {
    it('should parse valid LMWF markdown', () => {
      const markdown = `# Push Day
@tags: push, strength
@units: lbs

Upper body strength focus

## Bench Press
- 135 x 8 @rest: 90s
- 185 x 5 @rest: 120s

## Incline Dumbbell Press
- 60 x 10 @rest: 90s`;

      const template = parseAIWorkoutResponse(markdown, 'lbs');

      expect(template.name).toBe('Push Day');
      expect(template.tags).toContain('push');
      expect(template.tags).toContain('strength');
      expect(template.exercises.length).toBeGreaterThan(0);
      expect(template.sourceMarkdown).toBe(markdown);
    });

    it('should throw on invalid markdown', () => {
      const invalidMarkdown = 'Not a valid workout format';

      expect(() => parseAIWorkoutResponse(invalidMarkdown, 'lbs')).toThrow(
        'Failed to parse AI workout response'
      );
    });

    it('should throw on empty workout', () => {
      const emptyMarkdown = `# Workout
@tags: test`;

      expect(() => parseAIWorkoutResponse(emptyMarkdown, 'lbs')).toThrow(
        'Failed to parse AI workout response'
      );
    });

    it('should preserve weight unit from context', () => {
      const markdown = `# Workout
@units: kg

## Squat
- 100 x 5`;

      const template = parseAIWorkoutResponse(markdown, 'kg');

      expect(template.defaultWeightUnit).toBe('kg');
    });
  });

  describe('validateGeneratedWorkout', () => {
    const createValidTemplate = (): WorkoutTemplate => ({
      id: 'test-id',
      name: 'Test Workout',
      tags: ['test'],
      defaultWeightUnit: 'lbs',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exercises: [
        {
          id: 'ex1',
          workoutTemplateId: 'test-id',
          exerciseName: 'Bench Press',
          orderIndex: 0,
          sets: [
            {
              id: 'set1',
              templateExerciseId: 'ex1',
              orderIndex: 0,
              targetWeight: 185,
              targetWeightUnit: 'lbs',
              targetReps: 8,
            },
          ],
        },
      ],
    });

    it('should pass validation for valid workout', () => {
      const template = createValidTemplate();
      const result = validateGeneratedWorkout(template);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should fail validation when name is missing', () => {
      const template = createValidTemplate();
      template.name = '';

      const result = validateGeneratedWorkout(template);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Workout name is required');
    });

    it('should fail validation when no exercises', () => {
      const template = createValidTemplate();
      template.exercises = [];

      const result = validateGeneratedWorkout(template);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Workout must have at least one exercise');
    });

    it('should warn about exercises with no sets', () => {
      const template = createValidTemplate();
      template.exercises[0].sets = [];

      const result = validateGeneratedWorkout(template);

      expect(result.warnings).toContain('Exercise "Bench Press" has no sets');
    });

    it('should fail validation for invalid RPE', () => {
      const template = createValidTemplate();
      template.exercises[0].sets[0].targetRpe = 15;

      const result = validateGeneratedWorkout(template);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('RPE must be between 1 and 10'))).toBe(true);
    });

    it('should fail validation when set has no target values', () => {
      const template = createValidTemplate();
      template.exercises[0].sets[0] = {
        id: 'set1',
        templateExerciseId: 'ex1',
        orderIndex: 0,
      };

      const result = validateGeneratedWorkout(template);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('must specify weight, reps, or time'))).toBe(
        true
      );
    });

    it('should warn about low volume workouts', () => {
      const template = createValidTemplate();
      // Only 1 exercise with 1 set = very low volume

      const result = validateGeneratedWorkout(template);

      expect(result.warnings.some(w => w.includes('Low total volume'))).toBe(true);
    });

    it('should warn about very high volume workouts', () => {
      const template = createValidTemplate();

      // Create a workout with 50 sets
      const sets = Array.from({ length: 50 }, (_, i) => ({
        id: `set${i}`,
        templateExerciseId: 'ex1',
        orderIndex: i,
        targetWeight: 100,
        targetWeightUnit: 'lbs' as const,
        targetReps: 10,
      }));

      template.exercises[0].sets = sets;

      const result = validateGeneratedWorkout(template);

      expect(result.warnings.some(w => w.includes('Very high volume'))).toBe(true);
    });

    it('should warn about weight without unit', () => {
      const template = createValidTemplate();
      delete template.exercises[0].sets[0].targetWeightUnit;

      const result = validateGeneratedWorkout(template);

      expect(result.warnings.some(w => w.includes('weight specified without unit'))).toBe(true);
    });

    it('should fail validation for exercise without name', () => {
      const template = createValidTemplate();
      template.exercises[0].exerciseName = '';

      const result = validateGeneratedWorkout(template);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('missing a name'))).toBe(true);
    });
  });

  describe('Prompt Template Quality', () => {
    it('should produce prompts that encourage progression', () => {
      const context: WorkoutGenerationContext = {
        defaultWeightUnit: 'lbs',
        recentWorkouts: 'Recent: Squat 315x5',
        availableEquipment: ['Barbell'],
      };

      const prompt = buildWorkoutGenerationPrompt(context, {
        intent: 'leg day',
      });

      expect(prompt).toContain('Progression');
      expect(prompt).toContain('recent training history');
      expect(prompt).toContain('PRs');
    });

    it('should emphasize equipment constraints', () => {
      const context: WorkoutGenerationContext = {
        defaultWeightUnit: 'lbs',
        recentWorkouts: 'None',
        availableEquipment: ['Dumbbells'],
      };

      const prompt = buildWorkoutGenerationPrompt(context, {
        intent: 'workout',
      });

      expect(prompt).toContain('Only use equipment from the available list');
      expect(prompt).toContain('Dumbbells');
    });

    it('should request format-only output', () => {
      const context: WorkoutGenerationContext = {
        defaultWeightUnit: 'lbs',
        recentWorkouts: 'None',
        availableEquipment: [],
      };

      const prompt = buildWorkoutGenerationPrompt(context, {
        intent: 'workout',
      });

      expect(prompt).toContain('Generate ONLY the workout');
      expect(prompt).toContain('Do not include any preamble');
      expect(prompt).toContain('ready to parse and save directly');
    });
  });
});
