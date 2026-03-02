import exerciseDictionaryJson from '../../../spec/data/exercise-dictionary.json';

export interface ExerciseDefinition {
  canonical: string;
  aliases: string[];
  muscleGroups: string[];
  category: 'compound' | 'isolation' | 'bodyweight' | 'cardio';
}

const dictionary: ExerciseDefinition[] = exerciseDictionaryJson as ExerciseDefinition[];

/** Map from lowercase alias/canonical → canonical name */
const aliasToCanonical = new Map<string, string>();

/** Map from lowercase canonical → full definition */
const canonicalToDefinition = new Map<string, ExerciseDefinition>();

// Build lookup maps once at module load
for (const entry of dictionary) {
  const lowerCanonical = entry.canonical.toLowerCase();
  aliasToCanonical.set(lowerCanonical, entry.canonical);
  canonicalToDefinition.set(lowerCanonical, entry);

  for (const alias of entry.aliases) {
    aliasToCanonical.set(alias.toLowerCase(), entry.canonical);
  }
}

/**
 * Get the canonical (display-preferred) name for an exercise.
 * Returns the original name if not found in the dictionary.
 */
export function getCanonicalName(name: string): string {
  return aliasToCanonical.get(name.toLowerCase()) ?? name;
}

/**
 * Check if two exercise names refer to the same movement.
 */
export function isSameExercise(a: string, b: string): boolean {
  return getCanonicalName(a) === getCanonicalName(b);
}

/**
 * Get all lowercase aliases (including the canonical name lowercased)
 * for a given exercise name. Useful for building SQL IN clauses.
 * Returns a single-element array with the lowercased input if not found.
 */
export function getAliases(name: string): string[] {
  const canonical = aliasToCanonical.get(name.toLowerCase());
  if (!canonical) {
    return [name.toLowerCase()];
  }

  const definition = canonicalToDefinition.get(canonical.toLowerCase());
  if (!definition) {
    return [name.toLowerCase()];
  }

  return [definition.canonical.toLowerCase(), ...definition.aliases.map(a => a.toLowerCase())];
}

/**
 * Get the full exercise definition for a name (canonical or alias).
 * Returns null if not found in the dictionary.
 */
export function getExerciseDefinition(name: string): ExerciseDefinition | null {
  const canonical = aliasToCanonical.get(name.toLowerCase());
  if (!canonical) {
    return null;
  }
  return canonicalToDefinition.get(canonical.toLowerCase()) ?? null;
}
