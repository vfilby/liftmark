# Workouts Screen

## Purpose
Browse, search, filter, and manage all imported workout plans. Supports tablet split-view for side-by-side list + detail.

## Route
`/(tabs)/workouts` — Second tab in the bottom tab bar.

## Layout
- **Header**: Tab header from navigator
- **Body** (phone): Search bar + filter panel + FlatList of plan cards
- **Body** (tablet): SplitView with list on left, WorkoutDetailView on right
- **Footer**: None

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `workouts-screen` | View |
| Search input | `search-input` | TextInput |
| Filter toggle | `filter-toggle` | TouchableOpacity |
| Favorites filter switch | `switch-filter-favorites` | Switch |
| Equipment filter switch | `switch-filter-equipment` | Switch |
| Gym option (per gym) | `gym-option-{gym.id}` | TouchableOpacity |
| Workout list | `workout-list` | FlatList |
| Workout card container | `workout-{item.id}` | View (Swipeable) |
| Workout card tap area | `workout-card-{item.id}` | TouchableOpacity |
| Workout card index | `workout-card-index-{index}` | View |
| Favorite button | `favorite-{item.id}` | TouchableOpacity |
| Swipe-delete button | `delete-{item.id}` | TouchableOpacity |
| Empty state | `empty-state` | View |
| Import button (empty) | `button-import-empty` | TouchableOpacity |
| Setup equipment button | `button-setup-equipment` | TouchableOpacity |

## Data Dependencies
- **workoutPlanStore**: `plans`, `loadPlans`, `removePlan`, `searchPlans`, `selectedPlan`, `loadPlan`, `reprocessPlan`, `error`, `clearError`
- **equipmentStore**: `equipment`, `loadEquipment`, `getAvailableEquipmentNames`
- **gymStore**: `defaultGym`, `loadGyms`, `gyms`
- **sessionStore**: `startWorkout`, `checkForActiveSession`
- **repository**: `toggleFavoritePlan`

## User Interactions
- **Type in search** → filters plans by query
- **Toggle "Show Filters"** → expands/collapses filter card
- **Toggle favorites switch** → filters to favorited plans only
- **Toggle equipment switch** → filters plans by available equipment at selected gym
- **Tap gym option** → selects gym for equipment filtering
- **Tap plan card** → phone: navigates to `/workout/{id}`; tablet: selects plan in split view
- **Tap favorite heart** → toggles favorite status
- **Swipe left on card** → reveals red Delete button
- **Tap Delete** → removes plan from store
- **Tap "Import Plan" (empty state)** → navigates to `/modal/import`
- **Tap "Set Up Equipment" (equipment empty)** → navigates to gym detail or settings
- **Tap "Start Workout" (tablet detail)** → checks for active session, starts workout, navigates to `/workout/active`
- **Tap "Reprocess" (tablet detail)** → re-parses plan from markdown with confirmation alert

## Navigation
- `/workout/{id}` — phone plan card tap
- `/modal/import` — empty state import button
- `/workout/active` — after starting workout
- `/gym/{defaultGym.id}` — equipment setup button

## State
- `searchQuery` — current search text
- `filterByEquipment` — equipment filter toggle
- `showFavoritesOnly` — favorites filter toggle
- `selectedWorkoutId` — selected plan for tablet split view
- `showFilters` — filter panel expanded/collapsed
- `selectedGymId` — which gym's equipment to filter by
- `isStarting` / `isReprocessing` — loading states for actions

## Error/Empty States
- **No plans**: "No plans yet" + "Import your first workout plan to get started" + Import Plan button
- **No search results**: "No plans found" + "Try a different search term"
- **Equipment filter no results**: "No plans available" + "All plans require unavailable equipment..." + "Set Up Equipment" button
- **Store error**: Alert dialog with error message
