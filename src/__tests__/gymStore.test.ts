import { useGymStore } from '../stores/gymStore';
import type { Gym } from '@/types';

// Mock the database module
jest.mock('@/db/index', () => ({
  getDatabase: jest.fn(),
}));

// Mock the id utility
jest.mock('@/utils/id', () => ({
  generateId: jest.fn(() => 'generated-id'),
}));

import { getDatabase } from '@/db/index';
import { generateId } from '@/utils/id';

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockedGenerateId = generateId as jest.MockedFunction<typeof generateId>;

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

function createGymRow(overrides: Partial<{
  id: string;
  name: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    id: 'gym-1',
    name: 'My Gym',
    is_default: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('gymStore', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);

    // Reset the store state before each test
    useGymStore.setState({
      gyms: [],
      defaultGym: null,
      isLoading: false,
      error: null,
    });
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('has empty gyms array initially', () => {
      const { gyms } = useGymStore.getState();
      expect(gyms).toEqual([]);
    });

    it('has null defaultGym initially', () => {
      const { defaultGym } = useGymStore.getState();
      expect(defaultGym).toBeNull();
    });

    it('is not loading initially', () => {
      const { isLoading } = useGymStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has no error initially', () => {
      const { error } = useGymStore.getState();
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadGyms Tests
  // ==========================================================================

  describe('loadGyms', () => {
    it('sets isLoading to true while loading', async () => {
      const gymRows = [createGymRow()];
      let resolvePromise: (value: typeof gymRows) => void;
      const pendingPromise = new Promise<typeof gymRows>((resolve) => {
        resolvePromise = resolve;
      });

      mockDb.getAllAsync.mockReturnValue(pendingPromise);

      const loadPromise = useGymStore.getState().loadGyms();

      expect(useGymStore.getState().isLoading).toBe(true);

      resolvePromise!(gymRows);
      await loadPromise;
    });

    it('loads gyms from database and converts to proper types', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Home Gym', is_default: 1 }),
        createGymRow({ id: 'gym-2', name: 'Work Gym', is_default: 0 }),
      ];

      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const { gyms, defaultGym, isLoading, error } = useGymStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(gyms).toHaveLength(2);
      expect(gyms[0]).toEqual({
        id: 'gym-1',
        name: 'Home Gym',
        isDefault: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      });
      expect(gyms[1]).toEqual({
        id: 'gym-2',
        name: 'Work Gym',
        isDefault: false,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      });
    });

    it('sets defaultGym to the gym with is_default = 1', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Home Gym', is_default: 0 }),
        createGymRow({ id: 'gym-2', name: 'Work Gym', is_default: 1 }),
      ];

      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const { defaultGym } = useGymStore.getState();

      expect(defaultGym).not.toBeNull();
      expect(defaultGym?.id).toBe('gym-2');
      expect(defaultGym?.name).toBe('Work Gym');
    });

    it('sets defaultGym to null when no default exists', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Home Gym', is_default: 0 }),
      ];

      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const { defaultGym } = useGymStore.getState();

      expect(defaultGym).toBeNull();
    });

    it('handles empty gyms list', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useGymStore.getState().loadGyms();

      const { gyms, defaultGym, isLoading, error } = useGymStore.getState();

      expect(gyms).toEqual([]);
      expect(defaultGym).toBeNull();
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('handles database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.getAllAsync.mockRejectedValue(dbError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useGymStore.getState().loadGyms();

      const { gyms, isLoading, error } = useGymStore.getState();

      expect(isLoading).toBe(false);
      expect(gyms).toEqual([]);
      expect(error).toBe('Database connection failed');
      expect(errorSpy).toHaveBeenCalledWith('Failed to load gyms:', dbError);

      errorSpy.mockRestore();
    });

    it('handles non-Error thrown values', async () => {
      mockDb.getAllAsync.mockRejectedValue('string error');

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useGymStore.getState().loadGyms();

      const { error } = useGymStore.getState();

      expect(error).toBe('Failed to load gyms');

      errorSpy.mockRestore();
    });

    it('clears previous error when loading', async () => {
      useGymStore.setState({ error: 'Previous error' });

      mockDb.getAllAsync.mockResolvedValue([createGymRow()]);

      await useGymStore.getState().loadGyms();

      const { error } = useGymStore.getState();

      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // addGym Tests
  // ==========================================================================

  describe('addGym', () => {
    beforeEach(() => {
      mockedGenerateId.mockReturnValue('new-gym-id');
    });

    it('adds a new gym to the database', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useGymStore.getState().addGym('New Gym');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gyms'),
        expect.arrayContaining(['new-gym-id', 'New Gym', 0])
      );
    });

    it('trims gym name', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useGymStore.getState().addGym('  New Gym  ');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gyms'),
        expect.arrayContaining(['New Gym'])
      );
    });

    it('sets gym as default when setAsDefault is true', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useGymStore.getState().addGym('New Gym', true);

      // Should unset other defaults first
      expect(mockDb.runAsync).toHaveBeenCalledWith('UPDATE gyms SET is_default = 0');

      // Then insert with is_default = 1
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gyms'),
        expect.arrayContaining([1])
      );
    });

    it('returns the new gym object', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const newGym = await useGymStore.getState().addGym('New Gym', true);

      expect(newGym).toEqual(expect.objectContaining({
        id: 'new-gym-id',
        name: 'New Gym',
        isDefault: true,
      }));
    });

    it('reloads gyms after adding', async () => {
      const newGymRow = createGymRow({ id: 'new-gym-id', name: 'New Gym' });
      mockDb.getAllAsync.mockResolvedValue([newGymRow]);

      await useGymStore.getState().addGym('New Gym');

      // Should have called getAllAsync to reload
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('handles add errors', async () => {
      const addError = new Error('Insert failed');
      mockDb.runAsync.mockRejectedValue(addError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(useGymStore.getState().addGym('New Gym')).rejects.toThrow('Insert failed');

      const { error, isLoading } = useGymStore.getState();

      expect(error).toBe('Insert failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });

    it('handles non-Error thrown values', async () => {
      mockDb.runAsync.mockRejectedValue('string error');

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(useGymStore.getState().addGym('New Gym')).rejects.toBe('string error');

      const { error } = useGymStore.getState();

      expect(error).toBe('Failed to add gym');

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // updateGym Tests
  // ==========================================================================

  describe('updateGym', () => {
    it('updates gym name in database', async () => {
      const gymRows = [createGymRow({ id: 'gym-1', name: 'Old Name' })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      await useGymStore.getState().updateGym('gym-1', { name: 'New Name' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE gyms SET name'),
        expect.arrayContaining(['New Name'])
      );
    });

    it('trims updated name', async () => {
      const gymRows = [createGymRow({ id: 'gym-1', name: 'Old Name' })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      await useGymStore.getState().updateGym('gym-1', { name: '  Trimmed Name  ' });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE gyms SET name'),
        expect.arrayContaining(['Trimmed Name'])
      );
    });

    it('updates local state after successful update', async () => {
      const gymRows = [createGymRow({ id: 'gym-1', name: 'Old Name', is_default: 1 })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      await useGymStore.getState().updateGym('gym-1', { name: 'New Name' });

      const { gyms, defaultGym } = useGymStore.getState();

      expect(gyms[0].name).toBe('New Name');
      expect(defaultGym?.name).toBe('New Name');
    });

    it('does nothing when name is undefined', async () => {
      const gymRows = [createGymRow({ id: 'gym-1', name: 'Old Name' })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      mockDb.runAsync.mockClear();

      await useGymStore.getState().updateGym('gym-1', {});

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('handles update errors', async () => {
      const gymRows = [createGymRow({ id: 'gym-1', name: 'Old Name' })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const updateError = new Error('Update failed');
      mockDb.runAsync.mockRejectedValue(updateError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useGymStore.getState().updateGym('gym-1', { name: 'New Name' });

      const { error, isLoading } = useGymStore.getState();

      expect(error).toBe('Update failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // setDefaultGym Tests
  // ==========================================================================

  describe('setDefaultGym', () => {
    it('unsets all defaults then sets the new default', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 1 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 0 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      mockDb.runAsync.mockClear();

      await useGymStore.getState().setDefaultGym('gym-2');

      expect(mockDb.runAsync).toHaveBeenCalledWith('UPDATE gyms SET is_default = 0');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE gyms SET is_default = 1'),
        expect.arrayContaining(['gym-2'])
      );
    });

    it('updates local state with new default', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 1 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 0 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      await useGymStore.getState().setDefaultGym('gym-2');

      const { gyms, defaultGym } = useGymStore.getState();

      expect(gyms.find(g => g.id === 'gym-1')?.isDefault).toBe(false);
      expect(gyms.find(g => g.id === 'gym-2')?.isDefault).toBe(true);
      expect(defaultGym?.id).toBe('gym-2');
    });

    it('handles setDefault errors', async () => {
      const gymRows = [createGymRow({ id: 'gym-1' })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const setDefaultError = new Error('Set default failed');
      mockDb.runAsync.mockRejectedValue(setDefaultError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useGymStore.getState().setDefaultGym('gym-1');

      const { error, isLoading } = useGymStore.getState();

      expect(error).toBe('Set default failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // removeGym Tests
  // ==========================================================================

  describe('removeGym', () => {
    it('throws error when trying to delete the last gym', async () => {
      const gymRows = [createGymRow({ id: 'gym-1' })];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useGymStore.getState().removeGym('gym-1');

      const { error } = useGymStore.getState();

      expect(error).toBe('Cannot delete the last gym');

      errorSpy.mockRestore();
    });

    it('deletes gym equipment first then the gym', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 0 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 1 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      mockDb.runAsync.mockClear();

      await useGymStore.getState().removeGym('gym-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM gym_equipment WHERE gym_id = ?',
        ['gym-1']
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM gyms WHERE id = ?',
        ['gym-1']
      );
    });

    it('sets a new default when deleting the default gym', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 1 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 0 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      mockDb.runAsync.mockClear();

      await useGymStore.getState().removeGym('gym-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE gyms SET is_default = 1 WHERE id = ?',
        ['gym-2']
      );
    });

    it('does not set new default when deleting non-default gym', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 1 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 0 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      mockDb.runAsync.mockClear();

      await useGymStore.getState().removeGym('gym-2');

      // Should only have delete calls, not set default
      const setDefaultCall = mockDb.runAsync.mock.calls.find(
        call => call[0].includes('is_default = 1')
      );
      expect(setDefaultCall).toBeUndefined();
    });

    it('reloads gyms after deletion', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 0 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 1 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      mockDb.getAllAsync.mockClear();
      mockDb.getAllAsync.mockResolvedValue([gymRows[1]]);

      await useGymStore.getState().removeGym('gym-1');

      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('handles remove errors', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 0 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 1 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const removeError = new Error('Delete failed');
      mockDb.runAsync.mockRejectedValue(removeError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useGymStore.getState().removeGym('gym-1');

      const { error, isLoading } = useGymStore.getState();

      expect(error).toBe('Delete failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // getDefaultGym Tests
  // ==========================================================================

  describe('getDefaultGym', () => {
    it('returns the default gym', async () => {
      const gymRows = [
        createGymRow({ id: 'gym-1', name: 'Gym 1', is_default: 0 }),
        createGymRow({ id: 'gym-2', name: 'Gym 2', is_default: 1 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(gymRows);

      await useGymStore.getState().loadGyms();

      const defaultGym = useGymStore.getState().getDefaultGym();

      expect(defaultGym).not.toBeNull();
      expect(defaultGym?.id).toBe('gym-2');
    });

    it('returns null when no default gym exists', () => {
      const defaultGym = useGymStore.getState().getDefaultGym();

      expect(defaultGym).toBeNull();
    });
  });

  // ==========================================================================
  // clearError Tests
  // ==========================================================================

  describe('clearError', () => {
    it('clears the error state', () => {
      useGymStore.setState({ error: 'Some error' });

      useGymStore.getState().clearError();

      const { error } = useGymStore.getState();

      expect(error).toBeNull();
    });

    it('does nothing when error is already null', () => {
      expect(useGymStore.getState().error).toBeNull();

      useGymStore.getState().clearError();

      expect(useGymStore.getState().error).toBeNull();
    });
  });
});
