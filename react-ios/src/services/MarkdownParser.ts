/**
 * LiftMark Workout Format (LMWF) Markdown Parser
 *
 * Parses markdown text into WorkoutPlan structure according to LMWF spec v1.0
 * See: /MARKDOWN_SPEC.md for full specification
 *
 * Features:
 * - Flexible header levels (workout can be any H level, exercises one below)
 * - Freeform notes after headers
 * - @tags and @units metadata
 * - Exercise metadata (@type, superset detection)
 * - Full set parsing: weight x reps, time-based, AMRAP, modifiers
 * - Set modifiers: @rpe, @rest, @tempo, @dropset, @perside
 * - Supersets via nested headers containing "superset" (case-insensitive)
 *   - Child exercises can be at ANY header level below superset (not limited to parent+1)
 * - Section grouping (nested headers without "superset")
 * - Comprehensive validation with clear error messages
 */

import { WorkoutPlan, PlannedExercise, PlannedSet, ParseResult } from '../types/workout';
import { generateId } from '../utils/id';

// ============================================================================
// Types
// ============================================================================

interface ParseError {
  line: number;
  message: string;
  code: string;
}

interface ParseWarning {
  line: number;
  message: string;
  code: string;
}

interface ParsedLine {
  lineNumber: number;
  raw: string;
  trimmed: string;
  headerLevel?: number; // 1-6 for H1-H6
  headerText?: string;
  isList?: boolean;
  listContent?: string;
  isMetadata?: boolean;
  metadataKey?: string;
  metadataValue?: string;
}

interface ParseContext {
  lines: ParsedLine[];
  currentIndex: number;
  workoutHeaderLevel?: number;
  exerciseHeaderLevel?: number;
  errors: ParseError[];
  warnings: ParseWarning[];
}

interface ParsedSet {
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  reps?: number;
  time?: number; // seconds
  isAmrap?: boolean;
  rpe?: number;
  rest?: number; // seconds
  tempo?: string;
  isDropset?: boolean;
  isPerSide?: boolean;
  notes?: string; // Trailing text from set line (e.g., "forward", "each side")
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse markdown text into a WorkoutPlan
 * @param markdown - The markdown text to parse
 * @returns ParseResult with WorkoutPlan or errors
 */
export function parseWorkout(markdown: string): ParseResult<WorkoutPlan> {
  const context: ParseContext = {
    lines: preprocessLines(markdown),
    currentIndex: 0,
    errors: [],
    warnings: [],
  };

  // Generate workout ID upfront so exercises can reference it
  const workoutId = generateId();

  try {
    // Find workout header
    const workoutHeaderLine = findWorkoutHeader(context);
    if (!workoutHeaderLine) {
      return {
        success: false,
        errors: ['No workout header found. Must have a header (# Workout Name) with exercises below it.'],
        warnings: [],
      };
    }

    // Parse workout metadata and notes
    const { name, tags, defaultWeightUnit, notes } = parseWorkoutSection(context, workoutHeaderLine);

    // Parse exercises (pass workoutId so exercises reference the correct workout)
    const exercises = parseExercises(context, workoutId);

    if (exercises.length === 0) {
      context.errors.push({
        line: workoutHeaderLine.lineNumber,
        message: 'Workout must contain at least one exercise',
        code: 'NO_EXERCISES',
      });
    }

    // Check for critical errors
    if (context.errors.length > 0) {
      return {
        success: false,
        errors: context.errors.map(e => `Line ${e.line}: ${e.message}`),
        warnings: context.warnings.map(w => `Line ${w.line}: ${w.message}`),
      };
    }

    // Build workout template
    const now = new Date().toISOString();
    const workout: WorkoutPlan = {
      id: workoutId,
      name,
      description: notes,
      tags,
      defaultWeightUnit,
      sourceMarkdown: markdown,
      createdAt: now,
      updatedAt: now,
      exercises,
    };

    return {
      success: true,
      data: workout,
      errors: [],
      warnings: context.warnings.map(w => `Line ${w.line}: ${w.message}`),
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
    };
  }
}

// ============================================================================
// Line Preprocessing
// ============================================================================

/**
 * Preprocess markdown into parsed lines
 */
function preprocessLines(markdown: string): ParsedLine[] {
  // Normalize line endings (CRLF -> LF, CR -> LF)
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');

  return rawLines.map((raw, index) => {
    const trimmed = raw.trim();
    const lineNumber = index + 1;

    // Parse header (# Header Text)
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      return {
        lineNumber,
        raw,
        trimmed,
        headerLevel: headerMatch[1].length,
        headerText: headerMatch[2].trim(),
      };
    }

    // Parse list item (- Content)
    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch) {
      return {
        lineNumber,
        raw,
        trimmed,
        isList: true,
        listContent: listMatch[1].trim(),
      };
    }

    // Parse metadata (@key: value)
    const metadataMatch = trimmed.match(/^@(\w+):\s*(.+)$/);
    if (metadataMatch) {
      return {
        lineNumber,
        raw,
        trimmed,
        isMetadata: true,
        metadataKey: metadataMatch[1].toLowerCase(),
        metadataValue: metadataMatch[2].trim(),
      };
    }

    // Regular text
    return {
      lineNumber,
      raw,
      trimmed,
    };
  });
}

