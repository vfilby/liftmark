import type { SessionExercise, SessionSet } from '@/types';

export interface InterleavedSet {
  exercise: SessionExercise;
  set: SessionSet;
  setIndex: number;
}

/**
 * Interleaves sets from multiple exercises in a superset.
 *
 * For example, if we have:
 * - Exercise A: Set 1, Set 2, Set 3
 * - Exercise B: Set 1, Set 2, Set 3
 *
 * This function returns: A1, B1, A2, B2, A3, B3
 *
 * @param exercises - Array of exercises in the superset
 * @returns Array of interleaved sets with exercise and set index information
 */
export function interleaveSupersetSets(exercises: SessionExercise[]): InterleavedSet[] {
  // Find the maximum number of sets across all exercises
  const maxSets = Math.max(...exercises.map(ex => ex.sets.length));

  // Create interleaved array: [A1, B1, A2, B2, A3, B3, ...]
  const interleavedSets: InterleavedSet[] = [];

  for (let setIndex = 0; setIndex < maxSets; setIndex++) {
    for (const exercise of exercises) {
      if (setIndex < exercise.sets.length) {
        interleavedSets.push({
          exercise,
          set: exercise.sets[setIndex],
          setIndex
        });
      }
    }
  }

  return interleavedSets;
}
