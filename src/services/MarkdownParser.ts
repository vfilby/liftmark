/**
 * LiftMark Workout Format (LMWF) Markdown Parser
 *
 * Parses markdown text into WorkoutTemplate structure according to LMWF spec v1.0
 * See: /MARKDOWN_SPEC.md for full specification
 *
 * Features:
 * - Flexible header levels (workout can be any H level, exercises one below)
 * - Freeform notes after headers
 * - @tags and @units metadata
 * - Exercise metadata (@type, superset detection)
 * - Full set parsing: weight x reps, time-based, AMRAP, modifiers
 * - Set modifiers: @rpe, @rest, @tempo, @dropset
 * - Supersets via nested headers containing "superset"
 * - Section grouping (nested headers without "superset")
 * - Comprehensive validation with clear error messages
 */

import { WorkoutTemplate, TemplateExercise, TemplateSet, ParseResult } from '../types/workout';
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
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse markdown text into a WorkoutTemplate
 * @param markdown - The markdown text to parse
 * @returns ParseResult with WorkoutTemplate or errors
 */
export function parseWorkout(markdown: string): ParseResult<WorkoutTemplate> {
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
    const workout: WorkoutTemplate = {
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
function parseExercises(context: ParseContext, workoutTemplateId: string): TemplateExercise[] {
  const exercises: TemplateExercise[] = [];

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
): TemplateExercise | TemplateExercise[] | null {
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
    workoutTemplateId,
    exerciseName,
    orderIndex,
    notes,
    equipmentType,
    sets,
  };
}

/**
 * Check if there are nested headers below current header
 */
function checkForNestedHeaders(context: ParseContext, headerIndex: number, headerLevel: number): boolean {
  for (let i = headerIndex + 1; i < context.lines.length; i++) {
    const line = context.lines[i];

    // Stop at same or higher level header
    if (line.headerLevel && line.headerLevel <= headerLevel) {
      break;
    }

    // Found nested header
    if (line.headerLevel && line.headerLevel === headerLevel + 1) {
      return true;
    }
  }
  return false;
}

/**
 * Parse grouped exercises (superset or section)
 * Returns an array: [parent, ...children]
 */
function parseGroupedExercises(
  context: ParseContext,
  workoutTemplateId: string,
  orderIndex: number,
  groupName: string,
  isSuperset: boolean
): TemplateExercise[] {
  const headerLine = context.lines[context.currentIndex];
  const parentId = generateId();
  const groupType = isSuperset ? 'superset' : 'section';

  // Create parent exercise (no sets, just a grouping container)
  const parentExercise: TemplateExercise = {
    id: parentId,
    workoutTemplateId,
    exerciseName: groupName,
    orderIndex,
    groupType,
    groupName,
    sets: [],
  };

  context.currentIndex++;

  // Parse child exercises
  const childExercises: TemplateExercise[] = [];
  let childOrderIndex = 0;

  while (context.currentIndex < context.lines.length) {
    const line = context.lines[context.currentIndex];

    // Stop at same or higher level header
    if (line.headerLevel && line.headerLevel <= headerLine.headerLevel!) {
      break;
    }

    // Parse child exercise (one level below parent)
    if (line.headerLevel === headerLine.headerLevel! + 1) {
      const result = parseExerciseBlock(context, workoutTemplateId, orderIndex + childOrderIndex + 1);
      if (result) {
        // Handle both single exercise and nested arrays
        const exercises = Array.isArray(result) ? result : [result];
        for (const childExercise of exercises) {
          childExercise.parentExerciseId = parentId;
          childExercise.groupType = groupType;
          childExercise.groupName = groupName;
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
): TemplateSet[] {
  const sets: TemplateSet[] = [];
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
          templateExerciseId: exerciseId,
          orderIndex,
          targetWeight: parsedSet.weight,
          targetWeightUnit: parsedSet.weightUnit,
          targetReps: parsedSet.reps,
          targetTime: parsedSet.time,
          targetRpe: parsedSet.rpe,
          restSeconds: parsedSet.rest,
          tempo: parsedSet.tempo,
          isDropset: parsedSet.isDropset,
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
 */
function parseSetLine(content: string, context: ParseContext, lineNumber: number): ParsedSet | null {
  // Split on @ to separate main content from modifiers
  const parts = content.split('@');
  const mainPart = parts[0].trim();
  const modifierParts = parts.slice(1);

  // Parse modifiers first
  const modifiers = parseModifiers(modifierParts, context, lineNumber);

  // Parse main set content
  const set = parseMainSetContent(mainPart, context, lineNumber);
  if (!set) {
    return null;
  }

  // Merge modifiers into set
  return {
    ...set,
    ...modifiers,
  };
}

/**
 * Parse the main set content (before modifiers)
 */
function parseMainSetContent(content: string, context: ParseContext, lineNumber: number): ParsedSet | null {
  const trimmed = content.trim().toLowerCase();

  // Handle AMRAP only
  if (trimmed === 'amrap') {
    return {
      isAmrap: true,
    };
  }

  // Try to match various formats
  // Format: weight unit x reps/time
  // Examples: "225 lbs x 5", "100 kg x 8", "45 lbs x 60s", "45 lbs for 60s"

  // Regex patterns (case-insensitive, whitespace-tolerant)

  // Pattern 1: weight unit x reps/time (e.g., "225 lbs x 5", "45 lbs x 60s")
  const pattern1 = /^(\d+(?:\.\d+)?)\s*(lbs?|kgs?|kg|bw)?\s*(?:x|for)\s*(\d+|amrap)\s*(reps?|s|sec|m|min)?$/i;

  // Pattern 2: bodyweight x reps/time (e.g., "x 10", "bw x 12")
  const pattern2 = /^(?:(bw|x)\s*)?x\s*(\d+|amrap)\s*(reps?|s|sec|m|min)?$/i;

  // Pattern 3: single number (e.g., "10" = bodyweight reps, "60s" = time)
  const pattern3 = /^(\d+)\s*(s|sec|m|min)?$/i;

  // Try pattern 1: weight unit x reps/time
  let match = trimmed.match(pattern1);
  if (match) {
    const weight = parseFloat(match[1]);
    const weightUnit = normalizeWeightUnit(match[2]);
    const repsOrTime = match[3].toLowerCase();
    const repsUnit = match[4];

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
        weight: weightUnit === 'bw' || !weightUnit ? undefined : weight,
        weightUnit: weightUnit === 'bw' || !weightUnit ? undefined : weightUnit,
        isAmrap: true,
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
        weight: weightUnit === 'bw' || !weightUnit ? undefined : weight,
        weightUnit: weightUnit === 'bw' || !weightUnit ? undefined : weightUnit,
        time: seconds,
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
        weight: weightUnit === 'bw' || !weightUnit ? undefined : weight,
        weightUnit: weightUnit === 'bw' || !weightUnit ? undefined : weightUnit,
        reps: value,
      };
    }
  }

  // Try pattern 2: bodyweight x reps/time
  match = trimmed.match(pattern2);
  if (match) {
    const repsOrTime = match[2].toLowerCase();
    const repsUnit = match[3];

    if (repsOrTime === 'amrap') {
      return {
        isAmrap: true,
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
      return { time: seconds };
    } else {
      if (value > 100) {
        context.warnings.push({
          line: lineNumber,
          message: `Very high rep count (${value}). Double-check for typos.`,
          code: 'HIGH_REPS',
        });
      }
      return { reps: value };
    }
  }

  // Try pattern 3: single number
  match = trimmed.match(pattern3);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

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
      return { time: seconds };
    } else {
      // Single number = bodyweight reps
      if (value > 100) {
        context.warnings.push({
          line: lineNumber,
          message: `Very high rep count (${value}). Double-check for typos.`,
          code: 'HIGH_REPS',
        });
      }
      return { reps: value };
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
 * Parse modifiers from @ parts
 * Formats:
 * - @rpe: 8
 * - @rest: 180s
 * - @rest: 3m
 * - @tempo: 3-0-1-0
 * - @dropset
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
