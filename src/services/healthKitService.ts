import { Platform } from 'react-native';
import type { WorkoutSession } from '@/types';

// Lazy load the native module to avoid crashes when not available
let HealthKit: typeof import('@kingstinct/react-native-healthkit') | undefined;
let moduleLoadAttempted = false;

function getHealthKit() {
  if (!moduleLoadAttempted && Platform.OS === 'ios') {
    moduleLoadAttempted = true;
    try {
      HealthKit = require('@kingstinct/react-native-healthkit');
    } catch (e) {
      // Module not available - silently continue
    }
  }
  return HealthKit;
}

/**
 * Check if HealthKit is available on this device
 */
export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const hk = getHealthKit();
    return hk?.isHealthDataAvailable?.() ?? false;
  } catch {
    return false;
  }
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
  if (!hk) return false;

  try {
    // Request write permission for workouts
    const result = await hk.requestAuthorization({
      toShare: [hk.WorkoutTypeIdentifier],
      toRead: [],
    });
    return result;
  } catch (error) {
    return false;
  }
}

/**
 * Check if HealthKit has been authorized
 */
export async function isHealthKitAuthorized(): Promise<boolean> {
  if (!isHealthKitAvailable()) {
    return false;
  }

  const hk = getHealthKit();
  if (!hk) return false;

  try {
    const status = await hk.getRequestStatusForAuthorization({
      toShare: [hk.WorkoutTypeIdentifier],
      toRead: [],
    });
    return status === hk.AuthorizationRequestStatus.unnecessary;
  } catch {
    return false;
  }
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
  if (!hk) {
    return { success: false, error: 'HealthKit module not loaded' };
  }

  try {
    // Calculate workout times and stats
    const startTime = session.startTime || session.date;
    const endTime = session.endTime || new Date().toISOString();
    const totalVolume = calculateWorkoutVolume(session);

    // Build metadata with workout details
    const metadata: Record<string, string | number> = {
      HKExternalUUID: session.id,
    };

    // Add total volume if any sets were completed
    if (totalVolume > 0) {
      metadata['TotalVolumeLbs'] = totalVolume;
    }

    const result = await hk.saveWorkoutSample(
      hk.WorkoutActivityType.traditionalStrengthTraining,
      [],
      new Date(startTime),
      new Date(endTime),
      undefined, // no totals (distance/energy)
      metadata
    );

    return { success: true, healthKitId: result?.uuid };
  } catch (error) {
    return { success: false, error: String(error) };
  }
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
