import { Stack } from 'expo-router';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEffect } from 'react';

export default function RootLayout() {
  const { colors } = useTheme();
  const { loadSettings } = useSettingsStore();

  // Load settings when the app starts
  useEffect(() => {
    loadSettings().catch((error) => {
      console.error('Failed to load settings on app start:', error);
    });
  }, [loadSettings]);

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
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal/import"
        options={{
          presentation: 'modal',
          title: 'Import Workout',
        }}
      />
      <Stack.Screen
        name="workout/[id]"
        options={{
          title: 'Workout Details',
        }}
      />
      <Stack.Screen
        name="workout/active"
        options={{
          title: 'Active Workout',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="workout/summary"
        options={{
          title: 'Workout Complete',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="history/[id]"
        options={{
          title: 'Workout Details',
        }}
      />
    </Stack>
  );
}
