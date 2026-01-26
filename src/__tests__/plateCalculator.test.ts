import {
  calculatePlates,
  formatPlateBreakdown,
  formatCompletePlateSetup,
  isBarbellExercise,
} from '../utils/plateCalculator';

describe('plateCalculator', () => {
  describe('isBarbellExercise', () => {
    it('should identify barbell exercises by equipment type', () => {
      expect(isBarbellExercise('Some Exercise', 'Barbell')).toBe(true);
      expect(isBarbellExercise('Some Exercise', 'barbell')).toBe(true);
      expect(isBarbellExercise('Some Exercise', 'Dumbbell')).toBe(false);
    });

    it('should identify common barbell exercises by name', () => {
      expect(isBarbellExercise('Back Squat')).toBe(true);
      expect(isBarbellExercise('Deadlift')).toBe(true);
      expect(isBarbellExercise('Bench Press')).toBe(true);
      expect(isBarbellExercise('Overhead Press')).toBe(true);
      expect(isBarbellExercise('Barbell Row')).toBe(true);
      expect(isBarbellExercise('Romanian Deadlift')).toBe(true);
      expect(isBarbellExercise('RDL')).toBe(true);
      expect(isBarbellExercise('Power Clean')).toBe(true);
      expect(isBarbellExercise('Front Squat')).toBe(true);
    });

    it('should not identify non-barbell exercises', () => {
      expect(isBarbellExercise('Dumbbell Curl')).toBe(false);
      expect(isBarbellExercise('Pull-up')).toBe(false);
      expect(isBarbellExercise('Bodyweight Squat')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isBarbellExercise('DEADLIFT')).toBe(true);
      expect(isBarbellExercise('bench press')).toBe(true);
      expect(isBarbellExercise('BaRbElL rOw')).toBe(true);
    });
  });

  describe('calculatePlates - pounds', () => {
    it('should calculate plates for 95 lbs (example from requirements)', () => {
      const result = calculatePlates(95, 'lbs');
      expect(result.weightPerSide).toBe(25); // (95 - 45) / 2
      expect(result.unit).toBe('lbs');
      expect(result.barWeight).toBe(45);
      expect(result.isAchievable).toBe(true);
      expect(result.plates).toEqual([{ weight: 25, count: 1 }]);
    });

    it('should calculate plates for 135 lbs', () => {
      const result = calculatePlates(135, 'lbs');
      expect(result.weightPerSide).toBe(45); // (135 - 45) / 2
      expect(result.plates).toEqual([{ weight: 45, count: 1 }]);
      expect(result.isAchievable).toBe(true);
    });

    it('should calculate plates for 225 lbs', () => {
      const result = calculatePlates(225, 'lbs');
      expect(result.weightPerSide).toBe(90); // (225 - 45) / 2
      expect(result.plates).toEqual([
        { weight: 45, count: 2 },
      ]);
      expect(result.isAchievable).toBe(true);
    });

    it('should calculate plates for 315 lbs', () => {
      const result = calculatePlates(315, 'lbs');
      expect(result.weightPerSide).toBe(135); // (315 - 45) / 2
      expect(result.plates).toEqual([
        { weight: 45, count: 3 },
      ]);
      expect(result.isAchievable).toBe(true);
    });

    it('should calculate plates for mixed plate sizes', () => {
      const result = calculatePlates(185, 'lbs');
      expect(result.weightPerSide).toBe(70); // (185 - 45) / 2
      expect(result.plates).toEqual([
        { weight: 45, count: 1 },
        { weight: 25, count: 1 },
      ]);
      expect(result.isAchievable).toBe(true);
    });

    it('should calculate plates with small increments', () => {
      const result = calculatePlates(152.5, 'lbs');
      expect(result.weightPerSide).toBe(53.75); // (152.5 - 45) / 2
      expect(result.plates).toEqual([
        { weight: 45, count: 1 },
        { weight: 5, count: 1 },
        { weight: 2.5, count: 1 },
      ]);
      // 45 + 5 + 2.5 = 52.5, not 53.75, so there's a 1.25 lb remainder
      expect(result.isAchievable).toBe(false);
      expect(result.remainder).toBeCloseTo(1.25, 1);
    });

    it('should handle bar weight only', () => {
      const result = calculatePlates(45, 'lbs');
      expect(result.weightPerSide).toBe(0);
      expect(result.plates).toEqual([]);
      expect(result.isAchievable).toBe(true);
    });

    it('should handle weights that cannot be achieved exactly', () => {
      const result = calculatePlates(100, 'lbs');
      expect(result.weightPerSide).toBe(27.5); // (100 - 45) / 2
      expect(result.plates).toEqual([
        { weight: 25, count: 1 },
        { weight: 2.5, count: 1 },
      ]);
      // 25 + 2.5 = 27.5, so it IS achievable
      expect(result.isAchievable).toBe(true);
    });

    it('should handle invalid weights (less than bar)', () => {
      const result = calculatePlates(30, 'lbs');
      expect(result.weightPerSide).toBe(0);
      expect(result.plates).toEqual([]);
      expect(result.isAchievable).toBe(false);
      expect(result.remainder).toBeLessThan(0);
    });
  });

  describe('calculatePlates - kilograms', () => {
    it('should calculate plates for 60 kg', () => {
      const result = calculatePlates(60, 'kg');
      expect(result.weightPerSide).toBe(20); // (60 - 20) / 2
      expect(result.unit).toBe('kg');
      expect(result.barWeight).toBe(20);
      expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
      expect(result.isAchievable).toBe(true);
    });

    it('should calculate plates for 100 kg', () => {
      const result = calculatePlates(100, 'kg');
      expect(result.weightPerSide).toBe(40); // (100 - 20) / 2
      expect(result.plates).toEqual([
        { weight: 25, count: 1 },
        { weight: 15, count: 1 },
      ]);
      expect(result.isAchievable).toBe(true);
    });

    it('should calculate plates for 140 kg', () => {
      const result = calculatePlates(140, 'kg');
      expect(result.weightPerSide).toBe(60); // (140 - 20) / 2
      expect(result.plates).toEqual([
        { weight: 25, count: 2 },
        { weight: 10, count: 1 },
      ]);
      expect(result.isAchievable).toBe(true);
    });

    it('should handle bar weight only (20kg)', () => {
      const result = calculatePlates(20, 'kg');
      expect(result.weightPerSide).toBe(0);
      expect(result.plates).toEqual([]);
      expect(result.isAchievable).toBe(true);
    });
  });

  describe('calculatePlates - custom bar weight', () => {
    it('should handle custom bar weight (35 lbs)', () => {
      const result = calculatePlates(135, 'lbs', 35);
      expect(result.weightPerSide).toBe(50); // (135 - 35) / 2
      expect(result.barWeight).toBe(35);
      expect(result.plates).toEqual([
        { weight: 45, count: 1 },
        { weight: 5, count: 1 },
      ]);
      expect(result.isAchievable).toBe(true);
    });

    it('should handle custom bar weight (15 kg)', () => {
      const result = calculatePlates(60, 'kg', 15);
      expect(result.weightPerSide).toBe(22.5); // (60 - 15) / 2
      expect(result.plates).toEqual([
        { weight: 20, count: 1 },
        { weight: 2.5, count: 1 },
      ]);
      expect(result.isAchievable).toBe(true);
    });
  });

  describe('formatPlateBreakdown', () => {
    it('should format single plate', () => {
      const breakdown = calculatePlates(95, 'lbs');
      expect(formatPlateBreakdown(breakdown)).toBe('25lbs');
    });

    it('should format multiple of same plate', () => {
      const breakdown = calculatePlates(225, 'lbs');
      expect(formatPlateBreakdown(breakdown)).toBe('2×45lbs');
    });

    it('should format mixed plates', () => {
      const breakdown = calculatePlates(185, 'lbs');
      expect(formatPlateBreakdown(breakdown)).toBe('45lbs + 25lbs');
    });

    it('should format complex combinations', () => {
      const breakdown = calculatePlates(152.5, 'lbs');
      expect(formatPlateBreakdown(breakdown)).toBe('45lbs + 5lbs + 2.5lbs (+1.3lbs short)');
    });

    it('should format bar only', () => {
      const breakdown = calculatePlates(45, 'lbs');
      expect(formatPlateBreakdown(breakdown)).toBe('Bar only');
    });

    it('should show remainder when not achievable', () => {
      const breakdown = calculatePlates(146, 'lbs'); // (146 - 45) / 2 = 50.5
      const formatted = formatPlateBreakdown(breakdown);
      expect(formatted).toContain('45lbs + 5lbs');
      expect(formatted).toContain('short');
    });
  });

  describe('formatCompletePlateSetup', () => {
    it('should format complete setup with bar weight and per side label', () => {
      const breakdown = calculatePlates(95, 'lbs');
      expect(formatCompletePlateSetup(breakdown)).toBe('45lb bar + 25lbs per side');
    });

    it('should format 135 lbs correctly', () => {
      const breakdown = calculatePlates(135, 'lbs');
      expect(formatCompletePlateSetup(breakdown)).toBe('45lb bar + 45lbs per side');
    });

    it('should format 155 lbs correctly', () => {
      const breakdown = calculatePlates(155, 'lbs');
      expect(formatCompletePlateSetup(breakdown)).toBe('45lb bar + 55lbs per side');
    });

    it('should format 225 lbs correctly', () => {
      const breakdown = calculatePlates(225, 'lbs');
      expect(formatCompletePlateSetup(breakdown)).toBe('45lb bar + 90lbs per side');
    });

    it('should format kilograms correctly', () => {
      const breakdown = calculatePlates(100, 'kg');
      expect(formatCompletePlateSetup(breakdown)).toBe('20kg bar + 40kg per side');
    });

    it('should format bar only', () => {
      const breakdown = calculatePlates(45, 'lbs');
      expect(formatCompletePlateSetup(breakdown)).toBe('Bar only');
    });

    it('should handle custom bar weight', () => {
      const breakdown = calculatePlates(135, 'lbs', 35);
      expect(formatCompletePlateSetup(breakdown)).toBe('35lb bar + 50lbs per side');
    });
  });
});
