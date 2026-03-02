import {
  getCanonicalName,
  isSameExercise,
  getAliases,
  getExerciseDefinition,
} from '@/data/exerciseDictionary';

describe('exerciseDictionary', () => {
  describe('getCanonicalName', () => {
    it('returns canonical name for exact match', () => {
      expect(getCanonicalName('Bench Press')).toBe('Bench Press');
    });

    it('returns canonical name for alias', () => {
      expect(getCanonicalName('barbell bench press')).toBe('Bench Press');
      expect(getCanonicalName('flat bench press')).toBe('Bench Press');
    });

    it('is case-insensitive', () => {
      expect(getCanonicalName('BENCH PRESS')).toBe('Bench Press');
      expect(getCanonicalName('bench press')).toBe('Bench Press');
    });

    it('returns original name for unknown exercise', () => {
      expect(getCanonicalName('Zercher Squat')).toBe('Zercher Squat');
    });

    it('maps squat aliases correctly', () => {
      expect(getCanonicalName('Back Squat')).toBe('Back Squat');
      expect(getCanonicalName('Barbell Squat')).toBe('Back Squat');
      expect(getCanonicalName('Squat')).toBe('Back Squat');
    });

    it('maps overhead press aliases', () => {
      expect(getCanonicalName('OHP')).toBe('Overhead Press');
      expect(getCanonicalName('Military Press')).toBe('Overhead Press');
      expect(getCanonicalName('Shoulder Press')).toBe('Overhead Press');
    });

    it('maps deadlift aliases', () => {
      expect(getCanonicalName('Conventional Deadlift')).toBe('Deadlift');
      expect(getCanonicalName('Barbell Deadlift')).toBe('Deadlift');
    });

    it('maps RDL aliases', () => {
      expect(getCanonicalName('RDL')).toBe('Romanian Deadlift');
      expect(getCanonicalName('Barbell Romanian Deadlift')).toBe('Romanian Deadlift');
    });

    it('keeps dumbbell and barbell bench separate', () => {
      expect(getCanonicalName('Dumbbell Bench Press')).toBe('Dumbbell Bench Press');
      expect(getCanonicalName('Bench Press')).toBe('Bench Press');
      expect(getCanonicalName('Dumbbell Bench Press')).not.toBe('Bench Press');
    });
  });

  describe('isSameExercise', () => {
    it('returns true for same canonical', () => {
      expect(isSameExercise('Bench Press', 'Barbell Bench Press')).toBe(true);
    });

    it('returns true for same name', () => {
      expect(isSameExercise('Squat', 'Squat')).toBe(true);
    });

    it('returns false for different exercises', () => {
      expect(isSameExercise('Bench Press', 'Squat')).toBe(false);
    });

    it('returns false for unknown exercises with different names', () => {
      expect(isSameExercise('Zercher Squat', 'Jefferson Squat')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isSameExercise('bench press', 'BENCH PRESS')).toBe(true);
    });

    it('keeps dumbbell variants separate from barbell', () => {
      expect(isSameExercise('Dumbbell Bench Press', 'Bench Press')).toBe(false);
      expect(isSameExercise('DB Row', 'Barbell Row')).toBe(false);
    });
  });

  describe('getAliases', () => {
    it('returns all aliases including canonical', () => {
      const aliases = getAliases('Squat');
      expect(aliases).toContain('squat');
      expect(aliases).toContain('back squat');
      expect(aliases).toContain('barbell squat');
    });

    it('returns same aliases when queried by alias', () => {
      const fromCanonical = getAliases('Squat');
      const fromAlias = getAliases('Back Squat');
      expect(fromCanonical).toEqual(fromAlias);
    });

    it('returns single-element array for unknown exercise', () => {
      expect(getAliases('Zercher Squat')).toEqual(['zercher squat']);
    });

    it('all returned values are lowercase', () => {
      const aliases = getAliases('Bench Press');
      for (const alias of aliases) {
        expect(alias).toBe(alias.toLowerCase());
      }
    });
  });

  describe('getExerciseDefinition', () => {
    it('returns definition for canonical name', () => {
      const def = getExerciseDefinition('Back Squat');
      expect(def).not.toBeNull();
      expect(def!.canonical).toBe('Back Squat');
      expect(def!.category).toBe('compound');
      expect(def!.muscleGroups).toContain('quadriceps');
    });

    it('returns definition for alias', () => {
      const def = getExerciseDefinition('Squat');
      expect(def).not.toBeNull();
      expect(def!.canonical).toBe('Back Squat');
    });

    it('returns null for unknown exercise', () => {
      expect(getExerciseDefinition('Zercher Squat')).toBeNull();
    });

    it('bodyweight exercises have correct category', () => {
      const def = getExerciseDefinition('Pull-Up');
      expect(def).not.toBeNull();
      expect(def!.category).toBe('bodyweight');
    });

    it('isolation exercises have correct category', () => {
      const def = getExerciseDefinition('Bicep Curl');
      expect(def).not.toBeNull();
      expect(def!.category).toBe('isolation');
    });
  });
});
