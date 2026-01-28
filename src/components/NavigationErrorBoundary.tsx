/**
 * Navigation Error Boundary
 *
 * Catches and logs errors that occur during navigation and rendering,
 * particularly useful for debugging routing issues in production builds.
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { logger } from '@/services/logger';
import { navigationLogger } from '@/services/navigationLogger';
import { useRouter } from 'expo-router';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

class NavigationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    // Log to our custom logger
    logger.error('error_boundary', 'Navigation error caught', error, {
      componentStack: errorInfo.componentStack,
    });

    // Log to navigation logger
    navigationLogger.logErrorBoundary(error, errorInfo);

    this.setState({
      errorInfo,
    });
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error Fallback Component
 */
interface ErrorFallbackProps {
  error: Error;
  errorInfo: { componentStack: string } | null;
  onReset: () => void;
}

function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const router = useRouter();

  const handleGoHome = () => {
    onReset();
    router.replace('/');
  };

  const handleExportLogs = async () => {
    try {
      const logs = await logger.exportLogs();
      // In a real implementation, you'd use expo-sharing or similar
      console.log('Export logs:', logs);
      alert('Logs exported to console. In production, this would share the logs.');
    } catch (err) {
      console.error('Failed to export logs:', err);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Oops! Something went wrong</Text>
        <Text style={styles.subtitle}>
          We've logged this error and will work on fixing it.
        </Text>

        {__DEV__ && (
          <>
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Error Details:</Text>
              <Text style={styles.errorMessage}>{error.message}</Text>
              {error.stack && (
                <Text style={styles.stackTrace}>{error.stack}</Text>
              )}
            </View>

            {errorInfo?.componentStack && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Component Stack:</Text>
                <Text style={styles.stackTrace}>{errorInfo.componentStack}</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleGoHome}>
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={onReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>

          {!__DEV__ && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleExportLogs}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Export Debug Logs
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 40,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#ff4444',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#ff4444',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 10,
  },
  stackTrace: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
});

export default NavigationErrorBoundary;
