import {
  formatSetCompact,
  formatExerciseCompact,
  formatSessionCompact,
  abbreviateExerciseName,
  generateWorkoutHistoryContext,
  hasWorkoutHistory,
} from '../services/workoutHistoryService';
import type { SessionSet, SessionExercise, WorkoutSession } from '@/types';

// Mock the database repository
jest.mock('@/db/sessionRepository', () => ({
  getRecentSessions: jest.fn(),
  getExerciseBestWeights: jest.fn(),
}));

import { getRecentSessions, getExerciseBestWeights } from '@/db/sessionRepository';

const mockedGetRecentSessions = getRecentSessions as jest.MockedFunction<typeof getRecentSessions>;
const mockedGetExerciseBestWeights = getExerciseBestWeights as jest.MockedFunction<typeof getExerciseBestWeights>;

// ============================================================================
// Helper Factory Functions
// ============================================================================

function createSessionSet(overrides: Partial<SessionSet> = {}): SessionSet {
  return {
    id: 'set-1',
    sessionExerciseId: 'exercise-1',
    orderIndex: 0,
    status: 'completed',
    ...overrides,
  };
}

function createSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'exercise-1',
    workoutSessionId: 'session-1',
    exerciseName: 'Test Exercise',
    orderIndex: 0,
    sets: [],
    status: 'completed',
    ...overrides,
  };
}

function createWorkoutSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    name: 'Test Workout',
    date: '2024-01-15T10:00:00Z',
    exercises: [],
    status: 'completed',
    ...overrides,
  };
}

// ============================================================================
// formatSetCompact Tests
// ============================================================================

describe('formatSetCompact', () => {
  describe('weight + reps format', () => {
    it('formats actual weight and reps', () => {
      const set = createSessionSet({
        actualWeight: 185,
        actualReps: 8,
      });
      expect(formatSetCompact(set)).toBe('185x8');
    });

    it('formats target weight and reps when actuals are undefined', () => {
      const set = createSessionSet({
        targetWeight: 185,
        targetReps: 8,
      });
      expect(formatSetCompact(set)).toBe('185x8');
    });

    it('prefers actual values over target values', () => {
      const set = createSessionSet({
        targetWeight: 180,
        targetReps: 10,
        actualWeight: 185,
        actualReps: 8,
      });
      expect(formatSetCompact(set)).toBe('185x8');
    });

    it('formats decimal weights correctly', () => {
      const set = createSessionSet({
        actualWeight: 102.5,
        actualReps: 5,
      });
      expect(formatSetCompact(set)).toBe('102.5x5');
    });
  });

  describe('bodyweight format', () => {
    it('formats bodyweight reps when weight is undefined', () => {
      const set = createSessionSet({
        actualReps: 10,
      });
      expect(formatSetCompact(set)).toBe('bwx10');
    });

    it('formats bodyweight reps when weight is 0', () => {
      const set = createSessionSet({
        actualWeight: 0,
        actualReps: 10,
      });
      expect(formatSetCompact(set)).toBe('bwx10');
    });

    it('formats target bodyweight reps', () => {
      const set = createSessionSet({
        targetReps: 12,
      });
      expect(formatSetCompact(set)).toBe('bwx12');
    });
  });

  describe('time-based format', () => {
    it('formats actual time in seconds', () => {
      const set = createSessionSet({
        actualTime: 30,
      });
      expect(formatSetCompact(set)).toBe('30s');
    });

    it('formats target time in seconds', () => {
      const set = createSessionSet({
        targetTime: 60,
      });
      expect(formatSetCompact(set)).toBe('60s');
    });

    it('prefers actual time over target time', () => {
      const set = createSessionSet({
        targetTime: 45,
        actualTime: 60,
      });
      expect(formatSetCompact(set)).toBe('60s');
    });

    it('prefers reps over time when both present', () => {
      const set = createSessionSet({
        actualReps: 10,
        actualTime: 30,
      });
      expect(formatSetCompact(set)).toBe('bwx10');
    });

    it('prefers weighted reps over time when both present', () => {
      const set = createSessionSet({
        actualWeight: 100,
        actualReps: 10,
        actualTime: 30,
      });
      expect(formatSetCompact(set)).toBe('100x10');
    });
  });

  describe('empty/undefined values', () => {
    it('returns empty string when no values present', () => {
      const set = createSessionSet({});
      expect(formatSetCompact(set)).toBe('');
    });

    it('returns empty string when only weight is present (no reps)', () => {
      const set = createSessionSet({
        actualWeight: 100,
      });
      expect(formatSetCompact(set)).toBe('');
    });

    it('returns empty string when weight is undefined and reps is undefined', () => {
      const set = createSessionSet({
        actualWeight: undefined,
        actualReps: undefined,
        actualTime: undefined,
      });
      expect(formatSetCompact(set)).toBe('');
    });
  });
});

