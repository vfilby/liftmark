# AI Workout Generation Service Specification

## Purpose

Generate personalized workout plans using the Claude API. This combines user context (workout history, gym equipment, preferences) with a structured prompt to produce LMWF-formatted workout plans.

## Components

### Anthropic Service (`anthropicService.ts`)

Provides two implementation paths for communicating with the Claude API.

#### SDK-based Implementation (AnthropicService class, singleton)

##### `initialize(apiKey): void`

Create an Anthropic client instance with the provided API key.

##### `generateWorkout(params): Promise<string>`

Generate a workout using the SDK client. Returns the raw markdown response.

##### `verifyApiKey(apiKey): Promise<boolean>`

Make a minimal API call to verify the key is valid and has available credits.

##### `clear(): void`

Reset the client instance, clearing the stored API key.

#### Fetch-based Implementation (`generateWorkout` function)

A standalone function that calls the Anthropic API directly via `fetch`.

- Endpoint: `https://api.anthropic.com/v1/messages`
- Default model: `claude-haiku-4-5-20251001`
- Available models: Haiku 4.5, Sonnet 4.5
- Max tokens: 4096

#### API Error Handling

| HTTP Status | Meaning |
|---|---|
| 401 | Invalid API key |
| 429 | Rate limit exceeded |
| 400 | Invalid request |
| 500+ | Server unavailable |
| Network error | Connection check message presented to user |

---

### Workout Generation Service (`workoutGenerationService.ts`)

Orchestrates the full generation pipeline: context assembly, prompt building, API call, response parsing, and validation.

#### `buildWorkoutGenerationPrompt(context, params): string`

Build a structured prompt from the user's context and generation parameters. The prompt instructs the model to output valid LMWF markdown.

#### `gatherWorkoutGenerationContext(recentCount?): Promise<WorkoutGenerationContext>`

Collect all relevant user context for prompt assembly.

#### `parseAIWorkoutResponse(markdown, defaultWeightUnit): WorkoutTemplate`

Parse the AI's markdown response into a WorkoutTemplate using the LMWF parser.

#### `validateGeneratedWorkout(template): ValidationResult`

Run quality validation checks on the generated workout.

### Context Assembly

The following data is gathered and included in the generation prompt:

- **Settings**: User's preferred weight unit, custom prompt instructions.
- **History**: Recent workout history via `generateWorkoutHistoryContext()`, formatted in a compact abbreviated format.
- **Equipment**: Available equipment from the user's default gym.
- **Gym name**: The name of the user's default gym.

### Prompt Structure

The prompt is assembled in this order:

1. System role definition (strength coach persona).
2. User context block (history, gym, equipment, preferences).
3. Workout request (user's specific ask).
4. LMWF format specification with examples.
5. Output instructions (return only the markdown, no preamble).

### Validation Checks

#### Required (errors)

- Workout must have a name.
- Workout must have at least one exercise.

#### Per Exercise

- Exercise name is required.
- Warning if exercise has no sets.

#### Per Set

- Must have at least one of: weight, reps, or time.
- Warning if weight is specified without a unit.
- RPE must be in range 1-10 if specified.

#### Volume

- Warning if total working sets are fewer than 8.
- Warning if total working sets exceed 40.

## Dependencies

- `@anthropic-ai/sdk` for the SDK-based implementation.
- `fetch` (global) for the fetch-based implementation.
- LMWF parser (`MarkdownParser`) for parsing AI responses.
- `workoutHistoryService` for generating history context.
- Zustand stores: settings store, gym store, equipment store.

## Error Handling

- API errors are translated into user-friendly messages based on HTTP status code.
- Network failures produce a connection check message.
- Parse failures from the AI response are surfaced through the standard `ParseResult` error mechanism.
- Validation issues are returned as warnings or errors in the `ValidationResult`, not thrown as exceptions.
