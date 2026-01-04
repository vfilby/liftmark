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
  });
});
