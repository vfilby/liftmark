import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { getWorkoutSessionById, deleteSession } from '@/db/sessionRepository';
import { useTheme } from '@/theme';
import { HistoryDetailView } from '@/components/HistoryDetailView';
import type { WorkoutSession } from '@/types';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDelete = () => {
    if (!session) return;

    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${session.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSession(session.id);
              router.back();
            } catch (error) {
              console.error('Failed to delete session:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    async function loadSession() {
      if (!id) return;
      try {
        const loadedSession = await getWorkoutSessionById(id);
        setSession(loadedSession);
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, [id]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
    },
    deleteButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    deleteButtonText: {
      fontSize: 16,
      color: colors.error,
      fontWeight: '500',
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Workout not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: session.name,
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <HistoryDetailView session={session} />
    </View>
  );
}
