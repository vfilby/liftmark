import { create } from 'zustand';
import type { Gym, GymRow } from '@/types';
import { getDatabase } from '@/db';
import { generateId } from '@/utils/id';

interface GymStore {
  // State
  gyms: Gym[];
  defaultGym: Gym | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadGyms: () => Promise<void>;
  addGym: (name: string, setAsDefault?: boolean) => Promise<Gym>;
  updateGym: (id: string, updates: Partial<Pick<Gym, 'name'>>) => Promise<void>;
  setDefaultGym: (id: string) => Promise<void>;
  removeGym: (id: string) => Promise<void>;
  getDefaultGym: () => Gym | null;
  clearError: () => void;
}

export const useGymStore = create<GymStore>((set, get) => ({
  // Initial state
  gyms: [],
  defaultGym: null,
  isLoading: false,
  error: null,

  // Load all gyms
  loadGyms: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<GymRow>(
        'SELECT * FROM gyms ORDER BY name ASC'
      );

      const gyms: Gym[] = rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: row.is_default === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const defaultGym = gyms.find(g => g.isDefault) ?? null;

      set({ gyms, defaultGym, isLoading: false });
    } catch (error) {
      console.error('Failed to load gyms:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load gyms',
        isLoading: false,
      });
    }
  },

  // Add new gym
  addGym: async (name: string, setAsDefault: boolean = false) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const id = generateId();

      // If setting as default, unset other defaults first
      if (setAsDefault) {
        await db.runAsync('UPDATE gyms SET is_default = 0');
      }

      await db.runAsync(
        `INSERT INTO gyms (id, name, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, name.trim(), setAsDefault ? 1 : 0, now, now]
      );

      const newGym: Gym = {
        id,
        name: name.trim(),
        isDefault: setAsDefault,
        createdAt: now,
        updatedAt: now,
      };

      // Reload gyms list
      await get().loadGyms();

      return newGym;
    } catch (error) {
      console.error('Failed to add gym:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add gym',
        isLoading: false,
      });
      throw error;
    }
  },

  // Update gym details
  updateGym: async (id: string, updates: Partial<Pick<Gym, 'name'>>) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      if (updates.name !== undefined) {
        await db.runAsync(
          `UPDATE gyms SET name = ?, updated_at = ? WHERE id = ?`,
          [updates.name.trim(), now, id]
        );
      }

      // Update state locally
      set(state => ({
        gyms: state.gyms.map(gym =>
          gym.id === id
            ? { ...gym, ...updates, updatedAt: now }
            : gym
        ),
        defaultGym: state.defaultGym?.id === id
          ? { ...state.defaultGym, ...updates, updatedAt: now }
          : state.defaultGym,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to update gym:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update gym',
        isLoading: false,
      });
    }
  },

  // Set default gym
  setDefaultGym: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      // Unset all defaults, then set the new default
      await db.runAsync('UPDATE gyms SET is_default = 0');
      await db.runAsync(
        `UPDATE gyms SET is_default = 1, updated_at = ? WHERE id = ?`,
        [now, id]
      );

      // Update state locally
      set(state => {
        const updatedGyms = state.gyms.map(gym => ({
          ...gym,
          isDefault: gym.id === id,
          updatedAt: gym.id === id ? now : gym.updatedAt,
        }));
        return {
          gyms: updatedGyms,
          defaultGym: updatedGyms.find(g => g.id === id) ?? null,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to set default gym:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to set default gym',
        isLoading: false,
      });
    }
  },

  // Remove gym
  removeGym: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const { gyms, defaultGym } = get();

      // Check if this is the last gym
      if (gyms.length === 1) {
        throw new Error('Cannot delete the last gym');
      }

      // Delete the gym (cascade will delete associated equipment)
      await db.runAsync('DELETE FROM gym_equipment WHERE gym_id = ?', [id]);
      await db.runAsync('DELETE FROM gyms WHERE id = ?', [id]);

      // If we deleted the default gym, set a new default
      if (defaultGym?.id === id) {
        const remainingGyms = gyms.filter(g => g.id !== id);
        if (remainingGyms.length > 0) {
          await db.runAsync(
            `UPDATE gyms SET is_default = 1 WHERE id = ?`,
            [remainingGyms[0].id]
          );
        }
      }

      // Reload gyms
      await get().loadGyms();
    } catch (error) {
      console.error('Failed to remove gym:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to remove gym',
        isLoading: false,
      });
    }
  },

  // Get the current default gym
  getDefaultGym: () => {
    return get().defaultGym;
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },
}));
