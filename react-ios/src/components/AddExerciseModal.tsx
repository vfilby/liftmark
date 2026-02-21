import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '@/theme';

interface AddExerciseModalProps {
  visible: boolean;
  markdown: string;
  onChangeMarkdown: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function AddExerciseModal({
  visible,
  markdown,
  onChangeMarkdown,
  onSave,
  onCancel,
}: AddExerciseModalProps) {
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
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    helpText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 8,
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
          <Text style={styles.modalTitle}>Add Exercise</Text>

          <Text style={styles.helpText}>
            Enter exercise in markdown format:
          </Text>

          <TextInput
            style={styles.modalInput}
            value={markdown}
            onChangeText={onChangeMarkdown}
            placeholder="### Exercise Name&#10;&#10;- Rep&#10;- Rep&#10;- Rep"
            placeholderTextColor={colors.textMuted}
            multiline
          />

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
              <Text style={styles.modalButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
