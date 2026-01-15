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
import { useRouter } from 'expo-router';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGymStore } from '@/stores/gymStore';
import { useTheme } from '@/theme';
import { PRESET_EQUIPMENT } from '@/types';

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
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
    defaultGym,
    loadGyms,
    error: gymError,
    clearError: clearGymError,
  } = useGymStore();

  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [showGymPicker, setShowGymPicker] = useState(false);

  // Load gyms on mount
  useEffect(() => {
    loadGyms();
  }, []);

  // Set initial selected gym when gyms load
  useEffect(() => {
    if (defaultGym && !selectedGymId) {
      setSelectedGymId(defaultGym.id);
    } else if (gyms.length > 0 && !selectedGymId) {
      setSelectedGymId(gyms[0].id);
    }
  }, [defaultGym, gyms, selectedGymId]);

  // Load equipment when selected gym changes
  useEffect(() => {
    if (selectedGymId) {
      loadEquipment(selectedGymId);
    }
  }, [selectedGymId]);

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

  // Equipment management handlers
  const handleAddEquipment = async () => {
    if (!selectedGymId) {
      Alert.alert('Error', 'Please select a gym first');
      return;
    }

    const trimmedName = newEquipmentName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter equipment name');
      return;
    }

    if (hasEquipment(selectedGymId, trimmedName)) {
      Alert.alert('Error', 'This equipment already exists for this gym');
      return;
    }

    await addEquipment(selectedGymId, trimmedName);
    setNewEquipmentName('');
  };

  const handleRemoveEquipment = (id: string, name: string) => {
    Alert.alert(
      'Remove Equipment',
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeEquipment(id),
        },
      ]
    );
  };

  // Preset equipment handlers
  const openPresetModal = () => {
    if (!selectedGymId) {
      Alert.alert('Error', 'Please select a gym first');
      return;
    }

    // Pre-select equipment that already exists
    const existingEquipment = new Set(
      equipment
        .filter(eq => eq.gymId === selectedGymId)
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
    if (!selectedGymId) return;

    // Find equipment to add (selected but not yet in gym)
    const existingNames = new Set(
      equipment
        .filter(eq => eq.gymId === selectedGymId)
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
        eq.gymId === selectedGymId &&
        Object.values(PRESET_EQUIPMENT).flat().some(p => p.toLowerCase() === eq.name.toLowerCase()) &&
        !selectedLower.has(eq.name.toLowerCase())
      )
      .map(eq => eq.id);

    // Add new equipment
    if (toAdd.length > 0) {
      await addMultipleEquipment(selectedGymId, toAdd);
    }

    // Remove unselected equipment (only presets, not custom)
    for (const id of toRemove) {
      await removeEquipment(id);
    }

    setShowPresetModal(false);
  };

  const selectedGym = gyms.find(g => g.id === selectedGymId);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      backgroundColor: colors.card,
      marginTop: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    // Gym selector styles
    gymSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    gymSelectorContent: {
      flex: 1,
    },
    gymSelectorLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    gymSelectorValue: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    // Equipment styles
    equipmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      backgroundColor: colors.background,
      borderWidth: 1,
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
      backgroundColor: colors.background,
      borderWidth: 1,
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
    modalInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
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
    // Gym picker modal styles
    gymPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    gymPickerItemText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    gymBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    gymBadgeText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container} testID="equipment-screen">
      {/* Gym Selector */}
      <TouchableOpacity
        style={styles.gymSelector}
        onPress={() => setShowGymPicker(true)}
        testID="gym-selector"
      >
        <View style={styles.gymSelectorContent}>
          <Text style={styles.gymSelectorLabel}>Gym</Text>
          <Text style={styles.gymSelectorValue}>
            {selectedGym?.name || 'Select Gym'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView>
        {/* Equipment Section */}
        {selectedGym && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{selectedGym.name} Equipment</Text>
            <Text style={styles.settingDescription}>
              Track which equipment is available at this gym
            </Text>

            {equipment.length === 0 ? (
              <Text style={styles.emptyEquipmentText}>
                No equipment added yet. Use presets or add custom equipment below.
              </Text>
            ) : (
              equipment.map((item) => (
                <View key={item.id} style={styles.equipmentRow}>
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
        )}

        {!selectedGym && (
          <View style={styles.section}>
            <Text style={styles.emptyEquipmentText}>
              Please select a gym to manage equipment
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Gym Picker Modal */}
      <Modal
        visible={showGymPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGymPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gym</Text>
              <TouchableOpacity onPress={() => setShowGymPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {gyms.map(gym => (
                <TouchableOpacity
                  key={gym.id}
                  style={styles.gymPickerItem}
                  onPress={() => {
                    setSelectedGymId(gym.id);
                    setShowGymPicker(false);
                  }}
                  testID={`gym-picker-${gym.id}`}
                >
                  <Text style={styles.gymPickerItemText}>{gym.name}</Text>
                  {gym.isDefault && (
                    <View style={styles.gymBadge}>
                      <Text style={styles.gymBadgeText}>DEFAULT</Text>
                    </View>
                  )}
                  {selectedGymId === gym.id && (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
