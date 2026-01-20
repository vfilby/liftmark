import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';
import { WorkoutDetailView } from '@/components/WorkoutDetailView';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedWorkout, loadWorkout, reprocessWorkout, isLoading, error, clearError } = useWorkoutStore();
  const { startWorkout, checkForActiveSession } = useSessionStore();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartWorkout = async () => {
    if (!selectedWorkout || isStarting) return;

    // Check for existing active session
    const hasActive = await checkForActiveSession();
    if (hasActive) {
      Alert.alert(
        'Workout In Progress',
        'You have another workout in progress. Please finish or cancel it first.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Resume Workout',
            onPress: () => router.push('/workout/active'),
          },
        ]
      );
      return;
    }

    setIsStarting(true);
    try {
      await startWorkout(selectedWorkout);
      router.push('/workout/active');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setIsStarting(false);
    }
  };

  const handleReprocess = async () => {
    if (!id || isReprocessing) return;

    Alert.alert(
      'Reprocess Workout',
      'This will re-parse the workout from its original markdown. Any manual edits will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reprocess',
          onPress: async () => {
            setIsReprocessing(true);
            const result = await reprocessWorkout(id);
            setIsReprocessing(false);

            if (result.success) {
              Alert.alert('Success', 'Workout has been reprocessed.');
            } else {
              Alert.alert('Error', result.errors?.join('\n') || 'Failed to reprocess workout');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (id) {
      loadWorkout(id);
    }
  }, [id]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => { clearError(); router.back(); } },
      ]);
    }
  }, [error]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 100,
    },
  });

  if (!selectedWorkout) {
    return (
      <View style={styles.container} testID="workout-detail-loading">
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <WorkoutDetailView
      workout={selectedWorkout}
      onStartWorkout={handleStartWorkout}
      onReprocess={handleReprocess}
      isStarting={isStarting}
      isReprocessing={isReprocessing}
      showBackButton={true}
    />
  );
}
