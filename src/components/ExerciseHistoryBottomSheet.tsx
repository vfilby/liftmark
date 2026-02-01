import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ThemeColors } from '@/theme/colors';
import type { ExerciseSessionData, ExerciseProgressMetrics } from '@/types';
import {
  getExerciseSessionHistory,
  getExerciseProgressMetrics,
} from '@/db/exerciseHistoryRepository';

interface ExerciseHistoryBottomSheetProps {
  exerciseName: string;
  isVisible: boolean;
  onClose: () => void;
  colors: ThemeColors;
}

interface SummaryStats {
  totalSessions: number;
  maxWeight: number;
  avgReps: number;
  totalVolume: number;
  unit: string;
}

export function ExerciseHistoryBottomSheet({
  exerciseName,
  isVisible,
  onClose,
  colors,
}: ExerciseHistoryBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [sessionHistory, setSessionHistory] = useState<ExerciseSessionData[]>([]);
  const [metrics, setMetrics] = useState<ExerciseProgressMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load exercise history and metrics
  useEffect(() => {
    if (!isVisible) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [history, progressMetrics] = await Promise.all([
          getExerciseSessionHistory(exerciseName, 30),
          getExerciseProgressMetrics(exerciseName),
        ]);
        setSessionHistory(history);
        setMetrics(progressMetrics);
      } catch (error) {
        console.error('Error loading exercise history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isVisible, exerciseName]);

  // Compute summary stats from metrics
  const summaryStats = useMemo<SummaryStats>(() => {
    if (!metrics) {
      return {
        totalSessions: 0,
        maxWeight: 0,
        avgReps: 0,
        totalVolume: 0,
        unit: 'lbs',
      };
    }

    return {
      totalSessions: metrics.totalSessions,
      maxWeight: metrics.maxWeight,
      avgReps: metrics.avgRepsPerSet,
      totalVolume: metrics.totalVolume,
      unit: metrics.maxWeightUnit,
    };
  }, [metrics]);

  const styles = createStyles(colors, insets);

  const renderSessionCard = ({ item }: { item: ExerciseSessionData }) => {
    // Calculate session volume
    const sessionVolume = item.sets.reduce((total, set) => {
      const weight = set.actualWeight ?? set.targetWeight ?? 0;
      const reps = set.actualReps ?? set.targetReps ?? 0;
      return total + weight * reps;
    }, 0);

    return (
      <View style={styles.sessionCard}>
        {/* Session Header */}
        <View style={styles.sessionHeader}>
          <View>
            <Text style={styles.sessionDate}>
              {formatDate(item.date)}
            </Text>
            <Text style={styles.sessionWorkout}>{item.workoutName}</Text>
          </View>
          <Text style={styles.sessionVolume}>
            {Math.round(sessionVolume)} vol
          </Text>
        </View>

        {/* Sets List */}
        <View style={styles.setsContainer}>
          {item.sets.map((set, index) => (
            <View key={`${item.sessionId}-set-${index}`} style={styles.setRow}>
              <Text style={styles.setNumber}>Set {set.setIndex + 1}</Text>

              {/* Target */}
              {(set.targetWeight || set.targetReps) && (
                <Text style={styles.setTarget}>
                  {set.targetWeight ? `${set.targetWeight}${set.actualWeightUnit || 'lbs'}` : ''}{' '}
                  {set.targetReps ? `x${set.targetReps}` : ''}
                </Text>
              )}

              {/* Actual */}
              <Text style={styles.setActual}>
                {set.actualWeight ? `${set.actualWeight}${set.actualWeightUnit || 'lbs'}` : ''}{' '}
                {set.actualReps ? `x${set.actualReps}` : ''}
              </Text>

              {/* Notes */}
              {set.notes && <Text style={styles.setNotes}>{set.notes}</Text>}
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <View style={[styles.overlay, { pointerEvents: isVisible ? 'auto' : 'none' }]}>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={0.3}
        onPress={onClose}
      />

      {/* Bottom Sheet Container */}
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{exerciseName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={styles.closeButton}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : sessionHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No workout history for this exercise yet.</Text>
          </View>
        ) : (
          <>
            {/* Summary Stats Card */}
            <View style={styles.summaryCard}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Sessions</Text>
                <Text style={styles.statValue}>{summaryStats.totalSessions}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Max Weight</Text>
                <Text style={styles.statValue}>
                  {summaryStats.maxWeight}
                  <Text style={styles.unitText}>{summaryStats.unit}</Text>
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Avg Reps</Text>
                <Text style={styles.statValue}>{summaryStats.avgReps.toFixed(1)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Volume</Text>
                <Text style={styles.statValue}>{summaryStats.totalVolume}</Text>
              </View>
            </View>

            {/* Session History List */}
            <FlatList
              data={sessionHistory}
              renderItem={renderSessionCard}
              keyExtractor={(item) => item.sessionId}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </>
        )}
      </View>
    </View>
  );
}

// Helper function to format dates
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  // Format as "Jan 15, 2024"
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function createStyles(colors: ThemeColors, insets: { bottom: number }) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      fontSize: 32,
      color: colors.textSecondary,
      fontWeight: '300',
    },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.primaryLightBorder,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statDivider: {
      width: 1,
      height: '100%',
      backgroundColor: colors.primaryLightBorder,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    unitText: {
      fontSize: 12,
      fontWeight: '500',
    },
    listContent: {
      paddingBottom: 16,
    },
    sessionCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 12,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sessionDate: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    sessionWorkout: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    sessionVolume: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    setsContainer: {
      gap: 8,
    },
    setRow: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    setNumber: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    setTarget: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
    },
    setActual: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    setNotes: {
      fontSize: 11,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    separator: {
      height: 0,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 12,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
}
