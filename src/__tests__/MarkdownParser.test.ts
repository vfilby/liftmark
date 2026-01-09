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
  });
});
