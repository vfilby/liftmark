/**
 * Debug Logs Screen
 *
 * Allows users to view, filter, and export application logs
 * for debugging issues in production builds.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { logger, LogLevel, LogCategory } from '@/services/logger';
import { navigationLogger } from '@/services/navigationLogger';
import { useTheme } from '@/theme';
import Clipboard from '@react-native-clipboard/clipboard';

interface LogEntry {
  id?: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

export default function DebugLogsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{
    level?: LogLevel;
    category?: LogCategory;
  }>({});
  const [stats, setStats] = useState<{
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
  } | null>(null);

  const deviceInfo = logger.getDeviceInformation();

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [filter]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const fetchedLogs = await logger.getLogs(100, filter.level, filter.category);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const fetchedStats = await logger.getLogStats();
      setStats(fetchedStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleExportLogs = async () => {
    try {
      const exportData = await logger.exportLogs();
      const navHistory = navigationLogger.exportHistory();

      const combinedData = JSON.stringify({
        ...JSON.parse(exportData),
        navigationHistory: JSON.parse(navHistory),
      }, null, 2);

      // Copy to clipboard
      Clipboard.setString(combinedData);

      Alert.alert(
        'Logs Exported',
        'Debug logs have been copied to your clipboard. You can paste them in an email or message.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to export logs:', error);
      Alert.alert('Error', 'Failed to export logs');
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await logger.clearLogs();
            navigationLogger.clearHistory();
            loadLogs();
            loadStats();
          },
        },
      ]
    );
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'error':
        return '#ff4444';
      case 'warn':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      case 'debug':
        return '#9e9e9e';
      default:
        return '#666';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors?.background }]}
      testID="debug-logs-screen"
    >
      {/* Device Info Header */}
      <View style={[styles.header, { backgroundColor: colors?.card }]}>
        <Text style={[styles.headerTitle, { color: colors?.text }]}>Device Info</Text>
        <Text style={[styles.infoText, { color: colors?.text }]}>
          Platform: {deviceInfo.platform} {deviceInfo.osVersion}
        </Text>
        <Text style={[styles.infoText, { color: colors?.text }]}>
          App: {deviceInfo.appVersion} ({deviceInfo.buildType})
        </Text>
        <Text style={[styles.infoText, { color: colors?.text }]}>
          {deviceInfo.isSimulator ? 'Simulator' : 'Device'}
        </Text>
      </View>

      {/* Stats */}
      {stats && (
        <View style={[styles.stats, { backgroundColor: colors?.card }]}>
          <Text style={[styles.statsTitle, { color: colors?.text }]}>
            Total Logs: {stats.total}
          </Text>
          <View style={styles.statsRow}>
            {Object.entries(stats.byLevel).map(([level, count]) => (
              <View key={level} style={styles.statItem}>
                <Text style={[styles.statLabel, { color: getLevelColor(level as LogLevel) }]}>
                  {level}
                </Text>
                <Text style={[styles.statValue, { color: colors?.text }]}>
                  {count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions} testID="debug-logs-actions">
        <TouchableOpacity
          style={[styles.actionButton, styles.exportButton]}
          onPress={handleExportLogs}
          testID="debug-logs-export"
        >
          <Text style={styles.actionButtonText}>Export Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.clearButton]}
          onPress={handleClearLogs}
          testID="debug-logs-clear"
        >
          <Text style={styles.actionButtonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Logs List */}
      {isLoading ? (
        <View style={styles.loadingContainer} testID="debug-logs-loading">
          <ActivityIndicator size="large" color={colors?.primary} />
        </View>
      ) : (
        <ScrollView style={styles.logsList} testID="debug-logs-list">
          {logs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors?.text }]} testID="debug-logs-empty">
              No logs found
            </Text>
          ) : (
            logs.map((log, index) => (
              <View
                key={log.id || index}
                style={[styles.logEntry, { backgroundColor: colors?.card }]}
              >
                <View style={styles.logHeader}>
                  <Text style={[styles.timestamp, { color: colors?.text }]}>
                    {formatTimestamp(log.timestamp)}
                  </Text>
                  <View style={styles.logMeta}>
                    <Text
                      style={[
                        styles.level,
                        { color: getLevelColor(log.level), fontWeight: 'bold' },
                      ]}
                    >
                      {log.level.toUpperCase()}
                    </Text>
                    <Text style={[styles.category, { color: colors?.text }]}>
                      [{log.category}]
                    </Text>
                  </View>
                </View>
                <Text style={[styles.message, { color: colors?.text }]}>
                  {log.message}
                </Text>
                {log.metadata && (
                  <Text style={[styles.metadata, { color: colors?.text }]}>
                    {JSON.stringify(log.metadata, null, 2)}
                  </Text>
                )}
                {log.stackTrace && (
                  <Text style={[styles.stackTrace, { color: colors?.text }]}>
                    {log.stackTrace}
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    marginBottom: 4,
  },
  stats: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: '#007AFF',
  },
  clearButton: {
    backgroundColor: '#ff4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logsList: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  logEntry: {
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ccc',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  level: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  category: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  message: {
    fontSize: 13,
    marginBottom: 4,
  },
  metadata: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  stackTrace: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
