import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { getExerciseHistory } from '@/db/sessionRepository';

interface ExerciseTrendViewProps {
  exerciseName: string;
}

export function ExerciseTrendView({ exerciseName }: ExerciseTrendViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getExerciseHistory>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && history.length === 0) {
      loadHistory();
    }
  }, [isExpanded]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getExerciseHistory(exerciseName, 10);
      setHistory(data);
    } catch (error) {
      console.error('Error loading exercise history:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateVolume = (sets: typeof history[0]['sets']): number => {
    return sets.reduce((total, set) => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      return total + (weight * reps);
    }, 0);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getTrendIndicator = (): string => {
    if (history.length < 2) return '';

    // Compare most recent vs previous session
    const recent = history[0];
    const previous = history[1];

    const recentVolume = calculateVolume(recent.sets);
    const previousVolume = calculateVolume(previous.sets);

    if (recentVolume > previousVolume) return '↗';
    if (recentVolume < previousVolume) return '↘';
    return '→';
  };

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={styles.collapsedContainer}
        onPress={() => setIsExpanded(true)}
      >
        <Text style={styles.collapsedText}>View exercise history</Text>
        {history.length > 0 && (
          <Text style={styles.trendIndicator}>{getTrendIndicator()}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.expandedContainer}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(false)}
      >
        <Text style={styles.headerText}>Exercise History</Text>
        <Text style={styles.collapseIcon}>▼</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <View style={styles.historyList}>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No previous history found</Text>
          ) : (
            history.map((session, index) => {
              const volume = calculateVolume(session.sets);
              const maxWeight = Math.max(...session.sets.map(s => s.weight || 0));
              const totalReps = session.sets.reduce((sum, s) => sum + (s.reps || 0), 0);
              const unit = session.sets[0]?.unit || 'lbs';

              return (
                <View key={session.sessionId} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>{formatDate(session.sessionDate)}</Text>
                    {index === 0 && <Text style={styles.recentBadge}>Most Recent</Text>}
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Sets</Text>
                      <Text style={styles.statValue}>{session.sets.length}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Max Weight</Text>
                      <Text style={styles.statValue}>
                        {maxWeight > 0 ? `${maxWeight}${unit}` : 'BW'}
                      </Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Total Reps</Text>
                      <Text style={styles.statValue}>{totalReps}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Volume</Text>
                      <Text style={styles.statValue}>
                        {volume > 0 ? `${volume.toLocaleString()}${unit}` : '-'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.setsDetail}>
                    {session.sets.map((set, setIndex) => (
                      <Text key={setIndex} style={styles.setDetail}>
                        {set.weight ? `${set.weight}${unit}` : 'BW'} × {set.reps || 0}
                        {set.rpe ? ` @ RPE ${set.rpe}` : ''}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginVertical: 4,
  },
  collapsedText: {
    fontSize: 13,
    color: '#666',
  },
  trendIndicator: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expandedContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  collapseIcon: {
    fontSize: 12,
    color: '#666',
  },
  loader: {
    paddingVertical: 20,
  },
  historyList: {
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontSize: 14,
  },
  historyItem: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recentBadge: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  setsDetail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setDetail: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
});
