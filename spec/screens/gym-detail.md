# Gym Detail Screen

## Purpose
Manage a single gym's details: edit name, set as default, manage equipment (toggle availability, add custom, select from presets), and delete the gym.

## Route
`/gym/[id]` — Dynamic route accessed by tapping a gym item in Settings.

## Layout
- **Header**: Native stack header with gym name as title, "Settings" back button
- **Body**: ScrollView containing:
  1. Gym Information section (name display/edit, default badge, "Set as Default" button)
  2. Equipment section (equipment list with availability toggles, preset selection button, custom equipment input)
  3. Danger Zone section (Delete Gym button, hidden if only one gym exists)
- **Overlay**: Preset Equipment Modal (bottom sheet style)

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `gym-detail-screen` | View |
| Gym name input (editing) | `input-gym-name` | TextInput |
| Save gym name | `save-gym-name` | TouchableOpacity |
| Cancel edit gym name | `cancel-edit-gym-name` | TouchableOpacity |
| Edit gym name button | `edit-gym-name-button` | TouchableOpacity |
| Set as Default button | `set-default-button` | TouchableOpacity |
| Equipment availability toggle | `switch-equipment-{item.id}` | Switch |
| Remove equipment button | `button-remove-equipment-{item.id}` | TouchableOpacity |
| Select from Presets button | `preset-equipment-button` | TouchableOpacity |
| Custom equipment input | `input-new-equipment` | TextInput |
| Add equipment button | `button-add-equipment` | TouchableOpacity |
| Delete Gym button | `delete-gym-button` | TouchableOpacity |
| Preset item | `preset-{item}` | TouchableOpacity |
| Save presets button | `save-presets-button` | TouchableOpacity |

## Data Dependencies
- **equipmentStore**: `equipment`, `loadEquipment()`, `addEquipment()`, `addMultipleEquipment()`, `updateEquipmentAvailability()`, `removeEquipment()`, `hasEquipment()`, `error`, `clearError()`
- **gymStore**: `gyms`, `updateGym()`, `setDefaultGym()`, `removeGym()`, `error`, `clearError()`
- **PRESET_EQUIPMENT**: Static preset equipment organized by category (freeWeights, benchesAndRacks, machines, cardio, other)

## User Interactions
- **Tap pencil icon** on gym name → enters name editing mode with TextInput
- **Tap checkmark** (editing) → saves new gym name
- **Tap X** (editing) → cancels name edit, reverts to original
- **Tap "Set as Default Gym"** (non-default gyms only) → sets gym as default
- **Toggle equipment switch** → updates equipment availability
- **Tap trash icon** on equipment → confirmation alert → removes equipment
- **Tap "Select from Presets"** → opens preset modal with categories, pre-selects existing equipment
- **Toggle preset checkbox** → selects/deselects preset item
- **Tap "Save Selection"** in preset modal → adds new selections, removes deselected presets (preserves custom equipment)
- **Type in custom equipment input + tap Add** → adds custom equipment to gym
- **Tap "Delete Gym"** → confirmation alert → deletes gym + equipment → navigates back
  - Blocked if only one gym exists (alert: "You must have at least one gym")

## Navigation
- Back → Settings screen (via stack navigation)

## State
- `gymName` — local state for gym name editing
- `isEditingName` — whether name editing mode is active
- `newEquipmentName` — local state for custom equipment input
- `showPresetModal` — whether preset selection modal is visible
- `selectedPresets` — Set of selected preset equipment names

## Error/Empty States
- **Gym not found**: "Gym not found" text
- **Equipment/gym store error**: Alert dialog with error message
- **Empty gym name**: Alert "Gym name cannot be empty"
- **Duplicate equipment**: Alert "This equipment already exists for this gym"
- **Empty equipment name**: Alert "Please enter equipment name"
- **No equipment**: Italic text "No equipment added yet. Use presets or add custom equipment below."
- **Cannot delete last gym**: Alert "You must have at least one gym"
