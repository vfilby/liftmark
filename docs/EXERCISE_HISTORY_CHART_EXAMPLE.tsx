/**
 * ExerciseHistoryChart Integration Example
 * Shows how to integrate the component with a real screen
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { ExerciseHistoryChart } from '@/components/ExerciseHistoryChart';
import { ExerciseHistoryPoint, ChartMetricType } from '@/types';
import { useTheme } from '@/theme';

/**
 * Example 1: Simple Exercise Detail Screen
 */
export function ExerciseDetailScreen({ exerciseName }: { exerciseName: string }) {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricType>('maxWeight');

  // Mock history data - in real app, fetch from database
  const historyData: ExerciseHistoryPoint[] = [
    { date: '2025-01-01', workoutName: 'Push Day', maxWeight: 185, avgReps: 8, totalVolume: 1480, setsCount: 3, avgTime: 0, maxTime: 0, unit: 'lbs' },
    { date: '2025-01-08', workoutName: 'Push Day', maxWeight: 190, avgReps: 8, totalVolume: 1520, setsCount: 3, avgTime: 0, maxTime: 0, unit: 'lbs' },
    { date: '2025-01-15', workoutName: 'Push Day', maxWeight: 195, avgReps: 9, totalVolume: 1755, setsCount: 3, avgTime: 0, maxTime: 0, unit: 'lbs' },
    { date: '2025-01-22', workoutName: 'Push Day', maxWeight: 200, avgReps: 9, totalVolume: 1800, setsCount: 3, avgTime: 0, maxTime: 0, unit: 'lbs' },
    { date: '2025-01-29', workoutName: 'Push Day', maxWeight: 205, avgReps: 10, totalVolume: 2050, setsCount: 3, avgTime: 0, maxTime: 0, unit: 'lbs' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <ExerciseHistoryChart
          exerciseName={exerciseName}
          historyData={historyData}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          colors={colors}
        />
      </View>
    </ScrollView>
  );
}

/**
 * Example 2: Exercise with Data Fetching
 */
export function ExerciseDetailScreenWithData({
  exerciseName,
  getExerciseHistory,
}: {
  exerciseName: string;
  getExerciseHistory: (name: string) => Promise<ExerciseHistoryPoint[]>;
}) {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricType>('maxWeight');
  const [historyData, setHistoryData] = useState<ExerciseHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getExerciseHistory(exerciseName);
        setHistoryData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
        setHistoryData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [exerciseName, getExerciseHistory]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading exercise history...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && (
          <ExerciseHistoryChart
            exerciseName={exerciseName}
            historyData={historyData}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            colors={colors}
          />
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Example 3: Multiple Exercises Dashboard
 */
export function ExercisesDashboard({
  exercises,
  getExerciseHistory,
}: {
  exercises: string[];
  getExerciseHistory: (name: string) => Promise<ExerciseHistoryPoint[]>;
}) {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricType>('maxWeight');
  const [historyData, setHistoryData] = useState<Record<string, ExerciseHistoryPoint[]>>({});

  useEffect(() => {
    const loadAllData = async () => {
      const data: Record<string, ExerciseHistoryPoint[]> = {};

      for (const exercise of exercises) {
        try {
          const history = await getExerciseHistory(exercise);
          data[exercise] = history;
        } catch (error) {
          data[exercise] = [];
        }
      }

      setHistoryData(data);
    };

    loadAllData();
  }, [exercises, getExerciseHistory]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        {exercises.map((exercise) => (
          <ExerciseHistoryChart
            key={exercise}
            exerciseName={exercise}
            historyData={historyData[exercise] || []}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            colors={colors}
          />
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Example 4: Workout Session History View
 * Shows progress for multiple exercises from a specific workout
 */
export function WorkoutSessionView({
  workoutName,
  exercises,
  getSessionData,
}: {
  workoutName: string;
  exercises: string[];
  getSessionData: (workoutName: string, exerciseName: string) => Promise<ExerciseHistoryPoint[]>;
}) {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricType>('maxWeight');
  const [allHistoryData, setAllHistoryData] = useState<Record<string, ExerciseHistoryPoint[]>>({});

  useEffect(() => {
    const loadData = async () => {
      const data: Record<string, ExerciseHistoryPoint[]> = {};

      for (const exercise of exercises) {
        try {
          const history = await getSessionData(workoutName, exercise);
          data[exercise] = history;
        } catch (error) {
          data[exercise] = [];
        }
      }

      setAllHistoryData(data);
    };

    loadData();
  }, [workoutName, exercises, getSessionData]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        {exercises.map((exercise) => (
          <ExerciseHistoryChart
            key={exercise}
            exerciseName={exercise}
            historyData={allHistoryData[exercise] || []}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            colors={colors}
          />
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Example 5: Route Integration with Expo Router
 * Shows how to integrate with React Navigation/Expo Router
 */
export function ExerciseDetailRoute() {
  const route = {
    params: {
      exerciseName: 'Bench Press',
    },
  };

  return <ExerciseDetailScreen exerciseName={route.params.exerciseName} />;
}

/**
 * Example 6: With Performance Tracking
 * Shows metrics over specific time periods
 */
export function ProgressTrackingScreen({
  exerciseName,
  getHistoryForPeriod,
}: {
  exerciseName: string;
  getHistoryForPeriod: (exerciseName: string, days: number) => Promise<ExerciseHistoryPoint[]>;
}) {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricType>('maxWeight');
  const [period, setPeriod] = useState<30 | 90 | 180>(30); // days
  const [historyData, setHistoryData] = useState<ExerciseHistoryPoint[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const data = await getHistoryForPeriod(exerciseName, period);
      setHistoryData(data);
    };

    loadData();
  }, [exerciseName, period, getHistoryForPeriod]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        {/* Period selector */}
        <View style={styles.periodSelector}>
          {[30, 90, 180].map((days) => (
            <TouchableOpacity
              key={days}
              style={[
                styles.periodButton,
                period === days && { backgroundColor: colors.primary },
              ]}
              onPress={() => setPeriod(days as 30 | 90 | 180)}
            >
              <Text style={{ color: period === days ? '#fff' : colors.textSecondary }}>
                {days}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ExerciseHistoryChart
          exerciseName={exerciseName}
          historyData={historyData}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          colors={colors}
        />
      </View>
    </ScrollView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
});
