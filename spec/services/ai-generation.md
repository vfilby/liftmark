# AI Workout Generation Service Specification

## Purpose

Generate personalized workout plans using the Claude API. This combines user context (workout history, gym equipment, preferences) with a structured prompt to produce LMWF-formatted workout plans.

## Generation Paths

There are two user-facing paths for AI workout generation:

1. **In-app generation**: The user provides an Anthropic API key in settings. The app calls the Claude API directly to generate a workout, parse it, and present the result for review.
2. **Open in Claude**: The app assembles the same structured prompt, copies it to the clipboard, and opens Claude.ai in the browser. The user pastes the prompt, receives a workout in LMWF format, and imports the result back into the app.

## API Configuration

- Endpoint: `https://api.anthropic.com/v1/messages`
- Default model: `claude-haiku-4-5-20251001`
- Available models: Haiku 4.5, Sonnet 4.5
- Max tokens: 4096

## API Error Handling

| HTTP Status | Meaning |
|---|---|
| 401 | Invalid API key |
| 429 | Rate limit exceeded |
| 400 | Invalid request |
| 500+ | Server unavailable |
| Network error | Connection check message presented to user |

API errors are translated into user-friendly messages based on HTTP status code. Network failures produce a connection check message.

## Context Assembly

The following data is gathered and included in the generation prompt:

- **Settings**: User's preferred weight unit, custom prompt instructions.
- **History**: Recent workout history, formatted in a compact abbreviated format.
- **Equipment**: Available equipment from the user's default gym.
- **Gym name**: The name of the user's default gym.

## Prompt Structure

The prompt is assembled in this order:

1. System role definition (strength coach persona).
2. User context block (history, gym, equipment, preferences).
3. Workout request (user's specific ask).
4. LMWF format specification with examples.
5. Output instructions (return only the markdown, no preamble).

## Validation Checks

The generated workout is validated before being presented to the user.

### Required (errors)

- Workout must have a name.
- Workout must have at least one exercise.

### Per Exercise

- Exercise name is required.
- Warning if exercise has no sets.

### Per Set

- Must have at least one of: weight, reps, or time.
- Warning if weight is specified without a unit.
- RPE must be in range 1-10 if specified.

### Volume

- Warning if total working sets are fewer than 8.
- Warning if total working sets exceed 40.

## Error Handling

- Parse failures from the AI response are surfaced through the standard parse result error mechanism.
- Validation issues are returned as warnings or errors, not thrown as exceptions.
