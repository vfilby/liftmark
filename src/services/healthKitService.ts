import { Platform } from 'react-native';
import type { WorkoutSession } from '@/types';

// Lazy load the native module to avoid crashes when not available
let AppleHealthKit: any = undefined;
let HealthActivity: any = undefined;
let moduleLoadAttempted = false;

function getHealthKit() {
  if (!moduleLoadAttempted && Platform.OS === 'ios') {
    moduleLoadAttempted = true;
    try {
      const health = require('react-native-health');
      if (health?.default?.initHealthKit) {
        AppleHealthKit = health.default;
        HealthActivity = health.HealthActivity;
      }
    } catch (e) {
      console.log('HealthKit module not available:', e);
    }
  }
  return AppleHealthKit;
}

/**
 * Check if HealthKit is available on this device
 */
export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const hk = getHealthKit();
    return hk != null && typeof hk?.initHealthKit === 'function';
  } catch {
    return false;
  }
}

// HealthKit permissions needed for workout tracking
function getHealthKitPermissions() {
  const hk = getHealthKit();
  if (!hk) return null;
  return {
    permissions: {
      read: [],
      write: [hk.Constants.Permissions.Workout],
    },
  };
}

/**
 * Request HealthKit authorization
 * Returns true if authorized, false if denied or unavailable
 */
export async function requestHealthKitAuthorization(): Promise<boolean> {
  if (!isHealthKitAvailable()) {
    return false;
  }

  const hk = getHealthKit();
  const permissions = getHealthKitPermissions();
  if (!hk || !permissions) return false;

  return new Promise((resolve) => {
    hk.initHealthKit(permissions, (error: string | null) => {
      if (error) {
        console.log('HealthKit authorization error:', error);
        resolve(false);
      } else {
        console.log('HealthKit authorized successfully');
        resolve(true);
      }
    });
  });
}

/**
 * Check if HealthKit has been authorized
 * Note: This actually re-requests authorization, as react-native-health
 * doesn't have a separate check method
 */
export async function isHealthKitAuthorized(): Promise<boolean> {
  if (!isHealthKitAvailable()) {
    return false;
  }

  const hk = getHealthKit();
  const permissions = getHealthKitPermissions();
  if (!hk || !permissions) return false;

  return new Promise((resolve) => {
    hk.initHealthKit(permissions, (error: string | null) => {
      resolve(!error);
    });
  });
}

/**
 * Save a completed workout session to Apple Health
 */
export async function saveWorkoutToHealthKit(
  session: WorkoutSession
): Promise<{ success: boolean; healthKitId?: string; error?: string }> {
  if (!isHealthKitAvailable()) {
    return { success: false, error: 'HealthKit is not available on this device' };
  }

  const hk = getHealthKit();
  if (!hk || !HealthActivity) {
    return { success: false, error: 'HealthKit module not loaded' };
  }

  // Calculate workout stats
  const startTime = session.startTime || session.date;
  const endTime = session.endTime || new Date().toISOString();

  const workoutOptions = {
    type: HealthActivity.TraditionalStrengthTraining,
    startDate: new Date(startTime).toISOString(),
    endDate: new Date(endTime).toISOString(),
  };

  return new Promise((resolve) => {
    hk.saveWorkout(workoutOptions, (error: string | null, result: any) => {
      if (error) {
        console.log('Error saving workout to HealthKit:', error);
        resolve({ success: false, error: String(error) });
      } else {
        console.log('Workout saved to HealthKit:', result);
        // Result is a HealthValue which could be the workout ID
        resolve({ success: true, healthKitId: String(result) });
      }
    });
  });
}

/**
 * Calculate total volume from a workout session
 */
export function calculateWorkoutVolume(session: WorkoutSession): number {
  let totalVolume = 0;

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.status === 'completed' && set.actualWeight && set.actualReps) {
        totalVolume += set.actualWeight * set.actualReps;
      }
    }
  }

  return totalVolume;
}
