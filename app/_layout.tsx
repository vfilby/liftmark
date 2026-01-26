import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useNavigationContainerRef, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEffect } from 'react';
import NavigationErrorBoundary from '@/components/NavigationErrorBoundary';
import { ActiveWorkoutBanner } from '@/components/ActiveWorkoutBanner';
import { logger } from '@/services/logger';
import { navigationLogger } from '@/services/navigationLogger';

export default function RootLayout() {
  const { colors } = useTheme();
  const { loadSettings } = useSettingsStore();
  const navigationRef = useNavigationContainerRef();
  const pathname = usePathname();

  // Load settings when the app starts
  useEffect(() => {
    loadSettings().catch((error) => {
      console.error('Failed to load settings on app start:', error);
      logger.error('app', 'Failed to load settings on app start', error);
    });
  }, [loadSettings]);

  // Log app initialization
  useEffect(() => {
    logger.info('app', 'App initialized', {
      pathname,
    });
  }, []);

  // Register routes
  useEffect(() => {
    const routes = [
      '(tabs)',
      'modal/import',
      'workout/[id]',
      'workout/active',
      'workout/summary',
      'history/[id]',
      'gym/[id]',
      'settings/workout',
      'settings/sync',
      'settings/debug-logs',
      'cloudkit-test',
    ];

    routes.forEach((route) => {
      navigationLogger.registerRoute(route);
    });

    navigationLogger.logRouteRegistrationSummary();
  }, []);

  // Track navigation state changes
  useEffect(() => {
    if (!navigationRef.current) return;

    const state = navigationRef.current.getRootState();
    if (state) {
      navigationLogger.logStateChange(state);
    }
  }, [pathname, navigationRef]);

  // Track unhandled errors
  useEffect(() => {
    const errorHandler = (error: Error, isFatal?: boolean) => {
      logger.error('app', 'Unhandled error', error, { isFatal });
    };

    // Note: In React Native, you'd use ErrorUtils.setGlobalHandler
    // For now, we'll just log
    if (typeof ErrorUtils !== 'undefined') {
      ErrorUtils.setGlobalHandler(errorHandler);
    }

    return () => {
      if (typeof ErrorUtils !== 'undefined') {
        ErrorUtils.setGlobalHandler(() => {});
      }
    };
  }, []);

  return (
    <NavigationErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ActiveWorkoutBanner />
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
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            headerBackTitle: 'Back',
          }}
        />
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
            headerBackTitle: 'Back',
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
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="gym/[id]"
          options={{
            title: 'Gym Details',
            headerBackTitle: 'Settings',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="cloudkit-test"
          options={{
            title: 'CloudKit Test',
            headerBackTitle: 'Back',
            presentation: 'card',
          }}
        />
          </Stack>
        </View>
      </GestureHandlerRootView>
    </NavigationErrorBoundary>
  );
}
