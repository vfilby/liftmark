/**
 * Example usage of the MarkdownParser
 * This demonstrates how to use the parser and shows expected output
 */

import { parseWorkout } from '../MarkdownParser';

// Example 1: Simple workout
const simpleWorkout = `
# Push Day
@tags: push, strength
@units: lbs

Feeling strong today, going for PRs!

## Bench Press

Focus on bar path and leg drive.

- 135 x 5 @rest: 120s
- 185 x 5 @rest: 180s
- 225 x 5 @rpe: 8

## Overhead Press
- 95 x 8 @rest: 90s
- 115 x 8 @rest: 90s
- 135 x 6 @rpe: 8
`;

// Example 2: Workout with supersets
const supersetWorkout = `
# Chest & Triceps
@tags: bodybuilding, push, hypertrophy

## Barbell Bench Press
- 135 lbs x 12 reps @rest: 90s
- 185 lbs x 10 reps @rest: 90s
- 205 lbs x 8 reps @rest: 90s

## Superset: Chest Finisher

### Cable Fly
- 30 lbs x 15 reps @rest: 30s
- 30 lbs x 15 reps @rest: 30s
- 30 lbs x 12 reps @rest: 30s

### Dumbbell Pullover
- 50 lbs x 15 reps @rest: 90s
- 50 lbs x 15 reps @rest: 90s
- 50 lbs x 15 reps @rest: 90s

## Tricep Pushdown

Final set is a drop set.

- 60 lbs x 15 reps @rest: 60s
- 70 lbs x 12 reps @rest: 60s
- 80 lbs x 10 reps @rest: 60s
- 60 lbs x 15 reps @dropset
`;

// Example 3: Bodyweight and time-based
const bodyweightWorkout = `
# Calisthenics
@tags: bodyweight, calisthenics

## Pull-ups
- 10 @rest: 120s
- 8 @rest: 120s
- 6 @rest: 120s
- AMRAP

## Plank

Adding weight on last two sets.

- 60s @rest: 30s
- 45 lbs x 60s @rest: 30s
- 45 lbs for 45s

## Hanging Leg Raise
- 15 @rest: 60s
- 12 @rest: 60s
- 10 @rest: 60s
`;

// Example 4: Advanced powerlifting
const powerliftingWorkout = `
# Squat Day - Week 3 Heavy
@tags: powerlifting, squat, heavy

Competition prep, 4 weeks out. Feeling good, bodyweight at 220.

## Low Bar Squat

Competition depth, belt on work sets starting at 315.

- 135 lbs x 5 reps @rpe: 4 @rest: 60s
- 225 lbs x 5 reps @rpe: 5 @rest: 90s
- 315 lbs x 3 reps @rpe: 6 @rest: 120s
- 365 lbs x 1 reps @rpe: 7 @rest: 180s
- 405 lbs x 3 reps @rpe: 8 @rest: 300s
- 405 lbs x 3 reps @rpe: 9 @rest: 300s
- 405 lbs x 3 reps @rpe: 9.5 @rest: 300s

## Pause Squat

2 second pause at bottom, no belt.

- 315 lbs x 3 reps @tempo: 3-2-3-0 @rest: 180s
- 315 lbs x 3 reps @tempo: 3-2-3-0 @rest: 180s
- 315 lbs x 3 reps @tempo: 3-2-3-0 @rest: 180s

## Front Squat
- 225 lbs x 5 reps @rest: 120s
- 225 lbs x 5 reps @rest: 120s
- 225 lbs x 5 reps @rest: 120s
`;

// Run examples
console.log('=== Example 1: Simple Workout ===');
const result1 = parseWorkout(simpleWorkout);
console.log('Success:', result1.success);
console.log('Workout:', result1.data?.name);
console.log('Tags:', result1.data?.tags);
console.log('Default unit:', result1.data?.defaultWeightUnit);
console.log('Exercises:', result1.data?.exercises.length);
console.log('Errors:', result1.errors);
console.log('Warnings:', result1.warnings);
console.log('\n');

console.log('=== Example 2: Superset Workout ===');
const result2 = parseWorkout(supersetWorkout);
console.log('Success:', result2.success);
console.log('Workout:', result2.data?.name);
console.log('Exercises:', result2.data?.exercises.map(e => ({
  name: e.exerciseName,
  groupType: e.groupType,
  groupName: e.groupName,
  sets: e.sets.length,
})));
console.log('\n');

console.log('=== Example 3: Bodyweight Workout ===');
const result3 = parseWorkout(bodyweightWorkout);
console.log('Success:', result3.success);
console.log('Workout:', result3.data?.name);
console.log('First exercise sets:', result3.data?.exercises[0]?.sets.map(s => ({
  reps: s.targetReps,
  time: s.targetTime,
  isAmrap: s.targetReps === undefined && s.targetTime === undefined,
  rest: s.restSeconds,
})));
console.log('\n');

console.log('=== Example 4: Powerlifting Workout ===');
const result4 = parseWorkout(powerliftingWorkout);
console.log('Success:', result4.success);
console.log('Workout:', result4.data?.name);
console.log('First exercise (Squat) sets:', result4.data?.exercises[0]?.sets.length);
console.log('Tempo example:', result4.data?.exercises[1]?.sets[0]?.tempo);
console.log('\n');

// Export for use in tests
export {
  simpleWorkout,
  supersetWorkout,
  bodyweightWorkout,
  powerliftingWorkout,
};
