import { useSettingsStore } from '../stores/settingsStore';
import type { UserSettings } from '@/types';

// Mock the database module
jest.mock('@/db/index', () => ({
  getDatabase: jest.fn(),
}));

// Mock the secure storage module
jest.mock('@/services/secureStorage', () => ({
  getApiKey: jest.fn(),
  storeApiKey: jest.fn(),
  removeApiKey: jest.fn(),
}));

// Mock the anthropicService module
jest.mock('@/services/anthropicService', () => ({
  anthropicService: {
    verifyApiKey: jest.fn(),
  },
}));

import { getDatabase } from '@/db/index';
import { getApiKey, storeApiKey, removeApiKey } from '@/services/secureStorage';
import { anthropicService } from '@/services/anthropicService';

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockedGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;
const mockedStoreApiKey = storeApiKey as jest.MockedFunction<typeof storeApiKey>;
const mockedRemoveApiKey = removeApiKey as jest.MockedFunction<typeof removeApiKey>;
const mockedVerifyApiKey = anthropicService.verifyApiKey as jest.MockedFunction<typeof anthropicService.verifyApiKey>;

// ============================================================================
// Mock Database Setup
// ============================================================================

interface MockDatabase {
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
  execAsync: jest.Mock;
}

function createMockDatabase(): MockDatabase {
  return {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

// ============================================================================
// Helper Factory Functions
// ============================================================================

function createSettingsRow(overrides: Partial<{
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
  keep_screen_awake: number;
  live_activities_enabled: number;
  show_open_in_claude_button: number;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    id: 'settings-1',
    default_weight_unit: 'lbs',
    enable_workout_timer: 1,
    auto_start_rest_timer: 1,
    theme: 'auto',
    notifications_enabled: 1,
    custom_prompt_addition: null,
    anthropic_api_key: null,
    anthropic_api_key_status: 'not_set',
    healthkit_enabled: 0,
    keep_screen_awake: 0,
    live_activities_enabled: 1,
    show_open_in_claude_button: 0,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('settingsStore', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
    mockedGetApiKey.mockResolvedValue(null);
    mockedStoreApiKey.mockResolvedValue(undefined);
    mockedRemoveApiKey.mockResolvedValue(undefined);
    mockedVerifyApiKey.mockResolvedValue({ valid: true });

    // Reset the store state before each test
    useSettingsStore.setState({
      settings: null,
      isLoading: false,
      error: null,
    });
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('has null settings initially', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings).toBeNull();
    });

    it('is not loading initially', () => {
      const { isLoading } = useSettingsStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has no error initially', () => {
      const { error } = useSettingsStore.getState();
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadSettings Tests
  // ==========================================================================

  describe('loadSettings', () => {
    it('sets isLoading to true while loading', async () => {
      const settingsRow = createSettingsRow();
      let resolvePromise: (value: typeof settingsRow | null) => void;
      const pendingPromise = new Promise<typeof settingsRow | null>((resolve) => {
        resolvePromise = resolve;
      });

      mockDb.getFirstAsync.mockReturnValue(pendingPromise);

      const loadPromise = useSettingsStore.getState().loadSettings();

      // Check loading state immediately
      expect(useSettingsStore.getState().isLoading).toBe(true);

      // Resolve and wait for completion
      resolvePromise!(settingsRow);
      await loadPromise;
    });

    it('loads settings from database and converts to proper types', async () => {
      const settingsRow = createSettingsRow({
        default_weight_unit: 'kg',
        enable_workout_timer: 0,
        auto_start_rest_timer: 0,
        theme: 'dark',
        notifications_enabled: 0,
        custom_prompt_addition: 'Custom AI prompt',
        healthkit_enabled: 1,
      });

      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      const { settings, isLoading, error } = useSettingsStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(settings).toEqual({
        id: 'settings-1',
        defaultWeightUnit: 'kg',
        enableWorkoutTimer: false,
        autoStartRestTimer: false,
        theme: 'dark',
        notificationsEnabled: false,
        customPromptAddition: 'Custom AI prompt',
        anthropicApiKey: undefined,
        anthropicApiKeyStatus: 'not_set',
        healthKitEnabled: true,
        keepScreenAwake: false,
        liveActivitiesEnabled: true,
        showOpenInClaudeButton: false,
        homeTiles: ['Squat', 'Deadlift', 'Bench Press', 'Overhead Press'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      });
    });

    it('converts boolean integers (1/0) to booleans', async () => {
      const settingsRow = createSettingsRow({
        enable_workout_timer: 1,
        auto_start_rest_timer: 0,
        notifications_enabled: 1,
        healthkit_enabled: 0,
      });

      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      const { settings } = useSettingsStore.getState();

      expect(settings?.enableWorkoutTimer).toBe(true);
      expect(settings?.autoStartRestTimer).toBe(false);
      expect(settings?.notificationsEnabled).toBe(true);
      expect(settings?.healthKitEnabled).toBe(false);
    });

    it('handles null custom_prompt_addition by converting to undefined', async () => {
      const settingsRow = createSettingsRow({ custom_prompt_addition: null });

      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      const { settings } = useSettingsStore.getState();

      expect(settings?.customPromptAddition).toBeUndefined();
    });

    it('handles no settings in database', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      // Suppress console.warn for this test
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await useSettingsStore.getState().loadSettings();

      const { settings, isLoading, error } = useSettingsStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(settings).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('No settings found in database, using defaults');

      warnSpy.mockRestore();
    });

    it('handles database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.getFirstAsync.mockRejectedValue(dbError);

      // Suppress console.error for this test
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useSettingsStore.getState().loadSettings();

      const { settings, isLoading, error } = useSettingsStore.getState();

      expect(isLoading).toBe(false);
      expect(settings).toBeNull();
      expect(error).toBe('Database connection failed');
      expect(errorSpy).toHaveBeenCalledWith('Failed to load settings:', dbError);

      errorSpy.mockRestore();
    });

    it('handles non-Error thrown values', async () => {
      mockDb.getFirstAsync.mockRejectedValue('string error');

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useSettingsStore.getState().loadSettings();

      const { error } = useSettingsStore.getState();

      expect(error).toBe('Failed to load settings');

      errorSpy.mockRestore();
    });

    it('clears previous error when loading', async () => {
      // Set an initial error state
      useSettingsStore.setState({ error: 'Previous error' });

      mockDb.getFirstAsync.mockResolvedValue(createSettingsRow());

      await useSettingsStore.getState().loadSettings();

      const { error } = useSettingsStore.getState();

      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // updateSettings Tests
  // ==========================================================================

  describe('updateSettings', () => {
    it('throws error when settings not loaded', async () => {
      // Settings are null initially
      await useSettingsStore.getState().updateSettings({ theme: 'dark' });

      const { error, isLoading } = useSettingsStore.getState();

      expect(error).toBe('Settings not loaded');
      expect(isLoading).toBe(false);
    });

    it('updates defaultWeightUnit', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      // First load settings
      await useSettingsStore.getState().loadSettings();

      // Then update
      await useSettingsStore.getState().updateSettings({ defaultWeightUnit: 'kg' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_settings SET'),
        expect.arrayContaining(['kg'])
      );
    });

    it('updates enableWorkoutTimer with boolean to integer conversion', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ enableWorkoutTimer: false });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('enable_workout_timer'),
        expect.arrayContaining([0])
      );
    });

    it('updates autoStartRestTimer with boolean to integer conversion', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ autoStartRestTimer: true });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('auto_start_rest_timer'),
        expect.arrayContaining([1])
      );
    });

    it('updates theme', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ theme: 'light' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('theme'),
        expect.arrayContaining(['light'])
      );
    });

    it('updates notificationsEnabled', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ notificationsEnabled: false });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('notifications_enabled'),
        expect.arrayContaining([0])
      );
    });

    it('updates customPromptAddition', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ customPromptAddition: 'New prompt' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('custom_prompt_addition'),
        expect.arrayContaining(['New prompt'])
      );
    });

    it('converts empty customPromptAddition to null', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ customPromptAddition: '' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('custom_prompt_addition'),
        expect.arrayContaining([null])
      );
    });

    it('updates healthKitEnabled', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ healthKitEnabled: true });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('healthkit_enabled'),
        expect.arrayContaining([1])
      );
    });

    it('always includes updated_at in the update', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ theme: 'dark' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('updated_at'),
        expect.any(Array)
      );
    });

    it('reloads settings after successful update', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      // Clear mock to track new calls
      mockDb.getFirstAsync.mockClear();

      const updatedRow = createSettingsRow({ theme: 'dark' });
      mockDb.getFirstAsync.mockResolvedValue(updatedRow);

      await useSettingsStore.getState().updateSettings({ theme: 'dark' });

      // Should have called getFirstAsync again to reload settings
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('handles update errors', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      const updateError = new Error('Update failed');
      mockDb.runAsync.mockRejectedValue(updateError);

      await useSettingsStore.getState().updateSettings({ theme: 'dark' });

      const { error, isLoading } = useSettingsStore.getState();

      expect(error).toBe('Update failed');
      expect(isLoading).toBe(false);
    });

    it('handles non-Error thrown values during update', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      mockDb.runAsync.mockRejectedValue('string error');

      await useSettingsStore.getState().updateSettings({ theme: 'dark' });

      const { error } = useSettingsStore.getState();

      expect(error).toBe('Failed to update settings');
    });

    it('stores valid API key in secure storage and sets status to verified', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);
      mockedVerifyApiKey.mockResolvedValue({ valid: true });

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ anthropicApiKey: 'sk-ant-valid-key' });

      // Verify API key was stored
      expect(mockedStoreApiKey).toHaveBeenCalledWith('sk-ant-valid-key');

      // Verify status was set to verified in database
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('anthropic_api_key_status'),
        expect.arrayContaining(['verified'])
      );

      // Verify actual API key is not stored in database (always null)
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('anthropic_api_key'),
        expect.arrayContaining([null])
      );
    });

    it('stores invalid API key in secure storage and sets status to invalid', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);
      mockedVerifyApiKey.mockResolvedValue({ valid: false });

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ anthropicApiKey: 'sk-ant-invalid-key' });

      // Verify API key was still stored (even though invalid)
      expect(mockedStoreApiKey).toHaveBeenCalledWith('sk-ant-invalid-key');

      // Verify status was set to invalid in database
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('anthropic_api_key_status'),
        expect.arrayContaining(['invalid'])
      );
    });

    it('removes API key from secure storage when set to undefined', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ anthropicApiKey: undefined });

      // Verify removeApiKey was called
      expect(mockedRemoveApiKey).toHaveBeenCalled();

      // Verify status was set to not_set in database
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('anthropic_api_key_status'),
        expect.arrayContaining(['not_set'])
      );

      // Verify actual API key is set to null in database
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('anthropic_api_key'),
        expect.arrayContaining([null])
      );
    });

    it('removes API key from secure storage when set to empty string', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();
      await useSettingsStore.getState().updateSettings({ anthropicApiKey: '' });

      // Verify removeApiKey was called (empty string is falsy)
      expect(mockedRemoveApiKey).toHaveBeenCalled();

      // Verify status was set to not_set in database
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('anthropic_api_key_status'),
        expect.arrayContaining(['not_set'])
      );
    });

    it('loads API key from secure storage on loadSettings', async () => {
      const settingsRow = createSettingsRow({ anthropic_api_key_status: 'verified' });
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);
      mockedGetApiKey.mockResolvedValue('sk-ant-stored-key');

      await useSettingsStore.getState().loadSettings();

      const { settings } = useSettingsStore.getState();

      // Verify API key was loaded from secure storage
      expect(mockedGetApiKey).toHaveBeenCalled();
      expect(settings?.anthropicApiKey).toBe('sk-ant-stored-key');
      expect(settings?.anthropicApiKeyStatus).toBe('verified');
    });

    it('updates multiple fields at once', async () => {
      const settingsRow = createSettingsRow();
      mockDb.getFirstAsync.mockResolvedValue(settingsRow);

      await useSettingsStore.getState().loadSettings();

      await useSettingsStore.getState().updateSettings({
        theme: 'dark',
        defaultWeightUnit: 'kg',
        enableWorkoutTimer: false,
      });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('theme'),
        expect.any(Array)
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('default_weight_unit'),
        expect.any(Array)
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('enable_workout_timer'),
        expect.any(Array)
      );
    });
  });

  // ==========================================================================
  // clearError Tests
  // ==========================================================================

  describe('clearError', () => {
    it('clears the error state', () => {
      // Set an error state
      useSettingsStore.setState({ error: 'Some error' });

      useSettingsStore.getState().clearError();

      const { error } = useSettingsStore.getState();

      expect(error).toBeNull();
    });

    it('does nothing when error is already null', () => {
      // Error is already null
      expect(useSettingsStore.getState().error).toBeNull();

      useSettingsStore.getState().clearError();

      expect(useSettingsStore.getState().error).toBeNull();
    });
  });
});
