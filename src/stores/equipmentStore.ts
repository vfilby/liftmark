import { create } from 'zustand';
import type { GymEquipment, GymEquipmentRow } from '@/types';
import { getDatabase } from '@/db';
import { generateId } from '@/utils/id';

interface EquipmentStore {
  // State
  equipment: GymEquipment[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadEquipment: () => Promise<void>;
  addEquipment: (name: string, isAvailable?: boolean) => Promise<void>;
  updateEquipmentAvailability: (id: string, isAvailable: boolean) => Promise<void>;
  removeEquipment: (id: string) => Promise<void>;
  getAvailableEquipmentNames: () => string[];
  clearError: () => void;
}

export const useEquipmentStore = create<EquipmentStore>((set, get) => ({
  // Initial state
  equipment: [],
  isLoading: false,
  error: null,

  // Load all gym equipment
  loadEquipment: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<GymEquipmentRow>(
        'SELECT * FROM gym_equipment ORDER BY name ASC'
      );

      const equipment: GymEquipment[] = rows.map(row => ({
        id: row.id,
        name: row.name,
        isAvailable: row.is_available === 1,
        lastCheckedAt: row.last_checked_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      set({ equipment, isLoading: false });
    } catch (error) {
      console.error('Failed to load equipment:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load equipment',
        isLoading: false,
      });
    }
  },

  // Add new equipment
  addEquipment: async (name: string, isAvailable: boolean = true) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const id = generateId();

      await db.runAsync(
        `INSERT INTO gym_equipment (id, name, is_available, last_checked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), isAvailable ? 1 : 0, now, now, now]
      );

      // Reload equipment list
      await get().loadEquipment();
    } catch (error) {
      console.error('Failed to add equipment:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add equipment',
        isLoading: false,
      });
    }
  },

  // Update equipment availability
  updateEquipmentAvailability: async (id: string, isAvailable: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      await db.runAsync(
        `UPDATE gym_equipment
         SET is_available = ?, last_checked_at = ?, updated_at = ?
         WHERE id = ?`,
        [isAvailable ? 1 : 0, now, now, id]
      );

      // Update state locally without full reload for better performance
      set(state => ({
        equipment: state.equipment.map(eq =>
          eq.id === id
            ? { ...eq, isAvailable, lastCheckedAt: now, updatedAt: now }
            : eq
        ),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to update equipment:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update equipment',
        isLoading: false,
      });
    }
  },

  // Remove equipment
  removeEquipment: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM gym_equipment WHERE id = ?', [id]);

      // Update state locally
      set(state => ({
        equipment: state.equipment.filter(eq => eq.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to remove equipment:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to remove equipment',
        isLoading: false,
      });
    }
  },

  // Get list of available equipment names (for filtering workouts)
  getAvailableEquipmentNames: () => {
    const { equipment } = get();
    return equipment.filter(eq => eq.isAvailable).map(eq => eq.name.toLowerCase());
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },
}));
