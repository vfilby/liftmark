import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

// Helper factory functions
function createSessionSet(overrides: Partial<SessionSet> = {}): SessionSet {
  return {
    id: 'set-1',
    sessionExerciseId: 'exercise-1',
    orderIndex: 0,
    status: 'pending',
    targetWeight: 100,
    targetWeightUnit: 'lbs',
    targetReps: 10,
    ...overrides,
  };
}

function createSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'exercise-1',
    workoutSessionId: 'session-1',
    exerciseName: 'Bench Press',
    orderIndex: 0,
    sets: [createSessionSet()],
    status: 'in_progress',
    ...overrides,
  };
}

function createWorkoutSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    name: 'Upper Body Workout',
    date: '2024-01-15T10:00:00Z',
    exercises: [createSessionExercise()],
    status: 'in_progress',
    ...overrides,
  };
}

describe('liveActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isLiveActivityAvailable (iOS)', () => {
    it('returns true when module loads successfully on iOS', () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: jest.fn(),
        updateActivity: jest.fn(),
        stopActivity: jest.fn(),
      }));

      const { isLiveActivityAvailable } = require('../services/liveActivityService');
      expect(isLiveActivityAvailable()).toBe(true);
    });

    it('returns false when module fails to load on iOS', () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => {
        throw new Error('Module not found');
      });

      const { isLiveActivityAvailable } = require('../services/liveActivityService');

      expect(isLiveActivityAvailable()).toBe(false);
    });

    it('returns false when exception is thrown', () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => {
        throw new Error('Unexpected error');
      });

      const { isLiveActivityAvailable } = require('../services/liveActivityService');
      expect(isLiveActivityAvailable()).toBe(false);
    });
  });

  describe('isLiveActivityAvailable (non-iOS)', () => {
    it('returns false on Android', () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'android' },
      }));

      const { isLiveActivityAvailable } = require('../services/liveActivityService');
      expect(isLiveActivityAvailable()).toBe(false);
    });
  });

  describe('startWorkoutLiveActivity', () => {
    it('starts activity with exercise details', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: jest.fn(),
      }));

      const { startWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 5, total: 20 };

      startWorkoutLiveActivity(session, exercise, 0, progress);

      expect(mockStartActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bench Press',
          subtitle: expect.stringContaining('Set 1/1'),
          progressBar: { progress: 0.25 },
        }),
        expect.objectContaining({
          backgroundColor: '#1a1a1a',
          titleColor: '#ffffff',
        })
      );
    });

    it('starts activity without exercise (starting workout)', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: jest.fn(),
      }));

      const { startWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      startWorkoutLiveActivity(session, null, 0, progress);

      expect(mockStartActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upper Body Workout',
          subtitle: 'Starting workout...',
          progressBar: { progress: 0 },
        }),
        expect.any(Object)
      );
    });

    it('ends existing activity before starting new one', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockStopActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: mockStopActivity,
      }));

      const { startWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      // Start first activity
      startWorkoutLiveActivity(session, null, 0, progress);
      expect(mockStartActivity).toHaveBeenCalledTimes(1);

      // Start second activity - should stop first one
      startWorkoutLiveActivity(session, null, 0, progress);
      expect(mockStopActivity).toHaveBeenCalledWith('activity-123', expect.any(Object));
      expect(mockStartActivity).toHaveBeenCalledTimes(2);
    });

    it('handles errors gracefully', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn(() => {
        throw new Error('Failed to start');
      });
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: jest.fn(),
      }));

      const { startWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      // Should not throw even when startActivity fails
      expect(() => {
        startWorkoutLiveActivity(session, null, 0, progress);
      }).not.toThrow();
    });

    it('does nothing when not available', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'android' },
      }));

      const { startWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      startWorkoutLiveActivity(session, null, 0, progress);

      expect(mockStartActivity).not.toHaveBeenCalled();
    });

    it('formats weight correctly for bodyweight exercises', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: jest.fn(),
      }));

      const { startWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = createSessionExercise({
        sets: [createSessionSet({ targetWeight: undefined })],
      });
      const progress = { completed: 0, total: 10 };

      startWorkoutLiveActivity(session, exercise, 0, progress);

      expect(mockStartActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle: expect.stringContaining('BW'),
        }),
        expect.any(Object)
      );
    });
  });

  describe('updateWorkoutLiveActivity', () => {
    it('updates activity with active set state', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockUpdateActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: mockUpdateActivity,
        stopActivity: jest.fn(),
      }));

      const {
        startWorkoutLiveActivity,
        updateWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 5, total: 20 };

      // Start activity first
      startWorkoutLiveActivity(session, exercise, 0, progress);

      // Update it
      updateWorkoutLiveActivity(session, exercise, 0, progress);

      expect(mockUpdateActivity).toHaveBeenCalledWith(
        'activity-123',
        expect.objectContaining({
          title: 'Bench Press',
          subtitle: expect.stringContaining('Set 1/1'),
          progressBar: { progress: 0.25 },
        })
      );
    });

    it('updates activity with rest timer state', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockUpdateActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: mockUpdateActivity,
        stopActivity: jest.fn(),
      }));

      const {
        startWorkoutLiveActivity,
        updateWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 5, total: 20 };
      const nextExercise = createSessionExercise({ id: 'exercise-2', exerciseName: 'Squat' });

      // Start activity first
      startWorkoutLiveActivity(session, exercise, 0, progress);

      // Update with rest timer
      updateWorkoutLiveActivity(session, exercise, 0, progress, {
        remainingSeconds: 60,
        nextExercise,
      });

      expect(mockUpdateActivity).toHaveBeenCalledWith(
        'activity-123',
        expect.objectContaining({
          title: 'Rest',
          subtitle: 'Next: Squat',
          progressBar: { date: expect.any(Number) },
        })
      );
    });

    it('shows "Finishing up" when no next exercise', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockUpdateActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: mockUpdateActivity,
        stopActivity: jest.fn(),
      }));

      const {
        startWorkoutLiveActivity,
        updateWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 5, total: 20 };

      startWorkoutLiveActivity(session, exercise, 0, progress);

      updateWorkoutLiveActivity(session, exercise, 0, progress, {
        remainingSeconds: 60,
        nextExercise: null,
      });

      expect(mockUpdateActivity).toHaveBeenCalledWith(
        'activity-123',
        expect.objectContaining({
          subtitle: 'Finishing up',
        })
      );
    });

    it('does nothing when no current activity', () => {
      jest.resetModules();

      const mockUpdateActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: jest.fn(),
        updateActivity: mockUpdateActivity,
        stopActivity: jest.fn(),
      }));

      const { updateWorkoutLiveActivity } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 5, total: 20 };

      updateWorkoutLiveActivity(session, exercise, 0, progress);

      expect(mockUpdateActivity).not.toHaveBeenCalled();
    });

    it('handles errors gracefully', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockUpdateActivity = jest.fn(() => {
        throw new Error('Update failed');
      });
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: mockUpdateActivity,
        stopActivity: jest.fn(),
      }));

      const {
        startWorkoutLiveActivity,
        updateWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 5, total: 20 };

      startWorkoutLiveActivity(session, exercise, 0, progress);
      // Should not throw despite update error
      expect(() => {
        updateWorkoutLiveActivity(session, exercise, 0, progress);
      }).not.toThrow();
    });
  });

  describe('endWorkoutLiveActivity', () => {
    it('ends activity with default message', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockStopActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: mockStopActivity,
      }));

      const {
        startWorkoutLiveActivity,
        endWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      startWorkoutLiveActivity(session, null, 0, progress);
      endWorkoutLiveActivity();

      expect(mockStopActivity).toHaveBeenCalledWith(
        'activity-123',
        expect.objectContaining({
          title: 'Workout Complete',
          subtitle: 'Great job!',
        })
      );
    });

    it('ends activity with custom message', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockStopActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: mockStopActivity,
      }));

      const {
        startWorkoutLiveActivity,
        endWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      startWorkoutLiveActivity(session, null, 0, progress);
      endWorkoutLiveActivity('Workout Cancelled');

      expect(mockStopActivity).toHaveBeenCalledWith(
        'activity-123',
        expect.objectContaining({
          title: 'Workout Cancelled',
        })
      );
    });

    it('does nothing when no current activity', () => {
      jest.resetModules();

      const mockStopActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: jest.fn(),
        updateActivity: jest.fn(),
        stopActivity: mockStopActivity,
      }));

      const { endWorkoutLiveActivity } = require('../services/liveActivityService');

      endWorkoutLiveActivity();

      expect(mockStopActivity).not.toHaveBeenCalled();
    });

    it('handles errors gracefully', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockStopActivity = jest.fn(() => {
        throw new Error('Stop failed');
      });
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: jest.fn(),
        stopActivity: mockStopActivity,
      }));

      const {
        startWorkoutLiveActivity,
        endWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const progress = { completed: 0, total: 20 };

      startWorkoutLiveActivity(session, null, 0, progress);

      // Should not throw even when stopActivity fails
      expect(() => {
        endWorkoutLiveActivity();
      }).not.toThrow();
    });

    it('clears currentActivityId after ending', () => {
      jest.resetModules();

      const mockStartActivity = jest.fn().mockReturnValue('activity-123');
      const mockStopActivity = jest.fn();
      const mockUpdateActivity = jest.fn();
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('expo-live-activity', () => ({
        startActivity: mockStartActivity,
        updateActivity: mockUpdateActivity,
        stopActivity: mockStopActivity,
      }));

      const {
        startWorkoutLiveActivity,
        endWorkoutLiveActivity,
        updateWorkoutLiveActivity,
      } = require('../services/liveActivityService');
      const session = createWorkoutSession();
      const exercise = session.exercises[0];
      const progress = { completed: 0, total: 20 };

      startWorkoutLiveActivity(session, null, 0, progress);
      endWorkoutLiveActivity();

      // Try to update - should do nothing since activity is ended
      updateWorkoutLiveActivity(session, exercise, 0, progress);
      expect(mockUpdateActivity).not.toHaveBeenCalled();
    });
  });
});
