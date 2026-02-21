import { useWorkoutPlanStore } from '../stores/workoutPlanStore';
import type { WorkoutPlan } from '@/types';

// Mock the repository module
jest.mock('@/db/repository', () => ({
  getAllWorkoutPlans: jest.fn(),
  getWorkoutPlanById: jest.fn(),
  createWorkoutPlan: jest.fn(),
  updateWorkoutPlan: jest.fn(),
  deleteWorkoutPlan: jest.fn(),
  searchWorkoutPlans: jest.fn(),
  getWorkoutPlansByTag: jest.fn(),
}));

// Mock the MarkdownParser
jest.mock('@/services/MarkdownParser', () => ({
  parseWorkout: jest.fn(),
}));

import {
  getAllWorkoutPlans,
  getWorkoutPlanById,
  createWorkoutPlan as createWorkoutPlanInDb,
  updateWorkoutPlan as updateWorkoutPlanInDb,
  deleteWorkoutPlan,
  searchWorkoutPlans,
  getWorkoutPlansByTag,
} from '@/db/repository';
import { parseWorkout } from '@/services/MarkdownParser';

const mockedGetAllWorkoutPlans = getAllWorkoutPlans as jest.MockedFunction<typeof getAllWorkoutPlans>;
const mockedGetWorkoutPlanById = getWorkoutPlanById as jest.MockedFunction<typeof getWorkoutPlanById>;
const mockedCreateWorkoutPlan = createWorkoutPlanInDb as jest.MockedFunction<typeof createWorkoutPlanInDb>;
const mockedUpdateWorkoutPlan = updateWorkoutPlanInDb as jest.MockedFunction<typeof updateWorkoutPlanInDb>;
const mockedDeleteWorkoutPlan = deleteWorkoutPlan as jest.MockedFunction<typeof deleteWorkoutPlan>;
const mockedSearchWorkoutPlans = searchWorkoutPlans as jest.MockedFunction<typeof searchWorkoutPlans>;
const mockedGetWorkoutPlansByTag = getWorkoutPlansByTag as jest.MockedFunction<typeof getWorkoutPlansByTag>;
const mockedParseWorkout = parseWorkout as jest.MockedFunction<typeof parseWorkout>;

// ============================================================================
// Helper Factory Functions
// ============================================================================

