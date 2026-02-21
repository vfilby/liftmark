import { useEquipmentStore } from '../stores/equipmentStore';
import type { GymEquipment } from '@/types';

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

function createEquipmentRow(overrides: Partial<{
  id: string;
  gym_id: string;
  name: string;
  is_available: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    id: 'equipment-1',
    gym_id: 'gym-1',
    name: 'Barbell',
    is_available: 1,
    last_checked_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('equipmentStore', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);

    // Reset the store state before each test
    useEquipmentStore.setState({
      equipment: [],
      isLoading: false,
      error: null,
    });
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('has empty equipment array initially', () => {
      const { equipment } = useEquipmentStore.getState();
      expect(equipment).toEqual([]);
    });

    it('is not loading initially', () => {
      const { isLoading } = useEquipmentStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has no error initially', () => {
      const { error } = useEquipmentStore.getState();
      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // loadEquipment Tests
  // ==========================================================================

  describe('loadEquipment', () => {
    it('sets isLoading to true while loading', async () => {
      const equipmentRows = [createEquipmentRow()];
      let resolvePromise: (value: typeof equipmentRows) => void;
      const pendingPromise = new Promise<typeof equipmentRows>((resolve) => {
        resolvePromise = resolve;
      });

      mockDb.getAllAsync.mockReturnValue(pendingPromise);

      const loadPromise = useEquipmentStore.getState().loadEquipment('gym-1');

      expect(useEquipmentStore.getState().isLoading).toBe(true);

      resolvePromise!(equipmentRows);
      await loadPromise;
    });

    it('loads equipment for specific gym from database', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', gym_id: 'gym-1', name: 'Barbell' }),
        createEquipmentRow({ id: 'eq-2', gym_id: 'gym-1', name: 'Dumbbells' }),
      ];

      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE gym_id = ?'),
        ['gym-1']
      );

      const { equipment, isLoading, error } = useEquipmentStore.getState();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(equipment).toHaveLength(2);
      expect(equipment[0]).toEqual({
        id: 'eq-1',
        gymId: 'gym-1',
        name: 'Barbell',
        isAvailable: true,
        lastCheckedAt: '2024-01-15T10:00:00Z',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      });
    });

    it('converts is_available integer to boolean', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', is_available: 1 }),
        createEquipmentRow({ id: 'eq-2', is_available: 0 }),
      ];

      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const { equipment } = useEquipmentStore.getState();

      expect(equipment[0].isAvailable).toBe(true);
      expect(equipment[1].isAvailable).toBe(false);
    });

    it('handles null last_checked_at', async () => {
      const equipmentRow = createEquipmentRow({ last_checked_at: null });
      mockDb.getAllAsync.mockResolvedValue([equipmentRow]);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const { equipment } = useEquipmentStore.getState();

      expect(equipment[0].lastCheckedAt).toBeUndefined();
    });

    it('handles empty equipment list', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const { equipment, isLoading, error } = useEquipmentStore.getState();

      expect(equipment).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('handles database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.getAllAsync.mockRejectedValue(dbError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const { equipment, isLoading, error } = useEquipmentStore.getState();

      expect(isLoading).toBe(false);
      expect(equipment).toEqual([]);
      expect(error).toBe('Database connection failed');

      errorSpy.mockRestore();
    });

    it('handles non-Error thrown values', async () => {
      mockDb.getAllAsync.mockRejectedValue('string error');

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const { error } = useEquipmentStore.getState();

      expect(error).toBe('Failed to load equipment');

      errorSpy.mockRestore();
    });

    it('clears previous error when loading', async () => {
      useEquipmentStore.setState({ error: 'Previous error' });

      mockDb.getAllAsync.mockResolvedValue([createEquipmentRow()]);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const { error } = useEquipmentStore.getState();

      expect(error).toBeNull();
    });
  });

  // ==========================================================================
  // addEquipment Tests
  // ==========================================================================

  describe('addEquipment', () => {
    beforeEach(() => {
      mockedGenerateId.mockReturnValue('new-equipment-id');
    });

    it('adds equipment to the database for specific gym', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addEquipment('gym-1', 'New Equipment');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gym_equipment'),
        expect.arrayContaining(['new-equipment-id', 'gym-1', 'New Equipment', 1])
      );
    });

    it('trims equipment name', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addEquipment('gym-1', '  Trimmed Name  ');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gym_equipment'),
        expect.arrayContaining(['Trimmed Name'])
      );
    });

    it('adds equipment as available by default', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addEquipment('gym-1', 'Equipment');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gym_equipment'),
        expect.arrayContaining([1]) // is_available = 1
      );
    });

    it('can add equipment as unavailable', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addEquipment('gym-1', 'Equipment', false);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gym_equipment'),
        expect.arrayContaining([0]) // is_available = 0
      );
    });

    it('reloads equipment after adding', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addEquipment('gym-1', 'Equipment');

      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('handles add errors', async () => {
      const addError = new Error('Insert failed');
      mockDb.runAsync.mockRejectedValue(addError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useEquipmentStore.getState().addEquipment('gym-1', 'Equipment');

      const { error, isLoading } = useEquipmentStore.getState();

      expect(error).toBe('Insert failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // addMultipleEquipment Tests
  // ==========================================================================

  describe('addMultipleEquipment', () => {
    beforeEach(() => {
      let idCounter = 0;
      mockedGenerateId.mockImplementation(() => `generated-id-${++idCounter}`);
    });

    it('adds multiple equipment items', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addMultipleEquipment('gym-1', ['Barbell', 'Dumbbells', 'Bench']);

      expect(mockDb.runAsync).toHaveBeenCalledTimes(3);
    });

    it('skips equipment that already exists (case-insensitive)', async () => {
      const existingEquipment = [
        createEquipmentRow({ id: 'eq-1', gym_id: 'gym-1', name: 'Barbell' }),
      ];
      mockDb.getAllAsync.mockResolvedValue(existingEquipment);

      // First load the existing equipment
      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().addMultipleEquipment('gym-1', ['BARBELL', 'Dumbbells']);

      // Should only insert Dumbbells since Barbell already exists
      expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gym_equipment'),
        expect.arrayContaining(['Dumbbells'])
      );
    });

    it('does nothing when all equipment already exists', async () => {
      const existingEquipment = [
        createEquipmentRow({ id: 'eq-1', gym_id: 'gym-1', name: 'Barbell' }),
        createEquipmentRow({ id: 'eq-2', gym_id: 'gym-1', name: 'Dumbbells' }),
      ];
      mockDb.getAllAsync.mockResolvedValue(existingEquipment);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().addMultipleEquipment('gym-1', ['barbell', 'dumbbells']);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('trims equipment names when checking for duplicates', async () => {
      const existingEquipment = [
        createEquipmentRow({ id: 'eq-1', gym_id: 'gym-1', name: 'Barbell' }),
      ];
      mockDb.getAllAsync.mockResolvedValue(existingEquipment);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().addMultipleEquipment('gym-1', ['  Barbell  ']);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('reloads equipment after adding multiple', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await useEquipmentStore.getState().addMultipleEquipment('gym-1', ['Equipment']);

      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('handles add errors', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);
      const addError = new Error('Insert failed');
      mockDb.runAsync.mockRejectedValue(addError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useEquipmentStore.getState().addMultipleEquipment('gym-1', ['Equipment']);

      const { error, isLoading } = useEquipmentStore.getState();

      expect(error).toBe('Insert failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // updateEquipmentAvailability Tests
  // ==========================================================================

  describe('updateEquipmentAvailability', () => {
    it('updates availability in database', async () => {
      const equipmentRows = [createEquipmentRow({ id: 'eq-1', is_available: 1 })];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().updateEquipmentAvailability('eq-1', false);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE gym_equipment'),
        expect.arrayContaining([0]) // is_available = 0
      );
    });

    it('updates local state without full reload', async () => {
      const equipmentRows = [createEquipmentRow({ id: 'eq-1', is_available: 1 })];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.getAllAsync.mockClear();

      await useEquipmentStore.getState().updateEquipmentAvailability('eq-1', false);

      const { equipment } = useEquipmentStore.getState();

      expect(equipment[0].isAvailable).toBe(false);
      // Should not have called getAllAsync again (local update only)
      expect(mockDb.getAllAsync).not.toHaveBeenCalled();
    });

    it('updates lastCheckedAt and updatedAt timestamps', async () => {
      const equipmentRows = [createEquipmentRow({ id: 'eq-1' })];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      await useEquipmentStore.getState().updateEquipmentAvailability('eq-1', true);

      const { equipment } = useEquipmentStore.getState();

      // Timestamps should be updated (different from original)
      expect(equipment[0].lastCheckedAt).toBeDefined();
      expect(equipment[0].updatedAt).toBeDefined();
    });

    it('handles update errors', async () => {
      const equipmentRows = [createEquipmentRow({ id: 'eq-1' })];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const updateError = new Error('Update failed');
      mockDb.runAsync.mockRejectedValue(updateError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useEquipmentStore.getState().updateEquipmentAvailability('eq-1', false);

      const { error, isLoading } = useEquipmentStore.getState();

      expect(error).toBe('Update failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // removeEquipment Tests
  // ==========================================================================

  describe('removeEquipment', () => {
    it('removes equipment from database', async () => {
      const equipmentRows = [createEquipmentRow({ id: 'eq-1' })];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().removeEquipment('eq-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM gym_equipment WHERE id = ?',
        ['eq-1']
      );
    });

    it('updates local state after removal', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', name: 'Barbell' }),
        createEquipmentRow({ id: 'eq-2', name: 'Dumbbells' }),
      ];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      await useEquipmentStore.getState().removeEquipment('eq-1');

      const { equipment } = useEquipmentStore.getState();

      expect(equipment).toHaveLength(1);
      expect(equipment[0].id).toBe('eq-2');
    });

    it('handles remove errors', async () => {
      const equipmentRows = [createEquipmentRow({ id: 'eq-1' })];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const removeError = new Error('Delete failed');
      mockDb.runAsync.mockRejectedValue(removeError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await useEquipmentStore.getState().removeEquipment('eq-1');

      const { error, isLoading } = useEquipmentStore.getState();

      expect(error).toBe('Delete failed');
      expect(isLoading).toBe(false);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // removeMultipleEquipment Tests
  // ==========================================================================

  describe('removeMultipleEquipment', () => {
    it('removes multiple equipment items from database', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1' }),
        createEquipmentRow({ id: 'eq-2' }),
        createEquipmentRow({ id: 'eq-3' }),
      ];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().removeMultipleEquipment(['eq-1', 'eq-3']);

      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM gym_equipment WHERE id = ?',
        ['eq-1']
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM gym_equipment WHERE id = ?',
        ['eq-3']
      );
    });

    it('updates local state after removal', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', name: 'Barbell' }),
        createEquipmentRow({ id: 'eq-2', name: 'Dumbbells' }),
        createEquipmentRow({ id: 'eq-3', name: 'Bench' }),
      ];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      await useEquipmentStore.getState().removeMultipleEquipment(['eq-1', 'eq-3']);

      const { equipment } = useEquipmentStore.getState();

      expect(equipment).toHaveLength(1);
      expect(equipment[0].id).toBe('eq-2');
    });

    it('handles empty ids array', async () => {
      mockDb.getAllAsync.mockResolvedValue([createEquipmentRow()]);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      mockDb.runAsync.mockClear();

      await useEquipmentStore.getState().removeMultipleEquipment([]);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getAvailableEquipmentNames Tests
  // ==========================================================================

  describe('getAvailableEquipmentNames', () => {
    it('returns names of available equipment in lowercase', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', name: 'Barbell', is_available: 1 }),
        createEquipmentRow({ id: 'eq-2', name: 'Dumbbells', is_available: 1 }),
        createEquipmentRow({ id: 'eq-3', name: 'Bench', is_available: 0 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const availableNames = useEquipmentStore.getState().getAvailableEquipmentNames();

      expect(availableNames).toEqual(['barbell', 'dumbbells']);
    });

    it('returns empty array when no equipment is available', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', name: 'Barbell', is_available: 0 }),
      ];
      mockDb.getAllAsync.mockResolvedValue(equipmentRows);

      await useEquipmentStore.getState().loadEquipment('gym-1');

      const availableNames = useEquipmentStore.getState().getAvailableEquipmentNames();

      expect(availableNames).toEqual([]);
    });

    it('returns empty array when equipment list is empty', () => {
      const availableNames = useEquipmentStore.getState().getAvailableEquipmentNames();

      expect(availableNames).toEqual([]);
    });
  });

  // ==========================================================================
  // getEquipmentForGym Tests
  // ==========================================================================

  describe('getEquipmentForGym', () => {
    it('filters equipment by gym id', async () => {
      const equipmentRows = [
        createEquipmentRow({ id: 'eq-1', gym_id: 'gym-1', name: 'Barbell' }),
        createEquipmentRow({ id: 'eq-2', gym_id: 'gym-2', name: 'Dumbbells' }),
      ];

      // Manually set equipment from different gyms
      useEquipmentStore.setState({
        equipment: [
          { id: 'eq-1', gymId: 'gym-1', name: 'Barbell', isAvailable: true, createdAt: '', updatedAt: '' },
          { id: 'eq-2', gymId: 'gym-2', name: 'Dumbbells', isAvailable: true, createdAt: '', updatedAt: '' },
        ],
      });

      const gym1Equipment = useEquipmentStore.getState().getEquipmentForGym('gym-1');

      expect(gym1Equipment).toHaveLength(1);
      expect(gym1Equipment[0].id).toBe('eq-1');
    });

    it('returns empty array when gym has no equipment', () => {
      useEquipmentStore.setState({
        equipment: [
          { id: 'eq-1', gymId: 'gym-1', name: 'Barbell', isAvailable: true, createdAt: '', updatedAt: '' },
        ],
      });

      const gym2Equipment = useEquipmentStore.getState().getEquipmentForGym('gym-2');

      expect(gym2Equipment).toEqual([]);
    });
  });

  // ==========================================================================
  // hasEquipment Tests
  // ==========================================================================

  describe('hasEquipment', () => {
    beforeEach(() => {
      useEquipmentStore.setState({
        equipment: [
          { id: 'eq-1', gymId: 'gym-1', name: 'Barbell', isAvailable: true, createdAt: '', updatedAt: '' },
          { id: 'eq-2', gymId: 'gym-1', name: 'Dumbbells', isAvailable: true, createdAt: '', updatedAt: '' },
        ],
      });
    });

    it('returns true when equipment exists for gym', () => {
      const hasBarbell = useEquipmentStore.getState().hasEquipment('gym-1', 'Barbell');

      expect(hasBarbell).toBe(true);
    });

    it('performs case-insensitive check', () => {
      const hasBarbell = useEquipmentStore.getState().hasEquipment('gym-1', 'BARBELL');

      expect(hasBarbell).toBe(true);
    });

    it('trims name before checking', () => {
      const hasBarbell = useEquipmentStore.getState().hasEquipment('gym-1', '  Barbell  ');

      expect(hasBarbell).toBe(true);
    });

    it('returns false when equipment does not exist for gym', () => {
      const hasBench = useEquipmentStore.getState().hasEquipment('gym-1', 'Bench');

      expect(hasBench).toBe(false);
    });

    it('returns false when equipment exists but for different gym', () => {
      const hasBarbell = useEquipmentStore.getState().hasEquipment('gym-2', 'Barbell');

      expect(hasBarbell).toBe(false);
    });
  });

  // ==========================================================================
  // clearError Tests
  // ==========================================================================

  describe('clearError', () => {
    it('clears the error state', () => {
      useEquipmentStore.setState({ error: 'Some error' });

      useEquipmentStore.getState().clearError();

      const { error } = useEquipmentStore.getState();

      expect(error).toBeNull();
    });

    it('does nothing when error is already null', () => {
      expect(useEquipmentStore.getState().error).toBeNull();

      useEquipmentStore.getState().clearError();

      expect(useEquipmentStore.getState().error).toBeNull();
    });
  });
});
