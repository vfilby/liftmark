import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
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
