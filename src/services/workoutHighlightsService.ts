import { getExerciseBestWeights, getRecentSessions } from '@/db/sessionRepository';
import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

/**
 * Highlight types for celebrating workout achievements
 */
export interface WorkoutHighlight {
  type: 'pr' | 'weight_increase' | 'volume_increase' | 'streak';
  emoji: string;
  title: string;
  message: string;
}

export interface ExercisePR {
  exerciseName: string;
  newWeight: number;
  newReps: number;
  oldWeight?: number;
  oldReps?: number;
  unit: string;
}

export interface VolumeComparison {
  currentVolume: number;
  previousVolume: number;
  percentageIncrease: number;
}

/**
 * Calculate all highlights for a completed workout session
 */
export async function calculateWorkoutHighlights(
  session: WorkoutSession
): Promise<WorkoutHighlight[]> {
  const highlights: WorkoutHighlight[] = [];

  // Calculate PRs
  const prs = await detectPersonalRecords(session);
  for (const pr of prs) {
    highlights.push(createPRHighlight(pr));
  }

  // Calculate volume improvements
  const volumeComparison = await calculateVolumeImprovement(session);
  if (volumeComparison) {
    highlights.push(createVolumeHighlight(volumeComparison));
  }

  // Calculate workout streak
  const streak = await calculateWorkoutStreak(session);
  if (streak && streak >= 2) {
    highlights.push(createStreakHighlight(streak));
  }

  // Calculate weight increases (vs last time)
  const weightIncreases = await detectWeightIncreases(session);
  for (const increase of weightIncreases) {
    highlights.push(createWeightIncreaseHighlight(increase));
  }

  return highlights;
}

/**
 * Detect new personal records in the current session
 */
async function detectPersonalRecords(session: WorkoutSession): Promise<ExercisePR[]> {
  const bestWeights = await getExerciseBestWeights();
  const prs: ExercisePR[] = [];

  // Get max weight per exercise in current session
  const sessionMaxes = getSessionMaxWeights(session);

  for (const [exerciseName, sessionMax] of sessionMaxes) {
    const historicalBest = bestWeights.get(exerciseName);

    // If no historical data, this is a first-time PR
    if (!historicalBest) {
      prs.push({
        exerciseName,
        newWeight: sessionMax.weight,
        newReps: sessionMax.reps,
        unit: sessionMax.unit,
      });
    }
    // Check if we beat the previous PR
    else if (sessionMax.weight > historicalBest.weight) {
      prs.push({
        exerciseName,
        newWeight: sessionMax.weight,
        newReps: sessionMax.reps,
        oldWeight: historicalBest.weight,
        oldReps: historicalBest.reps,
        unit: sessionMax.unit,
      });
    }
  }

  return prs;
}

/**
 * Detect weight increases compared to last session with same exercises
 */
async function detectWeightIncreases(session: WorkoutSession): Promise<ExercisePR[]> {
  const increases: ExercisePR[] = [];
  const recentSessions = await getRecentSessions(10);

  // Get exercises from current session
  const currentExercises = session.exercises.filter((ex) => ex.sets.length > 0);

  for (const currentEx of currentExercises) {
    const currentMax = getExerciseMaxWeight(currentEx);
    if (!currentMax) continue;

    // Find the most recent session with this exercise (excluding current)
    const lastSession = findLastSessionWithExercise(
      recentSessions,
      currentEx.exerciseName,
      session.id
    );

    if (lastSession) {
      const lastEx = lastSession.exercises.find(
        (ex) => ex.exerciseName === currentEx.exerciseName
      );
      if (lastEx) {
        const lastMax = getExerciseMaxWeight(lastEx);
        if (lastMax && currentMax.weight > lastMax.weight) {
          increases.push({
            exerciseName: currentEx.exerciseName,
            newWeight: currentMax.weight,
            newReps: currentMax.reps,
            oldWeight: lastMax.weight,
            oldReps: lastMax.reps,
            unit: currentMax.unit,
          });
        }
      }
    }
  }

  return increases;
}

/**
 * Calculate volume improvement compared to recent similar workouts
 */
async function calculateVolumeImprovement(
  session: WorkoutSession
): Promise<VolumeComparison | null> {
  const currentVolume = calculateSessionVolume(session);
  if (currentVolume === 0) return null;

  // Get recent sessions with similar name
  const recentSessions = await getRecentSessions(10);
  const similarSessions = recentSessions.filter(
    (s) =>
      s.id !== session.id &&
      (s.name.toLowerCase() === session.name.toLowerCase() ||
        s.workoutTemplateId === session.workoutTemplateId)
  );

  if (similarSessions.length === 0) return null;

  // Use most recent similar session for comparison
  const previousVolume = calculateSessionVolume(similarSessions[0]);
  if (previousVolume === 0) return null;

  const percentageIncrease = ((currentVolume - previousVolume) / previousVolume) * 100;

  // Only report if there's a meaningful increase (>5%)
  if (percentageIncrease > 5) {
    return {
      currentVolume,
      previousVolume,
      percentageIncrease,
    };
  }

  return null;
}

