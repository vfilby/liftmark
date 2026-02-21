import {
  calculateWorkoutHighlights,
} from '../services/workoutHighlightsService';
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
// calculateWorkoutHighlights Tests
// ============================================================================

describe('calculateWorkoutHighlights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects new PR when weight exceeds historical best', async () => {
    const currentSession = createWorkoutSession({
      id: 'current-session',
      date: '2024-01-20',
      exercises: [
        createSessionExercise({
          exerciseName: 'Bench Press',
          sets: [
            createSessionSet({
              actualWeight: 225,
              actualWeightUnit: 'lbs',
              actualReps: 5,
            }),
          ],
        }),
      ],
    });

    const bestWeights = new Map([
      ['Bench Press', { weight: 215, reps: 5, unit: 'lbs' }],
    ]);

    mockedGetExerciseBestWeights.mockResolvedValue(bestWeights);
    mockedGetRecentSessions.mockResolvedValue([]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({
      type: 'pr',
      emoji: '🎉',
      title: 'New PR!',
      message: expect.stringContaining('Bench Press: 225lbs (previous: 215lbs)'),
    });
  });

  it('detects first-time PR when exercise has no historical data', async () => {
    const currentSession = createWorkoutSession({
      exercises: [
        createSessionExercise({
          exerciseName: 'Deadlift',
          sets: [
            createSessionSet({
              actualWeight: 315,
              actualWeightUnit: 'lbs',
              actualReps: 3,
            }),
          ],
        }),
      ],
    });

    mockedGetExerciseBestWeights.mockResolvedValue(new Map());
    mockedGetRecentSessions.mockResolvedValue([]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    expect(highlights).toContainEqual(
      expect.objectContaining({
        type: 'pr',
        emoji: '🎉',
        title: 'First PR!',
        message: 'Deadlift: 315lbs',
      })
    );
  });

  it('detects weight increase vs last session', async () => {
    const currentSession = createWorkoutSession({
      id: 'current',
      date: '2024-01-20',
      exercises: [
        createSessionExercise({
          exerciseName: 'Squat',
          sets: [
            createSessionSet({
              actualWeight: 185,
              actualWeightUnit: 'lbs',
              actualReps: 8,
            }),
          ],
        }),
      ],
    });

    const previousSession = createWorkoutSession({
      id: 'previous',
      date: '2024-01-15',
      exercises: [
        createSessionExercise({
          exerciseName: 'Squat',
          sets: [
            createSessionSet({
              actualWeight: 175,
              actualWeightUnit: 'lbs',
              actualReps: 8,
            }),
          ],
        }),
      ],
    });

    mockedGetExerciseBestWeights.mockResolvedValue(new Map());
    mockedGetRecentSessions.mockResolvedValue([previousSession]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    expect(highlights).toContainEqual(
      expect.objectContaining({
        type: 'weight_increase',
        emoji: '💪',
        title: 'Weight Increase!',
        message: expect.stringContaining('Squat: 185lbs (up from 175lbs)'),
      })
    );
  });

  it('detects volume increase compared to last similar workout', async () => {
    const currentSession = createWorkoutSession({
      id: 'current',
      name: 'Push Day',
      date: '2024-01-20',
      exercises: [
        createSessionExercise({
          exerciseName: 'Bench Press',
          sets: [
            createSessionSet({
              actualWeight: 185,
              actualReps: 10,
            }),
            createSessionSet({
              actualWeight: 185,
              actualReps: 10,
            }),
          ],
        }),
      ],
    });

    const previousSession = createWorkoutSession({
      id: 'previous',
      name: 'Push Day',
      date: '2024-01-15',
      exercises: [
        createSessionExercise({
          exerciseName: 'Bench Press',
          sets: [
            createSessionSet({
              actualWeight: 185,
              actualReps: 8,
            }),
            createSessionSet({
              actualWeight: 185,
              actualReps: 8,
            }),
          ],
        }),
      ],
    });

    mockedGetExerciseBestWeights.mockResolvedValue(new Map());
    mockedGetRecentSessions.mockResolvedValue([previousSession]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    expect(highlights).toContainEqual(
      expect.objectContaining({
        type: 'volume_increase',
        emoji: '📈',
        title: 'Volume Increase!',
      })
    );
  });

  describe('workout streak detection', () => {
    it('detects 3-day consecutive streak', async () => {
      const currentSession = createWorkoutSession({
        id: 'current',
        date: '2024-01-20',
      });

      const recentSessions = [
        createWorkoutSession({ id: 'session-1', date: '2024-01-19' }), // 1 day ago
        createWorkoutSession({ id: 'session-2', date: '2024-01-18' }), // 2 days ago
      ];

      mockedGetExerciseBestWeights.mockResolvedValue(new Map());
      mockedGetRecentSessions.mockResolvedValue(recentSessions);

      const highlights = await calculateWorkoutHighlights(currentSession);

      expect(highlights).toContainEqual(
        expect.objectContaining({
          type: 'streak',
          emoji: '🔥',
          title: 'Consistency!',
          message: '3-day streak!',
        })
      );
    });

    it('does not detect streak with gaps', async () => {
      const currentSession = createWorkoutSession({
        id: 'current',
        date: '2024-01-20',
      });

      const recentSessions = [
        createWorkoutSession({ id: 'session-1', date: '2024-01-18' }), // 2 days ago (gap!)
        createWorkoutSession({ id: 'session-2', date: '2024-01-16' }), // 4 days ago
      ];

      mockedGetExerciseBestWeights.mockResolvedValue(new Map());
      mockedGetRecentSessions.mockResolvedValue(recentSessions);

      const highlights = await calculateWorkoutHighlights(currentSession);

      // Should not have streak since there's a gap
      expect(highlights.find(h => h.type === 'streak')).toBeUndefined();
    });

    it('handles multiple workouts on same day correctly', async () => {
      const currentSession = createWorkoutSession({
        id: 'current',
        date: '2024-01-20T18:00:00Z',
      });

      const recentSessions = [
        createWorkoutSession({ id: 'session-1', date: '2024-01-20T10:00:00Z' }), // Same day
        createWorkoutSession({ id: 'session-2', date: '2024-01-19' }), // 1 day ago
        createWorkoutSession({ id: 'session-3', date: '2024-01-18' }), // 2 days ago
      ];

      mockedGetExerciseBestWeights.mockResolvedValue(new Map());
      mockedGetRecentSessions.mockResolvedValue(recentSessions);

      const highlights = await calculateWorkoutHighlights(currentSession);

      // Should count as 3-day streak (same-day workout doesn't add to count)
      expect(highlights).toContainEqual(
        expect.objectContaining({
          type: 'streak',
          message: '3-day streak!',
        })
      );
    });

    it('does not show streak for only 1 day', async () => {
      const currentSession = createWorkoutSession({
        id: 'current',
        date: '2024-01-20',
      });

      const recentSessions = [
        createWorkoutSession({ id: 'session-1', date: '2024-01-17' }), // 3 days ago (gap!)
      ];

      mockedGetExerciseBestWeights.mockResolvedValue(new Map());
      mockedGetRecentSessions.mockResolvedValue(recentSessions);

      const highlights = await calculateWorkoutHighlights(currentSession);

      // Should not show streak for only 1 day
      expect(highlights.find(h => h.type === 'streak')).toBeUndefined();
    });

    it('detects 7+ day streak and shows as weeks', async () => {
      const currentSession = createWorkoutSession({
        id: 'current',
        date: '2024-01-20',
      });

      const recentSessions = [
        createWorkoutSession({ id: 'session-1', date: '2024-01-19' }),
        createWorkoutSession({ id: 'session-2', date: '2024-01-18' }),
        createWorkoutSession({ id: 'session-3', date: '2024-01-17' }),
        createWorkoutSession({ id: 'session-4', date: '2024-01-16' }),
        createWorkoutSession({ id: 'session-5', date: '2024-01-15' }),
        createWorkoutSession({ id: 'session-6', date: '2024-01-14' }),
        createWorkoutSession({ id: 'session-7', date: '2024-01-13' }),
      ];

      mockedGetExerciseBestWeights.mockResolvedValue(new Map());
      mockedGetRecentSessions.mockResolvedValue(recentSessions);

      const highlights = await calculateWorkoutHighlights(currentSession);

      // 8 consecutive days = 1 week streak
      expect(highlights).toContainEqual(
        expect.objectContaining({
          type: 'streak',
          message: '1-week streak!',
        })
      );
    });
  });

  it('returns empty array when no highlights are detected', async () => {
    const currentSession = createWorkoutSession({
      exercises: [
        createSessionExercise({
          exerciseName: 'Bench Press',
          sets: [
            createSessionSet({
              actualWeight: 185,
              actualWeightUnit: 'lbs',
              actualReps: 8,
            }),
          ],
        }),
      ],
    });

    // Same weight as historical best (no PR)
    const bestWeights = new Map([
      ['Bench Press', { weight: 185, reps: 8, unit: 'lbs' }],
    ]);

    mockedGetExerciseBestWeights.mockResolvedValue(bestWeights);
    mockedGetRecentSessions.mockResolvedValue([]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    expect(highlights).toHaveLength(0);
  });

  it('ignores exercises with no completed sets', async () => {
    const currentSession = createWorkoutSession({
      exercises: [
        createSessionExercise({
          exerciseName: 'Bench Press',
          sets: [
            createSessionSet({
              status: 'skipped',
              actualWeight: 225,
              actualReps: 5,
            }),
          ],
        }),
      ],
    });

    mockedGetExerciseBestWeights.mockResolvedValue(new Map());
    mockedGetRecentSessions.mockResolvedValue([]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    expect(highlights).toHaveLength(0);
  });

  it('handles exercises with multiple sets and picks the max weight', async () => {
    const currentSession = createWorkoutSession({
      exercises: [
        createSessionExercise({
          exerciseName: 'Bench Press',
          sets: [
            createSessionSet({
              id: 'set-1',
              actualWeight: 185,
              actualWeightUnit: 'lbs',
              actualReps: 10,
            }),
            createSessionSet({
              id: 'set-2',
              actualWeight: 205,
              actualWeightUnit: 'lbs',
              actualReps: 6,
            }),
            createSessionSet({
              id: 'set-3',
              actualWeight: 225,
              actualWeightUnit: 'lbs',
              actualReps: 3,
            }),
          ],
        }),
      ],
    });

    const bestWeights = new Map([
      ['Bench Press', { weight: 215, reps: 5, unit: 'lbs' }],
    ]);

    mockedGetExerciseBestWeights.mockResolvedValue(bestWeights);
    mockedGetRecentSessions.mockResolvedValue([]);

    const highlights = await calculateWorkoutHighlights(currentSession);

    // Should detect PR for 225 lbs (not 185 or 205)
    expect(highlights).toContainEqual(
      expect.objectContaining({
        type: 'pr',
        message: expect.stringContaining('225lbs'),
      })
    );
  });
});
