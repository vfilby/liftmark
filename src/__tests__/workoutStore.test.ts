import { useWorkoutStore } from '../stores/workoutStore';
import type { WorkoutTemplate } from '@/types';

// Mock the repository module
jest.mock('@/db/repository', () => ({
  getAllWorkoutTemplates: jest.fn(),
  getWorkoutTemplateById: jest.fn(),
  createWorkoutTemplate: jest.fn(),
  updateWorkoutTemplate: jest.fn(),
  deleteWorkoutTemplate: jest.fn(),
  searchWorkoutTemplates: jest.fn(),
  getWorkoutTemplatesByTag: jest.fn(),
}));

// Mock the MarkdownParser
jest.mock('@/services/MarkdownParser', () => ({
  parseWorkout: jest.fn(),
}));

import {
  getAllWorkoutTemplates,
  getWorkoutTemplateById,
  createWorkoutTemplate as createWorkoutTemplateInDb,
  updateWorkoutTemplate as updateWorkoutTemplateInDb,
  deleteWorkoutTemplate,
  searchWorkoutTemplates,
  getWorkoutTemplatesByTag,
} from '@/db/repository';
import { parseWorkout } from '@/services/MarkdownParser';

const mockedGetAllWorkoutTemplates = getAllWorkoutTemplates as jest.MockedFunction<typeof getAllWorkoutTemplates>;
const mockedGetWorkoutTemplateById = getWorkoutTemplateById as jest.MockedFunction<typeof getWorkoutTemplateById>;
const mockedCreateWorkoutTemplate = createWorkoutTemplateInDb as jest.MockedFunction<typeof createWorkoutTemplateInDb>;
const mockedUpdateWorkoutTemplate = updateWorkoutTemplateInDb as jest.MockedFunction<typeof updateWorkoutTemplateInDb>;
const mockedDeleteWorkoutTemplate = deleteWorkoutTemplate as jest.MockedFunction<typeof deleteWorkoutTemplate>;
const mockedSearchWorkoutTemplates = searchWorkoutTemplates as jest.MockedFunction<typeof searchWorkoutTemplates>;
const mockedGetWorkoutTemplatesByTag = getWorkoutTemplatesByTag as jest.MockedFunction<typeof getWorkoutTemplatesByTag>;
const mockedParseWorkout = parseWorkout as jest.MockedFunction<typeof parseWorkout>;

// ============================================================================
// Helper Factory Functions
// ============================================================================

