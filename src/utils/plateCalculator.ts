/**
 * Plate calculator for barbell exercises
 *
 * Calculates the optimal combination of weight plates needed for each side
 * of a barbell to reach a target weight.
 */

export interface PlateBreakdown {
  /** Total weight per side (excluding bar) */
  weightPerSide: number;
  /** Unit of measurement */
  unit: 'lbs' | 'kg';
  /** Breakdown of plates needed per side */
  plates: { weight: number; count: number }[];
  /** Whether the target weight is achievable with standard plates */
  isAchievable: boolean;
  /** Remainder if target is not exactly achievable */
  remainder?: number;
}

// Standard plate weights in pounds
const STANDARD_PLATES_LBS = [45, 35, 25, 10, 5, 2.5];

// Standard plate weights in kilograms
const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

// Standard barbell weights
const STANDARD_BAR_WEIGHT_LBS = 45;
const STANDARD_BAR_WEIGHT_KG = 20;

/**
 * Determines if an exercise is a barbell exercise
 */
export function isBarbellExercise(
  exerciseName: string,
  equipmentType?: string
): boolean {
  // Check equipment type first
  if (equipmentType?.toLowerCase().includes('barbell')) {
    return true;
  }

  const lowerName = exerciseName.toLowerCase();

  // If it explicitly mentions barbell, it's a barbell exercise
  if (lowerName.includes('barbell')) {
    return true;
  }

  // Exclude exercises that mention other equipment
  const excludeKeywords = ['dumbbell', 'kettlebell', 'bodyweight', 'cable', 'machine'];
  if (excludeKeywords.some((keyword) => lowerName.includes(keyword))) {
    return false;
  }

  // Check exercise name for common barbell exercises
  const barbellExercises = [
    'deadlift',
    'bench press',
    'overhead press',
    'strict press',
    'power clean',
    'hang clean',
    'clean and jerk',
    'snatch',
    'front squat',
    'back squat',
    'romanian deadlift',
    'rdl',
    'bent over row',
    'pendlay row',
  ];

  return barbellExercises.some((exercise) => lowerName.includes(exercise));
}

/**
 * Calculates the optimal plate combination for a given weight
 */
export function calculatePlates(
  totalWeight: number,
  unit: 'lbs' | 'kg' = 'lbs',
  barWeight?: number
): PlateBreakdown {
  // Use standard bar weight if not provided
  const bar = barWeight ?? (unit === 'lbs' ? STANDARD_BAR_WEIGHT_LBS : STANDARD_BAR_WEIGHT_KG);

  // Weight remaining after subtracting bar
  const weightForPlates = totalWeight - bar;

  // Weight per side (divide by 2)
  const weightPerSide = weightForPlates / 2;

  // Can't have negative weight
  if (weightPerSide < 0) {
    return {
      weightPerSide: 0,
      unit,
      plates: [],
      isAchievable: false,
      remainder: weightPerSide,
    };
  }

  // Get appropriate plate set
  const availablePlates = unit === 'lbs' ? STANDARD_PLATES_LBS : STANDARD_PLATES_KG;

  // Calculate plate breakdown using greedy algorithm
  const plates: { weight: number; count: number }[] = [];
  let remaining = weightPerSide;

  for (const plateWeight of availablePlates) {
    const count = Math.floor(remaining / plateWeight);
    if (count > 0) {
      plates.push({ weight: plateWeight, count });
      remaining -= count * plateWeight;
    }
  }

  // Check if we achieved exact weight or have remainder
  const isAchievable = Math.abs(remaining) < 0.01; // Allow for floating point errors

  return {
    weightPerSide,
    unit,
    plates,
    isAchievable,
    remainder: isAchievable ? undefined : remaining,
  };
}

/**
 * Formats plate breakdown as a human-readable string
 */
export function formatPlateBreakdown(breakdown: PlateBreakdown): string {
  if (breakdown.plates.length === 0) {
    return 'Bar only';
  }

  const plateStrings = breakdown.plates.map(({ weight, count }) => {
    return count === 1 ? `${weight}${breakdown.unit}` : `${count}×${weight}${breakdown.unit}`;
  });

  const result = plateStrings.join(' + ');

  if (breakdown.remainder && Math.abs(breakdown.remainder) > 0.01) {
    return `${result} (+${breakdown.remainder.toFixed(1)}${breakdown.unit} short)`;
  }

  return result;
}

/**
 * Formats complete plate setup including both sides
 */
export function formatCompletePlateSetup(breakdown: PlateBreakdown): string {
  if (breakdown.plates.length === 0) {
    return 'Bar only';
  }

  const perSide = formatPlateBreakdown(breakdown);
  return `${perSide} per side`;
}
