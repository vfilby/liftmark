import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors?.tabIconSelected || '#007AFF',
        tabBarInactiveTintColor: colors?.tabIconDefault || '#8E8E93',
        tabBarStyle: {
          backgroundColor: colors?.tabBar || '#FFFFFF',
          borderTopColor: colors?.border || '#E5E5EA',
        },
        headerStyle: {
          backgroundColor: colors?.card || '#FFFFFF',
        },
        headerTintColor: colors?.text || '#000000',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'LiftMark',
          tabBarTestID: 'tab-home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarTestID: 'tab-workouts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fitness" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarTestID: 'tab-history',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarTestID: 'tab-settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
