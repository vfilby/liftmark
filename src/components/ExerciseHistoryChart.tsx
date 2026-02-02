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
    maxWeight: 'Max Weight (lbs)',
    totalVolume: 'Volume (lbs)',
    reps: 'Reps',
    time: 'Time (seconds)',
  };
  return labels[metric];
}

/**
 * Detect exercise type from history data
 * Returns: 'weighted', 'bodyweight', or 'timed'
 */
function detectExerciseType(historyData: ExerciseHistoryPoint[]): 'weighted' | 'bodyweight' | 'timed' {
  if (historyData.length === 0) return 'weighted'; // Default

  // Check if any session has weights
  const hasWeights = historyData.some(point => point.maxWeight > 0);

  // Check if any session has time data
  const hasTime = historyData.some(point => point.maxTime > 0 || point.avgTime > 0);

  if (hasWeights) {
    return 'weighted';
  } else if (hasTime) {
    return 'timed';
  } else {
    return 'bodyweight';
  }
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
  // Detect exercise type from history data
  const exerciseType = useMemo(() => detectExerciseType(historyData), [historyData]);

  // Adjust selected metric based on exercise type
  const effectiveMetric = useMemo(() => {
    if (exerciseType === 'bodyweight') return 'reps';
    if (exerciseType === 'timed') return 'time';
    return selectedMetric; // Use selected metric for weighted exercises
  }, [exerciseType, selectedMetric]);

  // Format data for Gifted Charts with dual Y-axis (primary: weight/volume, secondary: reps)
  const { chartData, secondaryData, maxReps, showSecondaryAxis } = useMemo(() => {
    const filtered = historyData.filter((point) => {
      if (effectiveMetric === 'maxWeight') return point.maxWeight != null;
      if (effectiveMetric === 'totalVolume') return point.totalVolume != null;
      if (effectiveMetric === 'reps') return point.avgReps != null;
      if (effectiveMetric === 'time') return point.maxTime != null || point.avgTime != null;
      return false;
    });

    const primary = filtered.map((point) => {
      let value = 0;
      if (effectiveMetric === 'maxWeight') value = point.maxWeight || 0;
      if (effectiveMetric === 'totalVolume') value = point.totalVolume || 0;
      if (effectiveMetric === 'reps') value = Math.round(point.avgReps || 0);
      if (effectiveMetric === 'time') value = Math.round(point.maxTime || point.avgTime || 0);

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
        dataPointText: effectiveMetric === 'reps' || effectiveMetric === 'time' ? value.toString() : value.toFixed(1),
      };
    });

    // Only show secondary axis for weighted exercises
    const shouldShowSecondary = exerciseType === 'weighted';

    if (!shouldShowSecondary) {
      return { chartData: primary, secondaryData: [], maxReps: 0, showSecondaryAxis: false };
    }

    // Calculate scale for secondary Y-axis (reps)
    const repValues = filtered.map((point) => Math.round(point.avgReps || 0));
    const maxRepValue = Math.max(...repValues, 1);
    const calculatedMaxReps = Math.max(Math.ceil((maxRepValue * 1.2) / 5) * 5, 15);

    // Get primary axis max value
    const primaryValues = primary.map(p => p.value);
    const maxPrimaryValue = Math.max(...primaryValues, 1);

    // Scale secondary data to match primary axis range
    // This ensures the data points are positioned correctly on the chart
    const scaleFactor = maxPrimaryValue / calculatedMaxReps;

    const secondary = filtered.map((point) => {
      const actualReps = Math.round(point.avgReps || 0);
      return {
        value: actualReps * scaleFactor, // Scale to primary axis range
        label: '',
        dataPointText: actualReps.toString(), // Show actual rep count
      };
    });

    return { chartData: primary, secondaryData: secondary, maxReps: calculatedMaxReps, showSecondaryAxis: true };
  }, [historyData, effectiveMetric, exerciseType]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { current: 0, best: 0, change: 0, hasComparison: false };
    }

    const values = chartData.map((d) => d.value);
    const current = values[values.length - 1];
    const best = Math.max(...values);

    // Only calculate change if we have at least 2 data points
    let change = 0;
    let hasComparison = false;
    if (values.length > 1) {
      const previous = values[values.length - 2];
      change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
      hasComparison = true;
    }

    return { current, best, change, hasComparison };
  }, [chartData]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
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
      padding: 12,
      minHeight: 160,
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
    legendContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
  });

  // Show empty state only if no data at all
  if (chartData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{exerciseName}</Text>
          <Text style={styles.metricLabel}>Performance History</Text>
        </View>

        {exerciseType === 'weighted' && (
          <View style={styles.metricsContainer}>
            {(['maxWeight', 'totalVolume'] as ChartMetricType[]).map((metric) => (
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
        )}

        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📊</Text>
          <Text style={styles.emptyStateText}>
            No history data available for this metric
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

      {/* Metric toggle buttons - only for weighted exercises */}
      {exerciseType === 'weighted' && (
        <View style={styles.metricsContainer}>
          {(['maxWeight', 'totalVolume'] as ChartMetricType[]).map((metric) => (
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
      )}

      {/* Chart legend - only show for weighted exercises */}
      {showSecondaryAxis && (
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>
              {effectiveMetric === 'maxWeight' ? 'Weight (lbs)' : 'Volume (lbs)'}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.chartLineSecondary }]} />
            <Text style={styles.legendText}>Reps</Text>
          </View>
        </View>
      )}

      {/* Chart - dual Y-axis for weighted, single axis for bodyweight/timed */}
      <View style={styles.chartContainer}>
        {showSecondaryAxis ? (
          <LineChart
            data={chartData}
            data2={secondaryData}
            width={Dimensions.get('window').width - 128}
            height={140}
            color={colors.primary}
            color2={colors.chartLineSecondary}
            thickness={3}
            thickness2={2}
            dataPointsColor={colors.primary}
            dataPointsColor2={colors.chartLineSecondary}
            dataPointsRadius={5}
            dataPointsRadius2={4}
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
            endSpacing={30}
            noOfSections={4}
            yAxisOffset={0}
            yAxisLabelWidth={35}
            textShiftY={-8}
            textShiftX={-5}
            textColor={colors.text}
            textFontSize={10}
            secondaryYAxis={{
              yAxisColor: colors.border,
              yAxisTextStyle: { color: colors.chartLineSecondary, fontSize: 11 },
              yAxisOffset: 0,
              yAxisLabelWidth: 30,
              noOfSections: 4,
              maxValue: maxReps,
              showFractionalValues: false,
            }}
            showDataPointLabelForSecondaryData
          />
        ) : (
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 96}
            height={140}
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
        )}
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={styles.statValue}>
            {stats.current.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Best</Text>
          <Text style={styles.statValue}>
            {stats.best.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Change</Text>
          {stats.hasComparison ? (
            <>
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
            </>
          ) : (
            <Text style={[styles.statValue, { color: colors.textSecondary }]}>—</Text>
          )}
        </View>
      </View>
    </View>
  );
}
