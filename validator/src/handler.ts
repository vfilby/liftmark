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

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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
        return makeResponse(400, { error: 'Missing request body' });
      }

      const parsed = JSON.parse(bodyStr) as ValidateRequest;
      markdown = parsed.markdown;
    } catch {
      return makeResponse(400, { error: 'Invalid JSON body' });
    }
  }

  if (!markdown || markdown.trim().length === 0) {
    return makeResponse(400, { error: 'Missing or empty markdown field' });
  }

  // Input size limits to prevent DoS
  const MAX_INPUT_BYTES = 1_048_576; // 1MB
  const MAX_INPUT_LINES = 50_000;

  if (Buffer.byteLength(markdown, 'utf-8') > MAX_INPUT_BYTES) {
    return {
      statusCode: 413,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: false,
        errors: [{ line: 0, message: 'Input exceeds maximum size of 1MB', code: 'INPUT_TOO_LARGE' }],
        warnings: [],
      }),
    };
  }

  if (markdown.split('\n').length > MAX_INPUT_LINES) {
    return {
      statusCode: 413,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: false,
        errors: [{ line: 0, message: 'Input exceeds maximum of 50,000 lines', code: 'INPUT_TOO_MANY_LINES' }],
        warnings: [],
      }),
    };
  }

  const result = parseWorkout(markdown);

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

  return makeResponse(200, response);
}
