import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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
  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

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

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 12,
  },
  timerLabel: {
    fontSize: 14,
    color: '#1e40af',
    marginRight: 6,
  },
  timeDisplay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  progressContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#dbeafe',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  skipButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
});
