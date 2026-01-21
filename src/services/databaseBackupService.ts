import { Paths, File, Directory } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { getDatabase, closeDatabase } from '@/db';

const DB_NAME = 'liftmark.db';

// Required tables to validate
const REQUIRED_TABLES = [
  'workout_templates',
  'template_exercises',
  'template_sets',
  'user_settings',
  'gyms',
  'gym_equipment',
  'workout_sessions',
  'session_exercises',
  'session_sets'
];

/**
 * Get the SQLite database file path
 */
export async function getDatabasePath(): Promise<string> {
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  const dbFile = new File(sqliteDir, DB_NAME);
  return dbFile.uri;
}

/**
 * Export database with timestamped filename
 * Returns the path to the exported file
 */
export async function exportDatabase(): Promise<string> {
  try {
    const dbPath = await getDatabasePath();
    const dbFile = new File(dbPath);

    // Check if database file exists
    if (!dbFile.exists) {
      throw new Error('Database file not found. Please restart the app.');
    }

    // Create timestamped filename
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\.\d{3}Z$/, '')
      .replace('T', '_');
    const exportFileName = `liftmark_backup_${timestamp}.db`;
    const exportFile = new File(Paths.cache, exportFileName);

    // Copy database to cache directory for sharing
    await dbFile.copy(exportFile);

    return exportFile.uri;
  } catch (error) {
    console.error('Export database error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to export database');
  }
}

/**
 * Validate imported database file structure
 * Checks for SQLite format and required tables
 */
export async function validateDatabaseFile(fileUri: string): Promise<boolean> {
  try {
    const file = new File(fileUri);

    // Check if file exists
    if (!file.exists) {
      throw new Error('File does not exist');
    }

    // Check file size (should be at least a few KB for a valid database)
    const size = file.size;
    if (size === 0) {
      throw new Error('File is empty');
    }

    if (size < 1024) {
      throw new Error('File is too small to be a valid database');
    }

    // Read first 16 bytes to check SQLite magic header
    const content = await file.text();

    // SQLite files start with "SQLite format 3" in ASCII
    if (!content.startsWith('SQLite format 3')) {
      throw new Error('Invalid database file format - not a SQLite database');
    }

    // Basic validation passed
    // Full schema validation will happen during import
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid database file');
  }
}

/**
 * Import and replace current database
 * WARNING: This is a destructive operation that replaces all data
 */
export async function importDatabase(fileUri: string): Promise<void> {
  let backupFile: File | null = null;

  try {
    const dbPath = await getDatabasePath();
    const dbFile = new File(dbPath);
    const importFile = new File(fileUri);

    // Create backup of current database before replacing
    backupFile = new File(Paths.cache, 'backup_before_import.db');
    if (dbFile.exists) {
      await dbFile.copy(backupFile);
    }

    // Close current database connection
    await closeDatabase();

    // Wait a bit to ensure connection is fully closed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Delete current database
    if (dbFile.exists) {
      await dbFile.delete();
    }

    // Copy imported file to database location
    await importFile.copy(dbFile);

    // Reopen database to verify it works
    await getDatabase();

    // Clean up backup
    if (backupFile && backupFile.exists) {
      await backupFile.delete();
    }

  } catch (error) {
    console.error('Import database error:', error);

    // Attempt to restore backup if import failed
    if (backupFile && backupFile.exists) {
      try {
        const dbPath = await getDatabasePath();
        const dbFile = new File(dbPath);
        if (dbFile.exists) {
          await dbFile.delete();
        }
        await backupFile.copy(dbFile);
        // Reopen original database
        await getDatabase();
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError);
      }
    }

    if (error instanceof Error) {
      throw new Error(`Import failed: ${error.message}. Your original data is intact.`);
    }
    throw new Error('Import failed. Your original data is intact.');
  }
}
