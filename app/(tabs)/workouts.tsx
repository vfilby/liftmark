import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useTheme } from '@/theme';
import type { WorkoutTemplate } from '@/types';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { workouts, loadWorkouts, removeWorkout, searchWorkouts, error, clearError } =
    useWorkoutStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadWorkouts();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    searchWorkouts(query);
  };

  const handleDelete = (workout: WorkoutTemplate) => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workout.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeWorkout(workout.id),
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      padding: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    list: {
      padding: 16,
    },
    workoutCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      overflow: 'hidden',
    },
    workoutContent: {
      padding: 16,
    },
    workoutHeader: {
      marginBottom: 8,
    },
    workoutName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    tagText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },
    tagMore: {
      fontSize: 12,
      color: colors.textSecondary,
      alignSelf: 'center',
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    workoutMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    metaSeparator: {
      fontSize: 14,
      color: colors.border,
      marginHorizontal: 8,
    },
    deleteButton: {
      backgroundColor: colors.errorLight,
      padding: 12,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.errorLight,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 24,
    },
    importButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    importButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
  });

  const renderWorkout = ({ item }: { item: WorkoutTemplate }) => (
    <View style={styles.workoutCard} testID={`workout-${item.id}`}>
      <TouchableOpacity
        style={styles.workoutContent}
        onPress={() => router.push(`/workout/${item.id}`)}
        testID={`workout-card-${item.id}`}
      >
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutName}>{item.name}</Text>
          {item.tags.length > 0 && (
            <View style={styles.tagContainer}>
              {item.tags.slice(0, 2).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {item.tags.length > 2 && (
                <Text style={styles.tagMore}>+{item.tags.length - 2}</Text>
              )}
            </View>
          )}
        </View>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.workoutMeta}>
          <Text style={styles.metaText}>
            {item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.metaSeparator}>•</Text>
          <Text style={styles.metaText}>
            {item.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} sets
          </Text>
          {item.defaultWeightUnit && (
            <>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaText}>{item.defaultWeightUnit}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
        testID={`delete-${item.id}`}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container} testID="workouts-screen">
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search workouts..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          testID="search-input"
        />
      </View>

      {workouts.length === 0 ? (
        <View style={styles.emptyState} testID="empty-state">
          <Text style={styles.emptyText}>
            {searchQuery ? 'No workouts found' : 'No workouts yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try a different search term'
              : 'Import your first workout to get started'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={styles.importButton}
              onPress={() => router.push('/modal/import')}
              testID="button-import-empty"
            >
              <Text style={styles.importButtonText}>Import Workout</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkout}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          testID="workout-list"
        />
      )}
    </View>
  );
}
