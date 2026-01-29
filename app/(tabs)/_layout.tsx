import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  const createTabButton = (testID: string) =>
    React.forwardRef<any, any>((props, ref) => (
      <Pressable {...props} ref={ref} testID={testID} />
    ));

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
          tabBarButton: createTabButton('tab-home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarButton: createTabButton('tab-workouts'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fitness" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarButton: createTabButton('tab-history'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButton: createTabButton('tab-settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
