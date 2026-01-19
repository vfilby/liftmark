/**
 * Sync Store - Zustand store for managing CloudKit sync state
 */

import { create } from 'zustand';
import { getSyncMetadata, getPendingSyncCount } from '@/db/syncMetadataRepository';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncStore {
  // State
  isSyncing: boolean;
  syncStatus: SyncStatus;
  lastSyncDate: Date | null;
  syncError: string | null;
  pendingChanges: number;
  syncEnabled: boolean;

  // Actions
  loadSyncState: () => Promise<void>;
  setSyncing: (syncing: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncDate: (date: Date | null) => void;
  setSyncError: (error: string | null) => void;
  setPendingChanges: (count: number) => void;
  setSyncEnabled: (enabled: boolean) => void;
  clearError: () => void;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  // Initial state
  isSyncing: false,
  syncStatus: 'idle',
  lastSyncDate: null,
  syncError: null,
  pendingChanges: 0,
  syncEnabled: false,

  // Load sync state from database
  loadSyncState: async () => {
    try {
      const metadata = await getSyncMetadata();
      const pendingCount = await getPendingSyncCount();

      set({
        syncEnabled: metadata.sync_enabled === 1,
        lastSyncDate: metadata.last_sync_date ? new Date(metadata.last_sync_date) : null,
        pendingChanges: pendingCount,
      });
    } catch (error) {
      console.error('Failed to load sync state:', error);
    }
  },

  // Set syncing state
  setSyncing: (syncing: boolean) => {
    set({ isSyncing: syncing });
    if (syncing) {
      set({ syncStatus: 'syncing', syncError: null });
    } else {
      const { syncError } = get();
      set({ syncStatus: syncError ? 'error' : 'idle' });
    }
  },

  // Set sync status
  setSyncStatus: (status: SyncStatus) => {
    set({ syncStatus: status });
  },

  // Set last sync date
  setLastSyncDate: (date: Date | null) => {
    set({ lastSyncDate: date });
  },

  // Set sync error
  setSyncError: (error: string | null) => {
    set({
      syncError: error,
      syncStatus: error ? 'error' : 'idle',
    });
  },

  // Set pending changes count
  setPendingChanges: (count: number) => {
    set({ pendingChanges: count });
  },

  // Set sync enabled
  setSyncEnabled: (enabled: boolean) => {
    set({ syncEnabled: enabled });
  },

  // Clear error message
  clearError: () => {
    set({ syncError: null, syncStatus: 'idle' });
  },
}));
