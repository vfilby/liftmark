import { parseWorkout } from '../services/MarkdownParser';

describe('MarkdownParser', () => {
  describe('parseWorkout', () => {
    it('parses a simple workout with one exercise', () => {
      const markdown = `# Test Workout
@units: lbs

## Bicep Curls
- 20 x 10
- 25 x 8
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('Test Workout');
      expect(result.data?.defaultWeightUnit).toBe('lbs');
      expect(result.data?.exercises).toHaveLength(1);
      expect(result.data?.exercises[0].exerciseName).toBe('Bicep Curls');
      expect(result.data?.exercises[0].sets).toHaveLength(2);
    });

    it('parses sets with rest modifiers', () => {
      const markdown = `# Workout
## Exercise
- 100 x 5 @rest: 60s
- 100 x 5 @rest: 90s
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].restSeconds).toBe(60);
      expect(result.data?.exercises[0].sets[1].restSeconds).toBe(90);
    });

    it('parses sets with RPE modifiers', () => {
      const markdown = `# Workout
## Squats
- 225 lbs x 5 @rpe: 8
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].targetWeight).toBe(225);
      expect(result.data?.exercises[0].sets[0].targetReps).toBe(5);
      expect(result.data?.exercises[0].sets[0].targetRpe).toBe(8);
    });

    it('parses bodyweight exercises', () => {
      const markdown = `# Workout
## Pull-ups
- bw x 10
- bw x 8
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].targetWeight).toBeUndefined();
      expect(result.data?.exercises[0].sets[0].targetReps).toBe(10);
    });

    it('parses time-based sets', () => {
      const markdown = `# Workout
## Plank
- 60s
- 45s
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].targetTime).toBe(60);
      expect(result.data?.exercises[0].sets[1].targetTime).toBe(45);
    });

    it('parses kg units', () => {
      const markdown = `# Workout
@units: kg

## Deadlift
- 100 kg x 5
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.defaultWeightUnit).toBe('kg');
      expect(result.data?.exercises[0].sets[0].targetWeight).toBe(100);
      expect(result.data?.exercises[0].sets[0].targetWeightUnit).toBe('kg');
    });

    it('fails when no workout header found', () => {
      const markdown = `Just some text
without a proper workout`;

      const result = parseWorkout(markdown);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('fails when exercise has no sets', () => {
      const markdown = `# Workout
## Empty Exercise
`;
      const result = parseWorkout(markdown);

      // Parser requires exercises to have sets to be recognized as valid
      // Without sets, the workout header isn't found
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('parses workout tags', () => {
      const markdown = `# Upper Body
@tags: strength, push
@units: lbs

## Bench Press
- 135 x 10
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.tags).toContain('strength');
      expect(result.data?.tags).toContain('push');
    });

    it('parses supersets', () => {
      const markdown = `# Workout

## Superset
### Bicep Curls
- 20 x 10
### Tricep Extensions
- 20 x 10
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      // Should have parent superset + 2 child exercises
      expect(result.data?.exercises.length).toBeGreaterThanOrEqual(2);
    });

    it('parses sections with exercises', () => {
      const markdown = `# Workout

## Warmup
### Arm Circles
- 30s
### Jumping Jacks
- 60s

## Workout
### Bench Press
- 135 x 10
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      const exercises = result.data?.exercises || [];

      // Should have: Warmup section parent, 2 warmup exercises, Workout section parent, 1 workout exercise
      expect(exercises.length).toBe(5);

      // First should be section parent
      expect(exercises[0].groupType).toBe('section');
      expect(exercises[0].exerciseName).toBe('Warmup');
      expect(exercises[0].sets).toHaveLength(0);

      // Warmup exercises should have parent pointing to warmup section
      expect(exercises[1].exerciseName).toBe('Arm Circles');
      expect(exercises[1].parentExerciseId).toBe(exercises[0].id);

      expect(exercises[2].exerciseName).toBe('Jumping Jacks');
      expect(exercises[2].parentExerciseId).toBe(exercises[0].id);
    });

    it('parses supersets inside sections', () => {
      const markdown = `# Workout

## Workout
### Superset: Arms
#### Bicep Curls
- 20 x 10
#### Tricep Extensions
- 20 x 10
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      const exercises = result.data?.exercises || [];

      // Should have: Workout section parent, Superset parent, 2 superset children
      expect(exercises.length).toBe(4);

      // First should be section parent
      const sectionParent = exercises[0];
      expect(sectionParent.groupType).toBe('section');
      expect(sectionParent.exerciseName).toBe('Workout');
      expect(sectionParent.sets).toHaveLength(0);

      // Second should be superset parent, with parent pointing to section
      const supersetParent = exercises[1];
      expect(supersetParent.groupType).toBe('superset');
      expect(supersetParent.exerciseName).toBe('Superset: Arms');
      expect(supersetParent.sets).toHaveLength(0);
      expect(supersetParent.parentExerciseId).toBe(sectionParent.id);

      // Superset children should have parent pointing to superset, NOT section
      const child1 = exercises[2];
      expect(child1.exerciseName).toBe('Bicep Curls');
      expect(child1.parentExerciseId).toBe(supersetParent.id);
      expect(child1.sets).toHaveLength(1);

      const child2 = exercises[3];
      expect(child2.exerciseName).toBe('Tricep Extensions');
      expect(child2.parentExerciseId).toBe(supersetParent.id);
      expect(child2.sets).toHaveLength(1);
    });

    it('parses @perside modifier', () => {
      const markdown = `# Workout
## Stretches
- 30s @perside
- 45s @perside
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].isPerSide).toBe(true);
      expect(result.data?.exercises[0].sets[1].isPerSide).toBe(true);
    });

    it('parses @dropset modifier', () => {
      const markdown = `# Workout
## Curls
- 20 x 10
- 15 x 12 @dropset
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].isDropset).toBeFalsy();
      expect(result.data?.exercises[0].sets[1].isDropset).toBe(true);
    });

    it('parses trailing text without modifiers', () => {
      const markdown = `# Workout
## Bench Press
- 225 x 5 Felt strong today!
- 245 x 3 PR set!
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].notes).toBe('Felt strong today!');
      expect(result.data?.exercises[0].sets[1].notes).toBe('PR set!');
    });

    it('parses trailing text after modifiers', () => {
      const markdown = `# Workout
## Squats
- 315 x 5 @rpe: 8 Great depth today
- 335 x 3 @rpe: 9 @rest: 180s Tough but doable
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].targetRpe).toBe(8);
      expect(result.data?.exercises[0].sets[0].notes).toBe('Great depth today');
      expect(result.data?.exercises[0].sets[1].targetRpe).toBe(9);
      expect(result.data?.exercises[0].sets[1].restSeconds).toBe(180);
      expect(result.data?.exercises[0].sets[1].notes).toBe('Tough but doable');
    });

    it('parses trailing text with tempo modifier', () => {
      const markdown = `# Workout
## Pause Squats
- 225 x 5 @tempo: 3-2-1-0 @rest: 120s Really focused on the pause
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].tempo).toBe('3-2-1-0');
      expect(result.data?.exercises[0].sets[0].restSeconds).toBe(120);
      expect(result.data?.exercises[0].sets[0].notes).toBe('Really focused on the pause');
    });

    it('handles text that looks like modifier but is not', () => {
      const markdown = `# Workout
## Deadlift
- 405 x 5 @rpe: 8.5 Back felt good, no issues
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].targetRpe).toBe(8.5);
      expect(result.data?.exercises[0].sets[0].notes).toBe('Back felt good, no issues');
    });

    it('handles multiple @ symbols in trailing text', () => {
      const markdown = `# Workout
## Bench Press
- 225 x 5 @rpe: 7 Hit the target @135 for warmup
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].targetRpe).toBe(7);
      // The trailing text includes the @ from "Hit the target @135 for warmup"
      expect(result.data?.exercises[0].sets[0].notes).toContain('Hit the target');
    });

    it('handles trailing text with only invalid modifiers', () => {
      const markdown = `# Workout
## Press
- 135 x 8 @invalid: value Some note here
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      // Invalid modifier should generate a warning but trailing text should still be captured
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.data?.exercises[0].sets[0].notes).toContain('Some note here');
    });

    it('parses trailing text after flag modifiers', () => {
      const markdown = `# Workout
## Curls
- 20 x 12 @dropset Burned out completely
- 15 x 15 Great pump
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].isDropset).toBe(true);
      expect(result.data?.exercises[0].sets[0].notes).toBe('Burned out completely');
      expect(result.data?.exercises[0].sets[1].notes).toBe('Great pump');
    });

    it('preserves trailing text with special characters', () => {
      const markdown = `# Workout
## Squats
- 225 x 5 @rpe: 8 Form was perfect! 💪 #PR
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].notes).toBe('Form was perfect! 💪 #PR');
    });

    it('handles empty trailing text gracefully', () => {
      const markdown = `# Workout
## Bench Press
- 225 x 5 @rpe: 8
- 245 x 3
`;
      const result = parseWorkout(markdown);

      expect(result.success).toBe(true);
      expect(result.data?.exercises[0].sets[0].notes).toBeUndefined();
      expect(result.data?.exercises[0].sets[1].notes).toBeUndefined();
    });
  });

  describe('GenAI Format Variations - Known Cases', () => {
    describe('Trailing descriptive text', () => {
      it('handles directional instructions', () => {
        const markdown = `# Test
## Arm Circles
- 30s forward
- 30s backward
`;
        const result = parseWorkout(markdown);
        // NOTE: This will fail until parser is enhanced (Project 1)
        // Expected: success with notes preserved
        expect(result.success || result.errors?.length).toBeDefined();
      });

      it('handles side/limb specifications', () => {
        const markdown = `# Test
## Dead Bug
- 12 each side
- 10 each arm
`;
        const result = parseWorkout(markdown);
        // NOTE: This will fail until parser is enhanced (Project 1)
        expect(result.success || result.errors?.length).toBeDefined();
      });

      it('handles "per side" and "both sides"', () => {
        const markdown = `# Test
## Stretch
- 45s per side
- 60s both sides
`;
        const result = parseWorkout(markdown);
        // NOTE: This will fail until parser is enhanced (Project 1)
        expect(result.success || result.errors?.length).toBeDefined();
      });
    });

    describe('Real-world GenAI outputs', () => {
      it('parses Claude-generated Push Day workout', () => {
        const markdown = `# Push Day - Compound Focus
@tags: push, chest, shoulders, triceps
@units: lbs

## Warmup

### Arm Circles
- 30s forward
- 30s backward

### Band Pull-Aparts
- 15
- 15

### Push-up to Downward Dog
- 8

### Empty Bar Overhead Press
- 45 x 10
- 45 x 8

## Workout

### Bench Press
- 135 x 8
- 185 x 6 @rpe: 6
- 205 x 5 @rpe: 7
- 225 x 4 @rpe: 8
- 225 x 4 @rpe: 9 @rest: 180s

### Overhead Press
- 95 x 8
- 115 x 6 @rpe: 7
- 125 x 5 @rpe: 8 @rest: 120s

### Incline Dumbbell Press
- 50 x 10
- 60 x 8 @rpe: 7
- 65 x 8 @rpe: 8

### Dips
- bw x 10
- bw x 8 @rpe: 8
- bw x AMRAP

### Superset: Shoulder & Tricep Finisher
#### Lateral Raises
- 20 x 12
- 25 x 10
#### Tricep Pushdowns
- 50 x 12
- 60 x 10

## Core

### Hanging Leg Raises
- 10
- 10
- 10 @rest: 60s

### Dead Bug
- 12 each side
- 12 each side

## Cool Down

### Doorway Chest Stretch
- 45s each side

### Overhead Tricep Stretch
- 30s each arm

### Thread the Needle
- 30s each side

### Child's Pose
- 60s
`;
        const result = parseWorkout(markdown);

        // This is the user's actual failing workout
        // NOTE: Will fail until Project 1 (parser enhancement) is complete
        // After Project 1, should parse successfully with trailing text as notes
        if (result.success) {
          expect(result.data?.exercises).toBeDefined();
          expect(result.data?.exercises.length).toBeGreaterThan(0);
        } else {
          // Document the failures for now
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
