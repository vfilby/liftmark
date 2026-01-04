import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/theme';

interface RestTimerProps {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  onStop: () => void;
}

export default function RestTimer({
  remainingSeconds,
  totalSeconds,
  isRunning,
  onStop,
}: RestTimerProps) {
  const { colors } = useTheme();
  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const styles = StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    timerInfo: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginRight: 12,
    },
    timerLabel: {
      fontSize: 14,
      color: colors.primary,
      marginRight: 6,
    },
    timeDisplay: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
    },
    progressContainer: {
      flex: 1,
      marginRight: 12,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    skipButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.container}>
      {/* Compact inline timer */}
      <View style={styles.timerRow}>
        <View style={styles.timerInfo}>
          <Text style={styles.timerLabel}>Rest</Text>
          <Text style={styles.timeDisplay}>{timeDisplay}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={onStop}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
