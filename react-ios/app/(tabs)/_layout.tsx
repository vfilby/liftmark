import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';

function createTabButton(testID: string) {
  return (props: any) => <Pressable {...props} testID={testID} />;
}

const TabHomeButton = createTabButton('tab-home');
const TabWorkoutsButton = createTabButton('tab-workouts');
const TabHistoryButton = createTabButton('tab-history');
const TabSettingsButton = createTabButton('tab-settings');

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
          tabBarButton: TabHomeButton,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Plans',
          tabBarButton: TabWorkoutsButton,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Workouts',
          tabBarButton: TabHistoryButton,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButton: TabSettingsButton,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
