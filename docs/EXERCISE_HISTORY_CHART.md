# ExerciseHistoryChart Component Documentation

## Overview

The `ExerciseHistoryChart` component provides a visual representation of exercise performance over time using Victory Native for charting. It supports multiple metrics (Max Weight, Reps, Volume) with interactive metric toggling and touch-based data visualization.

## Features

- **Multi-Metric Support**: Track performance by Max Weight, Reps, or Volume
- **Interactive Metric Switching**: Toggle between metrics with button controls
- **Touch Tooltips**: Tap data points to see detailed information
- **Dark/Light Theme Support**: Automatically adapts to theme colors
- **Statistics Display**: Shows current value, best value, and percentage change
- **Empty State Handling**: Graceful fallback for insufficient data (< 2 sessions)
- **Responsive Design**: Adapts to screen width automatically

## Installation

The component requires `victory-native@37.0.2`:

```bash
npm install victory-native@37.0.2
```

## Basic Usage

```typescript
import ExerciseHistoryChart, { HistoryDataPoint } from '@/components/ExerciseHistoryChart';
import { useTheme } from '@/theme';

export function MyExerciseScreen() {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<'maxWeight' | 'reps' | 'volume'>('maxWeight');

  const historyData: HistoryDataPoint[] = [
    {
      date: '2025-01-01',
      maxWeight: 185,
      reps: 8,
      volume: 1480,
    },
    {
      date: '2025-01-08',
      maxWeight: 190,
      reps: 8,
      volume: 1520,
    },
    {
      date: '2025-01-15',
      maxWeight: 195,
      reps: 9,
      volume: 1755,
    },
  ];

  return (
    <ExerciseHistoryChart
      exerciseName="Bench Press"
      historyData={historyData}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      colors={colors}
    />
  );
}
```

## Props

### `exerciseName`
- **Type**: `string`
- **Required**: Yes
- **Description**: The name of the exercise being tracked

### `historyData`
- **Type**: `HistoryDataPoint[]`
- **Required**: Yes
- **Description**: Array of historical performance data points
- **Structure**:
  ```typescript
  interface HistoryDataPoint {
    date: string;           // ISO date string (YYYY-MM-DD)
    maxWeight?: number;     // Maximum weight lifted (lbs/kg)
    reps?: number;          // Number of repetitions
    volume?: number;        // Total volume (weight × reps)
  }
  ```

### `selectedMetric`
- **Type**: `'maxWeight' | 'reps' | 'volume'`
- **Required**: Yes
- **Description**: Currently selected metric to display

### `onMetricChange`
- **Type**: `(metric: 'maxWeight' | 'reps' | 'volume') => void`
- **Required**: Yes
- **Description**: Callback fired when user changes the selected metric

### `colors`
- **Type**: `ThemeColors`
- **Required**: Yes
- **Description**: Theme colors object from `useTheme()` hook

## Data Requirements

### Minimum Data Points
- The chart requires at least **2 valid data points** for the selected metric to display
- If fewer than 2 points exist, an empty state is shown

### Data Point Structure
Each data point should represent a single workout session for the exercise:

```typescript
{
  date: '2025-01-15',    // ISO date string
  maxWeight: 195,        // Heaviest weight used in that session
  reps: 9,               // Reps achieved at max weight
  volume: 1755,          // Total volume (sum of all sets: weight × reps)
}
```

### Handling Missing Values
The component gracefully handles undefined/null values:
- Data points with undefined metric values are filtered out
- If all points for a metric are undefined, empty state displays
- Other metrics remain unaffected

## Styling & Theming

The component automatically adapts to the current theme:

### Light Theme
- Clean white card background
- Blue accent colors for the chart line
- Light gray backgrounds for buttons

### Dark Theme
- Dark gray card background
- Lighter blue accent colors
- Dark backgrounds for buttons

### Customization

The component uses the following theme colors:
- `colors.card` - Container background
- `colors.text` - Primary text
- `colors.textSecondary` - Secondary text and labels
- `colors.primary` - Chart line and accent color
- `colors.border` - Component borders
- `colors.borderLight` - Light dividers
- `colors.backgroundSecondary` - Button and chart backgrounds
- `colors.success` - Positive change indicator
- `colors.error` - Negative change indicator

## Statistics Display

The component shows three key statistics below the chart:

### Current
The most recent value for the selected metric

### Best
The highest value recorded for the selected metric

### Change
The percentage change from the second-to-last point to the current point
- Green color for positive changes
- Red color for negative changes

## Empty State

When insufficient data is available, the component displays:
- A chart icon emoji (📊)
- Message: "Complete more sessions to see progress"
- All metric toggle buttons remain functional for switching between metrics

## Victory Native Integration

### Chart Configuration
- **Chart Type**: VictoryLine (line chart with monotone interpolation)
- **X-Axis**: Session index (displays dates on hover)
- **Y-Axis**: Metric value with auto-scaled domain
- **Padding**: 10px top, 30px right, 30px bottom, 50px left
- **Size**: Responsive to window width, fixed height of 200px

