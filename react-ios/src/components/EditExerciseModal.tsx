import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { SessionSet } from '@/types';

interface EditExerciseModalProps {
  visible: boolean;
  exerciseValues: {
    exerciseName: string;
    equipmentType: string;
    notes: string;
  };
  sets: SessionSet[];
  onChangeExerciseValues: (values: { exerciseName: string; equipmentType: string; notes: string }) => void;
  onUpdateSet: (setId: string, field: keyof SessionSet, value: any) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function EditExerciseModal({
  visible,
  exerciseValues,
  sets,
  onChangeExerciseValues,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onSave,
  onCancel,
}: EditExerciseModalProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      width: '85%',
      maxWidth: 500,
      maxHeight: '90%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalInputMultiline: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    modalButtonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 16,
      gap: 12,
    },
    modalButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      minWidth: 80,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: colors.backgroundTertiary,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    setsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    setEditContainer: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setEditHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    setEditNumber: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    setDeleteButton: {
      padding: 8,
    },
    setEditRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 8,
    },
    setEditInput: {
      flex: 1,
    },
    setEditLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    setEditTextInput: {
      backgroundColor: colors.background,
      borderRadius: 6,
      padding: 8,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
    },
    addSetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
      marginBottom: 16,
      gap: 8,
    },
    addSetButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Exercise</Text>

          <ScrollView style={{ maxHeight: 500 }}>
            <TextInput
              style={styles.modalInput}
              value={exerciseValues.exerciseName}
              onChangeText={(text) => onChangeExerciseValues({ ...exerciseValues, exerciseName: text })}
              placeholder="Exercise Name"
              placeholderTextColor={colors.textMuted}
            />

            <TextInput
              style={styles.modalInput}
              value={exerciseValues.equipmentType}
              onChangeText={(text) => onChangeExerciseValues({ ...exerciseValues, equipmentType: text })}
              placeholder="Equipment Type (optional)"
              placeholderTextColor={colors.textMuted}
            />

            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              value={exerciseValues.notes}
              onChangeText={(text) => onChangeExerciseValues({ ...exerciseValues, notes: text })}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={styles.setsTitle}>Sets</Text>

            {sets.map((set, index) => (
              <View key={set.id} style={styles.setEditContainer}>
                <View style={styles.setEditHeader}>
                  <Text style={styles.setEditNumber}>Set {index + 1}</Text>
                  <TouchableOpacity
                    onPress={() => onDeleteSet(set.id)}
                    style={styles.setDeleteButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>

                <View style={styles.setEditRow}>
                  <View style={styles.setEditInput}>
                    <Text style={styles.setEditLabel}>Weight</Text>
                    <TextInput
                      style={styles.setEditTextInput}
                      value={set.targetWeight !== undefined ? String(set.targetWeight) : ''}
                      onChangeText={(text) => onUpdateSet(set.id, 'targetWeight', text ? parseFloat(text) : undefined)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.setEditInput}>
                    <Text style={styles.setEditLabel}>Reps</Text>
                    <TextInput
                      style={styles.setEditTextInput}
                      value={set.targetReps !== undefined ? String(set.targetReps) : ''}
                      onChangeText={(text) => onUpdateSet(set.id, 'targetReps', text ? parseInt(text, 10) : undefined)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.setEditInput}>
                    <Text style={styles.setEditLabel}>RPE</Text>
                    <TextInput
                      style={styles.setEditTextInput}
                      value={set.targetRpe !== undefined ? String(set.targetRpe) : ''}
                      onChangeText={(text) => onUpdateSet(set.id, 'targetRpe', text ? parseFloat(text) : undefined)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.setEditRow}>
                  <View style={styles.setEditInput}>
                    <Text style={styles.setEditLabel}>Rest (s)</Text>
                    <TextInput
                      style={styles.setEditTextInput}
                      value={set.restSeconds !== undefined ? String(set.restSeconds) : ''}
                      onChangeText={(text) => onUpdateSet(set.id, 'restSeconds', text ? parseInt(text, 10) : undefined)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.setEditInput}>
                    <Text style={styles.setEditLabel}>Time (s)</Text>
                    <TextInput
                      style={styles.setEditTextInput}
                      value={set.targetTime !== undefined ? String(set.targetTime) : ''}
                      onChangeText={(text) => onUpdateSet(set.id, 'targetTime', text ? parseInt(text, 10) : undefined)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <TextInput
                  style={[styles.modalInput, { marginTop: 8 }]}
                  value={set.notes || ''}
                  onChangeText={(text) => onUpdateSet(set.id, 'notes', text || undefined)}
                  placeholder="Set notes (optional)"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))}

            <TouchableOpacity
              style={styles.addSetButton}
              onPress={onAddSet}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.addSetButtonText}>Add Set</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={onCancel}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={onSave}
            >
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
