import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/theme';

interface ExerciseTimerProps {
  elapsedSeconds: number;
  targetSeconds: number;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function ExerciseTimer({
  elapsedSeconds,
  targetSeconds,
  isRunning,
  onStart,
  onStop,
}: ExerciseTimerProps) {
  const { colors } = useTheme();

  const progress = targetSeconds > 0 ? Math.min(elapsedSeconds / targetSeconds, 1) : 0;
  const isComplete = elapsedSeconds >= targetSeconds;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const styles = StyleSheet.create({
    container: {
      marginBottom: 12,
      alignItems: 'center',
    },
    timeDisplay: {
      fontSize: 48,
      fontWeight: 'bold',
      color: isComplete ? colors.success : colors.primary,
      fontVariant: ['tabular-nums'],
      marginBottom: 8,
    },
    progressContainer: {
      width: '100%',
      marginBottom: 12,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: isComplete ? colors.success : colors.primary,
      borderRadius: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    startButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
    },
    startButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    stopButton: {
      flex: 1,
      backgroundColor: colors.card,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    stopButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.timeDisplay}>{timeDisplay}</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.buttonRow}>
        {!isRunning ? (
          <TouchableOpacity style={styles.startButton} onPress={onStart}>
            <Text style={styles.startButtonText}>
              {elapsedSeconds > 0 ? 'Resume' : 'Start'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={onStop}>
            <Text style={styles.stopButtonText}>Pause</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
