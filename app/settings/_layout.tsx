/**
 * Settings Layout
 *
 * Defines the nested routing structure for all settings screens.
 * This ensures routes are properly discovered in production builds.
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function SettingsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors?.card || '#FFFFFF',
        },
        headerTintColor: colors?.text || '#000000',
        contentStyle: {
          backgroundColor: colors?.background || '#F5F5F5',
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
