import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/theme';
import type { WorkoutHighlight } from '@/services/workoutHighlightsService';

interface WorkoutHighlightsProps {
  highlights: WorkoutHighlight[];
}

export default function WorkoutHighlights({ highlights }: WorkoutHighlightsProps) {
  const { colors } = useTheme();

  if (highlights.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerEmoji: {
      fontSize: 24,
      marginRight: 8,
    },
    headerText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    highlightsList: {
      gap: 8,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderLeftWidth: 3,
    },
    highlightItemPR: {
      borderLeftColor: colors.success,
    },
    highlightItemIncrease: {
      borderLeftColor: colors.primary,
    },
    highlightItemStreak: {
      borderLeftColor: '#ff6b35',
    },
    highlightEmoji: {
      fontSize: 20,
      marginRight: 10,
    },
    highlightContent: {
      flex: 1,
    },
    highlightTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    highlightMessage: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  const getHighlightStyle = (type: WorkoutHighlight['type']) => {
    switch (type) {
      case 'pr':
        return styles.highlightItemPR;
      case 'weight_increase':
      case 'volume_increase':
        return styles.highlightItemIncrease;
      case 'streak':
        return styles.highlightItemStreak;
      default:
        return styles.highlightItemPR;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>✨</Text>
        <Text style={styles.headerText}>Highlights</Text>
      </View>

      <View style={styles.highlightsList}>
        {highlights.map((highlight, index) => (
          <View
            key={index}
            style={[styles.highlightItem, getHighlightStyle(highlight.type)]}
          >
            <Text style={styles.highlightEmoji}>{highlight.emoji}</Text>
            <View style={styles.highlightContent}>
              <Text style={styles.highlightTitle}>{highlight.title}</Text>
              <Text style={styles.highlightMessage}>{highlight.message}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
