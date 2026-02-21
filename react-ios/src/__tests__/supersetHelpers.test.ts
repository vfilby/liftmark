import { interleaveSupersetSets } from '../utils/supersetHelpers';
import type { SessionExercise, SessionSet } from '@/types';

describe('supersetHelpers', () => {
  describe('interleaveSupersetSets', () => {
    const createSet = (id: string, status: 'pending' | 'completed' = 'pending'): SessionSet => ({
      id,
      sessionExerciseId: 'exercise-1',
      status,
      orderIndex: 0,
    });

    const createExercise = (id: string, name: string, sets: SessionSet[]): SessionExercise => ({
      id,
      workoutSessionId: 'session-1',
      exerciseName: name,
      sets,
      orderIndex: 0,
      status: 'pending',
    });

    it('interleaves sets from two exercises correctly', () => {
      const exerciseA = createExercise('ex-a', 'Exercise A', [
        createSet('a1'),
        createSet('a2'),
        createSet('a3'),
      ]);

      const exerciseB = createExercise('ex-b', 'Exercise B', [
        createSet('b1'),
        createSet('b2'),
        createSet('b3'),
      ]);

      const result = interleaveSupersetSets([exerciseA, exerciseB]);

      expect(result).toHaveLength(6);
      expect(result[0].set.id).toBe('a1');
      expect(result[0].exercise.id).toBe('ex-a');
      expect(result[0].setIndex).toBe(0);

      expect(result[1].set.id).toBe('b1');
      expect(result[1].exercise.id).toBe('ex-b');
      expect(result[1].setIndex).toBe(0);

      expect(result[2].set.id).toBe('a2');
      expect(result[2].exercise.id).toBe('ex-a');
      expect(result[2].setIndex).toBe(1);

      expect(result[3].set.id).toBe('b2');
      expect(result[3].exercise.id).toBe('ex-b');
      expect(result[3].setIndex).toBe(1);

      expect(result[4].set.id).toBe('a3');
      expect(result[4].exercise.id).toBe('ex-a');
      expect(result[4].setIndex).toBe(2);

      expect(result[5].set.id).toBe('b3');
      expect(result[5].exercise.id).toBe('ex-b');
      expect(result[5].setIndex).toBe(2);
    });

    it('interleaves sets from three exercises correctly', () => {
      const exerciseA = createExercise('ex-a', 'Exercise A', [
        createSet('a1'),
        createSet('a2'),
      ]);

      const exerciseB = createExercise('ex-b', 'Exercise B', [
        createSet('b1'),
        createSet('b2'),
      ]);

      const exerciseC = createExercise('ex-c', 'Exercise C', [
        createSet('c1'),
        createSet('c2'),
      ]);

      const result = interleaveSupersetSets([exerciseA, exerciseB, exerciseC]);

      expect(result).toHaveLength(6);
      // First round: A1, B1, C1
      expect(result[0].set.id).toBe('a1');
      expect(result[1].set.id).toBe('b1');
      expect(result[2].set.id).toBe('c1');
      // Second round: A2, B2, C2
      expect(result[3].set.id).toBe('a2');
      expect(result[4].set.id).toBe('b2');
      expect(result[5].set.id).toBe('c2');
    });

    it('handles exercises with different number of sets', () => {
      const exerciseA = createExercise('ex-a', 'Exercise A', [
        createSet('a1'),
        createSet('a2'),
        createSet('a3'),
        createSet('a4'),
      ]);

      const exerciseB = createExercise('ex-b', 'Exercise B', [
        createSet('b1'),
        createSet('b2'),
      ]);

      const result = interleaveSupersetSets([exerciseA, exerciseB]);

      expect(result).toHaveLength(6);
      // Round 1: A1, B1
      expect(result[0].set.id).toBe('a1');
      expect(result[1].set.id).toBe('b1');
      // Round 2: A2, B2
      expect(result[2].set.id).toBe('a2');
      expect(result[3].set.id).toBe('b2');
      // Round 3: A3 only (B has no more sets)
      expect(result[4].set.id).toBe('a3');
      // Round 4: A4 only
      expect(result[5].set.id).toBe('a4');
    });

    it('handles single exercise', () => {
      const exerciseA = createExercise('ex-a', 'Exercise A', [
        createSet('a1'),
        createSet('a2'),
      ]);

      const result = interleaveSupersetSets([exerciseA]);

      expect(result).toHaveLength(2);
      expect(result[0].set.id).toBe('a1');
      expect(result[1].set.id).toBe('a2');
    });

    it('handles empty exercises array', () => {
      const result = interleaveSupersetSets([]);

      expect(result).toHaveLength(0);
    });

    it('handles exercises with no sets', () => {
      const exerciseA = createExercise('ex-a', 'Exercise A', []);
      const exerciseB = createExercise('ex-b', 'Exercise B', []);

      const result = interleaveSupersetSets([exerciseA, exerciseB]);

      expect(result).toHaveLength(0);
    });
  });
});
