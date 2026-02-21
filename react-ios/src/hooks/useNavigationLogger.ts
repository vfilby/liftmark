/**
 * useNavigationLogger Hook
 *
 * Provides easy-to-use navigation logging functions for tracking
 * navigation attempts and errors throughout the app.
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { navigationLogger } from '@/services/navigationLogger';
import { logger } from '@/services/logger';

type NavigationParams = Record<string, any>;

export function useNavigationLogger() {
  const router = useRouter();

  /**
   * Navigate with logging
   */
  const navigate = useCallback((route: string, params?: NavigationParams) => {
    try {
      navigationLogger.logNavigationAttempt(route, params, 'navigate');
      router.push({ pathname: route as any, params });
      navigationLogger.logNavigationSuccess(route);
    } catch (error) {
      navigationLogger.logNavigationError({
        type: 'navigation_failed',
        route,
        params,
        error: error instanceof Error ? error : new Error('Navigation failed'),
      });
      throw error;
    }
  }, [router]);

  /**
   * Push with logging
   */
  const push = useCallback((route: string, params?: NavigationParams) => {
    try {
      navigationLogger.logNavigationAttempt(route, params, 'push');
      router.push({ pathname: route as any, params });
      navigationLogger.logNavigationSuccess(route);
    } catch (error) {
      navigationLogger.logNavigationError({
        type: 'navigation_failed',
        route,
        params,
        error: error instanceof Error ? error : new Error('Navigation failed'),
      });
      throw error;
    }
  }, [router]);

  /**
   * Replace with logging
   */
  const replace = useCallback((route: string, params?: NavigationParams) => {
    try {
      navigationLogger.logNavigationAttempt(route, params, 'replace');
      router.replace({ pathname: route as any, params });
      navigationLogger.logNavigationSuccess(route);
    } catch (error) {
      navigationLogger.logNavigationError({
        type: 'navigation_failed',
        route,
        params,
        error: error instanceof Error ? error : new Error('Navigation failed'),
      });
      throw error;
    }
  }, [router]);

  /**
   * Go back with logging
   */
  const goBack = useCallback(() => {
    try {
      navigationLogger.logNavigationAttempt('back', undefined, 'goBack');
      router.back();
    } catch (error) {
      navigationLogger.logNavigationError({
        type: 'navigation_failed',
        route: 'back',
        error: error instanceof Error ? error : new Error('Navigation failed'),
      });
      throw error;
    }
  }, [router]);

  /**
   * Log a navigation-related error
   */
  const logError = useCallback((
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ) => {
    logger.error('navigation', message, error, metadata);
  }, []);

  return {
    navigate,
    push,
    replace,
    goBack,
    logError,
  };
}
