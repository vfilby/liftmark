export const Colors = {
  light: {
    // Backgrounds
    background: '#f5f5f5',
    backgroundSecondary: '#f9fafb',
    backgroundTertiary: '#f3f4f6',
    card: '#ffffff',

    // Text
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',

    // Accent
    primary: '#2563eb',
    primaryLight: '#eff6ff',
    primaryLightBorder: '#bfdbfe',

    // Status
    success: '#16a34a',
    successLight: '#f0fdf4',
    successLighter: '#dcfce7',
    successBorder: '#86efac',
    warning: '#ca8a04',
    warningLight: '#fefce8',
    warningLighter: '#fef9c3',
    warningBorder: '#fde047',
    error: '#ef4444',
    errorLight: '#fee2e2',

    // Borders & Dividers
    border: '#e5e7eb',
    borderLight: '#f3f4f6',

    // Tab bar
    tabBar: '#ffffff',
    tabIconDefault: '#6b7280',
    tabIconSelected: '#2563eb',

    // Workout sections
    sectionWarmup: '#10b981',
    sectionWarmupLight: '#ecfdf5',
    sectionWarmupBorder: '#6ee7b7',
    sectionCooldown: '#06b6d4',
    sectionCooldownLight: '#ecfeff',
    sectionCooldownBorder: '#67e8f9',
  },
  dark: {
    // Backgrounds
    background: '#111827',
    backgroundSecondary: '#1f2937',
    backgroundTertiary: '#374151',
    card: '#1f2937',

    // Text
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',

    // Accent
    primary: '#3b82f6',
    primaryLight: '#1e3a5f',
    primaryLightBorder: '#1e40af',

    // Status
    success: '#22c55e',
    successLight: '#14532d',
    successLighter: '#166534',
    successBorder: '#22c55e',
    warning: '#eab308',
    warningLight: '#422006',
    warningLighter: '#713f12',
    warningBorder: '#eab308',
    error: '#ef4444',
    errorLight: '#450a0a',

    // Borders & Dividers
    border: '#374151',
    borderLight: '#1f2937',

    // Tab bar
    tabBar: '#1f2937',
    tabIconDefault: '#6b7280',
    tabIconSelected: '#3b82f6',

    // Workout sections
    sectionWarmup: '#10b981',
    sectionWarmupLight: '#064e3b',
    sectionWarmupBorder: '#059669',
    sectionCooldown: '#06b6d4',
    sectionCooldownLight: '#164e63',
    sectionCooldownBorder: '#0891b2',
  },
};

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof Colors.light;
