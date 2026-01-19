/**
 * Background Sync Service
 * Handles periodic background sync using expo-task-manager
 *
 * NOTE: Requires expo-background-fetch and expo-task-manager packages to be installed:
 * npm install expo-background-fetch expo-task-manager
 */

import { performFullSync } from './syncService';
import { getSyncMetadata } from '@/db/syncMetadataRepository';
import { Platform } from 'react-native';

const BACKGROUND_SYNC_TASK = 'background-cloudkit-sync';

// Minimum interval between sync attempts (15 minutes)
const SYNC_INTERVAL_SECONDS = 15 * 60;

// Dynamic imports for optional dependencies
let BackgroundFetch: any = null;
let TaskManager: any = null;

// Load dependencies if available
try {
  BackgroundFetch = require('expo-background-fetch');
  TaskManager = require('expo-task-manager');
} catch (error) {
  console.warn('Background sync packages not installed. Install expo-background-fetch and expo-task-manager to enable background sync.');
}

// MARK: - Task Registration

/**
 * Register the background sync task
 */
export function registerBackgroundSyncTask(): void {
  if (!BackgroundFetch || !TaskManager) {
    console.log('Background sync packages not available');
    return;
  }

  if (Platform.OS !== 'ios') {
    console.log('Background sync only available on iOS');
    return;
  }

  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      console.log('Background sync task started');

      // Check if sync is enabled
      const metadata = await getSyncMetadata();
      if (!metadata.syncEnabled) {
        console.log('Sync is disabled, skipping background sync');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      // Perform sync
      const result = await performFullSync();

      if (result.success) {
        console.log('Background sync completed successfully');
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } else {
        console.error('Background sync failed:', result.error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    } catch (error) {
      console.error('Background sync task error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

/**
 * Start background sync (enable periodic background sync)
 */
export async function startBackgroundSync(): Promise<void> {
  if (!BackgroundFetch || !TaskManager) {
    console.log('Background sync packages not available');
    return;
  }

  if (Platform.OS !== 'ios') {
    console.log('Background sync only available on iOS');
    return;
  }

  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

    if (isRegistered) {
      console.log('Background sync task already registered');
      return;
    }

    // Register background fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: SYNC_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('Background sync started');
  } catch (error) {
    console.error('Failed to start background sync:', error);
  }
}

/**
 * Stop background sync (disable periodic background sync)
 */
export async function stopBackgroundSync(): Promise<void> {
  if (!BackgroundFetch || !TaskManager) {
    return;
  }

  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('Background sync stopped');
  } catch (error) {
    console.error('Failed to stop background sync:', error);
  }
}

/**
 * Check if background sync is active
 */
export async function isBackgroundSyncActive(): Promise<boolean> {
  if (!BackgroundFetch || !TaskManager) {
    return false;
  }

  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    const status = await BackgroundFetch.getStatusAsync();
    return status === BackgroundFetch.BackgroundFetchStatus.Available;
  } catch (error) {
    console.error('Failed to check background sync status:', error);
    return false;
  }
}
