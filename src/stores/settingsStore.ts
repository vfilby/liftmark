import { create } from 'zustand';
import type { UserSettings } from '@/types';
import { getDatabase } from '@/db';
import { getApiKey, storeApiKey, removeApiKey } from '@/services/secureStorage';
import { anthropicService } from '@/services/anthropicService';

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
        custom_prompt_addition: string | null;
        anthropic_api_key: string | null;
        anthropic_api_key_status: string | null;
        healthkit_enabled: number;
        live_activities_enabled: number;
        keep_screen_awake: number;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM user_settings LIMIT 1');

      if (row) {
        // Load API key from secure storage instead of database
        const secureApiKey = await getApiKey();

        const settings: UserSettings = {
          id: row.id,
          defaultWeightUnit: row.default_weight_unit as 'lbs' | 'kg',
          enableWorkoutTimer: row.enable_workout_timer === 1,
          autoStartRestTimer: row.auto_start_rest_timer === 1,
          theme: row.theme as 'light' | 'dark' | 'auto',
          notificationsEnabled: row.notifications_enabled === 1,
          customPromptAddition: row.custom_prompt_addition ?? undefined,
          anthropicApiKey: secureApiKey ?? undefined,
          anthropicApiKeyStatus:
            (row.anthropic_api_key_status as 'verified' | 'invalid' | 'not_set') ?? 'not_set',
          healthKitEnabled: row.healthkit_enabled === 1,
          liveActivitiesEnabled: row.live_activities_enabled === 1,
          keepScreenAwake: row.keep_screen_awake === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        set({ settings, isLoading: false });
      } else {
        console.warn('No settings found in database, using defaults');
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
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
      if (updates.customPromptAddition !== undefined) {
        updateFields.push('custom_prompt_addition = ?');
        values.push(updates.customPromptAddition || null);
      }
      if (updates.healthKitEnabled !== undefined) {
        updateFields.push('healthkit_enabled = ?');
        values.push(updates.healthKitEnabled ? 1 : 0);
      }
      if (updates.liveActivitiesEnabled !== undefined) {
        updateFields.push('live_activities_enabled = ?');
        values.push(updates.liveActivitiesEnabled ? 1 : 0);
      }
      if (updates.keepScreenAwake !== undefined) {
        updateFields.push('keep_screen_awake = ?');
        values.push(updates.keepScreenAwake ? 1 : 0);
      }

      // Handle API key separately - store in secure storage, not database
      if (updates.anthropicApiKey !== undefined) {
        let apiKeyStatus: 'verified' | 'invalid' | 'not_set' = 'not_set';

        if (updates.anthropicApiKey) {
          // Verify the API key before storing
          const verification = await anthropicService.verifyApiKey(updates.anthropicApiKey);

          if (verification.valid) {
            // Store in secure storage
            await storeApiKey(updates.anthropicApiKey);
            apiKeyStatus = 'verified';
          } else {
            // Still store it, but mark as invalid
            await storeApiKey(updates.anthropicApiKey);
            apiKeyStatus = 'invalid';
          }
        } else {
          // Remove from secure storage
          await removeApiKey();
          apiKeyStatus = 'not_set';
        }

        // Always set database field to null (we don't store the actual key in DB)
        updateFields.push('anthropic_api_key = ?');
        values.push(null);

        // Update the verification status
        updateFields.push('anthropic_api_key_status = ?');
        values.push(apiKeyStatus);
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