### Theme Adapter

The component includes a built-in `createVictoryTheme` function:

```typescript
function createVictoryTheme(colors: ThemeColors) {
  return {
    axis: {
      style: {
        axis: { stroke: colors.border, strokeWidth: 1 },
        grid: { stroke: colors.borderLight, strokeWidth: 0.5 },
        tickLabels: {
          fill: colors.textSecondary,
          fontSize: 11,
          fontFamily: 'System',
        },
      },
    },
    line: {
      style: {
        data: {
          stroke: colors.primary,
          strokeWidth: 2.5,
        },
      },
    },
  };
}
```

## Performance Considerations

### Data Filtering
- Invalid data points (with undefined metric values) are filtered client-side
- Filtering is memoized using `useMemo` to prevent unnecessary recalculation

### Chart Rendering
- Chart dimensions are calculated from `Dimensions.get('window').width`
- Responsive to screen size changes
- Y-axis domain is calculated with 10% padding for visual clarity

### Statistics Calculation
- All statistics are memoized and only recalculate when data or metric changes
- Percentage calculations handle division by zero gracefully

## Examples

### Tracking Multiple Exercises

```typescript
const [selectedMetric, setSelectedMetric] = useState<'maxWeight' | 'reps' | 'volume'>('maxWeight');

return (
  <ScrollView>
    <ExerciseHistoryChart
      exerciseName="Bench Press"
      historyData={benchPressHistory}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      colors={colors}
    />
    <ExerciseHistoryChart
      exerciseName="Squat"
      historyData={squatHistory}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      colors={colors}
    />
    <ExerciseHistoryChart
      exerciseName="Deadlift"
      historyData={deadliftHistory}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      colors={colors}
    />
  </ScrollView>
);
```

### With Session Fetching

```typescript
import { useEffect, useState } from 'react';
import { getExerciseHistory } from '@/services/workoutService';

export function ExerciseDetailScreen({ exerciseName }: Props) {
  const { colors } = useTheme();
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'maxWeight' | 'reps' | 'volume'>('maxWeight');

  useEffect(() => {
    getExerciseHistory(exerciseName).then(setHistory);
  }, [exerciseName]);

  return (
    <ExerciseHistoryChart
      exerciseName={exerciseName}
      historyData={history}
      selectedMetric={selectedMetric}
      onMetricChange={setSelectedMetric}
      colors={colors}
    />
  );
}
```

## Testing

The component includes comprehensive test coverage:

```bash
npm test -- ExerciseHistoryChart.test.tsx
```

### Test Categories
- **Rendering**: Component displays correctly with exercise name and labels
- **Empty State**: Handles insufficient data gracefully
- **Metric Selection**: Metric toggle buttons work correctly
- **Statistics**: Statistics are calculated accurately
- **Theme Support**: Adapts to light/dark themes
- **Data Filtering**: Invalid data points are filtered appropriately
- **Metric Calculation**: All metrics (maxWeight, reps, volume) display correctly

## Troubleshooting

### Chart Not Displaying
- Ensure at least 2 valid data points exist for the selected metric
- Check that `colors` prop is properly provided from `useTheme()`
- Verify `victory-native` is installed: `npm list victory-native`

### Metric Values Not Updating
- Confirm `onMetricChange` callback is implemented
- Check that `selectedMetric` state is updated correctly
- Verify component receives updated props

### Theme Colors Not Applied
- Ensure component receives `colors` from `useTheme()` hook
- Check that theme context provider is properly initialized
- Verify color definitions in `/src/theme/colors.ts`

### Data Points Missing
- Ensure `HistoryDataPoint` objects have valid `date` in ISO format
- Check that selected metric values are not `undefined`
- Use `console.log` to inspect filtered data with `validData`

## API Reference

### Component Exports

```typescript
// Default export
export default function ExerciseHistoryChart(props: ExerciseHistoryChartProps): JSX.Element

// Type exports
export interface HistoryDataPoint
export interface ExerciseHistoryChartProps
```

### Helper Functions

These are internal utilities but may be useful for understanding the component:

- `createVictoryTheme(colors)` - Creates Victory theme from ThemeColors
- `formatChartData(data, metric)` - Converts history data to chart format
- `formatAxisDate(index, allData)` - Formats dates for X-axis display
- `getMetricLabel(metric)` - Returns display label for metric

## Future Enhancements

Potential improvements for future versions:

1. **Touch Gesture Support**: Add pan/zoom for zooming into specific date ranges
2. **Time Period Filtering**: Allow filtering by week/month/year
3. **Trend Analysis**: Display trend lines or moving averages
4. **Goal Tracking**: Overlay user-defined goals on the chart
5. **Comparison**: Compare metrics side-by-side or across exercises
6. **Export**: Export chart as image or data as CSV

## Version History

### v1.0.0
- Initial release with Victory Native v37.0.2
- Support for maxWeight, reps, and volume metrics
- Light/dark theme support
- Empty state handling
- Statistics display with change calculation
