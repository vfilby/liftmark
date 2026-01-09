import { getRecentSessions, getExerciseBestWeights } from '@/db/sessionRepository';
import type { WorkoutSession, SessionExercise, SessionSet } from '@/types';

/**
 * Generate a compact workout history summary for AI prompts
 * Format is designed to be token-efficient while providing useful context
 */
export async function generateWorkoutHistoryContext(recentCount: number = 5): Promise<string> {
  const [recentSessions, bestWeights] = await Promise.all([
    getRecentSessions(recentCount),
    getExerciseBestWeights(),
  ]);

  const parts: string[] = [];

  // Recent workouts in compact format
  if (recentSessions.length > 0) {
    parts.push('Recent workouts:');
    for (const session of recentSessions) {
      parts.push(formatSessionCompact(session));
    }
  }

  // Best weights for exercises not in recent workouts
  const recentExerciseNames = new Set<string>();
  for (const session of recentSessions) {
    for (const exercise of session.exercises) {
      // Skip section/superset parents
      if (exercise.sets.length > 0) {
        recentExerciseNames.add(exercise.exerciseName.toLowerCase());
      }
    }
  }

  const additionalWeights: string[] = [];
  bestWeights.forEach((data, exerciseName) => {
    if (!recentExerciseNames.has(exerciseName.toLowerCase())) {
      additionalWeights.push(`${exerciseName}: ${data.weight}${data.unit}x${data.reps}`);
    }
  });

  if (additionalWeights.length > 0) {
    parts.push('');
    parts.push('Other exercise PRs: ' + additionalWeights.join(', '));
  }

  return parts.join('\n');
}

/**
 * Format a single workout session in compact format
 * Example: "2024-01-15 Push Day: Bench 185x8,205x5; Incline DB 60x10,70x8"
 */
function formatSessionCompact(session: WorkoutSession): string {
  const date = session.date.split('T')[0]; // Just the date part
  const exercises = session.exercises
    .filter(ex => ex.sets.length > 0) // Skip section/superset parents
    .map(formatExerciseCompact)
    .filter(s => s.length > 0);

  return `${date} ${session.name}: ${exercises.join('; ')}`;
}

/**
 * Format a single exercise in compact format
 * Example: "Bench 185x8,205x5,225x3"
 */
function formatExerciseCompact(exercise: SessionExercise): string {
  const completedSets = exercise.sets.filter(s => s.status === 'completed');
  if (completedSets.length === 0) return '';

  // Abbreviate exercise name to save tokens
  const name = abbreviateExerciseName(exercise.exerciseName);

  const sets = completedSets
    .map(formatSetCompact)
    .filter(s => s.length > 0);

  if (sets.length === 0) return '';

  return `${name} ${sets.join(',')}`;
}

/**
 * Format a single set in compact format
 * Example: "185x8" or "30s" or "bwx10"
 */
function formatSetCompact(set: SessionSet): string {
  const weight = set.actualWeight ?? set.targetWeight;
  const reps = set.actualReps ?? set.targetReps;
  const time = set.actualTime ?? set.targetTime;

  // Time-based set
  if (time !== undefined && reps === undefined) {
    return `${time}s`;
  }

  // Rep-based set
  if (reps !== undefined) {
    if (weight !== undefined && weight > 0) {
      return `${weight}x${reps}`;
    }
    return `bwx${reps}`;
  }

  return '';
}

/**
 * Abbreviate common exercise names to save tokens
 */
function abbreviateExerciseName(name: string): string {
  const abbreviations: Record<string, string> = {
    'barbell bench press': 'Bench',
    'bench press': 'Bench',
    'incline bench press': 'Inc Bench',
    'incline dumbbell press': 'Inc DB',
    'dumbbell bench press': 'DB Bench',
    'overhead press': 'OHP',
    'military press': 'OHP',
    'barbell squat': 'Squat',
    'back squat': 'Squat',
    'front squat': 'Fr Squat',
    'deadlift': 'DL',
    'romanian deadlift': 'RDL',
    'barbell row': 'Row',
    'bent over row': 'Row',
    'dumbbell row': 'DB Row',
    'lat pulldown': 'Pulldown',
    'pull-ups': 'Pullups',
    'pull ups': 'Pullups',
    'chin-ups': 'Chinups',
    'chin ups': 'Chinups',
    'bicep curls': 'Curls',
    'dumbbell bicep curls': 'DB Curls',
    'tricep pushdowns': 'Pushdowns',
    'tricep extensions': 'Tri Ext',
    'leg press': 'Leg Press',
    'leg curl': 'Leg Curl',
    'leg extension': 'Leg Ext',
    'calf raises': 'Calves',
    'lateral raises': 'Lat Raise',
    'face pulls': 'Face Pull',
    'cable flyes': 'Flyes',
    'dumbbell flyes': 'DB Flyes',
    'push-ups': 'Pushups',
    'push ups': 'Pushups',
  };

  const lower = name.toLowerCase();
  return abbreviations[lower] || name;
}

/**
 * Check if there's any workout history available
 */
export async function hasWorkoutHistory(): Promise<boolean> {
  const sessions = await getRecentSessions(1);
  return sessions.length > 0;
}
