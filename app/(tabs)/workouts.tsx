import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGymStore } from '@/stores/gymStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { SplitView } from '@/components/SplitView';
import { WorkoutDetailView } from '@/components/WorkoutDetailView';
import type { WorkoutTemplate } from '@/types';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { workouts, loadWorkouts, removeWorkout, searchWorkouts, selectedWorkout, loadWorkout, reprocessWorkout, error, clearError } =
    useWorkoutStore();
  const { equipment, loadEquipment, getAvailableEquipmentNames } = useEquipmentStore();
  const { defaultGym, loadGyms } = useGymStore();
  const { startWorkout, checkForActiveSession } = useSessionStore();
  const { isTablet } = useDeviceLayout();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByEquipment, setFilterByEquipment] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  useEffect(() => {
    loadWorkouts();
    loadGyms();
  }, []);

  // Load equipment when default gym changes
  useEffect(() => {
    if (defaultGym) {
      loadEquipment(defaultGym.id);
    }
  }, [defaultGym?.id]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  // Load selected workout when ID changes (for tablet split view)
  useEffect(() => {
    if (selectedWorkoutId && isTablet) {
      loadWorkout(selectedWorkoutId);
    }
  }, [selectedWorkoutId, isTablet]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    searchWorkouts(query);
  };

  const handleDelete = (workout: WorkoutTemplate) => {
    removeWorkout(workout.id);
    // Clear selection if deleted workout was selected
    if (selectedWorkoutId === workout.id) {
      setSelectedWorkoutId(null);
    }
  };

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
    if (!selectedWorkoutId || isReprocessing) return;

    Alert.alert(
      'Reprocess Workout',
      'This will re-parse the workout from its original markdown. Any manual edits will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reprocess',
          onPress: async () => {
            setIsReprocessing(true);
            const result = await reprocessWorkout(selectedWorkoutId);
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

  // Filter workouts based on available equipment
  const filteredWorkouts = useMemo(() => {
    if (!filterByEquipment) {
      return workouts;
    }

    const availableEquipmentNames = getAvailableEquipmentNames();

    // If no equipment is set up, show all workouts
    if (equipment.length === 0) {
      return workouts;
    }

    return workouts.filter((workout) => {
      // Check if all exercises have available equipment
      const allExercisesAvailable = workout.exercises.every((exercise) => {
        // If exercise has no equipment type specified, it's available (bodyweight)
        if (!exercise.equipmentType) {
          return true;
        }

        // Check if the equipment is available
        return availableEquipmentNames.includes(
          exercise.equipmentType.toLowerCase()
        );
      });

      return allExercisesAvailable;
    });
  }, [workouts, filterByEquipment, equipment]);

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
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
    },
    filterLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    filterDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
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
    workoutCardSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
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
    swipeDeleteAction: {
      justifyContent: 'center',
      alignItems: 'flex-end',
      marginBottom: 12,
      paddingLeft: 12,
    },
    swipeDeleteButton: {
      backgroundColor: colors.error,
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      height: '100%',
      borderRadius: 12,
    },
    swipeDeleteText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
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

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    item: WorkoutTemplate
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeDeleteAction,
          { transform: [{ translateX }] },
        ]}
      >
        <TouchableOpacity
          style={styles.swipeDeleteButton}
          onPress={() => handleDelete(item)}
          testID={`delete-${item.id}`}
        >
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderWorkout = ({ item, index }: { item: WorkoutTemplate; index: number }) => {
    const isSelected = isTablet && selectedWorkoutId === item.id;
    const handlePress = () => {
      if (isTablet) {
        setSelectedWorkoutId(item.id);
      } else {
        router.push(`/workout/${item.id}`);
      }
    };

    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
        overshootRight={false}
        rightThreshold={40}
      >
        <View
          style={[
            styles.workoutCard,
            isSelected && styles.workoutCardSelected,
          ]}
          testID={`workout-${item.id}`}
        >
          <TouchableOpacity
            style={styles.workoutContent}
            onPress={handlePress}
            testID={`workout-card-${item.id}`}
          >
            <View testID={`workout-card-index-${index}`}>
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
            </View>
          </TouchableOpacity>
        </View>
      </Swipeable>
    );
  };

  const listContent = (
    <>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search workouts..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          testID="search-input"
        />

        {equipment.length > 0 && (
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Show only available equipment</Text>
              <Text style={styles.filterDescription}>
                Filter workouts based on your gym equipment
              </Text>
            </View>
            <Switch
              value={filterByEquipment}
              onValueChange={setFilterByEquipment}
              trackColor={{ false: colors.border, true: colors.primary }}
              testID="switch-filter-equipment"
            />
          </View>
        )}
      </View>

      {filteredWorkouts.length === 0 ? (
        <View style={styles.emptyState} testID="empty-state">
          <Text style={styles.emptyText}>
            {filterByEquipment
              ? 'No workouts available'
              : searchQuery
              ? 'No workouts found'
              : 'No workouts yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {filterByEquipment
              ? 'All workouts require unavailable equipment. Try adding equipment in Settings or disable the filter.'
              : searchQuery
              ? 'Try a different search term'
              : 'Import your first workout to get started'}
          </Text>
          {!searchQuery && !filterByEquipment && (
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
          data={filteredWorkouts}
          renderItem={renderWorkout}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          testID="workout-list"
        />
      )}
    </>
  );

  if (isTablet) {
    return (
      <View style={styles.container} testID="workouts-screen">
        <SplitView
          leftPane={listContent}
          rightPane={
            selectedWorkout ? (
              <WorkoutDetailView
                workout={selectedWorkout}
                onStartWorkout={handleStartWorkout}
                onReprocess={handleReprocess}
                isStarting={isStarting}
                isReprocessing={isReprocessing}
              />
            ) : null
          }
          selectedId={selectedWorkoutId}
          emptyStateMessage="Select a workout to view details"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="workouts-screen">
      {listContent}
    </View>
  );
}
