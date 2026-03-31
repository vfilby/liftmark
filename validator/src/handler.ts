import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { parseWorkout } from './parser/index.js';

interface ValidateRequest {
  markdown: string;
}

interface ExerciseSummary {
  name: string;
  setCount: number;
  groupType: string | null;
  groupName: string | null;
  parentExerciseId: string | null;
}

interface ValidateResponse {
  success: boolean;
  summary: {
    workoutName: string;
    defaultWeightUnit: string | null;
    tags: string[];
    exerciseCount: number;
    totalSetCount: number;
    exercises: ExerciseSummary[];
  } | null;
  errors: string[];
  warnings: string[];
}

function makeResponse(statusCode: number, body: ValidateResponse | { error: string }): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function log(entry: Record<string, unknown>): void {
  console.log(JSON.stringify(entry));
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const startTime = Date.now();
  const requestId = event.requestContext?.requestId ?? 'unknown';
  let markdown: string | undefined;

  const contentType = event.headers?.['content-type'] ?? event.headers?.['Content-Type'] ?? '';

  if (contentType.includes('text/markdown')) {
    // Raw markdown body
    markdown = event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body ?? undefined;
  } else {
    // JSON body
    try {
      const bodyStr = event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;

      if (!bodyStr) {
        log({ level: 'warn', requestId, event: 'request_error', status: 400, error: 'Missing request body', durationMs: Date.now() - startTime });
        return makeResponse(400, { error: 'Missing request body' });
      }

      const parsed = JSON.parse(bodyStr) as ValidateRequest;
      if (typeof parsed.markdown !== 'string') {
        log({ level: 'warn', requestId, event: 'request_error', status: 400, error: 'markdown field must be a string', durationMs: Date.now() - startTime });
        return makeResponse(400, { error: 'markdown field must be a string' });
      }
      markdown = parsed.markdown;
    } catch {
      log({ level: 'warn', requestId, event: 'request_error', status: 400, error: 'Invalid JSON body', durationMs: Date.now() - startTime });
      return makeResponse(400, { error: 'Invalid JSON body' });
    }
  }

  if (!markdown || markdown.trim().length === 0) {
    log({ level: 'warn', requestId, event: 'request_error', status: 400, error: 'Missing or empty markdown field', durationMs: Date.now() - startTime });
    return makeResponse(400, { error: 'Missing or empty markdown field' });
  }

  const inputBytes = Buffer.byteLength(markdown, 'utf-8');
  const lineCount = markdown.split('\n').length;

  log({ level: 'info', requestId, event: 'request_received', method: event.requestContext?.http?.method ?? 'unknown', contentType, inputBytes, lineCount });

  // Input size limits to prevent DoS
  const MAX_INPUT_BYTES = 1_048_576; // 1MB
  const MAX_INPUT_LINES = 50_000;
  const MAX_EXERCISES = 500;
  const MAX_TOTAL_SETS = 10_000;

  if (inputBytes > MAX_INPUT_BYTES) {
    log({ level: 'warn', requestId, event: 'request_error', status: 413, error: 'Input exceeds maximum size of 1MB', inputBytes, durationMs: Date.now() - startTime });
    return makeResponse(413, {
      success: false,
      summary: null,
      errors: ['Input exceeds maximum size of 1MB'],
      warnings: [],
    });
  }

  if (lineCount > MAX_INPUT_LINES) {
    log({ level: 'warn', requestId, event: 'request_error', status: 413, error: 'Input exceeds maximum of 50,000 lines', lineCount, durationMs: Date.now() - startTime });
    return makeResponse(413, {
      success: false,
      summary: null,
      errors: ['Input exceeds maximum of 50,000 lines'],
      warnings: [],
    });
  }

  const result = parseWorkout(markdown);

  if (result.data) {
    const exerciseCount = result.data.exercises.length;
    const setCount = result.data.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

    if (exerciseCount > MAX_EXERCISES) {
      log({ level: 'warn', requestId, event: 'request_error', status: 413, error: `Workout exceeds maximum of ${MAX_EXERCISES} exercises`, exerciseCount, durationMs: Date.now() - startTime });
      return makeResponse(413, {
        success: false,
        summary: null,
        errors: [`Workout exceeds maximum of ${MAX_EXERCISES} exercises (found ${exerciseCount})`],
        warnings: [],
      });
    }

    if (setCount > MAX_TOTAL_SETS) {
      log({ level: 'warn', requestId, event: 'request_error', status: 413, error: `Workout exceeds maximum of ${MAX_TOTAL_SETS} total sets`, setCount, durationMs: Date.now() - startTime });
      return makeResponse(413, {
        success: false,
        summary: null,
        errors: [`Workout exceeds maximum of ${MAX_TOTAL_SETS} total sets (found ${setCount})`],
        warnings: [],
      });
    }
  }

  const exercises: ExerciseSummary[] = result.data?.exercises.map((ex) => ({
    name: ex.exerciseName,
    setCount: ex.sets.length,
    groupType: ex.groupType,
    groupName: ex.groupName,
    parentExerciseId: ex.parentExerciseId,
  })) ?? [];

  const totalSetCount = exercises.reduce((sum, ex) => sum + ex.setCount, 0);

  const response: ValidateResponse = {
    success: result.success,
    summary: result.data
      ? {
          workoutName: result.data.name,
          defaultWeightUnit: result.data.defaultWeightUnit,
          tags: result.data.tags,
          exerciseCount: result.data.exercises.length,
          totalSetCount,
          exercises,
        }
      : null,
    errors: result.errors,
    warnings: result.warnings,
  };

  log({
    level: 'info',
    requestId,
    event: 'request_complete',
    status: 200,
    success: result.success,
    exerciseCount: exercises.length,
    totalSetCount,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    durationMs: Date.now() - startTime,
  });

  return makeResponse(200, response);
}