// ============================================================================
// Workout Header Detection
// ============================================================================

/**
 * Find the workout header in the document
 * A header is a workout if it has child headers with sets below them
 */
function findWorkoutHeader(context: ParseContext): ParsedLine | null {
  for (let i = 0; i < context.lines.length; i++) {
    const line = context.lines[i];
    if (line.headerLevel && line.headerText) {
      // Check if this header has child exercises (headers one level below with sets)
      if (hasChildExercises(context, i, line.headerLevel)) {
        context.workoutHeaderLevel = line.headerLevel;
        context.exerciseHeaderLevel = line.headerLevel + 1;
        context.currentIndex = i;
        return line;
      }
    }
  }
  return null;
}

/**
 * Check if a header has child exercise headers (with sets)
 */
function hasChildExercises(context: ParseContext, headerIndex: number, headerLevel: number): boolean {
  const exerciseLevel = headerLevel + 1;

  for (let i = headerIndex + 1; i < context.lines.length; i++) {
    const line = context.lines[i];

    // Stop if we hit a header at same or higher level
    if (line.headerLevel && line.headerLevel <= headerLevel) {
      break;
    }

    // Check if this is an exercise header (one level below workout)
    if (line.headerLevel === exerciseLevel) {
      // Check if this exercise has sets
      if (hasSetsBelowHeader(context, i, exerciseLevel)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a header has sets below it (or nested headers with sets)
 */
function hasSetsBelowHeader(context: ParseContext, headerIndex: number, headerLevel: number): boolean {
  for (let i = headerIndex + 1; i < context.lines.length; i++) {
    const line = context.lines[i];

    // Stop if we hit a header at same or higher level
    if (line.headerLevel && line.headerLevel <= headerLevel) {
      break;
    }

    // Found a set
    if (line.isList) {
      return true;
    }

    // Check nested headers (for supersets/sections)
    if (line.headerLevel && line.headerLevel > headerLevel) {
      if (hasSetsBelowHeader(context, i, line.headerLevel)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Workout Section Parsing
// ============================================================================

interface WorkoutSection {
  name: string;
  tags: string[];
  defaultWeightUnit?: 'lbs' | 'kg';
  notes?: string;
}

/**
 * Parse workout header section (name, metadata, notes)
 */
function parseWorkoutSection(context: ParseContext, headerLine: ParsedLine): WorkoutSection {
  const name = headerLine.headerText || '';
  let tags: string[] = [];
  let defaultWeightUnit: 'lbs' | 'kg' | undefined;
  const noteLines: string[] = [];

  // Move past header
  context.currentIndex++;

  // Collect metadata and notes until we hit an exercise header
  while (context.currentIndex < context.lines.length) {
    const line = context.lines[context.currentIndex];

    // Stop at exercise header
    if (line.headerLevel === context.exerciseHeaderLevel) {
      break;
    }

    // Stop at headers higher than workout level
    if (line.headerLevel && line.headerLevel <= context.workoutHeaderLevel!) {
      break;
    }

    // Parse metadata
    if (line.isMetadata) {
      if (line.metadataKey === 'tags') {
        tags = parseTagsMetadata(line.metadataValue || '');
      } else if (line.metadataKey === 'units') {
        const unit = parseUnitsMetadata(line.metadataValue || '', context, line.lineNumber);
        if (unit) {
          defaultWeightUnit = unit;
        }
      }
      // Ignore unknown metadata (forward compatible)
    } else if (line.trimmed) {
      // Collect freeform notes (non-empty, non-metadata lines)
      noteLines.push(line.trimmed);
    }

    context.currentIndex++;
  }

  return {
    name,
    tags,
    defaultWeightUnit,
    notes: noteLines.length > 0 ? noteLines.join('\n') : undefined,
  };
}

/**
 * Parse @tags metadata: "tag1, tag2, tag3" -> ["tag1", "tag2", "tag3"]
 */
function parseTagsMetadata(value: string): string[] {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

/**
 * Parse @units metadata: "lbs" or "kg"
 */
function parseUnitsMetadata(
  value: string,
  context: ParseContext,
  lineNumber: number
): 'lbs' | 'kg' | undefined {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'lbs' || normalized === 'lb') {
    return 'lbs';
  } else if (normalized === 'kg' || normalized === 'kgs') {
    return 'kg';
  } else {
    context.errors.push({
      line: lineNumber,
      message: `Invalid @units value "${value}". Must be "lbs" or "kg"`,
      code: 'INVALID_UNITS',
    });
    return undefined;
  }
}

// ============================================================================
// Exercise Parsing
// ============================================================================

/**
 * Parse all exercises in the workout
 */
function parseExercises(context: ParseContext, workoutTemplateId: string): PlannedExercise[] {
  const exercises: PlannedExercise[] = [];

  let orderIndex = 0;

  while (context.currentIndex < context.lines.length) {
    const line = context.lines[context.currentIndex];

    // Stop at headers at or above workout level
    if (line.headerLevel && line.headerLevel <= context.workoutHeaderLevel!) {
      break;
    }

    // Parse exercise at expected level
    if (line.headerLevel === context.exerciseHeaderLevel) {
      const result = parseExerciseBlock(context, workoutTemplateId, orderIndex);
      if (result) {
        // If it's a grouped exercise (superset/section), add parent and all children
        if (Array.isArray(result)) {
          exercises.push(...result);
          orderIndex += result.length;
        } else {
          exercises.push(result);
          orderIndex++;
        }
      }
    } else {
      context.currentIndex++;
    }
  }

  return exercises;
}

/**
 * Parse a single exercise block (header, metadata, notes, sets)
 * Handles both regular exercises and supersets/sections
 * Returns either a single exercise or an array of exercises (for grouped exercises)
 */
function parseExerciseBlock(
  context: ParseContext,
  workoutTemplateId: string,
  orderIndex: number
): PlannedExercise | PlannedExercise[] | null {
  const headerLine = context.lines[context.currentIndex];
  if (!headerLine.headerLevel || !headerLine.headerText) {
    context.currentIndex++;
    return null;
  }

  const exerciseName = headerLine.headerText;
  const exerciseId = generateId();

  // Check if this is a superset or section (has nested headers)
  const isSuperset = exerciseName.toLowerCase().includes('superset');
  const hasNestedHeaders = checkForNestedHeaders(context, context.currentIndex, headerLine.headerLevel);

  // If it has nested headers, it's either a superset or section
  if (hasNestedHeaders) {
    return parseGroupedExercises(context, workoutTemplateId, orderIndex, exerciseName, isSuperset);
  }

  // Regular exercise (no nested headers)
  context.currentIndex++;

  // Parse metadata and notes
  const { equipmentType, notes } = parseExerciseMetadata(context, headerLine.headerLevel);

  // Parse sets
  const sets = parseSets(context, headerLine.headerLevel, exerciseId);

  if (sets.length === 0) {
    context.errors.push({
      line: headerLine.lineNumber,
      message: `Exercise "${exerciseName}" has no sets`,
      code: 'NO_SETS',
    });
  }

  return {
    id: exerciseId,
    workoutPlanId: workoutTemplateId,
    exerciseName,
    orderIndex,
    notes,
    equipmentType,
    sets,
  };
}

/**
 * Check if there are nested headers below current header
 * Accepts ANY header level greater than the parent (not just parent+1)
 */
function checkForNestedHeaders(context: ParseContext, headerIndex: number, headerLevel: number): boolean {
  for (let i = headerIndex + 1; i < context.lines.length; i++) {
    const line = context.lines[i];

    // Stop at same or higher level header
    if (line.headerLevel && line.headerLevel <= headerLevel) {
      break;
    }

    // Found nested header at any level below parent
    if (line.headerLevel && line.headerLevel > headerLevel) {
      return true;
    }
  }
  return false;
}

/**
 * Find the header level of child exercises within a group (superset/section)
 * Returns the first header level (> parentLevel) that contains sets
 * This allows for flexible header hierarchies (not limited to parent+1)
 */
function findChildExerciseLevel(
  context: ParseContext,
  startIndex: number,
  parentLevel: number
): number | null {
  for (let i = startIndex; i < context.lines.length; i++) {
    const line = context.lines[i];

    // Stop at same or higher level header
    if (line.headerLevel && line.headerLevel <= parentLevel) {
      break;
    }

    // Check if this header has sets below it
    if (line.headerLevel && line.headerLevel > parentLevel) {
      if (hasSetsBelowHeader(context, i, line.headerLevel)) {
        return line.headerLevel;
      }
    }
  }
  return null;
}

/**
 * Parse grouped exercises (superset or section)
 * Returns an array: [parent, ...children]
 * Dynamically determines child exercise header level (not limited to parent+1)
 */
function parseGroupedExercises(
  context: ParseContext,
  workoutTemplateId: string,
  orderIndex: number,
  groupName: string,
  isSuperset: boolean
): PlannedExercise[] {
  const headerLine = context.lines[context.currentIndex];
  const parentId = generateId();
  const groupType = isSuperset ? 'superset' : 'section';

  // Create parent exercise (no sets, just a grouping container)
  const parentExercise: PlannedExercise = {
    id: parentId,
    workoutPlanId: workoutTemplateId,
    exerciseName: groupName,
    orderIndex,
    groupType,
    groupName,
    sets: [],
  };

  context.currentIndex++;

  // Find the first child header level that contains exercises (sets)
  const childExerciseLevel = findChildExerciseLevel(context, context.currentIndex, headerLine.headerLevel!);

  // Parse child exercises
  const childExercises: PlannedExercise[] = [];
  let childOrderIndex = 0;

  while (context.currentIndex < context.lines.length) {
    const line = context.lines[context.currentIndex];

    // Stop at same or higher level header
    if (line.headerLevel && line.headerLevel <= headerLine.headerLevel!) {
      break;
    }

    // Parse child exercise at the determined child level
    if (childExerciseLevel && line.headerLevel === childExerciseLevel) {
      const result = parseExerciseBlock(context, workoutTemplateId, orderIndex + childOrderIndex + 1);
      if (result) {
        // Handle both single exercise and nested arrays (e.g., superset inside section)
        const exercises = Array.isArray(result) ? result : [result];
        for (const childExercise of exercises) {
          // Only set parentExerciseId if not already set (preserves superset children's parent)
          if (!childExercise.parentExerciseId) {
            childExercise.parentExerciseId = parentId;
          }
          // Only set groupType/groupName for direct children, not nested superset children
          if (childExercise.groupType !== 'superset' || childExercise.sets.length === 0) {
            // This is either a regular exercise or a superset parent
            if (!childExercise.groupType) {
              childExercise.groupType = groupType;
              childExercise.groupName = groupName;
            }
          }
          childExercises.push(childExercise);
          childOrderIndex++;
        }
      }
    } else {
      context.currentIndex++;
    }
  }

  // Return parent and all children as a flattened array
  return [parentExercise, ...childExercises];
}

/**
 * Parse exercise metadata (@type, freeform notes)
 */
function parseExerciseMetadata(
  context: ParseContext,
  exerciseHeaderLevel: number
): { equipmentType?: string; notes?: string } {
  let equipmentType: string | undefined;
  const noteLines: string[] = [];

  while (context.currentIndex < context.lines.length) {
    const line = context.lines[context.currentIndex];

    // Stop at headers at or above exercise level
    if (line.headerLevel && line.headerLevel <= exerciseHeaderLevel) {
      break;
    }

    // Stop at sets (list items)
    if (line.isList) {
      break;
    }

    // Parse metadata
    if (line.isMetadata) {
      if (line.metadataKey === 'type') {
        equipmentType = line.metadataValue;
      }
      // Ignore unknown metadata (forward compatible)
      context.currentIndex++;
    } else if (line.trimmed) {
      // Collect freeform notes
      noteLines.push(line.trimmed);
      context.currentIndex++;
    } else {
      context.currentIndex++;
    }
  }

  return {
    equipmentType,
    notes: noteLines.length > 0 ? noteLines.join('\n') : undefined,
  };
}

// ============================================================================
// Set Parsing
// ============================================================================

/**
 * Parse all sets for an exercise
 */
function parseSets(
  context: ParseContext,
  exerciseHeaderLevel: number,
  exerciseId: string
): PlannedSet[] {
  const sets: PlannedSet[] = [];
  let orderIndex = 0;

  while (context.currentIndex < context.lines.length) {
    const line = context.lines[context.currentIndex];

    // Stop at headers at or above exercise level
    if (line.headerLevel && line.headerLevel <= exerciseHeaderLevel) {
      break;
    }

    // Parse set (list item)
    if (line.isList && line.listContent) {
      const parsedSet = parseSetLine(line.listContent, context, line.lineNumber);
      if (parsedSet) {
        sets.push({
          id: generateId(),
          plannedExerciseId: exerciseId,
          orderIndex,
          targetWeight: parsedSet.weight,
          targetWeightUnit: parsedSet.weightUnit,
          targetReps: parsedSet.reps,
          targetTime: parsedSet.time,
          targetRpe: parsedSet.rpe,
          restSeconds: parsedSet.rest,
          tempo: parsedSet.tempo,
          isDropset: parsedSet.isDropset,
          isPerSide: parsedSet.isPerSide,
          isAmrap: parsedSet.isAmrap,
          notes: parsedSet.notes,
        });
        orderIndex++;
      }
      context.currentIndex++;
    } else {
      context.currentIndex++;
    }
  }

  return sets;
}

/**
 * Parse a single set line
 * Formats:
 * - 225 x 5
 * - 225 lbs x 5 reps
 * - 100 kg x 8
 * - bw x 10
 * - x 10 (bodyweight implied)
 * - 10 (single number = bodyweight reps)
 * - 60s (time only)
 * - 45 lbs x 60s (weight x time)
 * - 45 lbs for 60s (weight for time)
 * - AMRAP
 * - bw x AMRAP
 * - 135 x AMRAP
 * With modifiers:
 * - 225 x 5 @rpe: 8 @rest: 180s @tempo: 3-0-1-0 @dropset
 * With trailing text:
 * - 225 x 5 @rpe: 8 Felt strong today!
 */
function parseSetLine(content: string, context: ParseContext, lineNumber: number): ParsedSet | null {
  // Split on @ to separate main content from modifiers
  const parts = content.split('@');
  const mainPart = parts[0].trim();
  const modifierParts = parts.slice(1);

  // Parse modifiers and extract trailing text from modifiers
  const { modifiers, trailingText: modifierTrailingText } = parseModifiersAndTrailingText(
    modifierParts,
    context,
    lineNumber
  );

  // Parse main set content
  const result = parseMainSetContent(mainPart, context, lineNumber);
  if (!result) {
    return null;
  }

  const { set, trailingText: mainTrailingText } = result;

  // Combine trailing text from main content and modifiers
  const combinedTrailingText = [mainTrailingText, modifierTrailingText].filter(Boolean).join(' ').trim();

  // Merge modifiers and trailing text into set
  return {
    ...set,
    ...modifiers,
    ...(combinedTrailingText ? { notes: combinedTrailingText } : {}),
  };
}

/**
 * Parse the main set content (before modifiers)
 * Returns the parsed set and any trailing text that wasn't part of the set
 */
function parseMainSetContent(
  content: string,
  context: ParseContext,
  lineNumber: number
): { set: ParsedSet; trailingText?: string } | null {
  const original = content.trim();
  const trimmed = original.toLowerCase();

  // Handle AMRAP only
  if (trimmed === 'amrap') {
    return {
      set: {
        isAmrap: true,
      },
    };
  }

  // Try to match various formats
  // Format: weight unit x reps/time
  // Examples: "225 lbs x 5", "100 kg x 8", "45 lbs x 60s", "45 lbs for 60s"

  // Regex patterns (case-insensitive, whitespace-tolerant)
  // Note: Added (.*) at the end to capture any trailing text

  // Pattern 1: weight unit x reps/time (e.g., "225 lbs x 5", "45 lbs x 60s")
  const pattern1 = /^(\d+(?:\.\d+)?)\s*(lbs?|kgs?|kg|bw)?\s*(?:x|for)\s*(\d+|amrap)\s*(reps?|s|sec|m|min)?\s*(.*)$/i;

  // Pattern 2: bodyweight x reps/time (e.g., "x 10", "bw x 12")
  const pattern2 = /^(?:(bw|x)\s*)?x\s*(\d+|amrap)\s*(reps?|s|sec|m|min)?\s*(.*)$/i;

  // Pattern 3: single number (e.g., "10" = bodyweight reps, "60s" = time)
  const pattern3 = /^(\d+)\s*(s|sec|m|min)?\s*(.*)$/i;

  // Try pattern 1: weight unit x reps/time
  // Match against the original (case-preserved) string
  let match = original.match(pattern1);
  if (match) {
    const weight = parseFloat(match[1]);
    const weightUnit = normalizeWeightUnit(match[2]);
    const repsOrTime = match[3].toLowerCase();
    const repsUnit = match[4];
    const trailing = match[5]?.trim();

    if (weight < 0) {
      context.errors.push({
        line: lineNumber,
        message: 'Weight cannot be negative',
        code: 'NEGATIVE_WEIGHT',
      });
      return null;
    }

    // Check if it's AMRAP
    if (repsOrTime === 'amrap') {
      return {
        set: {
          weight: weightUnit === 'bw' ? undefined : weight,
          weightUnit: weightUnit === 'bw' ? undefined : weightUnit,
          isAmrap: true,
        },
        trailingText: trailing || undefined,
      };
    }

    const value = parseInt(repsOrTime, 10);
    if (value <= 0) {
      context.errors.push({
        line: lineNumber,
        message: 'Reps/time must be positive',
        code: 'INVALID_REPS_TIME',
      });
      return null;
    }

    // Determine if it's time or reps
    const isTime = repsUnit && (repsUnit.startsWith('s') || repsUnit.startsWith('m'));

    if (isTime) {
      const seconds = normalizeTimeToSeconds(value, repsUnit);
      return {
        set: {
          weight: weightUnit === 'bw' ? undefined : weight,
          weightUnit: weightUnit === 'bw' ? undefined : weightUnit,
          time: seconds,
        },
        trailingText: trailing || undefined,
      };
    } else {
      // Reps
      if (value > 100) {
        context.warnings.push({
          line: lineNumber,
          message: `Very high rep count (${value}). Double-check for typos.`,
          code: 'HIGH_REPS',
        });
      }
      return {
        set: {
          weight: weightUnit === 'bw' ? undefined : weight,
          weightUnit: weightUnit === 'bw' ? undefined : weightUnit,
          reps: value,
        },
        trailingText: trailing || undefined,
      };
    }
  }

  // Try pattern 2: bodyweight x reps/time
  match = original.match(pattern2);
  if (match) {
    const repsOrTime = match[2].toLowerCase();
    const repsUnit = match[3];
    const trailing = match[4]?.trim();

    if (repsOrTime === 'amrap') {
      return {
        set: {
          isAmrap: true,
        },
        trailingText: trailing || undefined,
      };
    }

    const value = parseInt(repsOrTime, 10);
    if (value <= 0) {
      context.errors.push({
        line: lineNumber,
        message: 'Reps/time must be positive',
        code: 'INVALID_REPS_TIME',
      });
      return null;
    }

    const isTime = repsUnit && (repsUnit.startsWith('s') || repsUnit.startsWith('m'));

    if (isTime) {
      const seconds = normalizeTimeToSeconds(value, repsUnit);
      return {
        set: { time: seconds },
        trailingText: trailing || undefined,
      };
    } else {
      if (value > 100) {
        context.warnings.push({
          line: lineNumber,
          message: `Very high rep count (${value}). Double-check for typos.`,
          code: 'HIGH_REPS',
        });
      }
      return {
        set: { reps: value },
        trailingText: trailing || undefined,
      };
    }
  }

  // Try pattern 3: single number
  match = original.match(pattern3);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const trailing = match[3]?.trim();

    if (value <= 0) {
      context.errors.push({
        line: lineNumber,
        message: 'Reps/time must be positive',
        code: 'INVALID_REPS_TIME',
      });
      return null;
    }

    const isTime = unit && (unit.startsWith('s') || unit.startsWith('m'));

    if (isTime) {
      const seconds = normalizeTimeToSeconds(value, unit);
      return {
        set: { time: seconds },
        trailingText: trailing || undefined,
      };
    } else {
      // Single number = bodyweight reps
      if (value > 100) {
        context.warnings.push({
          line: lineNumber,
          message: `Very high rep count (${value}). Double-check for typos.`,
          code: 'HIGH_REPS',
        });
      }
      return {
        set: { reps: value },
        trailingText: trailing || undefined,
      };
    }
  }

  // Failed to parse
  context.errors.push({
    line: lineNumber,
    message: `Invalid set format: "${content}". Expected format: "weight unit x reps" or "time" or "AMRAP"`,
    code: 'INVALID_SET_FORMAT',
  });
  return null;
}

/**
 * Normalize weight unit to standard format
 */
function normalizeWeightUnit(unit: string | undefined): 'lbs' | 'kg' | 'bw' | undefined {
  if (!unit) return undefined;
  const normalized = unit.toLowerCase().trim();
  if (normalized === 'lb' || normalized === 'lbs') return 'lbs';
  if (normalized === 'kg' || normalized === 'kgs') return 'kg';
  if (normalized === 'bw') return 'bw';
  return undefined;
}

/**
 * Normalize time value to seconds
 */
function normalizeTimeToSeconds(value: number, unit: string | undefined): number {
  if (!unit) return value; // Default to seconds
  const normalized = unit.toLowerCase().trim();
  if (normalized.startsWith('m')) {
    return value * 60; // Minutes to seconds
  }
  return value; // Already seconds
}

/**
 * Parse modifiers and extract trailing text from @ parts
 * Returns both parsed modifiers and any trailing text that isn't part of a modifier
 */
function parseModifiersAndTrailingText(
  parts: string[],
  context: ParseContext,
  lineNumber: number
): { modifiers: Partial<ParsedSet>; trailingText: string | undefined } {
  const modifiers: Partial<ParsedSet> = {};
  const trailingTextParts: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Try to parse as flag modifier (dropset, perside)
    const lowerTrimmed = trimmed.toLowerCase();

    // Check if it starts with a flag keyword
    if (lowerTrimmed.startsWith('dropset')) {
      modifiers.isDropset = true;
      // Extract any text after "dropset"
      const trailing = trimmed.substring('dropset'.length).trim();
      if (trailing) {
        trailingTextParts.push(trailing);
      }
      continue;
    }
    if (lowerTrimmed.startsWith('perside')) {
      modifiers.isPerSide = true;
      // Extract any text after "perside"
      const trailing = trimmed.substring('perside'.length).trim();
      if (trailing) {
        trailingTextParts.push(trailing);
      }
      continue;
    }

    // Try to parse as key: value modifier
    const match = trimmed.match(/^(\w+):\s*(.+)$/);
    if (!match) {
      // Not a valid modifier format, treat as trailing text
      trailingTextParts.push(trimmed);
      continue;
    }

    const key = match[1].toLowerCase();
    const value = match[2].trim();

    // Try to parse based on modifier type
    let parsed = false;
    let remaining = '';

    switch (key) {
      case 'rpe':
        // RPE should be a number (possibly decimal) between 1-10
        const rpeMatch = value.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (rpeMatch) {
          const rpe = parseFloat(rpeMatch[1]);
          remaining = rpeMatch[2].trim();
          if (isNaN(rpe) || rpe < 1 || rpe > 10) {
            context.errors.push({
              line: lineNumber,
              message: `RPE must be between 1-10, got: ${rpeMatch[1]}`,
              code: 'INVALID_RPE',
            });
          } else {
            modifiers.rpe = rpe;
            parsed = true;
          }
        } else {
          context.errors.push({
            line: lineNumber,
            message: `Invalid RPE format: ${value}`,
            code: 'INVALID_RPE',
          });
        }
        break;

      case 'rest':
        // Rest should be: number + optional unit (s/sec/m/min)
        const restMatch = value.match(/^(\d+)\s*(s|sec|m|min)?\s*(.*)$/i);
        if (restMatch) {
          const restValue = `${restMatch[1]}${restMatch[2] || ''}`;
          remaining = restMatch[3].trim();
          const rest = parseRestTime(restValue);
          if (rest === null) {
            context.errors.push({
              line: lineNumber,
              message: `Invalid rest time format: ${restValue}. Expected format: "180s" or "3m"`,
              code: 'INVALID_REST',
            });
          } else {
            if (rest < 10) {
              context.warnings.push({
                line: lineNumber,
                message: `Very short rest period (${rest}s). Double-check for typos.`,
                code: 'SHORT_REST',
              });
            }
            if (rest > 600) {
              context.warnings.push({
                line: lineNumber,
                message: `Very long rest period (${rest}s). Double-check for typos.`,
                code: 'LONG_REST',
              });
            }
            modifiers.rest = rest;
            parsed = true;
          }
        } else {
          context.errors.push({
            line: lineNumber,
            message: `Invalid rest time format: ${value}. Expected format: "180s" or "3m"`,
            code: 'INVALID_REST',
          });
        }
        break;

      case 'tempo':
        // Tempo should be: X-X-X-X format
        const tempoMatch = value.match(/^(\d-\d-\d-\d)\s*(.*)$/);
        if (tempoMatch) {
          modifiers.tempo = tempoMatch[1];
          remaining = tempoMatch[2].trim();
          parsed = true;
        } else {
          context.errors.push({
            line: lineNumber,
            message: `Invalid tempo format: ${value}. Expected format: "X-X-X-X" (e.g., "3-0-1-0")`,
            code: 'INVALID_TEMPO',
          });
        }
        break;

      default:
        // Unknown modifier, treat entire thing as warning and trailing text
        context.warnings.push({
          line: lineNumber,
          message: `Unknown modifier: @${key}`,
          code: 'UNKNOWN_MODIFIER',
        });
        trailingTextParts.push(trimmed);
        continue;
    }

    // If there's remaining text after the modifier value, it's trailing text
    if (parsed && remaining) {
      trailingTextParts.push(remaining);
    } else if (!parsed && !remaining) {
      // If parsing failed and there's no remaining text, add the whole value as trailing
      trailingTextParts.push(value);
    }
  }

  return {
    modifiers,
    trailingText: trailingTextParts.length > 0 ? trailingTextParts.join(' ') : undefined,
  };
}

/**
 * Parse modifiers from @ parts (DEPRECATED - use parseModifiersAndTrailingText)
 * Kept for reference, but no longer used
 * Formats:
 * - @rpe: 8
 * - @rest: 180s
 * - @rest: 3m
 * - @tempo: 3-0-1-0
 * - @dropset
 * - @perside
 */
function parseModifiers(
  parts: string[],
  context: ParseContext,
  lineNumber: number
): Partial<ParsedSet> {
  const modifiers: Partial<ParsedSet> = {};

  for (const part of parts) {
    const trimmed = part.trim();

    // Handle flag modifiers (no value)
    if (trimmed.toLowerCase() === 'dropset') {
      modifiers.isDropset = true;
      continue;
    }
    if (trimmed.toLowerCase() === 'perside') {
      modifiers.isPerSide = true;
      continue;
    }

    // Parse key: value modifiers
    const match = trimmed.match(/^(\w+):\s*(.+)$/);
    if (!match) {
      // Invalid modifier format, skip with warning
      context.warnings.push({
        line: lineNumber,
        message: `Invalid modifier format: "@${trimmed}"`,
        code: 'INVALID_MODIFIER',
      });
      continue;
    }

    const key = match[1].toLowerCase();
    const value = match[2].trim();

    switch (key) {
      case 'rpe':
        const rpe = parseFloat(value);
        if (isNaN(rpe) || rpe < 1 || rpe > 10) {
          context.errors.push({
            line: lineNumber,
            message: `RPE must be between 1-10, got: ${value}`,
            code: 'INVALID_RPE',
          });
        } else {
          modifiers.rpe = rpe;
        }
        break;

      case 'rest':
        const rest = parseRestTime(value);
        if (rest === null) {
          context.errors.push({
            line: lineNumber,
            message: `Invalid rest time format: ${value}. Expected format: "180s" or "3m"`,
            code: 'INVALID_REST',
          });
        } else {
          if (rest < 10) {
            context.warnings.push({
              line: lineNumber,
              message: `Very short rest period (${rest}s). Double-check for typos.`,
              code: 'SHORT_REST',
            });
          }
          if (rest > 600) {
            context.warnings.push({
              line: lineNumber,
              message: `Very long rest period (${rest}s). Double-check for typos.`,
              code: 'LONG_REST',
            });
          }
          modifiers.rest = rest;
        }
        break;

      case 'tempo':
        if (!validateTempoFormat(value)) {
          context.errors.push({
            line: lineNumber,
            message: `Invalid tempo format: ${value}. Expected format: "X-X-X-X" (e.g., "3-0-1-0")`,
            code: 'INVALID_TEMPO',
          });
        } else {
          modifiers.tempo = value;
        }
        break;

      default:
        // Unknown modifier, ignore (forward compatible)
        context.warnings.push({
          line: lineNumber,
          message: `Unknown modifier: @${key}`,
          code: 'UNKNOWN_MODIFIER',
        });
    }
  }

  return modifiers;
}

/**
 * Parse rest time to seconds
 * Formats: "180s", "3m", "90sec", "2min"
 */
function parseRestTime(value: string): number | null {
  const match = value.match(/^(\d+)\s*(s|sec|m|min)?$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2] ? match[2].toLowerCase() : 's';

  if (unit.startsWith('m')) {
    return num * 60; // Minutes to seconds
  }
  return num; // Seconds
}

/**
 * Validate tempo format: X-X-X-X (single digits)
 */
function validateTempoFormat(tempo: string): boolean {
  return /^\d-\d-\d-\d$/.test(tempo);
}

// ============================================================================
// Export
// ============================================================================

export default {
  parseWorkout,
};