function createTestWorkoutTemplate(overrides: Partial<WorkoutTemplate> = {}): WorkoutTemplate {
  return {
    id: 'template-1',
    name: 'Test Workout',
    tags: ['strength'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    exercises: [],
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('workoutStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the store state before each test
    useWorkoutStore.setState({
      workouts: [],
      selectedWorkout: null,
      isLoading: false,
      error: null,
    });
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('has empty workouts array initially', () => {
      const { workouts } = useWorkoutStore.getState();
      expect(workouts).toEqual([]);
    });

    it('has null selectedWorkout initially', () => {
      const { selectedWorkout } = useWorkoutStore.getState();
      expect(selectedWorkout).toBeNull();
    });

    it('is not loading initially', () => {
      const { isLoading } = useWorkoutStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has no error initially', () => {
      const { error } = useWorkoutStore.getState();
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadWorkouts Tests
  // ==========================================================================

  describe('loadWorkouts', () => {
    it('sets isLoading to true while loading', async () => {
      let resolvePromise: (value: WorkoutTemplate[]) => void;
      const pendingPromise = new Promise<WorkoutTemplate[]>((resolve) => {
        resolvePromise = resolve;
      });

      mockedGetAllWorkoutTemplates.mockReturnValue(pendingPromise);

      const loadPromise = useWorkoutStore.getState().loadWorkouts();

      expect(useWorkoutStore.getState().isLoading).toBe(true);

      resolvePromise!([]);
      await loadPromise;
    });

    it('loads workouts from repository', async () => {
      const workouts = [
        createTestWorkoutTemplate({ id: 'template-1', name: 'Push Day' }),
        createTestWorkoutTemplate({ id: 'template-2', name: 'Pull Day' }),
      ];

      mockedGetAllWorkoutTemplates.mockResolvedValue(workouts);

      await useWorkoutStore.getState().loadWorkouts();

      const { workouts: loadedWorkouts, isLoading, error } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(loadedWorkouts).toHaveLength(2);
      expect(loadedWorkouts[0].name).toBe('Push Day');
      expect(loadedWorkouts[1].name).toBe('Pull Day');
    });

    it('handles empty workouts list', async () => {
      mockedGetAllWorkoutTemplates.mockResolvedValue([]);

      await useWorkoutStore.getState().loadWorkouts();

      const { workouts, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(workouts).toEqual([]);
    });

    it('handles errors', async () => {
      const error = new Error('Failed to fetch workouts');
      mockedGetAllWorkoutTemplates.mockRejectedValue(error);

      await useWorkoutStore.getState().loadWorkouts();

      const { error: storeError, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Failed to fetch workouts');
    });

    it('handles non-Error thrown values', async () => {
      mockedGetAllWorkoutTemplates.mockRejectedValue('string error');

      await useWorkoutStore.getState().loadWorkouts();

      const { error } = useWorkoutStore.getState();

      expect(error).toBe('Failed to load workouts');
    });

    it('clears previous error when loading', async () => {
      useWorkoutStore.setState({ error: 'Previous error' });

      mockedGetAllWorkoutTemplates.mockResolvedValue([]);

      await useWorkoutStore.getState().loadWorkouts();

      const { error } = useWorkoutStore.getState();

      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadWorkout Tests
  // ==========================================================================

  describe('loadWorkout', () => {
    it('sets isLoading to true while loading', async () => {
      let resolvePromise: (value: WorkoutTemplate | null) => void;
      const pendingPromise = new Promise<WorkoutTemplate | null>((resolve) => {
        resolvePromise = resolve;
      });

      mockedGetWorkoutTemplateById.mockReturnValue(pendingPromise);

      const loadPromise = useWorkoutStore.getState().loadWorkout('template-1');

      expect(useWorkoutStore.getState().isLoading).toBe(true);

      resolvePromise!(createTestWorkoutTemplate());
      await loadPromise;
    });

    it('loads a single workout and sets as selectedWorkout', async () => {
      const workout = createTestWorkoutTemplate({ id: 'template-1', name: 'Leg Day' });

      mockedGetWorkoutTemplateById.mockResolvedValue(workout);

      await useWorkoutStore.getState().loadWorkout('template-1');

      const { selectedWorkout, isLoading, error } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(selectedWorkout).toEqual(workout);
      expect(mockedGetWorkoutTemplateById).toHaveBeenCalledWith('template-1');
    });

    it('handles workout not found (null)', async () => {
      mockedGetWorkoutTemplateById.mockResolvedValue(null);

      await useWorkoutStore.getState().loadWorkout('non-existent');

      const { selectedWorkout, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(selectedWorkout).toBeNull();
    });

    it('handles errors', async () => {
      const error = new Error('Database error');
      mockedGetWorkoutTemplateById.mockRejectedValue(error);

      await useWorkoutStore.getState().loadWorkout('template-1');

      const { error: storeError, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Database error');
    });

    it('handles non-Error thrown values', async () => {
      mockedGetWorkoutTemplateById.mockRejectedValue('string error');

      await useWorkoutStore.getState().loadWorkout('template-1');

      const { error } = useWorkoutStore.getState();

      expect(error).toBe('Failed to load workout');
    });
  });

  // ==========================================================================
  // saveWorkout Tests
  // ==========================================================================

  describe('saveWorkout', () => {
    it('creates a new workout when it does not exist', async () => {
      const newWorkout = createTestWorkoutTemplate({ id: 'new-template', name: 'New Workout' });

      mockedGetWorkoutTemplateById.mockResolvedValue(null);
      mockedCreateWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([newWorkout]);

      await useWorkoutStore.getState().saveWorkout(newWorkout);

      expect(mockedGetWorkoutTemplateById).toHaveBeenCalledWith('new-template');
      expect(mockedCreateWorkoutTemplate).toHaveBeenCalledWith(newWorkout);
      expect(mockedUpdateWorkoutTemplate).not.toHaveBeenCalled();
    });

    it('updates an existing workout', async () => {
      const existingWorkout = createTestWorkoutTemplate({ id: 'existing-template', name: 'Existing Workout' });
      const updatedWorkout = { ...existingWorkout, name: 'Updated Workout' };

      mockedGetWorkoutTemplateById.mockResolvedValue(existingWorkout);
      mockedUpdateWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([updatedWorkout]);

      await useWorkoutStore.getState().saveWorkout(updatedWorkout);

      expect(mockedGetWorkoutTemplateById).toHaveBeenCalledWith('existing-template');
      expect(mockedUpdateWorkoutTemplate).toHaveBeenCalledWith(updatedWorkout);
      expect(mockedCreateWorkoutTemplate).not.toHaveBeenCalled();
    });

    it('reloads workouts after saving', async () => {
      const workout = createTestWorkoutTemplate();
      const allWorkouts = [workout, createTestWorkoutTemplate({ id: 'template-2' })];

      mockedGetWorkoutTemplateById.mockResolvedValue(null);
      mockedCreateWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue(allWorkouts);

      await useWorkoutStore.getState().saveWorkout(workout);

      const { workouts } = useWorkoutStore.getState();

      expect(mockedGetAllWorkoutTemplates).toHaveBeenCalled();
      expect(workouts).toHaveLength(2);
    });

    it('handles save errors', async () => {
      const workout = createTestWorkoutTemplate();
      const error = new Error('Failed to save');

      mockedGetWorkoutTemplateById.mockResolvedValue(null);
      mockedCreateWorkoutTemplate.mockRejectedValue(error);

      await useWorkoutStore.getState().saveWorkout(workout);

      const { error: storeError, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Failed to save');
    });

    it('handles non-Error thrown values', async () => {
      const workout = createTestWorkoutTemplate();

      mockedGetWorkoutTemplateById.mockResolvedValue(null);
      mockedCreateWorkoutTemplate.mockRejectedValue('string error');

      await useWorkoutStore.getState().saveWorkout(workout);

      const { error } = useWorkoutStore.getState();

      expect(error).toBe('Failed to save workout');
    });
  });

  // ==========================================================================
  // removeWorkout Tests
  // ==========================================================================

  describe('removeWorkout', () => {
    it('deletes workout and reloads list', async () => {
      mockedDeleteWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([]);

      await useWorkoutStore.getState().removeWorkout('template-to-delete');

      expect(mockedDeleteWorkoutTemplate).toHaveBeenCalledWith('template-to-delete');
      expect(mockedGetAllWorkoutTemplates).toHaveBeenCalled();
    });

    it('clears selectedWorkout after deletion', async () => {
      useWorkoutStore.setState({ selectedWorkout: createTestWorkoutTemplate({ id: 'template-1' }) });

      mockedDeleteWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([]);

      await useWorkoutStore.getState().removeWorkout('template-1');

      const { selectedWorkout } = useWorkoutStore.getState();

      expect(selectedWorkout).toBeNull();
    });

    it('handles delete errors', async () => {
      const error = new Error('Delete failed');
      mockedDeleteWorkoutTemplate.mockRejectedValue(error);

      await useWorkoutStore.getState().removeWorkout('template-1');

      const { error: storeError, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Delete failed');
    });

    it('handles non-Error thrown values', async () => {
      mockedDeleteWorkoutTemplate.mockRejectedValue('string error');

      await useWorkoutStore.getState().removeWorkout('template-1');

      const { error } = useWorkoutStore.getState();

      expect(error).toBe('Failed to delete workout');
    });
  });

  // ==========================================================================
  // reprocessWorkout Tests
  // ==========================================================================

  describe('reprocessWorkout', () => {
    it('returns error when workout not found', async () => {
      mockedGetWorkoutTemplateById.mockResolvedValue(null);

      const result = await useWorkoutStore.getState().reprocessWorkout('non-existent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Workout not found');
    });

    it('returns error when no source markdown', async () => {
      const workout = createTestWorkoutTemplate({ id: 'template-1', sourceMarkdown: undefined });
      mockedGetWorkoutTemplateById.mockResolvedValue(workout);

      const result = await useWorkoutStore.getState().reprocessWorkout('template-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No source markdown stored for this workout');
    });

    it('returns error when parse fails', async () => {
      const workout = createTestWorkoutTemplate({ id: 'template-1', sourceMarkdown: '# Invalid' });
      mockedGetWorkoutTemplateById.mockResolvedValue(workout);
      mockedParseWorkout.mockReturnValue({
        success: false,
        errors: ['Parse error: invalid format'],
      });

      const result = await useWorkoutStore.getState().reprocessWorkout('template-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Parse error: invalid format');
    });

    it('successfully reprocesses workout', async () => {
      const existingWorkout = createTestWorkoutTemplate({
        id: 'template-1',
        name: 'Old Name',
        sourceMarkdown: '# Push Day\n- Bench Press: 3x10',
        createdAt: '2024-01-10T10:00:00Z',
      });

      const parsedWorkout = createTestWorkoutTemplate({
        id: 'parsed-id',
        name: 'Push Day',
        exercises: [
          {
            id: 'exercise-1',
            workoutTemplateId: 'parsed-id',
            exerciseName: 'Bench Press',
            orderIndex: 0,
            sets: [],
          },
        ],
      });

      mockedGetWorkoutTemplateById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({
        success: true,
        data: parsedWorkout,
      });
      mockedUpdateWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([parsedWorkout]);

      const result = await useWorkoutStore.getState().reprocessWorkout('template-1');

      expect(result.success).toBe(true);
      expect(mockedUpdateWorkoutTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'template-1', // Preserves original ID
          createdAt: '2024-01-10T10:00:00Z', // Preserves original createdAt
          name: 'Push Day',
        })
      );
    });

    it('updates exercise workoutTemplateId to match original workout', async () => {
      const existingWorkout = createTestWorkoutTemplate({
        id: 'original-id',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutTemplate({
        id: 'new-id',
        exercises: [
          {
            id: 'exercise-1',
            workoutTemplateId: 'new-id',
            exerciseName: 'Squat',
            orderIndex: 0,
            sets: [],
          },
        ],
      });

      mockedGetWorkoutTemplateById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([]);

      await useWorkoutStore.getState().reprocessWorkout('original-id');

      expect(mockedUpdateWorkoutTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: expect.arrayContaining([
            expect.objectContaining({
              workoutTemplateId: 'original-id',
            }),
          ]),
        })
      );
    });

    it('updates selectedWorkout after reprocessing', async () => {
      const existingWorkout = createTestWorkoutTemplate({
        id: 'template-1',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutTemplate({ id: 'template-1', name: 'Updated' });

      mockedGetWorkoutTemplateById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutTemplate.mockResolvedValue(undefined);
      mockedGetAllWorkoutTemplates.mockResolvedValue([parsedWorkout]);

      await useWorkoutStore.getState().reprocessWorkout('template-1');

      const { selectedWorkout } = useWorkoutStore.getState();

      expect(selectedWorkout).not.toBeNull();
      expect(selectedWorkout?.name).toBe('Updated');
    });

    it('handles reprocess errors', async () => {
      const existingWorkout = createTestWorkoutTemplate({
        id: 'template-1',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutTemplate({ id: 'template-1' });
      const error = new Error('Update failed');

      mockedGetWorkoutTemplateById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutTemplate.mockRejectedValue(error);

      const result = await useWorkoutStore.getState().reprocessWorkout('template-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Update failed');

      const { error: storeError } = useWorkoutStore.getState();
      expect(storeError).toBe('Update failed');
    });

    it('handles non-Error thrown values', async () => {
      const existingWorkout = createTestWorkoutTemplate({
        id: 'template-1',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutTemplate({ id: 'template-1' });

      mockedGetWorkoutTemplateById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutTemplate.mockRejectedValue('string error');

      const result = await useWorkoutStore.getState().reprocessWorkout('template-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown error');
    });
  });

  // ==========================================================================
  // searchWorkouts Tests
  // ==========================================================================

  describe('searchWorkouts', () => {
    it('searches workouts with query', async () => {
      const workouts = [createTestWorkoutTemplate({ name: 'Push Day' })];
      mockedSearchWorkoutTemplates.mockResolvedValue(workouts);

      await useWorkoutStore.getState().searchWorkouts('push');

      expect(mockedSearchWorkoutTemplates).toHaveBeenCalledWith('push');

      const { workouts: results } = useWorkoutStore.getState();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Push Day');
    });

    it('loads all workouts when query is empty', async () => {
      const workouts = [
        createTestWorkoutTemplate({ id: '1', name: 'Push' }),
        createTestWorkoutTemplate({ id: '2', name: 'Pull' }),
      ];
      mockedGetAllWorkoutTemplates.mockResolvedValue(workouts);

      await useWorkoutStore.getState().searchWorkouts('');

      expect(mockedGetAllWorkoutTemplates).toHaveBeenCalled();
      expect(mockedSearchWorkoutTemplates).not.toHaveBeenCalled();

      const { workouts: results } = useWorkoutStore.getState();
      expect(results).toHaveLength(2);
    });

    it('handles search errors', async () => {
      const error = new Error('Search failed');
      mockedSearchWorkoutTemplates.mockRejectedValue(error);

      await useWorkoutStore.getState().searchWorkouts('query');

      const { error: storeError, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Search failed');
    });

    it('handles non-Error thrown values', async () => {
      mockedSearchWorkoutTemplates.mockRejectedValue('string error');

      await useWorkoutStore.getState().searchWorkouts('query');

      const { error } = useWorkoutStore.getState();

      expect(error).toBe('Failed to search workouts');
    });
  });

  // ==========================================================================
  // filterByTag Tests
  // ==========================================================================

  describe('filterByTag', () => {
    it('filters workouts by tag', async () => {
      const workouts = [createTestWorkoutTemplate({ tags: ['strength'] })];
      mockedGetWorkoutTemplatesByTag.mockResolvedValue(workouts);

      await useWorkoutStore.getState().filterByTag('strength');

      expect(mockedGetWorkoutTemplatesByTag).toHaveBeenCalledWith('strength');

      const { workouts: results } = useWorkoutStore.getState();
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('strength');
    });

    it('handles filter errors', async () => {
      const error = new Error('Filter failed');
      mockedGetWorkoutTemplatesByTag.mockRejectedValue(error);

      await useWorkoutStore.getState().filterByTag('tag');

      const { error: storeError, isLoading } = useWorkoutStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Filter failed');
    });

    it('handles non-Error thrown values', async () => {
      mockedGetWorkoutTemplatesByTag.mockRejectedValue('string error');

      await useWorkoutStore.getState().filterByTag('tag');

      const { error } = useWorkoutStore.getState();

      expect(error).toBe('Failed to filter workouts');
    });
  });

  // ==========================================================================
  // setSelectedWorkout Tests
  // ==========================================================================

  describe('setSelectedWorkout', () => {
    it('sets selectedWorkout', () => {
      const workout = createTestWorkoutTemplate({ id: 'template-1', name: 'Selected Workout' });

      useWorkoutStore.getState().setSelectedWorkout(workout);

      const { selectedWorkout } = useWorkoutStore.getState();

      expect(selectedWorkout).toEqual(workout);
    });

    it('clears selectedWorkout when passed null', () => {
      useWorkoutStore.setState({ selectedWorkout: createTestWorkoutTemplate() });

      useWorkoutStore.getState().setSelectedWorkout(null);

      const { selectedWorkout } = useWorkoutStore.getState();

      expect(selectedWorkout).toBeNull();
    });
  });

  // ==========================================================================
  // clearError Tests
  // ==========================================================================

  describe('clearError', () => {
    it('clears the error state', () => {
      useWorkoutStore.setState({ error: 'Some error' });

      useWorkoutStore.getState().clearError();

      const { error } = useWorkoutStore.getState();

      expect(error).toBeNull();
    });

    it('does nothing when error is already null', () => {
      expect(useWorkoutStore.getState().error).toBeNull();

      useWorkoutStore.getState().clearError();

      expect(useWorkoutStore.getState().error).toBeNull();
    });
  });
});
