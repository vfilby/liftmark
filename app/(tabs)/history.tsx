import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { shareAsync } from 'expo-sharing';
import { getCompletedSessions, getWorkoutSessionById } from '@/db/sessionRepository';
import { exportSessionsAsJson, ExportError } from '@/services/workoutExportService';
import { useTheme } from '@/theme';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { SplitView } from '@/components/SplitView';
import { HistoryDetailView } from '@/components/HistoryDetailView';
import type { WorkoutSession } from '@/types';

export default function HistoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isTablet } = useDeviceLayout();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);

  const handleExportJson = useCallback(async () => {
    setIsExporting(true);
    try {
      const fileUri = await exportSessionsAsJson();
      await shareAsync(fileUri, { mimeType: 'application/json' });
    } catch (error) {
      if (error instanceof ExportError) {
        Alert.alert('Nothing to Export', error.message);
      } else {
        Alert.alert(
          'Export Failed',
          error instanceof Error ? error.message : 'Failed to export workouts'
        );
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Set header right button for export
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isExporting ? (
          <ActivityIndicator style={{ marginRight: 16 }} color={colors.primary} />
        ) : (
          <TouchableOpacity
            onPress={handleExportJson}
            style={{ marginRight: 16 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="history-export-button"
          >
            <Ionicons name="share-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        ),
    });
  }, [navigation, isExporting, handleExportJson, colors.primary]);

  const loadSessions = useCallback(async () => {
    try {
      const completedSessions = await getCompletedSessions();
      setSessions(completedSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  // Load selected session when ID changes (for tablet split view)
  useEffect(() => {
    async function loadSelectedSession() {
      if (selectedSessionId && isTablet) {
        try {
          const session = await getWorkoutSessionById(selectedSessionId);
          setSelectedSession(session);
        } catch (error) {
          console.error('Failed to load selected session:', error);
          setSelectedSession(null);
        }
      } else {
        setSelectedSession(null);
      }
    }
    loadSelectedSession();
  }, [selectedSessionId, isTablet]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSessions();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getSessionStats = (session: WorkoutSession) => {
    let completedSets = 0;
    let totalSets = 0;
    let totalVolume = 0;

    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        totalSets++;
        if (set.status === 'completed') {
          completedSets++;
          if (set.actualWeight && set.actualReps) {
            totalVolume += set.actualWeight * set.actualReps;
          }
        }
      }
    }

    return { completedSets, totalSets, totalVolume };
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    listContent: {
      padding: 16,
    },
    separator: {
      height: 12,
    },
    sessionCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    sessionName: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    sessionDate: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    sessionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sessionTime: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    metaSeparator: {
      fontSize: 14,
      color: colors.border,
      marginHorizontal: 8,
    },
    sessionDuration: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    sessionStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.borderLight,
      borderRadius: 8,
      padding: 12,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
    },
    sessionCardSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
  });

  const renderSession = ({ item: session }: { item: WorkoutSession }) => {
    const stats = getSessionStats(session);
    const isSelected = isTablet && selectedSessionId === session.id;
    const handlePress = () => {
      if (isTablet) {
        setSelectedSessionId(session.id);
      } else {
        router.push(`/history/${session.id}`);
      }
    };

    return (
      <TouchableOpacity
        style={[styles.sessionCard, isSelected && styles.sessionCardSelected]}
        onPress={handlePress}
        activeOpacity={0.7}
        testID="history-session-card"
      >
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionName}>{session.name}</Text>
          <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
        </View>

        <View style={styles.sessionMeta}>
          {session.startTime && (
            <Text style={styles.sessionTime}>{formatTime(session.startTime)}</Text>
          )}
          {session.startTime && session.duration && (
            <Text style={styles.metaSeparator}>•</Text>
          )}
          {session.duration && (
            <Text style={styles.sessionDuration}>{formatDuration(session.duration)}</Text>
          )}
        </View>

        <View style={styles.sessionStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.completedSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{session.exercises.length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          {stats.totalVolume > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(stats.totalVolume).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Volume</Text>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container} testID="history-screen">
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </View>
    );
  }

  const listContent = (
    <>
      {sessions.length === 0 ? (
        <View style={styles.emptyState} testID="history-empty-state">
          <Text style={styles.emptyTitle}>No Workouts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete a workout to see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(session) => session.id}
          contentContainerStyle={styles.listContent}
          testID="history-list"
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </>
  );

  if (isTablet) {
    return (
      <View style={styles.container} testID="history-screen">
        <SplitView
          leftPane={listContent}
          rightPane={
            selectedSession ? (
              <HistoryDetailView session={selectedSession} />
            ) : null
          }
          selectedId={selectedSessionId}
          emptyStateMessage="Select a workout to view details"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="history-screen">
      {listContent}
    </View>
  );
}
