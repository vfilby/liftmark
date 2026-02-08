import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutPlanStore } from '@/stores/workoutPlanStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toggleFavoritePlan } from '@/db/repository';
import { useTheme } from '@/theme';
import { WorkoutDetailView } from '@/components/WorkoutDetailView';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedPlan, loadPlan, reprocessPlan, isLoading, error, clearError } = useWorkoutPlanStore();
  const { startWorkout, checkForActiveSession } = useSessionStore();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartWorkout = async () => {
    if (!selectedPlan || isStarting) return;

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
      await startWorkout(selectedPlan);
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
      'Reprocess Plan',
      'This will re-parse the plan from its original markdown. Any manual edits will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reprocess',
          onPress: async () => {
            setIsReprocessing(true);
            const result = await reprocessPlan(id);
            setIsReprocessing(false);

            if (result.success) {
              Alert.alert('Success', 'Plan has been reprocessed.');
            } else {
              Alert.alert('Error', result.errors?.join('\n') || 'Failed to reprocess plan');
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async () => {
    if (!id) return;

    try {
      await toggleFavoritePlan(id);
      // Reload the plan to get updated favorite status
      loadPlan(id);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  useEffect(() => {
    if (id) {
      loadPlan(id);
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

  if (!selectedPlan) {
    return (
      <View style={styles.container} testID="workout-detail-loading">
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <WorkoutDetailView
      workout={selectedPlan}
      onStartWorkout={handleStartWorkout}
      onReprocess={handleReprocess}
      onToggleFavorite={handleToggleFavorite}
      isStarting={isStarting}
      isReprocessing={isReprocessing}
      showBackButton={true}
    />
  );
}
