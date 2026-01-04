import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { colors } = useTheme();

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
