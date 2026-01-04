import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { parseWorkout } from '@/services/MarkdownParser';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useTheme } from '@/theme';

export default function ImportWorkoutModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const { saveWorkout } = useWorkoutStore();
  const [markdown, setMarkdown] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const handleImport = async () => {
    if (!markdown.trim()) {
      Alert.alert('Error', 'Please enter workout markdown');
      return;
    }

    setIsParsing(true);

    try {
      const result = parseWorkout(markdown);

      if (!result.success || !result.data) {
        const errorMessage = result.errors?.join('\n') || 'Failed to parse workout';
        Alert.alert('Parse Error', errorMessage);
        setIsParsing(false);
        return;
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        Alert.alert(
          'Warnings',
          result.warnings.join('\n'),
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsParsing(false),
            },
            {
              text: 'Continue',
              onPress: async () => {
                await saveWorkoutAndClose(result.data!);
              },
            },
          ]
        );
      } else {
        await saveWorkoutAndClose(result.data);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to import workout'
      );
      setIsParsing(false);
    }
  };

  const saveWorkoutAndClose = async (workout: any) => {
    try {
      await saveWorkout(workout);
      Alert.alert('Success', 'Workout imported successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to save workout'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleCancel = () => {
    if (markdown.trim()) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard this workout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.card,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    cancelButton: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    importButton: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    importButtonDisabled: {
      color: colors.textMuted,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    hint: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      fontFamily: 'monospace',
      minHeight: 300,
      textAlignVertical: 'top',
      color: colors.text,
    },
    helpSection: {
      marginTop: 24,
      padding: 16,
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
    },
    helpTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 8,
    },
    helpText: {
      fontSize: 13,
      color: colors.primary,
      marginBottom: 4,
    },
  });

  return (
    <View style={styles.container} testID="import-modal">
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} testID="button-cancel">
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Import Workout</Text>
        <TouchableOpacity
          onPress={handleImport}
          disabled={isParsing || !markdown.trim()}
          testID="button-import"
        >
          <Text
            style={[
              styles.importButton,
              (isParsing || !markdown.trim()) && styles.importButtonDisabled,
            ]}
          >
            {isParsing ? 'Parsing...' : 'Import'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Workout Markdown</Text>
        <Text style={styles.hint}>
          Paste your workout in LiftMark Workout Format (LMWF)
        </Text>

        <TextInput
          style={styles.input}
          multiline
          placeholder={`# Push Day A
@tags: push, chest, shoulders
@units: lbs

Bench Press
- 3x10 @135
- 3x8 @185

Incline Dumbbell Press
- 3x12 @60
- @rest: 90s`}
          placeholderTextColor={colors.textMuted}
          value={markdown}
          onChangeText={setMarkdown}
          autoCapitalize="none"
          autoCorrect={false}
          testID="input-markdown"
        />

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Format Guide:</Text>
          <Text style={styles.helpText}>• Start with # Workout Name</Text>
          <Text style={styles.helpText}>• Add @tags and @units (optional)</Text>
          <Text style={styles.helpText}>• List exercises on their own lines</Text>
          <Text style={styles.helpText}>• Add sets with - SetsxReps @Weight</Text>
          <Text style={styles.helpText}>
            • Use modifiers: @rpe, @rest, @tempo, @dropset
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
