import { create } from 'zustand';
import type { WorkoutTemplate } from '@/types';
import {
  getAllWorkoutTemplates,
  getWorkoutTemplateById,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
  searchWorkoutTemplates,
  getWorkoutTemplatesByTag,
} from '@/db/repository';
import { parseWorkout } from '@/services/MarkdownParser';

interface WorkoutStore {
  // State
  workouts: WorkoutTemplate[];
  selectedWorkout: WorkoutTemplate | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkouts: () => Promise<void>;
  loadWorkout: (id: string) => Promise<void>;
  saveWorkout: (workout: WorkoutTemplate) => Promise<void>;
  removeWorkout: (id: string) => Promise<void>;
  reprocessWorkout: (id: string) => Promise<{ success: boolean; errors?: string[] }>;
  searchWorkouts: (query: string) => Promise<void>;
  filterByTag: (tag: string) => Promise<void>;
  setSelectedWorkout: (workout: WorkoutTemplate | null) => void;
  clearError: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  // Initial state
  workouts: [],
  selectedWorkout: null,
  isLoading: false,
  error: null,

  // Load all workouts
  loadWorkouts: async () => {
    set({ isLoading: true, error: null });
    try {
      const workouts = await getAllWorkoutTemplates();
      set({ workouts, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workouts',
        isLoading: false,
      });
    }
  },

  // Load a single workout by ID
  loadWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workout = await getWorkoutTemplateById(id);
      set({ selectedWorkout: workout, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workout',
        isLoading: false,
      });
    }
  },

  // Save a workout (create or update)
  saveWorkout: async (workout: WorkoutTemplate) => {
    set({ isLoading: true, error: null });
    try {
      // Check if workout exists
      const existing = await getWorkoutTemplateById(workout.id);

      if (existing) {
        await updateWorkoutTemplate(workout);
      } else {
        await createWorkoutTemplate(workout);
      }

      // Reload workouts to get updated list
      const workouts = await getAllWorkoutTemplates();
      set({ workouts, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save workout',
        isLoading: false,
      });
    }
  },

  // Remove a workout
  removeWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteWorkoutTemplate(id);

      // Reload workouts to get updated list
      const workouts = await getAllWorkoutTemplates();
      set({
        workouts,
        selectedWorkout: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete workout',
        isLoading: false,
      });
    }
  },

  // Reprocess a workout from its stored markdown
  reprocessWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get the existing workout
      const existing = await getWorkoutTemplateById(id);
      if (!existing) {
        set({ isLoading: false });
        return { success: false, errors: ['Workout not found'] };
      }

      if (!existing.sourceMarkdown) {
        set({ isLoading: false });
        return { success: false, errors: ['No source markdown stored for this workout'] };
      }

      // Re-parse the markdown
      const result = parseWorkout(existing.sourceMarkdown);
      if (!result.success || !result.data) {
        set({ isLoading: false });
        return { success: false, errors: result.errors };
      }

      // Preserve original ID and createdAt, update the rest
      // Also update all exercises to reference the original workout ID
      const updatedExercises = result.data.exercises.map((exercise) => ({
        ...exercise,
        workoutTemplateId: existing.id,
      }));

      const updatedWorkout: WorkoutTemplate = {
        ...result.data,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        exercises: updatedExercises,
      };

      // Save the updated workout
      await updateWorkoutTemplate(updatedWorkout);

      // Reload workouts and update selected
      const workouts = await getAllWorkoutTemplates();
      set({
        workouts,
        selectedWorkout: updatedWorkout,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reprocess workout',
        isLoading: false,
      });
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  },

  // Search workouts by name or tags
  searchWorkouts: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const workouts = query
        ? await searchWorkoutTemplates(query)
        : await getAllWorkoutTemplates();
      set({ workouts, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to search workouts',
        isLoading: false,
      });
    }
  },

  // Filter workouts by tag
  filterByTag: async (tag: string) => {
    set({ isLoading: true, error: null });
    try {
      const workouts = await getWorkoutTemplatesByTag(tag);
      set({ workouts, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to filter workouts',
        isLoading: false,
      });
    }
  },

  // Set selected workout (for navigation)
  setSelectedWorkout: (workout: WorkoutTemplate | null) => {
    set({ selectedWorkout: workout });
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },
}));
