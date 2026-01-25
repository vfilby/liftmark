import Anthropic from '@anthropic-ai/sdk';

// Jasper's interfaces for SDK-based service
export interface WorkoutGenerationParams {
  prompt: string;
  customPrompt?: string;
  equipment?: string[];
  duration?: number;
  targetMuscleGroups?: string[];
}

export interface WorkoutGenerationResult {
  success: boolean;
  workoutMarkdown?: string;
  error?: string;
}

// Quartz's interfaces for fetch-based service
export interface AnthropicError {
  message: string;
  type?: string;
  status?: number;
}

export interface GenerateWorkoutParams {
  apiKey: string;
  prompt: string;
  model?: string; // Optional: defaults to Haiku 4.5
}

export interface GenerateWorkoutResult {
  success: boolean;
  workout?: string;
  error?: AnthropicError;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Default to Haiku 4.5 - fastest and cheapest at $1/$5 per million tokens
// Users can override this in settings to use Sonnet 4.5 ($3/$15) if they want higher quality
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const AVAILABLE_MODELS = {
  'haiku-4.5': {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest & cheapest - $1/$5 per million tokens',
  },
  'sonnet-4.5': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'More capable - $3/$15 per million tokens',
  },
} as const;

// Jasper's SDK-based service class
export class AnthropicService {
  private client: Anthropic | null = null;
  private apiKey: string | null = null;

  /**
   * Initialize the Anthropic client with the provided API key
   */
  initialize(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Check if the service is initialized and ready to use
   */
  isInitialized(): boolean {
    return this.client !== null && this.apiKey !== null;
  }

  /**
   * Generate a workout using the Anthropic API
   */
  async generateWorkout(params: WorkoutGenerationParams): Promise<WorkoutGenerationResult> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Anthropic service not initialized. Please set your API key in settings.',
      };
    }

    try {
      // Build the prompt for workout generation
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(params);

      const message = await this.client!.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        system: systemPrompt,
      });

      // Extract the workout markdown from the response
      const content = message.content[0];
      if (content.type === 'text') {
        return {
          success: true,
          workoutMarkdown: content.text,
        };
      }

      return {
        success: false,
        error: 'Unexpected response format from API',
      };
    } catch (error) {
      console.error('Workout generation error:', error);

      // Handle rate limiting
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded. Please try again in a moment.',
          };
        }
        if (status === 401) {
          return {
            success: false,
            error: 'Invalid API key. Please check your settings.',
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate workout',
      };
    }
  }

  /**
   * Build the system prompt that instructs Claude on how to generate workouts
   */
  private buildSystemPrompt(): string {
    return `You are a professional fitness trainer AI that generates workout routines in markdown format.

Your workouts must follow this exact markdown format that the LiftMark app expects:

# Workout Name

Optional description of the workout here.

@units: lbs (or kg)
@tags: tag1, tag2

## Exercise Name
- Equipment: equipment type (optional)
- Notes: any exercise notes (optional)

1. 3x10 @ 135lbs (rest: 90s)
2. 3x8 @ 155lbs (rest: 2min)
3. 3x6 @ 175lbs (rest: 2min)

Important formatting rules:
1. Use # for workout title
2. Use ## for exercise names
3. Use numbered lists (1., 2., etc.) for sets
4. Include @units and @tags at the top
5. For bodyweight exercises, omit the weight (e.g., "3x10")
6. Include rest periods in parentheses
7. You can use sections like "### Warmup" or "### Cool Down"
8. For supersets, group exercises together under a section
9. NEVER use @rpe - RPE is not supported in the workout format
10. For AMRAP (As Many Reps As Possible) sets, write them as "AMRAP @ weight" (e.g., "1. AMRAP @ 135lbs")
    - Example: "1. AMRAP @ 135lbs (rest: 2min)" means do as many reps as possible at 135lbs
    - Example: "1. AMRAP" (for bodyweight) means do as many reps as possible with no weight
    - Do NOT write "3x10 - AMRAP on last set" - instead write the AMRAP set as its own line

Generate complete, practical workouts based on the user's request.`;
  }

  /**
   * Build the user prompt from the workout generation parameters
   */
  private buildUserPrompt(params: WorkoutGenerationParams): string {
    let prompt = params.prompt;

    // Add equipment constraints if provided
    if (params.equipment && params.equipment.length > 0) {
      prompt += `\n\nAvailable equipment: ${params.equipment.join(', ')}`;
    }

    // Add duration if provided
    if (params.duration) {
      prompt += `\n\nTarget duration: ${params.duration} minutes`;
    }

    // Add target muscle groups if provided
    if (params.targetMuscleGroups && params.targetMuscleGroups.length > 0) {
      prompt += `\n\nTarget muscle groups: ${params.targetMuscleGroups.join(', ')}`;
    }

    // Add custom prompt addition if provided
    if (params.customPrompt) {
      prompt += `\n\n${params.customPrompt}`;
    }

    return prompt;
  }

  /**
   * Clear the API key and reset the client
   */
  clear(): void {
    this.apiKey = null;
    this.client = null;
  }
}

