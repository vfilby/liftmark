import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { format, parseISO } from 'date-fns';
import { ThemeColors } from '@/theme/colors';
import type { ExerciseHistoryPoint, ChartMetricType } from '@/types';

/**
 * Props for ExerciseHistoryChart component
 */
interface ExerciseHistoryChartProps {
  exerciseName: string;
  historyData: ExerciseHistoryPoint[];
  selectedMetric: ChartMetricType;
  onMetricChange: (metric: ChartMetricType) => void;
  colors: ThemeColors;
}

/**
 * Gets the metric label and unit
 */
function getMetricLabel(metric: ChartMetricType) {
  const labels: Record<ChartMetricType, string> = {
    weight: 'Max Weight (lbs)',
    reps: 'Reps',
    volume: 'Volume (lbs)',
  };
  return labels[metric];
}

/**
 * ExerciseHistoryChart Component
 * Displays exercise performance over time with selectable metrics
 */
export function ExerciseHistoryChart({
  exerciseName,
  historyData,
  selectedMetric,
  onMetricChange,
  colors,
}: ExerciseHistoryChartProps) {
  // Format data for Gifted Charts
  const chartData = useMemo(() => {
    return historyData
      .filter((point) => {
        if (selectedMetric === 'weight') return point.maxWeight != null;
        if (selectedMetric === 'reps') return point.avgReps != null;
        if (selectedMetric === 'volume') return point.totalVolume != null;
        return false;
      })
      .map((point) => {
        let value = 0;
        if (selectedMetric === 'weight') value = point.maxWeight || 0;
        if (selectedMetric === 'reps') value = Math.round(point.avgReps || 0);
        if (selectedMetric === 'volume') value = point.totalVolume || 0;

        // Format date label
        let dateLabel = '';
        try {
          const date = parseISO(point.date);
          dateLabel = format(date, 'MM/dd');
        } catch {
          dateLabel = point.date.substring(5, 10); // Fallback to MM-DD
        }

        return {
          value,
          label: dateLabel,
          dataPointText: value.toFixed(selectedMetric === 'reps' ? 0 : 1),
        };
      });
  }, [historyData, selectedMetric]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { current: 0, best: 0, change: 0 };
    }

    const values = chartData.map((d) => d.value);
    const current = values[values.length - 1];
    const best = Math.max(...values);
    const previous = values.length > 1 ? values[values.length - 2] : current;
    const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    return { current, best, change };
  }, [chartData]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    metricsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    metricButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    metricButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    metricButtonInactive: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
    },
    metricButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    metricButtonTextActive: {
      color: '#fff',
    },
    metricButtonTextInactive: {
      color: colors.textSecondary,
    },
    chartContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 12,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      padding: 16,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyStateIcon: {
      fontSize: 32,
      marginBottom: 12,
    },
    statsContainer: {
      marginTop: 16,
      flexDirection: 'row',
      gap: 12,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    statChange: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    statChangePositive: {
      color: colors.success,
    },
    statChangeNegative: {
      color: colors.error,
    },
  });

  // Show empty state if insufficient data
  if (chartData.length < 2) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{exerciseName}</Text>
          <Text style={styles.metricLabel}>Performance History</Text>
        </View>

        <View style={styles.metricsContainer}>
          {(['weight', 'reps', 'volume'] as const).map((metric) => (
            <TouchableOpacity
              key={metric}
              style={[
                styles.metricButton,
                selectedMetric === metric
                  ? styles.metricButtonActive
                  : styles.metricButtonInactive,
              ]}
              onPress={() => onMetricChange(metric)}
            >
              <Text
                style={[
                  styles.metricButtonText,
                  selectedMetric === metric
                    ? styles.metricButtonTextActive
                    : styles.metricButtonTextInactive,
                ]}
              >
                {getMetricLabel(metric).split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📊</Text>
          <Text style={styles.emptyStateText}>
            Complete more sessions to see progress
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{exerciseName}</Text>
        <Text style={styles.metricLabel}>{getMetricLabel(selectedMetric)}</Text>
      </View>

      {/* Metric toggle buttons */}
      <View style={styles.metricsContainer}>
        {(['weight', 'reps', 'volume'] as const).map((metric) => (
          <TouchableOpacity
            key={metric}
            style={[
              styles.metricButton,
              selectedMetric === metric
                ? styles.metricButtonActive
                : styles.metricButtonInactive,
            ]}
            onPress={() => onMetricChange(metric)}
          >
            <Text
              style={[
                styles.metricButtonText,
                selectedMetric === metric
                  ? styles.metricButtonTextActive
                  : styles.metricButtonTextInactive,
              ]}
            >
              {getMetricLabel(metric).split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={Dimensions.get('window').width - 96}
          height={200}
          color={colors.primary}
          thickness={3}
          dataPointsColor={colors.primary}
          dataPointsRadius={5}
          curved
          animateOnDataChange
          animationDuration={500}
          hideRules
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 11 }}
          xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
          showVerticalLines={false}
          spacing={chartData.length > 5 ? 40 : 60}
          initialSpacing={20}
          endSpacing={20}
          noOfSections={4}
          yAxisOffset={0}
          textShiftY={-8}
          textShiftX={-5}
          textColor={colors.text}
          textFontSize={10}
        />
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={styles.statValue}>
            {selectedMetric === 'reps'
              ? stats.current.toFixed(0)
              : stats.current.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Best</Text>
          <Text style={styles.statValue}>
            {selectedMetric === 'reps'
              ? stats.best.toFixed(0)
              : stats.best.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Change</Text>
          <Text style={styles.statValue}>
            {stats.change > 0 ? '+' : ''}
            {stats.change.toFixed(1)}%
          </Text>
          <Text
            style={[
              styles.statChange,
              stats.change >= 0
                ? styles.statChangePositive
                : styles.statChangeNegative,
            ]}
          >
            {stats.change >= 0 ? '↑' : '↓'}
          </Text>
        </View>
      </View>
    </View>
  );
}