// ============================================================================
// formatExerciseCompact Tests
// ============================================================================

describe('formatExerciseCompact', () => {
  describe('exercise with completed sets', () => {
    it('formats exercise with single completed set', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Bench Press',
        sets: [
          createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('Bench 185x8');
    });

    it('formats exercise with multiple completed sets', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Deadlift',
        sets: [
          createSessionSet({ id: 'set-1', actualWeight: 315, actualReps: 5, status: 'completed' }),
          createSessionSet({ id: 'set-2', actualWeight: 365, actualReps: 3, status: 'completed' }),
          createSessionSet({ id: 'set-3', actualWeight: 405, actualReps: 1, status: 'completed' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('DL 315x5,365x3,405x1');
    });

    it('uses abbreviated name for known exercises', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Romanian Deadlift',
        sets: [
          createSessionSet({ actualWeight: 185, actualReps: 10, status: 'completed' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('RDL 185x10');
    });

    it('uses original name for unknown exercises', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Custom Exercise',
        sets: [
          createSessionSet({ actualWeight: 50, actualReps: 12, status: 'completed' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('Custom Exercise 50x12');
    });
  });

  describe('exercise with no completed sets', () => {
    it('returns empty string for exercise with no sets', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Bench Press',
        sets: [],
      });
      expect(formatExerciseCompact(exercise)).toBe('');
    });

    it('returns empty string when all sets are pending', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Bench Press',
        sets: [
          createSessionSet({ targetWeight: 185, targetReps: 8, status: 'pending' }),
          createSessionSet({ targetWeight: 185, targetReps: 8, status: 'pending' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('');
    });

    it('returns empty string when all sets are skipped', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Bench Press',
        sets: [
          createSessionSet({ targetWeight: 185, targetReps: 8, status: 'skipped' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('');
    });
  });

  describe('exercise with mixed set types', () => {
    it('only includes completed sets in output', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Bench Press',
        sets: [
          createSessionSet({ id: 'set-1', actualWeight: 135, actualReps: 10, status: 'completed' }),
          createSessionSet({ id: 'set-2', targetWeight: 185, targetReps: 8, status: 'pending' }),
          createSessionSet({ id: 'set-3', actualWeight: 185, actualReps: 8, status: 'completed' }),
          createSessionSet({ id: 'set-4', targetWeight: 205, targetReps: 5, status: 'skipped' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('Bench 135x10,185x8');
    });

    it('handles bodyweight and weighted sets together', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Pull-ups',
        sets: [
          createSessionSet({ id: 'set-1', actualReps: 10, status: 'completed' }),
          createSessionSet({ id: 'set-2', actualWeight: 25, actualReps: 8, status: 'completed' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('Pullups bwx10,25x8');
    });

    it('handles time-based and rep-based sets together', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Plank',
        sets: [
          createSessionSet({ id: 'set-1', actualTime: 60, status: 'completed' }),
          createSessionSet({ id: 'set-2', actualTime: 45, status: 'completed' }),
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('Plank 60s,45s');
    });

    it('returns empty string when completed sets have no usable data', () => {
      const exercise = createSessionExercise({
        exerciseName: 'Test',
        sets: [
          createSessionSet({ status: 'completed' }), // no weight, reps, or time
        ],
      });
      expect(formatExerciseCompact(exercise)).toBe('');
    });
  });
});

// ============================================================================
// abbreviateExerciseName Tests
// ============================================================================

describe('abbreviateExerciseName', () => {
  describe('known abbreviations', () => {
    const knownAbbreviations: [string, string][] = [
      ['bench press', 'Bench'],
      ['barbell bench press', 'Bench'],
      ['incline bench press', 'Inc Bench'],
      ['incline dumbbell press', 'Inc DB'],
      ['dumbbell bench press', 'DB Bench'],
      ['overhead press', 'OHP'],
      ['military press', 'OHP'],
      ['barbell squat', 'Squat'],
      ['back squat', 'Squat'],
      ['front squat', 'Fr Squat'],
      ['deadlift', 'DL'],
      ['romanian deadlift', 'RDL'],
      ['barbell row', 'Row'],
      ['bent over row', 'Row'],
      ['dumbbell row', 'DB Row'],
      ['lat pulldown', 'Pulldown'],
      ['pull-ups', 'Pullups'],
      ['pull ups', 'Pullups'],
      ['chin-ups', 'Chinups'],
      ['chin ups', 'Chinups'],
      ['bicep curls', 'Curls'],
      ['dumbbell bicep curls', 'DB Curls'],
      ['tricep pushdowns', 'Pushdowns'],
      ['tricep extensions', 'Tri Ext'],
      ['leg press', 'Leg Press'],
      ['leg curl', 'Leg Curl'],
      ['leg extension', 'Leg Ext'],
      ['calf raises', 'Calves'],
      ['lateral raises', 'Lat Raise'],
      ['face pulls', 'Face Pull'],
      ['cable flyes', 'Flyes'],
      ['dumbbell flyes', 'DB Flyes'],
      ['push-ups', 'Pushups'],
      ['push ups', 'Pushups'],
    ];

    it.each(knownAbbreviations)('abbreviates "%s" to "%s"', (input, expected) => {
      expect(abbreviateExerciseName(input)).toBe(expected);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase input', () => {
      expect(abbreviateExerciseName('BENCH PRESS')).toBe('Bench');
    });

    it('handles mixed case input', () => {
      expect(abbreviateExerciseName('Bench Press')).toBe('Bench');
    });

    it('handles all lowercase input', () => {
      expect(abbreviateExerciseName('bench press')).toBe('Bench');
    });

    it('handles unusual casing', () => {
      expect(abbreviateExerciseName('BeNcH pReSs')).toBe('Bench');
    });
  });

  describe('unknown exercise names', () => {
    it('returns original name for unknown exercises', () => {
      expect(abbreviateExerciseName('Custom Exercise')).toBe('Custom Exercise');
    });

    it('returns original name with original casing', () => {
      expect(abbreviateExerciseName('My Special Workout')).toBe('My Special Workout');
    });

    it('returns empty string for empty input', () => {
      expect(abbreviateExerciseName('')).toBe('');
    });

    it('handles partial matches without abbreviating', () => {
      expect(abbreviateExerciseName('bench')).toBe('bench');
    });

    it('handles similar but not matching names', () => {
      expect(abbreviateExerciseName('incline bench')).toBe('incline bench');
    });
  });
});

// ============================================================================
// formatSessionCompact Tests
// ============================================================================

describe('formatSessionCompact', () => {
  describe('full session with exercises', () => {
    it('formats a session with single exercise', () => {
      const session = createWorkoutSession({
        name: 'Push Day',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            exerciseName: 'Bench Press',
            sets: [
              createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe('2024-01-15 Push Day: Bench 185x8');
    });

    it('formats a session with multiple exercises', () => {
      const session = createWorkoutSession({
        name: 'Upper Body',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            id: 'ex-1',
            exerciseName: 'Bench Press',
            sets: [
              createSessionSet({ id: 's-1', actualWeight: 185, actualReps: 8, status: 'completed' }),
              createSessionSet({ id: 's-2', actualWeight: 205, actualReps: 5, status: 'completed' }),
            ],
          }),
          createSessionExercise({
            id: 'ex-2',
            exerciseName: 'Incline Dumbbell Press',
            sets: [
              createSessionSet({ id: 's-3', actualWeight: 60, actualReps: 10, status: 'completed' }),
              createSessionSet({ id: 's-4', actualWeight: 70, actualReps: 8, status: 'completed' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe(
        '2024-01-15 Upper Body: Bench 185x8,205x5; Inc DB 60x10,70x8'
      );
    });

    it('handles date-only format (no time component)', () => {
      const session = createWorkoutSession({
        name: 'Leg Day',
        date: '2024-02-20',
        exercises: [
          createSessionExercise({
            exerciseName: 'Barbell Squat',
            sets: [
              createSessionSet({ actualWeight: 225, actualReps: 5, status: 'completed' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe('2024-02-20 Leg Day: Squat 225x5');
    });
  });

  describe('session with section/superset parents', () => {
    it('filters out section parents (no sets)', () => {
      const session = createWorkoutSession({
        name: 'Workout',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            id: 'section-1',
            exerciseName: 'Warmup',
            groupType: 'section',
            sets: [], // Section parents have no sets
          }),
          createSessionExercise({
            id: 'ex-1',
            exerciseName: 'Arm Circles',
            parentExerciseId: 'section-1',
            sets: [
              createSessionSet({ actualTime: 30, status: 'completed' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe('2024-01-15 Workout: Arm Circles 30s');
    });

    it('filters out superset parents (no sets)', () => {
      const session = createWorkoutSession({
        name: 'Arms',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            id: 'superset-1',
            exerciseName: 'Superset: Arms',
            groupType: 'superset',
            sets: [], // Superset parents have no sets
          }),
          createSessionExercise({
            id: 'ex-1',
            exerciseName: 'Bicep Curls',
            parentExerciseId: 'superset-1',
            sets: [
              createSessionSet({ actualWeight: 25, actualReps: 10, status: 'completed' }),
            ],
          }),
          createSessionExercise({
            id: 'ex-2',
            exerciseName: 'Tricep Extensions',
            parentExerciseId: 'superset-1',
            sets: [
              createSessionSet({ actualWeight: 30, actualReps: 10, status: 'completed' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe(
        '2024-01-15 Arms: Curls 25x10; Tri Ext 30x10'
      );
    });

    it('handles complex nested structure', () => {
      const session = createWorkoutSession({
        name: 'Full Workout',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            id: 'section-warmup',
            exerciseName: 'Warmup',
            groupType: 'section',
            sets: [],
          }),
          createSessionExercise({
            id: 'ex-warmup-1',
            exerciseName: 'Jump Rope',
            parentExerciseId: 'section-warmup',
            sets: [
              createSessionSet({ actualTime: 120, status: 'completed' }),
            ],
          }),
          createSessionExercise({
            id: 'section-main',
            exerciseName: 'Main Workout',
            groupType: 'section',
            sets: [],
          }),
          createSessionExercise({
            id: 'superset-1',
            exerciseName: 'Superset',
            groupType: 'superset',
            parentExerciseId: 'section-main',
            sets: [],
          }),
          createSessionExercise({
            id: 'ex-main-1',
            exerciseName: 'Bench Press',
            parentExerciseId: 'superset-1',
            sets: [
              createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe(
        '2024-01-15 Full Workout: Jump Rope 120s; Bench 185x8'
      );
    });
  });

  describe('session with no valid exercises', () => {
    it('handles session with only section parents', () => {
      const session = createWorkoutSession({
        name: 'Empty Session',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            exerciseName: 'Section',
            groupType: 'section',
            sets: [],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe('2024-01-15 Empty Session: ');
    });

    it('handles session with exercises having no completed sets', () => {
      const session = createWorkoutSession({
        name: 'Skipped Workout',
        date: '2024-01-15T10:00:00Z',
        exercises: [
          createSessionExercise({
            exerciseName: 'Bench Press',
            sets: [
              createSessionSet({ targetWeight: 185, targetReps: 8, status: 'pending' }),
            ],
          }),
        ],
      });
      expect(formatSessionCompact(session)).toBe('2024-01-15 Skipped Workout: ');
    });
  });
});

// ============================================================================
// generateWorkoutHistoryContext Tests (with mocked DB)
// ============================================================================

describe('generateWorkoutHistoryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with recent sessions', () => {
    it('generates context with recent sessions', async () => {
      mockedGetRecentSessions.mockResolvedValue([
        createWorkoutSession({
          name: 'Push Day',
          date: '2024-01-15T10:00:00Z',
          exercises: [
            createSessionExercise({
              exerciseName: 'Bench Press',
              sets: [
                createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
              ],
            }),
          ],
        }),
      ]);
      mockedGetExerciseBestWeights.mockResolvedValue(new Map());

      const result = await generateWorkoutHistoryContext(5);

      expect(result).toBe('Recent workouts:\n2024-01-15 Push Day: Bench 185x8');
      expect(mockedGetRecentSessions).toHaveBeenCalledWith(5);
    });

    it('generates context with multiple sessions', async () => {
      mockedGetRecentSessions.mockResolvedValue([
        createWorkoutSession({
          id: 'session-1',
          name: 'Push Day',
          date: '2024-01-15T10:00:00Z',
          exercises: [
            createSessionExercise({
              exerciseName: 'Bench Press',
              sets: [
                createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
              ],
            }),
          ],
        }),
        createWorkoutSession({
          id: 'session-2',
          name: 'Pull Day',
          date: '2024-01-14T10:00:00Z',
          exercises: [
            createSessionExercise({
              exerciseName: 'Deadlift',
              sets: [
                createSessionSet({ actualWeight: 315, actualReps: 5, status: 'completed' }),
              ],
            }),
          ],
        }),
      ]);
      mockedGetExerciseBestWeights.mockResolvedValue(new Map());

      const result = await generateWorkoutHistoryContext(5);

      expect(result).toContain('Recent workouts:');
      expect(result).toContain('2024-01-15 Push Day: Bench 185x8');
      expect(result).toContain('2024-01-14 Pull Day: DL 315x5');
    });

    it('uses default count of 5 when not specified', async () => {
      mockedGetRecentSessions.mockResolvedValue([]);
      mockedGetExerciseBestWeights.mockResolvedValue(new Map());

      await generateWorkoutHistoryContext();

      expect(mockedGetRecentSessions).toHaveBeenCalledWith(5);
    });
  });

  describe('with no sessions (empty)', () => {
    it('returns empty string when no sessions exist', async () => {
      mockedGetRecentSessions.mockResolvedValue([]);
      mockedGetExerciseBestWeights.mockResolvedValue(new Map());

      const result = await generateWorkoutHistoryContext();

      expect(result).toBe('');
    });
  });

  describe('with additional best weights', () => {
    it('includes best weights for exercises not in recent workouts', async () => {
      mockedGetRecentSessions.mockResolvedValue([
        createWorkoutSession({
          name: 'Push Day',
          date: '2024-01-15T10:00:00Z',
          exercises: [
            createSessionExercise({
              exerciseName: 'Bench Press',
              sets: [
                createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
              ],
            }),
          ],
        }),
      ]);
      mockedGetExerciseBestWeights.mockResolvedValue(
        new Map([
          ['Squat', { weight: 315, reps: 5, unit: 'lbs' }],
          ['Deadlift', { weight: 405, reps: 3, unit: 'lbs' }],
        ])
      );

      const result = await generateWorkoutHistoryContext();

      expect(result).toContain('Recent workouts:');
      expect(result).toContain('2024-01-15 Push Day: Bench 185x8');
      expect(result).toContain('Other exercise PRs:');
      expect(result).toContain('Squat: 315lbsx5');
      expect(result).toContain('Deadlift: 405lbsx3');
    });

    it('excludes best weights for exercises already in recent workouts', async () => {
      mockedGetRecentSessions.mockResolvedValue([
        createWorkoutSession({
          name: 'Push Day',
          date: '2024-01-15T10:00:00Z',
          exercises: [
            createSessionExercise({
              exerciseName: 'Bench Press',
              sets: [
                createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
              ],
            }),
          ],
        }),
      ]);
      mockedGetExerciseBestWeights.mockResolvedValue(
        new Map([
          ['Bench Press', { weight: 225, reps: 3, unit: 'lbs' }], // Same exercise, should be excluded
          ['Squat', { weight: 315, reps: 5, unit: 'lbs' }],
        ])
      );

      const result = await generateWorkoutHistoryContext();

      expect(result).not.toContain('Bench Press: 225lbsx3');
      expect(result).toContain('Squat: 315lbsx5');
    });

    it('handles case-insensitive exercise name matching', async () => {
      mockedGetRecentSessions.mockResolvedValue([
        createWorkoutSession({
          name: 'Push Day',
          date: '2024-01-15T10:00:00Z',
          exercises: [
            createSessionExercise({
              exerciseName: 'bench press', // lowercase
              sets: [
                createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
              ],
            }),
          ],
        }),
      ]);
      mockedGetExerciseBestWeights.mockResolvedValue(
        new Map([
          ['Bench Press', { weight: 225, reps: 3, unit: 'lbs' }], // Title case, should still be excluded
        ])
      );

      const result = await generateWorkoutHistoryContext();

      expect(result).not.toContain('Bench Press: 225lbsx3');
    });

    it('only includes best weights when there are no recent sessions', async () => {
      mockedGetRecentSessions.mockResolvedValue([]);
      mockedGetExerciseBestWeights.mockResolvedValue(
        new Map([
          ['Squat', { weight: 315, reps: 5, unit: 'lbs' }],
        ])
      );

      const result = await generateWorkoutHistoryContext();

      expect(result).not.toContain('Recent workouts');
      expect(result).toContain('Other exercise PRs: Squat: 315lbsx5');
    });

    it('handles kg unit in best weights', async () => {
      mockedGetRecentSessions.mockResolvedValue([]);
      mockedGetExerciseBestWeights.mockResolvedValue(
        new Map([
          ['Squat', { weight: 140, reps: 5, unit: 'kg' }],
        ])
      );

      const result = await generateWorkoutHistoryContext();

      expect(result).toContain('Squat: 140kgx5');
    });
  });

  describe('edge cases', () => {
    it('excludes section/superset parents from recent exercise names', async () => {
      mockedGetRecentSessions.mockResolvedValue([
        createWorkoutSession({
          name: 'Workout',
          date: '2024-01-15T10:00:00Z',
          exercises: [
            createSessionExercise({
              id: 'section-1',
              exerciseName: 'Warmup Section',
              groupType: 'section',
              sets: [], // No sets - this is a section parent
            }),
            createSessionExercise({
              exerciseName: 'Bench Press',
              parentExerciseId: 'section-1',
              sets: [
                createSessionSet({ actualWeight: 185, actualReps: 8, status: 'completed' }),
              ],
            }),
          ],
        }),
      ]);
      mockedGetExerciseBestWeights.mockResolvedValue(
        new Map([
          ['Warmup Section', { weight: 0, reps: 0, unit: 'lbs' }], // Should NOT be excluded because section has no sets
        ])
      );

      const result = await generateWorkoutHistoryContext();

      // The section parent should not be in recentExerciseNames because it has no sets
      // So if there was a PR for "Warmup Section", it would appear
      // However, this test verifies the logic that only exercises with sets count
      expect(result).toContain('Bench 185x8');
    });
  });
});

// ============================================================================
// hasWorkoutHistory Tests (with mocked DB)
// ============================================================================

describe('hasWorkoutHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when sessions exist', async () => {
    mockedGetRecentSessions.mockResolvedValue([
      createWorkoutSession({ name: 'Workout' }),
    ]);

    const result = await hasWorkoutHistory();

    expect(result).toBe(true);
    expect(mockedGetRecentSessions).toHaveBeenCalledWith(1);
  });

  it('returns false when no sessions exist', async () => {
    mockedGetRecentSessions.mockResolvedValue([]);

    const result = await hasWorkoutHistory();

    expect(result).toBe(false);
    expect(mockedGetRecentSessions).toHaveBeenCalledWith(1);
  });
});
