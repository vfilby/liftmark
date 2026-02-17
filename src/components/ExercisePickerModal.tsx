import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/theme';
import { getAllExercisesWithHistory } from '@/db/exerciseHistoryRepository';

const COMMON_EXERCISES = [
  'Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
  'Pull-Up',
  'Dip',
  'Leg Press',
  'Romanian Deadlift',
  'Front Squat',
  'Incline Bench Press',
  'Lat Pulldown',
  'Cable Row',
  'Leg Curl',
  'Leg Extension',
  'Lateral Raise',
  'Bicep Curl',
  'Tricep Pushdown',
];

interface ExercisePickerModalProps {
  visible: boolean;
  onSelect: (exerciseName: string) => void;
  onCancel: () => void;
}

export default function ExercisePickerModal({
  visible,
  onSelect,
  onCancel,
}: ExercisePickerModalProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [userExercises, setUserExercises] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSearch('');
      getAllExercisesWithHistory().then(setUserExercises);
    }
  }, [visible]);

  const getFilteredExercises = useCallback(() => {
    const userSet = new Set(userExercises.map(e => e.toLowerCase()));
    const commonNotLogged = COMMON_EXERCISES.filter(
      e => !userSet.has(e.toLowerCase())
    );
    const all = [...userExercises, ...commonNotLogged];

    if (!search.trim()) return all;

    const term = search.toLowerCase();
    return all.filter(e => e.toLowerCase().includes(term));
  }, [search, userExercises]);

  const filtered = getFilteredExercises();
  const trimmedSearch = search.trim();
  const exactMatch = filtered.some(
    e => e.toLowerCase() === trimmedSearch.toLowerCase()
  );

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '70%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    cancelButton: {
      padding: 4,
    },
    cancelText: {
      fontSize: 16,
      color: colors.primary,
    },
    searchContainer: {
      padding: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    list: {
      flexGrow: 0,
    },
    exerciseItem: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    exerciseText: {
      fontSize: 16,
      color: colors.text,
    },
    freeEntryItem: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    freeEntryText: {
      fontSize: 16,
      color: colors.primary,
      fontStyle: 'italic',
    },
    sectionLabel: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyText: {
      padding: 24,
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 15,
    },
  });

  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.exerciseItem}
      onPress={() => onSelect(item)}
      testID={`exercise-option-${item}`}
    >
      <Text style={styles.exerciseText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={styles.modalContent} testID="exercise-picker-modal">
          <View style={styles.header}>
            <Text style={styles.title}>Choose Exercise</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} testID="exercise-picker-cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search or type exercise name..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="done"
              testID="exercise-picker-search"
              onSubmitEditing={() => {
                if (trimmedSearch) onSelect(trimmedSearch);
              }}
            />
          </View>

          {trimmedSearch && !exactMatch && (
            <TouchableOpacity
              style={styles.freeEntryItem}
              onPress={() => onSelect(trimmedSearch)}
              testID="exercise-picker-free-entry"
            >
              <Text style={styles.freeEntryText}>
                Add "{trimmedSearch}"
              </Text>
            </TouchableOpacity>
          )}

          {filtered.length > 0 ? (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={renderItem}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            !trimmedSearch && (
              <Text style={styles.emptyText}>No exercises found</Text>
            )
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
