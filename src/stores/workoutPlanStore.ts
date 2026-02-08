import { create } from 'zustand';
import type { WorkoutPlan } from '@/types';
import {
  getAllWorkoutPlans,
  getWorkoutPlanById,
  createWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  searchWorkoutPlans,
  getWorkoutPlansByTag,
} from '@/db/repository';
import { parseWorkout } from '@/services/MarkdownParser';

interface WorkoutPlanStore {
  // State
  plans: WorkoutPlan[];
  selectedPlan: WorkoutPlan | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPlans: () => Promise<void>;
  loadPlan: (id: string) => Promise<void>;
  savePlan: (plan: WorkoutPlan) => Promise<void>;
  removePlan: (id: string) => Promise<void>;
  reprocessPlan: (id: string) => Promise<{ success: boolean; errors?: string[] }>;
  searchPlans: (query: string) => Promise<void>;
  filterByTag: (tag: string) => Promise<void>;
  setSelectedPlan: (plan: WorkoutPlan | null) => void;
  clearError: () => void;
}

export const useWorkoutPlanStore = create<WorkoutPlanStore>((set) => ({
  // Initial state
  plans: [],
  selectedPlan: null,
  isLoading: false,
  error: null,

  // Load all plans
  loadPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const plans = await getAllWorkoutPlans();
      set({ plans, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workout plans',
        isLoading: false,
      });
    }
  },

  // Load a single plan by ID
  loadPlan: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const plan = await getWorkoutPlanById(id);
      set({ selectedPlan: plan, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workout plan',
        isLoading: false,
      });
    }
  },

  // Save a plan (create or update)
  savePlan: async (plan: WorkoutPlan) => {
    set({ isLoading: true, error: null });
    try {
      // Check if plan exists
      const existing = await getWorkoutPlanById(plan.id);

      if (existing) {
        await updateWorkoutPlan(plan);
      } else {
        await createWorkoutPlan(plan);
      }

      // Reload plans to get updated list
      const plans = await getAllWorkoutPlans();
      set({ plans, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save workout plan',
        isLoading: false,
      });
    }
  },

  // Remove a plan
  removePlan: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteWorkoutPlan(id);

      // Reload plans to get updated list
      const plans = await getAllWorkoutPlans();
      set({
        plans,
        selectedPlan: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete workout plan',
        isLoading: false,
      });
    }
  },

  // Reprocess a plan from its stored markdown
  reprocessPlan: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get the existing plan
      const existing = await getWorkoutPlanById(id);
      if (!existing) {
        set({ isLoading: false });
        return { success: false, errors: ['Workout plan not found'] };
      }

      if (!existing.sourceMarkdown) {
        set({ isLoading: false });
        return { success: false, errors: ['No source markdown stored for this workout plan'] };
      }

      // Re-parse the markdown
      const result = parseWorkout(existing.sourceMarkdown);
      if (!result.success || !result.data) {
        set({ isLoading: false });
        return { success: false, errors: result.errors };
      }

      // Preserve original ID and createdAt, update the rest
      // Also update all exercises to reference the original plan ID
      const updatedExercises = result.data.exercises.map((exercise) => ({
        ...exercise,
        workoutPlanId: existing.id,
      }));

      const updatedPlan: WorkoutPlan = {
        ...result.data,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        exercises: updatedExercises,
      };

      // Save the updated plan
      await updateWorkoutPlan(updatedPlan);

      // Reload plans and update selected
      const plans = await getAllWorkoutPlans();
      set({
        plans,
        selectedPlan: updatedPlan,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reprocess workout plan',
        isLoading: false,
      });
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  },

  // Search plans by name or tags
  searchPlans: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const plans = query
        ? await searchWorkoutPlans(query)
        : await getAllWorkoutPlans();
      set({ plans, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to search workout plans',
        isLoading: false,
      });
    }
  },

  // Filter plans by tag
  filterByTag: async (tag: string) => {
    set({ isLoading: true, error: null });
    try {
      const plans = await getWorkoutPlansByTag(tag);
      set({ plans, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to filter workout plans',
        isLoading: false,
      });
    }
  },

  // Set selected plan (for navigation)
  setSelectedPlan: (plan: WorkoutPlan | null) => {
    set({ selectedPlan: plan });
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },
}));

// Legacy export for backward compatibility (will be removed)
/** @deprecated Use useWorkoutPlanStore instead */
export const useWorkoutStore = useWorkoutPlanStore;
