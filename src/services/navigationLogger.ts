/**
 * Navigation Logger Service
 *
 * Tracks navigation state changes, route transitions, and navigation errors
 * for debugging routing issues in production builds.
 */

import { logger } from './logger';

interface RouteInfo {
  name: string;
  params?: Record<string, any>;
  path?: string;
}

interface NavigationState {
  index: number;
  routes: RouteInfo[];
  key?: string;
}

interface NavigationError {
  type: 'unmatched_route' | 'navigation_failed' | 'invalid_params' | 'unknown';
  route?: string;
  params?: Record<string, any>;
  error: Error;
}

class NavigationLogger {
  private static instance: NavigationLogger;
  private previousState: NavigationState | null = null;
  private navigationHistory: Array<{
    timestamp: string;
    state: NavigationState;
  }> = [];
  private readonly MAX_HISTORY = 50;
  private registeredRoutes: Set<string> = new Set();

  private constructor() {
    this.logNavigationInit();
  }

  public static getInstance(): NavigationLogger {
    if (!NavigationLogger.instance) {
      NavigationLogger.instance = new NavigationLogger();
    }
    return NavigationLogger.instance;
  }

  /**
   * Log navigation initialization
   */
  private logNavigationInit(): void {
    logger.info('navigation', 'Navigation logger initialized', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Register a route
   */
  public registerRoute(routeName: string, routeConfig?: Record<string, any>): void {
    this.registeredRoutes.add(routeName);
    logger.debug('routing', `Route registered: ${routeName}`, {
      routeName,
      config: routeConfig,
      totalRoutes: this.registeredRoutes.size,
    });
  }

  /**
   * Get all registered routes
   */
  public getRegisteredRoutes(): string[] {
    return Array.from(this.registeredRoutes);
  }

  /**
   * Log route registration summary
   */
  public logRouteRegistrationSummary(): void {
    const routes = this.getRegisteredRoutes();
    logger.info('routing', 'Route registration complete', {
      totalRoutes: routes.length,
      routes,
    });
  }

  /**
   * Log navigation state change
   */
  public logStateChange(state: NavigationState | undefined, action?: string): void {
    if (!state) {
      logger.warn('navigation', 'Navigation state is undefined', { action });
      return;
    }

    const currentRoute = state.routes[state.index];
    const previousRoute = this.previousState?.routes[this.previousState.index];

    // Add to history
    this.navigationHistory.push({
      timestamp: new Date().toISOString(),
      state,
    });

    // Keep history limited
    if (this.navigationHistory.length > this.MAX_HISTORY) {
      this.navigationHistory.shift();
    }

    // Log state change
    logger.info('navigation', 'Navigation state changed', {
      action,
      previousRoute: previousRoute?.name,
      currentRoute: currentRoute?.name,
      currentParams: currentRoute?.params,
      stackDepth: state.routes.length,
      stateKey: state.key,
    });

    // Check for unregistered routes
    if (!this.registeredRoutes.has(currentRoute.name)) {
      logger.warn('routing', `Navigating to unregistered route: ${currentRoute.name}`, {
        route: currentRoute.name,
        params: currentRoute.params,
        registeredRoutes: this.getRegisteredRoutes(),
      });
    }

    this.previousState = state;
  }

  /**
   * Log navigation error
   */
  public logNavigationError(navError: NavigationError): void {
    logger.error(
      'navigation',
      `Navigation error: ${navError.type}`,
      navError.error,
      {
        errorType: navError.type,
        route: navError.route,
        params: navError.params,
        registeredRoutes: this.getRegisteredRoutes(),
        navigationHistory: this.getRecentHistory(5),
      }
    );
  }

  /**
   * Log route not found error
   */
  public logRouteNotFound(routeName: string, params?: Record<string, any>): void {
    this.logNavigationError({
      type: 'unmatched_route',
      route: routeName,
      params,
      error: new Error(`Route not found: ${routeName}`),
    });
  }

  /**
   * Log navigation attempt
   */
  public logNavigationAttempt(
    targetRoute: string,
    params?: Record<string, any>,
    method: 'push' | 'replace' | 'navigate' | 'goBack' = 'navigate'
  ): void {
    logger.debug('navigation', `Navigation attempt: ${method} to ${targetRoute}`, {
      targetRoute,
      params,
      method,
      currentState: this.previousState,
    });
  }

  /**
   * Log navigation success
   */
  public logNavigationSuccess(targetRoute: string): void {
    logger.debug('navigation', `Navigation successful to ${targetRoute}`, {
      targetRoute,
    });
  }

  /**
   * Get recent navigation history
   */
  public getRecentHistory(count = 10): Array<{
    timestamp: string;
    routeName: string;
    params?: Record<string, any>;
  }> {
    return this.navigationHistory
      .slice(-count)
      .map(entry => ({
        timestamp: entry.timestamp,
        routeName: entry.state.routes[entry.state.index]?.name,
        params: entry.state.routes[entry.state.index]?.params,
      }));
  }

  /**
   * Export navigation history
   */
  public exportHistory(): string {
    return JSON.stringify({
      registeredRoutes: this.getRegisteredRoutes(),
      currentState: this.previousState,
      history: this.navigationHistory,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Log deep link handling
   */
  public logDeepLink(url: string, parsed?: Record<string, any>): void {
    logger.info('navigation', `Deep link received: ${url}`, {
      url,
      parsed,
      currentRoute: this.previousState?.routes[this.previousState.index]?.name,
    });
  }

  /**
   * Log error boundary catch
   */
  public logErrorBoundary(error: Error, errorInfo: { componentStack: string }): void {
    logger.error(
      'error_boundary',
      'Error caught by navigation error boundary',
      error,
      {
        componentStack: errorInfo.componentStack,
        currentRoute: this.previousState?.routes[this.previousState.index]?.name,
        navigationHistory: this.getRecentHistory(3),
      }
    );
  }

  /**
   * Clear navigation history
   */
  public clearHistory(): void {
    this.navigationHistory = [];
    logger.info('navigation', 'Navigation history cleared');
  }
}

// Export singleton instance
export const navigationLogger = NavigationLogger.getInstance();
