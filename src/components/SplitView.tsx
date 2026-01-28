import React, { ReactNode } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useDeviceLayout } from '../hooks/useDeviceLayout';

interface SplitViewProps {
  leftPane: ReactNode;
  rightPane: ReactNode;
  selectedId: string | null;
  emptyStateMessage?: string;
}

export function SplitView({
  leftPane,
  rightPane,
  selectedId,
  emptyStateMessage = 'Select an item to view details',
}: SplitViewProps) {
  const { isTablet } = useDeviceLayout();

  if (!isTablet) {
    return <>{leftPane}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.leftPane}>{leftPane}</View>
      <View style={styles.divider} />
      <View style={styles.rightPane}>
        {selectedId ? (
          rightPane
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{emptyStateMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    flex: 0.35,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  divider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  rightPane: {
    flex: 0.65,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
  },
});