/**
 * Calculate workout streak (consecutive days/weeks with workouts)
 */
async function calculateWorkoutStreak(session: WorkoutSession): Promise<number | null> {
  const recentSessions = await getRecentSessions(30);
  if (recentSessions.length === 0) return null;

  // Sort by date descending
  const sortedSessions = [...recentSessions].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Count consecutive days with workouts
  let streak = 1; // Current session counts as 1
  const sessionDate = new Date(session.date);

  for (let i = 0; i < sortedSessions.length; i++) {
    const prevDate = new Date(sortedSessions[i].date);
    const daysDiff = Math.floor(
      (sessionDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Within 7 days = part of weekly streak
    if (daysDiff <= 7) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get max weight for each exercise in a session
 */
function getSessionMaxWeights(
  session: WorkoutSession
): Map<string, { weight: number; reps: number; unit: string }> {
  const maxes = new Map<string, { weight: number; reps: number; unit: string }>();

  for (const exercise of session.exercises) {
    if (exercise.sets.length === 0) continue; // Skip section headers

    const max = getExerciseMaxWeight(exercise);
    if (max) {
      maxes.set(exercise.exerciseName, max);
    }
  }

  return maxes;
}

/**
 * Get max weight for a single exercise
 */
function getExerciseMaxWeight(
  exercise: SessionExercise
): { weight: number; reps: number; unit: string } | null {
  let maxWeight = 0;
  let maxSet: SessionSet | null = null;

  for (const set of exercise.sets) {
    if (set.status === 'completed' && set.actualWeight && set.actualWeight > maxWeight) {
      maxWeight = set.actualWeight;
      maxSet = set;
    }
  }

  if (maxSet && maxWeight > 0) {
    return {
      weight: maxWeight,
      reps: maxSet.actualReps || 0,
      unit: maxSet.actualWeightUnit || 'lbs',
    };
  }

  return null;
}

/**
 * Calculate total volume (weight × reps) for a session
 */
function calculateSessionVolume(session: WorkoutSession): number {
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

/**
 * Find the most recent session containing a specific exercise
 */
function findLastSessionWithExercise(
  sessions: WorkoutSession[],
  exerciseName: string,
  excludeSessionId: string
): WorkoutSession | null {
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue;

    const hasExercise = session.exercises.some(
      (ex) => ex.exerciseName === exerciseName && ex.sets.length > 0
    );

    if (hasExercise) {
      return session;
    }
  }

  return null;
}

/**
 * Create highlight messages
 */
function createPRHighlight(pr: ExercisePR): WorkoutHighlight {
  if (pr.oldWeight) {
    return {
      type: 'pr',
      emoji: '🎉',
      title: 'New PR!',
      message: `${pr.exerciseName}: ${pr.newWeight}${pr.unit} (previous: ${pr.oldWeight}${pr.unit})`,
    };
  } else {
    return {
      type: 'pr',
      emoji: '🎉',
      title: 'First PR!',
      message: `${pr.exerciseName}: ${pr.newWeight}${pr.unit}`,
    };
  }
}

function createWeightIncreaseHighlight(increase: ExercisePR): WorkoutHighlight {
  return {
    type: 'weight_increase',
    emoji: '💪',
    title: 'Weight Increase!',
    message: `${increase.exerciseName}: ${increase.newWeight}${increase.unit} (up from ${increase.oldWeight}${increase.unit})`,
  };
}

function createVolumeHighlight(comparison: VolumeComparison): WorkoutHighlight {
  return {
    type: 'volume_increase',
    emoji: '📈',
    title: 'Volume Increase!',
    message: `${Math.round(comparison.percentageIncrease)}% more volume vs last time`,
  };
}

function createStreakHighlight(streak: number): WorkoutHighlight {
  const weekCount = Math.floor(streak / 7);
  const dayCount = streak % 7;

  let message = '';
  if (weekCount > 0) {
    message = `${weekCount}-week streak!`;
  } else {
    message = `${dayCount}-day streak!`;
  }

  return {
    type: 'streak',
    emoji: '🔥',
    title: 'Consistency!',
    message,
  };
}
