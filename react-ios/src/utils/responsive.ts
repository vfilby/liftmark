import { useDeviceLayout } from '@/hooks/useDeviceLayout';

// Re-export useDeviceLayout for convenience
export { useDeviceLayout };

/**
 * Returns responsive padding values based on device type
 */
export function useResponsivePadding() {
  const { isTablet } = useDeviceLayout();

  return {
    // Standard horizontal padding
    horizontal: isTablet ? 24 : 16,
    // Standard vertical padding
    vertical: isTablet ? 20 : 16,
    // Container padding
    container: isTablet ? 24 : 16,
    // Card padding
    card: isTablet ? 20 : 16,
    // Small padding
    small: isTablet ? 12 : 8,
    // Large padding
    large: isTablet ? 32 : 24,
  };
}

/**
 * Returns responsive spacing values for gaps between elements
 */
export function useResponsiveSpacing() {
  const { isTablet } = useDeviceLayout();

  return {
    xs: isTablet ? 6 : 4,
    sm: isTablet ? 10 : 8,
    md: isTablet ? 16 : 12,
    lg: isTablet ? 24 : 16,
    xl: isTablet ? 32 : 24,
  };
}

/**
 * Returns responsive font sizes
 */
export function useResponsiveFontSizes() {
  const { isTablet } = useDeviceLayout();

  return {
    xs: isTablet ? 12 : 11,
    sm: isTablet ? 14 : 13,
    md: isTablet ? 16 : 15,
    lg: isTablet ? 20 : 18,
    xl: isTablet ? 24 : 22,
    xxl: isTablet ? 32 : 28,
  };
}

/**
 * Returns the maximum width for content containers on large screens
 * Use this to prevent content from being too wide on iPad
 */
export function useMaxContentWidth() {
  const { isTablet } = useDeviceLayout();

  return isTablet ? 800 : undefined;
}
