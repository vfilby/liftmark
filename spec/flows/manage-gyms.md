# Manage Gyms Flow

## Preconditions

- User navigates to Settings and then to the Gym detail screen.
- At least one gym exists in the database.

## Flow Steps

1. The gym detail screen loads the gym information and its equipment list.

### Rename Gym

2. User taps the edit icon next to the gym name.
3. An inline text input appears with the current name.
4. User edits the name and taps save, or taps cancel to discard.
5. **Validation**: The name cannot be empty. An empty name is rejected.

### Set as Default Gym

6. If the gym is not currently the default, a "Set as Default" button is visible.
7. User taps the button. The gym's `isDefault` flag is set to `true`, and all other gyms have their `isDefault` flag set to `false`.

### Equipment Management

8. The equipment list is displayed with availability toggles (Switch components) for each item.

#### Add Custom Equipment

9. User enters a name in the text input and submits.
10. **Validation**: The name must not be empty and must not duplicate an existing equipment name (case-insensitive comparison).

#### Select from Presets

11. User taps "Select from Presets" to open a modal.
12. The modal displays categorized equipment lists:
    - Free Weights
    - Benches and Racks
    - Machines
    - Cardio
    - Other
13. Equipment already added to the gym is pre-selected.
14. User toggles selections and taps Save.
15. The system syncs the changes: newly selected presets are added, unselected presets are removed.

#### Remove Equipment

16. User initiates removal of an equipment item.
17. A confirmation dialog is shown.
18. On confirmation, the equipment is deleted from the gym.

#### Toggle Equipment Availability

19. User toggles the availability switch on an equipment item.
20. `updateEquipmentAvailability()` persists the change immediately.

### Delete Gym

21. User taps the delete option for the gym.
22. **Validation**: The last remaining gym cannot be deleted.
23. A confirmation dialog is shown with a warning that all associated equipment will be deleted.
24. On confirmation:
    - The gym and its equipment are soft-deleted (`deleted_at` timestamp set) rather than hard-deleted, so CloudKit sync does not re-insert them.
    - If the deleted gym was the default, the first remaining active gym (by name) is set as the new default.
    - The screen navigates back to the previous view.

## Data Flow

- `gymStore` manages gym state, persisted to the SQLite `gyms` table. Queries filter on `deleted_at IS NULL`.
- `equipmentStore` manages equipment state, persisted to the SQLite `gym_equipment` table. Queries filter on `deleted_at IS NULL`.
- Exactly one gym must be marked as default at all times. A safety-net check in `loadGyms()` corrects any inconsistency.

## Variations

- **Single gym**: The delete option is disabled or hidden since the last gym cannot be deleted.
- **No equipment**: The equipment list shows an empty state encouraging the user to add equipment.
- **Preset equipment already added**: Pre-selected items in the preset modal reflect current gym equipment.
- **Duplicate equipment name**: Adding a custom equipment name that matches an existing one (case-insensitive) is rejected with a validation message.

## Error Handling

| Scenario | Behavior |
|---|---|
| Empty gym name on rename | Validation prevents save |
| Duplicate equipment name | Validation prevents add |
| Attempt to delete last gym | Operation blocked, user informed |
| Database save failure | Error alert shown |
| Equipment sync failure (presets) | Error alert shown, previous state retained |

## Postconditions

- Gym and equipment changes are persisted in the SQLite database.
- Equipment availability status is used in AI workout generation prompts to provide context about available equipment.
- Default gym designation is consistent (exactly one gym is marked as default).
