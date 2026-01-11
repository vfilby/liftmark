import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

// Helper factory functions
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

describe('healthKitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateWorkoutVolume', () => {
    // calculateWorkoutVolume is a pure function that doesn't depend on Platform
    let calculateWorkoutVolume: typeof import('../services/healthKitService').calculateWorkoutVolume;

    beforeEach(() => {
      jest.resetModules();
      calculateWorkoutVolume = require('../services/healthKitService').calculateWorkoutVolume;
    });

    it('calculates total volume from completed sets', () => {
      const session = createWorkoutSession({
        exercises: [
          createSessionExercise({
            sets: [
              createSessionSet({
                actualWeight: 100,
                actualReps: 10,
                status: 'completed',
              }),
              createSessionSet({
                id: 'set-2',
                actualWeight: 100,
                actualReps: 8,
                status: 'completed',
              }),
            ],
          }),
        ],
      });

      expect(calculateWorkoutVolume(session)).toBe(1800); // (100*10) + (100*8)
    });

    it('ignores sets that are not completed', () => {
      const session = createWorkoutSession({
        exercises: [
          createSessionExercise({
            sets: [
              createSessionSet({
                actualWeight: 100,
                actualReps: 10,
                status: 'completed',
              }),
              createSessionSet({
                id: 'set-2',
                actualWeight: 100,
                actualReps: 10,
                status: 'pending',
              }),
              createSessionSet({
                id: 'set-3',
                actualWeight: 100,
                actualReps: 10,
                status: 'skipped',
              }),
            ],
          }),
        ],
      });

      expect(calculateWorkoutVolume(session)).toBe(1000); // Only first set
    });

    it('ignores sets without actualWeight', () => {
      const session = createWorkoutSession({
        exercises: [
          createSessionExercise({
            sets: [
              createSessionSet({
                actualReps: 10,
                status: 'completed',
              }),
            ],
          }),
        ],
      });

      expect(calculateWorkoutVolume(session)).toBe(0);
    });

    it('ignores sets without actualReps', () => {
      const session = createWorkoutSession({
        exercises: [
          createSessionExercise({
            sets: [
              createSessionSet({
                actualWeight: 100,
                status: 'completed',
              }),
            ],
          }),
        ],
      });

      expect(calculateWorkoutVolume(session)).toBe(0);
    });

    it('handles session with no exercises', () => {
      const session = createWorkoutSession({
        exercises: [],
      });

      expect(calculateWorkoutVolume(session)).toBe(0);
    });

    it('sums volume across multiple exercises', () => {
      const session = createWorkoutSession({
        exercises: [
          createSessionExercise({
            id: 'ex-1',
            sets: [
              createSessionSet({
                actualWeight: 100,
                actualReps: 10,
                status: 'completed',
              }),
            ],
          }),
          createSessionExercise({
            id: 'ex-2',
            sets: [
              createSessionSet({
                id: 'set-2',
                sessionExerciseId: 'ex-2',
                actualWeight: 50,
                actualReps: 20,
                status: 'completed',
              }),
            ],
          }),
        ],
      });

      expect(calculateWorkoutVolume(session)).toBe(2000); // (100*10) + (50*20)
    });
  });

  describe('isHealthKitAvailable (iOS)', () => {
    it('returns true when HealthKit is available on iOS', () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
      }));

      const { isHealthKitAvailable } = require('../services/healthKitService');
      expect(isHealthKitAvailable()).toBe(true);
    });

    it('returns false when isHealthDataAvailable returns false', () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => false),
      }));

      const { isHealthKitAvailable } = require('../services/healthKitService');
      expect(isHealthKitAvailable()).toBe(false);
    });
  });

  describe('isHealthKitAvailable (non-iOS)', () => {
    it('returns false on Android', () => {
      jest.resetModules();

      // Override Platform mock for this test
      jest.doMock('react-native', () => ({
        Platform: { OS: 'android' },
      }));

      const { isHealthKitAvailable } = require('../services/healthKitService');
      expect(isHealthKitAvailable()).toBe(false);
    });
  });

  describe('requestHealthKitAuthorization', () => {
    it('returns true when authorization succeeds', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        requestAuthorization: jest.fn().mockResolvedValue(true),
        WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
      }));

      const { requestHealthKitAuthorization } = require('../services/healthKitService');
      const result = await requestHealthKitAuthorization();
      expect(result).toBe(true);
    });

    it('returns false when authorization is denied', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        requestAuthorization: jest.fn().mockResolvedValue(false),
        WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
      }));

      const { requestHealthKitAuthorization } = require('../services/healthKitService');
      const result = await requestHealthKitAuthorization();
      expect(result).toBe(false);
    });

    it('returns false when authorization throws', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        requestAuthorization: jest.fn().mockRejectedValue(new Error('Auth failed')),
        WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
      }));

      const { requestHealthKitAuthorization } = require('../services/healthKitService');
      const result = await requestHealthKitAuthorization();
      expect(result).toBe(false);
    });

    it('returns false when not on iOS', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'android' },
      }));

      const { requestHealthKitAuthorization } = require('../services/healthKitService');
      const result = await requestHealthKitAuthorization();
      expect(result).toBe(false);
    });
  });

  describe('isHealthKitAuthorized', () => {
    it('returns true when status is unnecessary (already authorized)', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        getRequestStatusForAuthorization: jest.fn().mockResolvedValue(2),
        AuthorizationRequestStatus: { unnecessary: 2 },
        WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
      }));

      const { isHealthKitAuthorized } = require('../services/healthKitService');
      const result = await isHealthKitAuthorized();
      expect(result).toBe(true);
    });

    it('returns false when status is not unnecessary', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        getRequestStatusForAuthorization: jest.fn().mockResolvedValue(1),
        AuthorizationRequestStatus: { unnecessary: 2 },
        WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
      }));

      const { isHealthKitAuthorized } = require('../services/healthKitService');
      const result = await isHealthKitAuthorized();
      expect(result).toBe(false);
    });

    it('returns false when check throws', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        getRequestStatusForAuthorization: jest.fn().mockRejectedValue(new Error('Check failed')),
        AuthorizationRequestStatus: { unnecessary: 2 },
        WorkoutTypeIdentifier: 'HKWorkoutTypeIdentifier',
      }));

      const { isHealthKitAuthorized } = require('../services/healthKitService');
      const result = await isHealthKitAuthorized();
      expect(result).toBe(false);
    });

    it('returns false when not on iOS', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'android' },
      }));

      const { isHealthKitAuthorized } = require('../services/healthKitService');
      const result = await isHealthKitAuthorized();
      expect(result).toBe(false);
    });
  });

  describe('saveWorkoutToHealthKit', () => {
    it('saves workout successfully', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        saveWorkoutSample: jest.fn().mockResolvedValue({ uuid: 'hk-uuid-123' }),
        WorkoutActivityType: { traditionalStrengthTraining: 50 },
      }));

      const { saveWorkoutToHealthKit } = require('../services/healthKitService');
      const session = createWorkoutSession({
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T11:00:00Z',
        exercises: [
          createSessionExercise({
            sets: [
              createSessionSet({
                actualWeight: 100,
                actualReps: 10,
                status: 'completed',
              }),
            ],
          }),
        ],
      });

      const result = await saveWorkoutToHealthKit(session);

      expect(result.success).toBe(true);
      expect(result.healthKitId).toBe('hk-uuid-123');
    });

    it('uses session.date when startTime is not set', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      const mockSaveWorkoutSample = jest.fn().mockResolvedValue({ uuid: 'hk-uuid-123' });
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        saveWorkoutSample: mockSaveWorkoutSample,
        WorkoutActivityType: { traditionalStrengthTraining: 50 },
      }));

      const { saveWorkoutToHealthKit } = require('../services/healthKitService');
      const session = createWorkoutSession({
        date: '2024-01-15T10:00:00Z',
        // No startTime or endTime
      });

      const result = await saveWorkoutToHealthKit(session);

      expect(result.success).toBe(true);
      expect(mockSaveWorkoutSample).toHaveBeenCalled();
    });

    it('includes volume in metadata when sets have data', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      const mockSaveWorkoutSample = jest.fn().mockResolvedValue({ uuid: 'hk-uuid-123' });
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        saveWorkoutSample: mockSaveWorkoutSample,
        WorkoutActivityType: { traditionalStrengthTraining: 50 },
      }));

      const { saveWorkoutToHealthKit } = require('../services/healthKitService');
      const session = createWorkoutSession({
        exercises: [
          createSessionExercise({
            sets: [
              createSessionSet({
                actualWeight: 100,
                actualReps: 10,
                status: 'completed',
              }),
            ],
          }),
        ],
      });

      await saveWorkoutToHealthKit(session);

      expect(mockSaveWorkoutSample).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        expect.objectContaining({ TotalVolumeLbs: 1000 })
      );
    });

    it('returns error when save throws', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
      jest.doMock('@kingstinct/react-native-healthkit', () => ({
        isHealthDataAvailable: jest.fn(() => true),
        saveWorkoutSample: jest.fn().mockRejectedValue(new Error('Save failed')),
        WorkoutActivityType: { traditionalStrengthTraining: 50 },
      }));

      const { saveWorkoutToHealthKit } = require('../services/healthKitService');
      const result = await saveWorkoutToHealthKit(createWorkoutSession());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Save failed');
    });

    it('returns error when not on iOS', async () => {
      jest.resetModules();

      jest.doMock('react-native', () => ({
        Platform: { OS: 'android' },
      }));

      const { saveWorkoutToHealthKit } = require('../services/healthKitService');
      const result = await saveWorkoutToHealthKit(createWorkoutSession());

      expect(result.success).toBe(false);
      expect(result.error).toBe('HealthKit is not available on this device');
    });
  });
});
