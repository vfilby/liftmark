import { create } from 'zustand';
import type { UserSettings } from '@/types';
import { getDatabase } from '@/db';

interface SettingsStore {
  // State
  settings: UserSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Initial state
  settings: null,
  isLoading: false,
  error: null,

  // Load user settings
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{
        id: string;
        default_weight_unit: string;
        enable_workout_timer: number;
        auto_start_rest_timer: number;
        theme: string;
        notifications_enabled: number;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM user_settings LIMIT 1');

      if (row) {
        const settings: UserSettings = {
          id: row.id,
          defaultWeightUnit: row.default_weight_unit as 'lbs' | 'kg',
          enableWorkoutTimer: row.enable_workout_timer === 1,
          autoStartRestTimer: row.auto_start_rest_timer === 1,
          theme: row.theme as 'light' | 'dark' | 'auto',
          notificationsEnabled: row.notifications_enabled === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        set({ settings, isLoading: false });
      } else {
        throw new Error('Settings not found');
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load settings',
        isLoading: false,
      });
    }
  },

  // Update user settings
  updateSettings: async (updates: Partial<UserSettings>) => {
    set({ isLoading: true, error: null });
    try {
      const { settings } = get();
      if (!settings) {
        throw new Error('Settings not loaded');
      }

      const db = await getDatabase();
      const now = new Date().toISOString();

      // Build SQL update dynamically based on provided updates
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.defaultWeightUnit !== undefined) {
        updateFields.push('default_weight_unit = ?');
        values.push(updates.defaultWeightUnit);
      }
      if (updates.enableWorkoutTimer !== undefined) {
        updateFields.push('enable_workout_timer = ?');
        values.push(updates.enableWorkoutTimer ? 1 : 0);
      }
      if (updates.autoStartRestTimer !== undefined) {
        updateFields.push('auto_start_rest_timer = ?');
        values.push(updates.autoStartRestTimer ? 1 : 0);
      }
      if (updates.theme !== undefined) {
        updateFields.push('theme = ?');
        values.push(updates.theme);
      }
      if (updates.notificationsEnabled !== undefined) {
        updateFields.push('notifications_enabled = ?');
        values.push(updates.notificationsEnabled ? 1 : 0);
      }

      // Always update updated_at
      updateFields.push('updated_at = ?');
      values.push(now);

      // Add WHERE clause parameter
      values.push(settings.id);

      await db.runAsync(
        `UPDATE user_settings SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );

      // Reload settings
      await get().loadSettings();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update settings',
        isLoading: false,
      });
    }
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },
}));
