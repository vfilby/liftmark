/**
 * Logger Service
 *
 * Provides environment-aware logging and telemetry for debugging issues
 * in production builds (TestFlight, App Store) where console access is limited.
 *
 * Features:
 * - Persistent log storage using SQLite
 * - Environment detection (development, preview, production)
 * - Device info logging
 * - In-app log viewer support
 * - Export functionality
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getDatabase } from '@/db';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory =
  | 'navigation'
  | 'routing'
  | 'app'
  | 'database'
  | 'network'
  | 'user_action'
  | 'error_boundary'
  | 'logger';

interface LogEntry {
  id?: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

interface DeviceInfo {
  platform: string;
  osVersion: string;
  appVersion: string;
  buildType: string;
  isSimulator: boolean;
  deviceModel?: string;
  expoVersion?: string;
}

class Logger {
  private static instance: Logger;
  private deviceInfo: DeviceInfo;
  private isInitialized = false;
  private logQueue: LogEntry[] = [];
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly LOG_RETENTION_DAYS = 7;

  private constructor() {
    this.deviceInfo = this.getDeviceInfo();
    this.initializeDatabase().catch(console.error);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Get device and environment information
   */
  private getDeviceInfo(): DeviceInfo {
    const buildType = this.getBuildType();

    return {
      platform: Platform.OS,
      osVersion: Platform.Version.toString(),
      appVersion: Constants.expoConfig?.version || 'unknown',
      buildType,
      isSimulator: this.isRunningInSimulator(),
      deviceModel: Constants.deviceName || undefined,
      expoVersion: Constants.expoVersion || undefined,
    };
  }

  /**
   * Determine build type (development, preview, production)
   */
  private getBuildType(): string {
    if (__DEV__) {
      return 'development';
    }

    // Check if running in Expo Go
    if (Constants.appOwnership === 'expo') {
      return 'expo-go';
    }

    // Check for TestFlight
    // In TestFlight, there's no direct API, but we can use bundle ID or other markers
    // For now, we'll use a simple heuristic
    const channel = Constants.expoConfig?.extra?.eas?.channel;

    if (channel === 'preview') {
      return 'preview'; // TestFlight
    }

    return 'production';
  }

  /**
   * Check if running in simulator/emulator
   */
  private isRunningInSimulator(): boolean {
    if (Platform.OS === 'ios') {
      return Constants.appOwnership === null || Platform.isTV === false;
    }
    if (Platform.OS === 'android') {
      // Android emulator detection is more complex, but this is a good approximation
      return Constants.isDevice === false;
    }
    return false;
  }

  /**
   * Initialize SQLite database for log storage
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const db = await getDatabase();

      // Create logs table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata TEXT,
          stack_trace TEXT,
          device_info TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON app_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_logs_level ON app_logs(level);
        CREATE INDEX IF NOT EXISTS idx_logs_category ON app_logs(category);
      `);

      this.isInitialized = true;

      // Flush queued logs
      await this.flushQueue();

      // Clean old logs
      await this.cleanOldLogs();

      this.info('logger', 'Logger initialized', { deviceInfo: this.deviceInfo });
    } catch (error) {
      console.error('Failed to initialize logger database:', error);
    }
  }

  /**
   * Generate unique ID for log entry
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Write log to database
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    if (!this.isInitialized) {
      // Queue logs until database is ready
      this.logQueue.push(entry);
      if (this.logQueue.length > this.MAX_QUEUE_SIZE) {
        this.logQueue.shift(); // Remove oldest entry
      }
      return;
    }

    try {
      const db = await getDatabase();
      const id = entry.id || this.generateId();

      await db.runAsync(
        `INSERT INTO app_logs (id, timestamp, level, category, message, metadata, stack_trace, device_info)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          entry.timestamp,
          entry.level,
          entry.category,
          entry.message,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.stackTrace || null,
          JSON.stringify(this.deviceInfo),
        ]
      );
    } catch (error) {
      console.error('Failed to write log to database:', error);
    }
  }

  /**
   * Flush queued logs to database
   */
  private async flushQueue(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToFlush = [...this.logQueue];
    this.logQueue = [];

    for (const log of logsToFlush) {
      await this.writeLog(log);
    }
  }

  /**
   * Clean logs older than retention period
   */
  private async cleanOldLogs(): Promise<void> {
    try {
      const db = await getDatabase();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.LOG_RETENTION_DAYS);

      await db.runAsync(
        'DELETE FROM app_logs WHERE timestamp < ?',
        [cutoffDate.toISOString()]
      );
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
      stackTrace: error?.stack,
    };

    // Always log to console in development
    if (__DEV__) {
      const consoleMethod = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           console.log;

      consoleMethod(
        `[${category}] ${message}`,
        metadata || '',
        error?.stack || ''
      );
    }

    // Write to database
    this.writeLog(entry).catch(console.error);
  }

  /**
   * Public logging methods
   */
  public debug(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('debug', category, message, metadata);
  }

  public info(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('info', category, message, metadata);
  }

  public warn(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('warn', category, message, metadata);
  }

  public error(category: LogCategory, message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', category, message, metadata, error);
  }

  /**
   * Get logs from database
   */
  public async getLogs(
    limit = 100,
    level?: LogLevel,
    category?: LogCategory
  ): Promise<LogEntry[]> {
    try {
      const db = await getDatabase();
      let query = 'SELECT * FROM app_logs WHERE 1=1';
      const params: any[] = [];

      if (level) {
        query += ' AND level = ?';
        params.push(level);
      }

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const rows = await db.getAllAsync<any>(query, params);

      return rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        level: row.level,
        category: row.category,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        stackTrace: row.stack_trace,
      }));
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Export logs as JSON string
   */
  public async exportLogs(): Promise<string> {
    try {
      const logs = await this.getLogs(1000);
      return JSON.stringify({
        deviceInfo: this.deviceInfo,
        exportedAt: new Date().toISOString(),
        logs,
      }, null, 2);
    } catch (error) {
      console.error('Failed to export logs:', error);
      return JSON.stringify({ error: 'Failed to export logs' });
    }
  }

  /**
   * Clear all logs
   */
  public async clearLogs(): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM app_logs');
      this.info('logger', 'All logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Get device information
   */
  public getDeviceInformation(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  /**
   * Get log statistics
   */
  public async getLogStats(): Promise<{
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
  }> {
    try {
      const db = await getDatabase();

      const totalRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM app_logs'
      );

      const levelRows = await db.getAllAsync<{ level: LogLevel; count: number }>(
        'SELECT level, COUNT(*) as count FROM app_logs GROUP BY level'
      );

      const categoryRows = await db.getAllAsync<{ category: string; count: number }>(
        'SELECT category, COUNT(*) as count FROM app_logs GROUP BY category'
      );

      const byLevel = levelRows.reduce((acc, row) => {
        acc[row.level] = row.count;
        return acc;
      }, {} as Record<LogLevel, number>);

      const byCategory = categoryRows.reduce((acc, row) => {
        acc[row.category] = row.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: totalRow?.count || 0,
        byLevel,
        byCategory,
      };
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return {
        total: 0,
        byLevel: {} as Record<LogLevel, number>,
        byCategory: {},
      };
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
