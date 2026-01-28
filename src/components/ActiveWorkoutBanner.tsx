import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';

export function ActiveWorkoutBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const { activeSession, currentExerciseIndex } = useSessionStore();

  // Don't show banner if:
  // 1. No active session
  // 2. Already on the active workout screen
  if (!activeSession || pathname === '/workout/active') {
    return null;
  }

  const currentExercise = activeSession.exercises[currentExerciseIndex];
  const completedExercises = activeSession.exercises.filter((e) => e.status === 'completed').length;
  const totalExercises = activeSession.exercises.length;

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        { backgroundColor: colors?.primary || '#2563eb', borderBottomColor: colors?.border || '#e5e7eb' },
      ]}
      onPress={() => router.push('/workout/active')}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {activeSession.name}
          </Text>
          <Text style={styles.subtitle}>
            {currentExercise?.exerciseName || 'In Progress'} • {completedExercises}/{totalExercises} exercises
          </Text>
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText}>Return</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