function createTestWorkoutPlan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: 'plan-1',
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
    useWorkoutPlanStore.setState({
      plans: [],
      selectedPlan: null,
      isLoading: false,
      error: null,
    });
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('has empty plans array initially', () => {
      const { plans } = useWorkoutPlanStore.getState();
      expect(plans).toEqual([]);
    });

    it('has null selectedPlan initially', () => {
      const { selectedPlan } = useWorkoutPlanStore.getState();
      expect(selectedPlan).toBeNull();
    });

    it('is not loading initially', () => {
      const { isLoading } = useWorkoutPlanStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has no error initially', () => {
      const { error } = useWorkoutPlanStore.getState();
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadPlans Tests
  // ==========================================================================

  describe('loadPlans', () => {
    it('sets isLoading to true while loading', async () => {
      let resolvePromise: (value: WorkoutPlan[]) => void;
      const pendingPromise = new Promise<WorkoutPlan[]>((resolve) => {
        resolvePromise = resolve;
      });

      mockedGetAllWorkoutPlans.mockReturnValue(pendingPromise);

      const loadPromise = useWorkoutPlanStore.getState().loadPlans();

      expect(useWorkoutPlanStore.getState().isLoading).toBe(true);

      resolvePromise!([]);
      await loadPromise;
    });

    it('loads plans from repository', async () => {
      const plans = [
        createTestWorkoutPlan({ id: 'plan-1', name: 'Push Day' }),
        createTestWorkoutPlan({ id: 'plan-2', name: 'Pull Day' }),
      ];

      mockedGetAllWorkoutPlans.mockResolvedValue(plans);

      await useWorkoutPlanStore.getState().loadPlans();

      const { plans: loadedWorkouts, isLoading, error } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(loadedWorkouts).toHaveLength(2);
      expect(loadedWorkouts[0].name).toBe('Push Day');
      expect(loadedWorkouts[1].name).toBe('Pull Day');
    });

    it('handles empty plans list', async () => {
      mockedGetAllWorkoutPlans.mockResolvedValue([]);

      await useWorkoutPlanStore.getState().loadPlans();

      const { plans, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(plans).toEqual([]);
    });

    it('handles errors', async () => {
      const error = new Error('Failed to fetch plans');
      mockedGetAllWorkoutPlans.mockRejectedValue(error);

      await useWorkoutPlanStore.getState().loadPlans();

      const { error: storeError, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Failed to fetch plans');
    });

    it('handles non-Error thrown values', async () => {
      mockedGetAllWorkoutPlans.mockRejectedValue('string error');

      await useWorkoutPlanStore.getState().loadPlans();

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBe('Failed to load workout plans');
    });

    it('clears previous error when loading', async () => {
      useWorkoutPlanStore.setState({ error: 'Previous error' });

      mockedGetAllWorkoutPlans.mockResolvedValue([]);

      await useWorkoutPlanStore.getState().loadPlans();

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadPlan Tests
  // ==========================================================================

  describe('loadPlan', () => {
    it('sets isLoading to true while loading', async () => {
      let resolvePromise: (value: WorkoutPlan | null) => void;
      const pendingPromise = new Promise<WorkoutPlan | null>((resolve) => {
        resolvePromise = resolve;
      });

      mockedGetWorkoutPlanById.mockReturnValue(pendingPromise);

      const loadPromise = useWorkoutPlanStore.getState().loadPlan('plan-1');

      expect(useWorkoutPlanStore.getState().isLoading).toBe(true);

      resolvePromise!(createTestWorkoutPlan());
      await loadPromise;
    });

    it('loads a single workout and sets as selectedPlan', async () => {
      const workout = createTestWorkoutPlan({ id: 'plan-1', name: 'Leg Day' });

      mockedGetWorkoutPlanById.mockResolvedValue(workout);

      await useWorkoutPlanStore.getState().loadPlan('plan-1');

      const { selectedPlan, isLoading, error } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(selectedPlan).toEqual(workout);
      expect(mockedGetWorkoutPlanById).toHaveBeenCalledWith('plan-1');
    });

    it('handles workout not found (null)', async () => {
      mockedGetWorkoutPlanById.mockResolvedValue(null);

      await useWorkoutPlanStore.getState().loadPlan('non-existent');

      const { selectedPlan, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(selectedPlan).toBeNull();
    });

    it('handles errors', async () => {
      const error = new Error('Database error');
      mockedGetWorkoutPlanById.mockRejectedValue(error);

      await useWorkoutPlanStore.getState().loadPlan('plan-1');

      const { error: storeError, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Database error');
    });

    it('handles non-Error thrown values', async () => {
      mockedGetWorkoutPlanById.mockRejectedValue('string error');

      await useWorkoutPlanStore.getState().loadPlan('plan-1');

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBe('Failed to load workout plan');
    });
  });

  // ==========================================================================
  // savePlan Tests
  // ==========================================================================

  describe('savePlan', () => {
    it('creates a new workout when it does not exist', async () => {
      const newWorkout = createTestWorkoutPlan({ id: 'new-template', name: 'New Workout' });

      mockedGetWorkoutPlanById.mockResolvedValue(null);
      mockedCreateWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([newWorkout]);

      await useWorkoutPlanStore.getState().savePlan(newWorkout);

      expect(mockedGetWorkoutPlanById).toHaveBeenCalledWith('new-template');
      expect(mockedCreateWorkoutPlan).toHaveBeenCalledWith(newWorkout);
      expect(mockedUpdateWorkoutPlan).not.toHaveBeenCalled();
    });

    it('updates an existing workout', async () => {
      const existingWorkout = createTestWorkoutPlan({ id: 'existing-template', name: 'Existing Workout' });
      const updatedWorkout = { ...existingWorkout, name: 'Updated Workout' };

      mockedGetWorkoutPlanById.mockResolvedValue(existingWorkout);
      mockedUpdateWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([updatedWorkout]);

      await useWorkoutPlanStore.getState().savePlan(updatedWorkout);

      expect(mockedGetWorkoutPlanById).toHaveBeenCalledWith('existing-template');
      expect(mockedUpdateWorkoutPlan).toHaveBeenCalledWith(updatedWorkout);
      expect(mockedCreateWorkoutPlan).not.toHaveBeenCalled();
    });

    it('reloads plans after saving', async () => {
      const workout = createTestWorkoutPlan();
      const allWorkouts = [workout, createTestWorkoutPlan({ id: 'plan-2' })];

      mockedGetWorkoutPlanById.mockResolvedValue(null);
      mockedCreateWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue(allWorkouts);

      await useWorkoutPlanStore.getState().savePlan(workout);

      const { plans } = useWorkoutPlanStore.getState();

      expect(mockedGetAllWorkoutPlans).toHaveBeenCalled();
      expect(plans).toHaveLength(2);
    });

    it('handles save errors', async () => {
      const workout = createTestWorkoutPlan();
      const error = new Error('Failed to save');

      mockedGetWorkoutPlanById.mockResolvedValue(null);
      mockedCreateWorkoutPlan.mockRejectedValue(error);

      await useWorkoutPlanStore.getState().savePlan(workout);

      const { error: storeError, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Failed to save');
    });

    it('handles non-Error thrown values', async () => {
      const workout = createTestWorkoutPlan();

      mockedGetWorkoutPlanById.mockResolvedValue(null);
      mockedCreateWorkoutPlan.mockRejectedValue('string error');

      await useWorkoutPlanStore.getState().savePlan(workout);

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBe('Failed to save workout plan');
    });
  });

  // ==========================================================================
  // removePlan Tests
  // ==========================================================================

  describe('removePlan', () => {
    it('deletes workout and reloads list', async () => {
      mockedDeleteWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([]);

      await useWorkoutPlanStore.getState().removePlan('template-to-delete');

      expect(mockedDeleteWorkoutPlan).toHaveBeenCalledWith('template-to-delete');
      expect(mockedGetAllWorkoutPlans).toHaveBeenCalled();
    });

    it('clears selectedPlan after deletion', async () => {
      useWorkoutPlanStore.setState({ selectedPlan: createTestWorkoutPlan({ id: 'plan-1' }) });

      mockedDeleteWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([]);

      await useWorkoutPlanStore.getState().removePlan('plan-1');

      const { selectedPlan } = useWorkoutPlanStore.getState();

      expect(selectedPlan).toBeNull();
    });

    it('handles delete errors', async () => {
      const error = new Error('Delete failed');
      mockedDeleteWorkoutPlan.mockRejectedValue(error);

      await useWorkoutPlanStore.getState().removePlan('plan-1');

      const { error: storeError, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Delete failed');
    });

    it('handles non-Error thrown values', async () => {
      mockedDeleteWorkoutPlan.mockRejectedValue('string error');

      await useWorkoutPlanStore.getState().removePlan('plan-1');

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBe('Failed to delete workout plan');
    });
  });

  // ==========================================================================
  // reprocessPlan Tests
  // ==========================================================================

  describe('reprocessPlan', () => {
    it('returns error when workout not found', async () => {
      mockedGetWorkoutPlanById.mockResolvedValue(null);

      const result = await useWorkoutPlanStore.getState().reprocessPlan('non-existent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Workout plan not found');
    });

    it('returns error when no source markdown', async () => {
      const workout = createTestWorkoutPlan({ id: 'plan-1', sourceMarkdown: undefined });
      mockedGetWorkoutPlanById.mockResolvedValue(workout);

      const result = await useWorkoutPlanStore.getState().reprocessPlan('plan-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No source markdown stored for this workout plan');
    });

    it('returns error when parse fails', async () => {
      const workout = createTestWorkoutPlan({ id: 'plan-1', sourceMarkdown: '# Invalid' });
      mockedGetWorkoutPlanById.mockResolvedValue(workout);
      mockedParseWorkout.mockReturnValue({
        success: false,
        errors: ['Parse error: invalid format'],
      });

      const result = await useWorkoutPlanStore.getState().reprocessPlan('plan-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Parse error: invalid format');
    });

    it('successfully reprocesses workout', async () => {
      const existingWorkout = createTestWorkoutPlan({
        id: 'plan-1',
        name: 'Old Name',
        sourceMarkdown: '# Push Day\n- Bench Press: 3x10',
        createdAt: '2024-01-10T10:00:00Z',
      });

      const parsedWorkout = createTestWorkoutPlan({
        id: 'parsed-id',
        name: 'Push Day',
        exercises: [
          {
            id: 'exercise-1',
            workoutPlanId: 'parsed-id',
            exerciseName: 'Bench Press',
            orderIndex: 0,
            sets: [],
          },
        ],
      });

      mockedGetWorkoutPlanById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({
        success: true,
        data: parsedWorkout,
      });
      mockedUpdateWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([parsedWorkout]);

      const result = await useWorkoutPlanStore.getState().reprocessPlan('plan-1');

      expect(result.success).toBe(true);
      expect(mockedUpdateWorkoutPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'plan-1', // Preserves original ID
          createdAt: '2024-01-10T10:00:00Z', // Preserves original createdAt
          name: 'Push Day',
        })
      );
    });

    it('updates exercise workoutPlanId to match original workout', async () => {
      const existingWorkout = createTestWorkoutPlan({
        id: 'original-id',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutPlan({
        id: 'new-id',
        exercises: [
          {
            id: 'exercise-1',
            workoutPlanId: 'new-id',
            exerciseName: 'Squat',
            orderIndex: 0,
            sets: [],
          },
        ],
      });

      mockedGetWorkoutPlanById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([]);

      await useWorkoutPlanStore.getState().reprocessPlan('original-id');

      expect(mockedUpdateWorkoutPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: expect.arrayContaining([
            expect.objectContaining({
              workoutPlanId: 'original-id',
            }),
          ]),
        })
      );
    });

    it('updates selectedPlan after reprocessing', async () => {
      const existingWorkout = createTestWorkoutPlan({
        id: 'plan-1',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutPlan({ id: 'plan-1', name: 'Updated' });

      mockedGetWorkoutPlanById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutPlan.mockResolvedValue(undefined);
      mockedGetAllWorkoutPlans.mockResolvedValue([parsedWorkout]);

      await useWorkoutPlanStore.getState().reprocessPlan('plan-1');

      const { selectedPlan } = useWorkoutPlanStore.getState();

      expect(selectedPlan).not.toBeNull();
      expect(selectedPlan?.name).toBe('Updated');
    });

    it('handles reprocess errors', async () => {
      const existingWorkout = createTestWorkoutPlan({
        id: 'plan-1',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutPlan({ id: 'plan-1' });
      const error = new Error('Update failed');

      mockedGetWorkoutPlanById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutPlan.mockRejectedValue(error);

      const result = await useWorkoutPlanStore.getState().reprocessPlan('plan-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Update failed');

      const { error: storeError } = useWorkoutPlanStore.getState();
      expect(storeError).toBe('Update failed');
    });

    it('handles non-Error thrown values', async () => {
      const existingWorkout = createTestWorkoutPlan({
        id: 'plan-1',
        sourceMarkdown: '# Workout',
      });

      const parsedWorkout = createTestWorkoutPlan({ id: 'plan-1' });

      mockedGetWorkoutPlanById.mockResolvedValue(existingWorkout);
      mockedParseWorkout.mockReturnValue({ success: true, data: parsedWorkout });
      mockedUpdateWorkoutPlan.mockRejectedValue('string error');

      const result = await useWorkoutPlanStore.getState().reprocessPlan('plan-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown error');
    });
  });

  // ==========================================================================
  // searchPlans Tests
  // ==========================================================================

  describe('searchPlans', () => {
    it('searches plans with query', async () => {
      const plans = [createTestWorkoutPlan({ name: 'Push Day' })];
      mockedSearchWorkoutPlans.mockResolvedValue(plans);

      await useWorkoutPlanStore.getState().searchPlans('push');

      expect(mockedSearchWorkoutPlans).toHaveBeenCalledWith('push');

      const { plans: results } = useWorkoutPlanStore.getState();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Push Day');
    });

    it('loads all plans when query is empty', async () => {
      const plans = [
        createTestWorkoutPlan({ id: '1', name: 'Push' }),
        createTestWorkoutPlan({ id: '2', name: 'Pull' }),
      ];
      mockedGetAllWorkoutPlans.mockResolvedValue(plans);

      await useWorkoutPlanStore.getState().searchPlans('');

      expect(mockedGetAllWorkoutPlans).toHaveBeenCalled();
      expect(mockedSearchWorkoutPlans).not.toHaveBeenCalled();

      const { plans: results } = useWorkoutPlanStore.getState();
      expect(results).toHaveLength(2);
    });

    it('handles search errors', async () => {
      const error = new Error('Search failed');
      mockedSearchWorkoutPlans.mockRejectedValue(error);

      await useWorkoutPlanStore.getState().searchPlans('query');

      const { error: storeError, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Search failed');
    });

    it('handles non-Error thrown values', async () => {
      mockedSearchWorkoutPlans.mockRejectedValue('string error');

      await useWorkoutPlanStore.getState().searchPlans('query');

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBe('Failed to search workout plans');
    });
  });

  // ==========================================================================
  // filterByTag Tests
  // ==========================================================================

  describe('filterByTag', () => {
    it('filters plans by tag', async () => {
      const plans = [createTestWorkoutPlan({ tags: ['strength'] })];
      mockedGetWorkoutPlansByTag.mockResolvedValue(plans);

      await useWorkoutPlanStore.getState().filterByTag('strength');

      expect(mockedGetWorkoutPlansByTag).toHaveBeenCalledWith('strength');

      const { plans: results } = useWorkoutPlanStore.getState();
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('strength');
    });

    it('handles filter errors', async () => {
      const error = new Error('Filter failed');
      mockedGetWorkoutPlansByTag.mockRejectedValue(error);

      await useWorkoutPlanStore.getState().filterByTag('tag');

      const { error: storeError, isLoading } = useWorkoutPlanStore.getState();

      expect(isLoading).toBe(false);
      expect(storeError).toBe('Filter failed');
    });

    it('handles non-Error thrown values', async () => {
      mockedGetWorkoutPlansByTag.mockRejectedValue('string error');

      await useWorkoutPlanStore.getState().filterByTag('tag');

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBe('Failed to filter workout plans');
    });
  });

  // ==========================================================================
  // setSelectedPlan Tests
  // ==========================================================================

  describe('setSelectedPlan', () => {
    it('sets selectedPlan', () => {
      const workout = createTestWorkoutPlan({ id: 'plan-1', name: 'Selected Workout' });

      useWorkoutPlanStore.getState().setSelectedPlan(workout);

      const { selectedPlan } = useWorkoutPlanStore.getState();

      expect(selectedPlan).toEqual(workout);
    });

    it('clears selectedPlan when passed null', () => {
      useWorkoutPlanStore.setState({ selectedPlan: createTestWorkoutPlan() });

      useWorkoutPlanStore.getState().setSelectedPlan(null);

      const { selectedPlan } = useWorkoutPlanStore.getState();

      expect(selectedPlan).toBeNull();
    });
  });

  // ==========================================================================
  // clearError Tests
  // ==========================================================================

  describe('clearError', () => {
    it('clears the error state', () => {
      useWorkoutPlanStore.setState({ error: 'Some error' });

      useWorkoutPlanStore.getState().clearError();

      const { error } = useWorkoutPlanStore.getState();

      expect(error).toBeNull();
    });

    it('does nothing when error is already null', () => {
      expect(useWorkoutPlanStore.getState().error).toBeNull();

      useWorkoutPlanStore.getState().clearError();

      expect(useWorkoutPlanStore.getState().error).toBeNull();
    });
  });
});
