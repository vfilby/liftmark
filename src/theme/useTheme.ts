import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './colors';
import { useSettingsStore } from '@/stores/settingsStore';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const systemColorScheme = useColorScheme();
  const { settings } = useSettingsStore();

  // Determine which theme to use
  let isDark: boolean;
  
  // If settings are not loaded yet, default to system preference
  if (!settings) {
    isDark = systemColorScheme === 'dark';
  } else if (settings.theme === 'dark') {
    isDark = true;
  } else if (settings.theme === 'light') {
    isDark = false;
  } else {
    // 'auto' theme - use system preference
    isDark = systemColorScheme === 'dark';
  }

  return {
    colors: isDark ? Colors.dark : Colors.light,
    isDark,
  };
}