// Quartz's fetch-based workout generation function
/**
 * Generate a workout using Claude (fetch-based implementation)
 */
export async function generateWorkout(
  params: GenerateWorkoutParams
): Promise<GenerateWorkoutResult> {
  const { apiKey, prompt, model = DEFAULT_MODEL } = params;

  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      error: {
        message: 'API key is required. Please add your Anthropic API key in Settings.',
        type: 'missing_api_key',
      },
    };
  }

  try {
    console.log('[AnthropicService] Starting workout generation');
    console.log('[AnthropicService] API Key length:', apiKey.length);
    console.log('[AnthropicService] API Key prefix:', apiKey.substring(0, 10) + '...');
    console.log('[AnthropicService] Using model:', model);

    const requestBody = {
      model: model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    console.log('[AnthropicService] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[AnthropicService] Response status:', response.status);
    console.log('[AnthropicService] Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('[AnthropicService] Error response:', JSON.stringify(errorData, null, 2));

      let errorMessage = 'Failed to generate workout';
      let errorType = 'api_error';

      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your Anthropic API key in Settings.';
        errorType = 'invalid_api_key';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
        errorType = 'rate_limit';
      } else if (response.status === 400) {
        errorMessage = errorData.error?.message || 'Invalid request. Please try again.';
        errorType = 'bad_request';
      } else if (response.status >= 500) {
        errorMessage = 'Anthropic API is currently unavailable. Please try again later.';
        errorType = 'server_error';
      }

      return {
        success: false,
        error: {
          message: errorMessage,
          type: errorType,
          status: response.status,
        },
      };
    }

    const data = await response.json();
    console.log('[AnthropicService] Response data:', JSON.stringify(data, null, 2));

    // Extract the generated workout text from Claude's response
    const workout = data.content?.[0]?.text;

    if (!workout) {
      console.log('[AnthropicService] No workout text in response');
      return {
        success: false,
        error: {
          message: 'No workout generated. Please try again.',
          type: 'empty_response',
        },
      };
    }

    console.log('[AnthropicService] Successfully generated workout, length:', workout.length);
    return {
      success: true,
      workout,
    };
  } catch (error) {
    console.error('[AnthropicService] Failed to generate workout:', error);
    console.error('[AnthropicService] Error type:', typeof error);
    console.error('[AnthropicService] Error details:', JSON.stringify(error, null, 2));

    let errorMessage = 'Network error. Please check your connection and try again.';

    if (error instanceof TypeError && error.message.includes('network')) {
      errorMessage = 'Unable to connect to Anthropic API. Please check your internet connection.';
    }

    return {
      success: false,
      error: {
        message: errorMessage,
        type: 'network_error',
      },
    };
  }
}

// Export a singleton instance
export const anthropicService = new AnthropicService();
