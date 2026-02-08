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
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useWorkoutPlanStore } from '@/stores/workoutPlanStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGymStore } from '@/stores/gymStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toggleFavoritePlan } from '@/db/repository';
import { useTheme } from '@/theme';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { SplitView } from '@/components/SplitView';
import { WorkoutDetailView } from '@/components/WorkoutDetailView';
import type { WorkoutPlan } from '@/types';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { plans, loadPlans, removePlan, searchPlans, selectedPlan, loadPlan, reprocessPlan, error, clearError } =
    useWorkoutPlanStore();
  const { equipment, loadEquipment, getAvailableEquipmentNames } = useEquipmentStore();
  const { defaultGym, loadGyms, gyms } = useGymStore();
  const { startWorkout, checkForActiveSession } = useSessionStore();
  const { isTablet } = useDeviceLayout();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByEquipment, setFilterByEquipment] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadPlans();
    loadGyms();
  }, []);

  // Set initial selected gym to default gym
  useEffect(() => {
    if (defaultGym && !selectedGymId) {
      setSelectedGymId(defaultGym.id);
    }
  }, [defaultGym?.id]);

  // Load equipment when selected gym changes
  useEffect(() => {
    if (selectedGymId) {
      loadEquipment(selectedGymId);
    }
  }, [selectedGymId]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  // Load selected plan when ID changes (for tablet split view)
  useEffect(() => {
    if (selectedWorkoutId && isTablet) {
      loadPlan(selectedWorkoutId);
    }
  }, [selectedWorkoutId, isTablet]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    searchPlans(query);
  };

  const handleDelete = (plan: WorkoutPlan) => {
    removePlan(plan.id);
    // Clear selection if deleted plan was selected
    if (selectedWorkoutId === plan.id) {
      setSelectedWorkoutId(null);
    }
  };

  const handleToggleFavorite = async (workoutId: string, event: any) => {
    // Stop event propagation to prevent card selection
    event?.stopPropagation();

    try {
      await toggleFavoritePlan(workoutId);
      // Reload plans to get updated favorite status
      loadPlans();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

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
    if (!selectedWorkoutId || isReprocessing) return;

    Alert.alert(
      'Reprocess Plan',
      'This will re-parse the plan from its original markdown. Any manual edits will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reprocess',
          onPress: async () => {
            setIsReprocessing(true);
            const result = await reprocessPlan(selectedWorkoutId);
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

  // Filter plans based on available equipment and favorites
  const filteredPlans = useMemo(() => {
    let filtered = plans;

    // Filter by favorites first
    if (showFavoritesOnly) {
      filtered = filtered.filter((plan) => plan.isFavorite);
    }

    // Then filter by equipment if enabled
    if (filterByEquipment) {
      const availableEquipmentNames = getAvailableEquipmentNames();

      // If no equipment is set up, show all plans
      if (equipment.length > 0) {
        filtered = filtered.filter((plan) => {
          // Check if all exercises have available equipment
          const allExercisesAvailable = plan.exercises.every((exercise) => {
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
      }
    }

    return filtered;
  }, [plans, filterByEquipment, showFavoritesOnly, equipment, getAvailableEquipmentNames]);

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
    filterToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      paddingBottom: 8,
    },
    filterToggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    filterCard: {
      marginTop: 8,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      padding: 12,
      gap: 12,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    gymPicker: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
    },
    gymPickerText: {
      fontSize: 14,
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
    favoriteButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      padding: 8,
      zIndex: 1,
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
    item: WorkoutPlan
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

  const renderPlan = ({ item, index }: { item: WorkoutPlan; index: number }) => {
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
            style={styles.favoriteButton}
            onPress={(e) => handleToggleFavorite(item.id, e)}
            testID={`favorite-${item.id}`}
          >
            <Ionicons
              name={item.isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={item.isFavorite ? colors.error : colors.textSecondary}
            />
          </TouchableOpacity>
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
          placeholder="Search plans..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          testID="search-input"
        />

        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
          testID="filter-toggle"
        >
          <Text style={styles.filterToggleText}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Text>
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filterCard}>
            <View style={styles.filterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterLabel}>Favorites only</Text>
                <Text style={styles.filterDescription}>
                  Show only favorited plans
                </Text>
              </View>
              <Switch
                value={showFavoritesOnly}
                onValueChange={setShowFavoritesOnly}
                trackColor={{ false: colors.border, true: colors.primary }}
                testID="switch-filter-favorites"
              />
            </View>

            {gyms.length > 0 && (
              <>
                <View style={styles.filterRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filterLabel}>Equipment filter</Text>
                    <Text style={styles.filterDescription}>
                      Filter by available equipment
                    </Text>
                  </View>
                  <Switch
                    value={filterByEquipment}
                    onValueChange={setFilterByEquipment}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    testID="switch-filter-equipment"
                  />
                </View>

                {filterByEquipment && (
                  <View>
                    <Text style={styles.filterLabel}>Select Gym</Text>
                    <View style={styles.gymPicker}>
                      {gyms.map((gym) => (
                        <TouchableOpacity
                          key={gym.id}
                          onPress={() => setSelectedGymId(gym.id)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor:
                              selectedGymId === gym.id
                                ? colors.primaryLight
                                : 'transparent',
                            borderRadius: 6,
                            marginBottom: 4,
                          }}
                          testID={`gym-option-${gym.id}`}
                        >
                          <Text
                            style={[
                              styles.gymPickerText,
                              selectedGymId === gym.id && { color: colors.primary, fontWeight: '600' },
                            ]}
                          >
                            {gym.name}
                            {gym.isDefault && ' (Default)'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {filteredPlans.length === 0 ? (
        <View style={styles.emptyState} testID="empty-state">
          <Text style={styles.emptyText}>
            {filterByEquipment
              ? 'No plans available'
              : searchQuery
              ? 'No plans found'
              : 'No plans yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {filterByEquipment
              ? 'All plans require unavailable equipment. Try adding equipment in Settings or disable the filter.'
              : searchQuery
              ? 'Try a different search term'
              : 'Import your first workout plan to get started'}
          </Text>
          {!searchQuery && !filterByEquipment && (
            <TouchableOpacity
              style={styles.importButton}
              onPress={() => router.push('/modal/import')}
              testID="button-import-empty"
            >
              <Text style={styles.importButtonText}>Import Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPlans}
          renderItem={renderPlan}
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
            selectedPlan ? (
              <WorkoutDetailView
                workout={selectedPlan}
                onStartWorkout={handleStartWorkout}
                onReprocess={handleReprocess}
                onToggleFavorite={() => handleToggleFavorite(selectedPlan.id, { stopPropagation: () => {} })}
                isStarting={isStarting}
                isReprocessing={isReprocessing}
              />
            ) : null
          }
          selectedId={selectedWorkoutId}
          emptyStateMessage="Select a plan to view details"
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
