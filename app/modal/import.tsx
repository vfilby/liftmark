import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  const promptText = `Generate a workout in LiftMark Workout Format (LMWF). Use this exact format:

# Workout Name
@tags: tag1, tag2
@units: lbs

## Exercise Name
- weight unit x reps @modifiers
- weight unit x reps @modifiers

Format rules:
- Start with # for workout name
- Use @tags and @units for metadata
- ## for exercises
- Sets: "weight unit x reps" (e.g., "225 lbs x 5")
- Bodyweight: just reps (e.g., "10") or "bw x 10"
- Time: "60s" or "weight x time"
- Modifiers: @rpe:8, @rest:90s, @tempo:3-0-1-0, @dropset
- AMRAP sets: "weight x AMRAP"

Example:
# Push Day
@tags: push, chest
@units: lbs

## Bench Press
- 135 x 10
- 185 x 8 @rpe: 7
- 225 x 5 @rpe: 9 @rest: 180s

## Push-ups
- 15
- 12 @dropset

Generate a [workout type] workout with [specific requirements].`;

  const copyPrompt = async () => {
    try {
      await Clipboard.setString(promptText);
      Alert.alert('Copied!', 'Prompt copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy prompt');
    }
  };

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
    promptSection: {
      marginBottom: 16,
    },
    promptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.primaryLightBorder,
    },
    promptButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    promptExpanded: {
      marginTop: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    promptHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    promptHeaderText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    promptContent: {
      padding: 12,
    },
    promptText: {
      fontSize: 12,
      fontFamily: 'monospace',
      color: colors.textSecondary,
      lineHeight: 16,
    },
    copyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    copyButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
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
        <View style={styles.promptSection}>
          <TouchableOpacity
            style={styles.promptButton}
            onPress={() => setIsPromptExpanded(!isPromptExpanded)}
          >
            <Text style={styles.promptButtonText}>
              📋 AI Workout Prompt
            </Text>
            <Ionicons
              name={isPromptExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>

          {isPromptExpanded && (
            <View style={styles.promptExpanded}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptHeaderText}>
                  Copy this prompt for AI assistants
                </Text>
                <TouchableOpacity style={styles.copyButton} onPress={copyPrompt}>
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.promptContent}>
                <Text style={styles.promptText}>{promptText}</Text>
              </View>
            </View>
          )}
        </View>

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
          <Text style={styles.helpTitle}>Quick Guide:</Text>
          <Text style={styles.helpText}>• Start with # Workout Name</Text>
          <Text style={styles.helpText}>• Add @tags and @units (optional)</Text>
          <Text style={styles.helpText}>• ## Exercise Name</Text>
          <Text style={styles.helpText}>• - weight unit x reps</Text>
          <Text style={styles.helpText}>• Use @rpe, @rest, @tempo, @dropset modifiers</Text>
        </View>
      </ScrollView>
    </View>
  );
}
