import { useWindowDimensions, Platform } from 'react-native';

const TABLET_BREAKPOINT = 768;

export interface DeviceLayout {
  isTablet: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();

  const isTablet = Platform.OS === 'ios' && width >= TABLET_BREAKPOINT;
  const orientation = width > height ? 'landscape' : 'portrait';

  return {
    isTablet,
    width,
    height,
    orientation,
  };
}
