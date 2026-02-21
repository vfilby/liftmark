/**
 * Settings Layout
 *
 * Defines the nested routing structure for all settings screens.
 * This ensures routes are properly discovered in production builds.
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

// Default colors fallback
const defaultColors = {
  card: '#FFFFFF',
  text: '#000000',
  background: '#F5F5F5',
};

export default function SettingsLayout() {
  const theme = useTheme();
  const colors = theme?.colors || defaultColors;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        contentStyle: {
          backgroundColor: colors.background,
        },
        headerBackTitle: 'Settings',
        presentation: 'card',
      }}
    >
      <Stack.Screen
        name="workout"
        options={{
          title: 'Workout Settings',
        }}
      />
      <Stack.Screen
        name="sync"
        options={{
          title: 'iCloud Sync',
        }}
      />
      <Stack.Screen
        name="debug-logs"
        options={{
          title: 'Debug Logs',
        }}
      />
    </Stack>
  );
}
