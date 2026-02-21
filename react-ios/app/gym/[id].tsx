import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGymStore } from '@/stores/gymStore';
import { useTheme } from '@/theme';
import { PRESET_EQUIPMENT } from '@/types';

export default function GymDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    equipment,
    loadEquipment,
    addEquipment,
    addMultipleEquipment,
    updateEquipmentAvailability,
    removeEquipment,
    hasEquipment,
    error: equipmentError,
    clearError: clearEquipmentError,
  } = useEquipmentStore();

  const {
    gyms,
    updateGym,
    setDefaultGym,
    removeGym,
    error: gymError,
    clearError: clearGymError,
  } = useGymStore();

  const [gymName, setGymName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());

  const gym = gyms.find(g => g.id === id);

  // Load equipment when gym ID is available
  useEffect(() => {
    if (id) {
      loadEquipment(id);
    }
  }, [id]);

  // Sync gym name with local state
  useEffect(() => {
    if (gym) {
      setGymName(gym.name);
    }
  }, [gym]);

  // Handle errors
  useEffect(() => {
    const error = equipmentError || gymError;
    if (error) {
      Alert.alert('Error', error, [{
        text: 'OK',
        onPress: () => {
          clearEquipmentError();
          clearGymError();
        }
      }]);
    }
  }, [equipmentError, gymError]);

  // Gym name editing handlers
  const handleSaveGymName = async () => {
    if (!gym) return;

    const trimmedName = gymName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Gym name cannot be empty');
      setGymName(gym.name);
      return;
    }

    await updateGym(gym.id, { name: trimmedName });
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    if (gym) {
      setGymName(gym.name);
    }
    setIsEditingName(false);
  };

  // Equipment management handlers
  const handleAddEquipment = async () => {
    if (!id) return;

    const trimmedName = newEquipmentName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter equipment name');
      return;
    }

    if (hasEquipment(id, trimmedName)) {
      Alert.alert('Error', 'This equipment already exists for this gym');
      return;
    }

    await addEquipment(id, trimmedName);
    setNewEquipmentName('');
  };

  const handleRemoveEquipment = (equipmentId: string, name: string) => {
    Alert.alert(
      'Remove Equipment',
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeEquipment(equipmentId),
        },
      ]
    );
  };

  // Preset equipment handlers
  const openPresetModal = () => {
    if (!id) return;

    // Pre-select equipment that already exists
    const existingEquipment = new Set(
      equipment
        .filter(eq => eq.gymId === id)
        .map(eq => eq.name.toLowerCase())
    );

    const preselected = new Set<string>();
    Object.values(PRESET_EQUIPMENT).flat().forEach(name => {
      if (existingEquipment.has(name.toLowerCase())) {
        preselected.add(name);
      }
    });

    setSelectedPresets(preselected);
    setShowPresetModal(true);
  };

  const togglePreset = (name: string) => {
    setSelectedPresets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const handleSavePresets = async () => {
    if (!id) return;

    // Find equipment to add (selected but not yet in gym)
    const existingNames = new Set(
      equipment
        .filter(eq => eq.gymId === id)
        .map(eq => eq.name.toLowerCase())
    );

    const toAdd = Array.from(selectedPresets).filter(
      name => !existingNames.has(name.toLowerCase())
    );

    // Find equipment to remove (in gym but not selected)
    const selectedLower = new Set(
      Array.from(selectedPresets).map(n => n.toLowerCase())
    );
    const toRemove = equipment
      .filter(eq =>
        eq.gymId === id &&
        Object.values(PRESET_EQUIPMENT).flat().some(p => p.toLowerCase() === eq.name.toLowerCase()) &&
        !selectedLower.has(eq.name.toLowerCase())
      )
      .map(eq => eq.id);

    // Add new equipment
    if (toAdd.length > 0) {
      await addMultipleEquipment(id, toAdd);
    }

    // Remove unselected equipment (only presets, not custom)
    for (const equipmentId of toRemove) {
      await removeEquipment(equipmentId);
    }

    setShowPresetModal(false);
  };

  // Gym action handlers
  const handleSetAsDefault = async () => {
    if (!gym) return;
    await setDefaultGym(gym.id);
  };

  const handleDeleteGym = () => {
    if (!gym) return;

    if (gyms.length === 1) {
      Alert.alert('Cannot Delete', 'You must have at least one gym.');
      return;
    }

    Alert.alert(
      'Delete Gym',
      `Are you sure you want to delete "${gym.name}"? All equipment associated with this gym will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeGym(gym.id);
            router.back();
          },
        },
      ]
    );
  };

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
    section: {
      backgroundColor: colors.card,
      marginTop: 16,
      marginHorizontal: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    // Gym name section
    gymNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    gymNameInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
    },
    gymNameText: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    editButtonContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    defaultBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    defaultBadgeText: {
      fontSize: 11,
      color: '#fff',
      fontWeight: '600',
    },
    // Action buttons
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 8,
      gap: 8,
      marginTop: 12,
    },
    primaryActionButton: {
      backgroundColor: colors.primary,
    },
    secondaryActionButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    dangerActionButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.error,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryActionButtonText: {
      color: '#fff',
    },
    secondaryActionButtonText: {
      color: colors.text,
    },
    dangerActionButtonText: {
      color: colors.error,
    },
    // Equipment styles
    equipmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    equipmentRowLast: {
      borderBottomWidth: 0,
    },
    equipmentName: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    equipmentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    addEquipmentRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    addEquipmentInput: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
    },
    addEquipmentButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addEquipmentButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    emptyEquipmentText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
      paddingVertical: 12,
    },
    presetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginTop: 8,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 8,
      gap: 8,
    },
    presetButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalBody: {
      padding: 16,
    },
    modalButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Preset modal styles
    presetCategory: {
      marginBottom: 20,
    },
    presetCategoryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    presetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    presetCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetCheckboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetItemText: {
      fontSize: 16,
      color: colors.text,
    },
  });

  if (!gym) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Gym Details' }} />
        <Text style={styles.loadingText}>Gym not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="gym-detail-screen">
      <Stack.Screen
        options={{
          title: gym.name,
          headerBackTitle: 'Settings',
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Gym Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Gym Information</Text>
          </View>

          <View style={styles.gymNameContainer}>
            {isEditingName ? (
              <>
                <TextInput
                  style={styles.gymNameInput}
                  value={gymName}
                  onChangeText={setGymName}
                  autoFocus
                  testID="input-gym-name"
                />
                <View style={styles.editButtonContainer}>
                  <TouchableOpacity onPress={handleSaveGymName} testID="save-gym-name">
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancelEdit} testID="cancel-edit-gym-name">
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.gymNameText}>{gym.name}</Text>
                {gym.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setIsEditingName(true)}
                  testID="edit-gym-name-button"
                >
                  <Ionicons name="pencil-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {!gym.isDefault && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={handleSetAsDefault}
              testID="set-default-button"
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
                Set as Default Gym
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Equipment Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="barbell-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Equipment</Text>
          </View>
          <Text style={styles.settingDescription}>
            Track which equipment is available at this gym
          </Text>

          {equipment.length === 0 ? (
            <Text style={styles.emptyEquipmentText}>
              No equipment added yet. Use presets or add custom equipment below.
            </Text>
          ) : (
            equipment.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.equipmentRow,
                  index === equipment.length - 1 && styles.equipmentRowLast,
                ]}
              >
                <Text style={styles.equipmentName}>{item.name}</Text>
                <View style={styles.equipmentActions}>
                  <Switch
                    value={item.isAvailable}
                    onValueChange={(value) =>
                      updateEquipmentAvailability(item.id, value)
                    }
                    trackColor={{ false: colors.border, true: colors.primary }}
                    testID={`switch-equipment-${item.id}`}
                  />
                  <TouchableOpacity
                    onPress={() => handleRemoveEquipment(item.id, item.name)}
                    testID={`button-remove-equipment-${item.id}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.presetButton}
            onPress={openPresetModal}
            testID="preset-equipment-button"
          >
            <Ionicons name="checkbox-outline" size={20} color={colors.primary} />
            <Text style={styles.presetButtonText}>Select from Presets</Text>
          </TouchableOpacity>

          <View style={styles.addEquipmentRow}>
            <TextInput
              style={styles.addEquipmentInput}
              placeholder="Add custom equipment..."
              placeholderTextColor={colors.textMuted}
              value={newEquipmentName}
              onChangeText={setNewEquipmentName}
              onSubmitEditing={handleAddEquipment}
              returnKeyType="done"
              testID="input-new-equipment"
            />
            <TouchableOpacity
              style={styles.addEquipmentButton}
              onPress={handleAddEquipment}
              testID="button-add-equipment"
            >
              <Text style={styles.addEquipmentButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Gym Section */}
        {gyms.length > 1 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={20} color={colors.error} />
              <Text style={styles.sectionTitle}>Danger Zone</Text>
            </View>
            <Text style={styles.settingDescription}>
              Delete this gym and all associated equipment. This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerActionButton]}
              onPress={handleDeleteGym}
              testID="delete-gym-button"
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.actionButtonText, styles.dangerActionButtonText]}>
                Delete Gym
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Preset Equipment Modal */}
      <Modal
        visible={showPresetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPresetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Equipment</Text>
              <TouchableOpacity onPress={() => setShowPresetModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {Object.entries(PRESET_EQUIPMENT).map(([category, items]) => (
                <View key={category} style={styles.presetCategory}>
                  <Text style={styles.presetCategoryTitle}>
                    {category === 'freeWeights' ? 'Free Weights' :
                     category === 'benchesAndRacks' ? 'Benches & Racks' :
                     category === 'machines' ? 'Machines' :
                     category === 'cardio' ? 'Cardio' : 'Other'}
                  </Text>
                  {items.map((item) => {
                    const isSelected = selectedPresets.has(item);
                    return (
                      <TouchableOpacity
                        key={item}
                        style={styles.presetItem}
                        onPress={() => togglePreset(item)}
                        testID={`preset-${item}`}
                      >
                        <View style={[
                          styles.presetCheckbox,
                          isSelected && styles.presetCheckboxSelected
                        ]}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.presetItemText}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSavePresets}
                testID="save-presets-button"
              >
                <Text style={styles.modalButtonText}>Save Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
