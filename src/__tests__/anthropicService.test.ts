// Tests for anthropicService

import { anthropicService } from '../services/anthropicService';

// Mock the @anthropic-ai/sdk module
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

describe('anthropicService', () => {
  let mockAnthropicClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state
    anthropicService.clear();
  });

  describe('initialize', () => {
    it('initializes with a valid API key', () => {
      expect(() => {
        anthropicService.initialize('test-api-key');
      }).not.toThrow();

      expect(anthropicService.isInitialized()).toBe(true);
    });

    it('throws error when initialized without API key', () => {
      expect(() => {
        anthropicService.initialize('');
      }).toThrow('API key is required');
    });
  });

  describe('isInitialized', () => {
    it('returns false when not initialized', () => {
      expect(anthropicService.isInitialized()).toBe(false);
    });

    it('returns true after initialization', () => {
      anthropicService.initialize('test-api-key');
      expect(anthropicService.isInitialized()).toBe(true);
    });

    it('returns false after clear', () => {
      anthropicService.initialize('test-api-key');
      anthropicService.clear();
      expect(anthropicService.isInitialized()).toBe(false);
    });
  });

  describe('generateWorkout', () => {
    it('returns error when not initialized', async () => {
      const result = await anthropicService.generateWorkout({
        prompt: 'Create a push workout',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('successfully generates a workout', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '# Push Day\n\n## Bench Press\n1. 3x10 @ 135lbs',
          },
        ],
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      const result = await anthropicService.generateWorkout({
        prompt: 'Create a push workout',
      });

      expect(result.success).toBe(true);
      expect(result.workoutMarkdown).toContain('Push Day');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
        })
      );
    });

    it('includes equipment in the prompt', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '# Workout' }],
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      await anthropicService.generateWorkout({
        prompt: 'Create a workout',
        equipment: ['barbell', 'bench'],
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Available equipment: barbell, bench');
    });

    it('includes duration in the prompt', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '# Workout' }],
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      await anthropicService.generateWorkout({
        prompt: 'Create a workout',
        duration: 45,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Target duration: 45 minutes');
    });

    it('includes target muscle groups in the prompt', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '# Workout' }],
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      await anthropicService.generateWorkout({
        prompt: 'Create a workout',
        targetMuscleGroups: ['chest', 'triceps'],
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Target muscle groups: chest, triceps');
    });

    it('includes custom prompt addition', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '# Workout' }],
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      await anthropicService.generateWorkout({
        prompt: 'Create a workout',
        customPrompt: 'Focus on hypertrophy',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Focus on hypertrophy');
    });

    it('handles rate limiting errors (429)', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      const result = await anthropicService.generateWorkout({
        prompt: 'Create a workout',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('handles invalid API key errors (401)', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockRejectedValue({
        status: 401,
        message: 'Invalid API key',
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      const result = await anthropicService.generateWorkout({
        prompt: 'Create a workout',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('handles general API errors', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockRejectedValue(new Error('Network error'));

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      anthropicService.initialize('test-api-key');

      const result = await anthropicService.generateWorkout({
        prompt: 'Create a workout',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(consoleSpy).toHaveBeenCalledWith('Workout generation error:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('handles unexpected response format', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [
          {
            type: 'unknown',
            data: 'something',
          },
        ],
      });

      Anthropic.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      anthropicService.initialize('test-api-key');

      const result = await anthropicService.generateWorkout({
        prompt: 'Create a workout',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected response format');
    });
  });

  describe('clear', () => {
    it('clears the API key and client', () => {
      anthropicService.initialize('test-api-key');
      expect(anthropicService.isInitialized()).toBe(true);

      anthropicService.clear();
      expect(anthropicService.isInitialized()).toBe(false);
    });
  });
});
