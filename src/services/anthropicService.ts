import Anthropic from '@anthropic-ai/sdk';

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
        model: 'claude-3-5-sonnet-20241022',
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
3. 3x6 @ 175lbs (rest: 2min) - AMRAP on last set

Important formatting rules:
1. Use # for workout title
2. Use ## for exercise names
3. Use numbered lists (1., 2., etc.) for sets
4. Include @units and @tags at the top
5. For bodyweight exercises, omit the weight (e.g., "3x10")
6. Include rest periods in parentheses
7. You can use sections like "### Warmup" or "### Cool Down"
8. For supersets, group exercises together under a section

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

// Export a singleton instance
export const anthropicService = new AnthropicService();
