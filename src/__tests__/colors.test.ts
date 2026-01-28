import { Colors, ColorScheme, ThemeColors } from '../theme/colors';

describe('Colors Theme', () => {
  describe('Theme Parity', () => {
    it('light and dark themes have identical keys', () => {
      const lightKeys = Object.keys(Colors.light).sort();
      const darkKeys = Object.keys(Colors.dark).sort();

      expect(lightKeys).toEqual(darkKeys);
    });

    it('no keys are missing from light theme', () => {
      const darkKeys = Object.keys(Colors.dark);

      for (const key of darkKeys) {
        expect(Colors.light).toHaveProperty(key);
      }
    });

    it('no keys are missing from dark theme', () => {
      const lightKeys = Object.keys(Colors.light);

      for (const key of lightKeys) {
        expect(Colors.dark).toHaveProperty(key);
      }
    });
  });

  describe('Color Format Validation', () => {
    const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

    it('all light theme colors are valid hex format', () => {
      for (const [key, value] of Object.entries(Colors.light)) {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
        expect(typeof value).toBe('string');
        expect(value).toMatch(hexColorRegex);
      }
    });

    it('all dark theme colors are valid hex format', () => {
      for (const [key, value] of Object.entries(Colors.dark)) {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
        expect(typeof value).toBe('string');
        expect(value).toMatch(hexColorRegex);
      }
    });

    it('no undefined or null values in light theme', () => {
      for (const [key, value] of Object.entries(Colors.light)) {
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
      }
    });

    it('no undefined or null values in dark theme', () => {
      for (const [key, value] of Object.entries(Colors.dark)) {
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
      }
    });
  });

  describe('Key Categories Exist', () => {
    describe('Background colors', () => {
      it('light theme has required background colors', () => {
        expect(Colors.light).toHaveProperty('background');
        expect(Colors.light).toHaveProperty('backgroundSecondary');
        expect(Colors.light).toHaveProperty('backgroundTertiary');
        expect(Colors.light).toHaveProperty('card');
      });

      it('dark theme has required background colors', () => {
        expect(Colors.dark).toHaveProperty('background');
        expect(Colors.dark).toHaveProperty('backgroundSecondary');
        expect(Colors.dark).toHaveProperty('backgroundTertiary');
        expect(Colors.dark).toHaveProperty('card');
      });
    });

    describe('Text colors', () => {
      it('light theme has required text colors', () => {
        expect(Colors.light).toHaveProperty('text');
        expect(Colors.light).toHaveProperty('textSecondary');
        expect(Colors.light).toHaveProperty('textMuted');
      });

      it('dark theme has required text colors', () => {
        expect(Colors.dark).toHaveProperty('text');
        expect(Colors.dark).toHaveProperty('textSecondary');
        expect(Colors.dark).toHaveProperty('textMuted');
      });
    });

    describe('Status colors', () => {
      it('light theme has required status colors', () => {
        expect(Colors.light).toHaveProperty('success');
        expect(Colors.light).toHaveProperty('warning');
        expect(Colors.light).toHaveProperty('error');
      });

      it('dark theme has required status colors', () => {
        expect(Colors.dark).toHaveProperty('success');
        expect(Colors.dark).toHaveProperty('warning');
        expect(Colors.dark).toHaveProperty('error');
      });
    });

    describe('Border colors', () => {
      it('light theme has required border colors', () => {
        expect(Colors.light).toHaveProperty('border');
        expect(Colors.light).toHaveProperty('borderLight');
      });

      it('dark theme has required border colors', () => {
        expect(Colors.dark).toHaveProperty('border');
        expect(Colors.dark).toHaveProperty('borderLight');
      });
    });

    describe('Tab bar colors', () => {
      it('light theme has required tab bar colors', () => {
        expect(Colors.light).toHaveProperty('tabBar');
        expect(Colors.light).toHaveProperty('tabIconDefault');
        expect(Colors.light).toHaveProperty('tabIconSelected');
      });

      it('dark theme has required tab bar colors', () => {
        expect(Colors.dark).toHaveProperty('tabBar');
        expect(Colors.dark).toHaveProperty('tabIconDefault');
        expect(Colors.dark).toHaveProperty('tabIconSelected');
      });
    });

    describe('Section colors (warmup, cooldown)', () => {
      it('light theme has required warmup section colors', () => {
        expect(Colors.light).toHaveProperty('sectionWarmup');
        expect(Colors.light).toHaveProperty('sectionWarmupLight');
        expect(Colors.light).toHaveProperty('sectionWarmupBorder');
      });

      it('light theme has required cooldown section colors', () => {
        expect(Colors.light).toHaveProperty('sectionCooldown');
        expect(Colors.light).toHaveProperty('sectionCooldownLight');
        expect(Colors.light).toHaveProperty('sectionCooldownBorder');
      });

      it('dark theme has required warmup section colors', () => {
        expect(Colors.dark).toHaveProperty('sectionWarmup');
        expect(Colors.dark).toHaveProperty('sectionWarmupLight');
        expect(Colors.dark).toHaveProperty('sectionWarmupBorder');
      });

      it('dark theme has required cooldown section colors', () => {
        expect(Colors.dark).toHaveProperty('sectionCooldown');
        expect(Colors.dark).toHaveProperty('sectionCooldownLight');
        expect(Colors.dark).toHaveProperty('sectionCooldownBorder');
      });
    });
  });

  describe('Type Exports', () => {
    it('ColorScheme type accepts light', () => {
      const scheme: ColorScheme = 'light';
      expect(scheme).toBe('light');
    });

    it('ColorScheme type accepts dark', () => {
      const scheme: ColorScheme = 'dark';
      expect(scheme).toBe('dark');
    });

    it('ThemeColors type matches light theme structure', () => {
      const lightTheme: ThemeColors = Colors.light;
      expect(lightTheme).toBe(Colors.light);
    });

    it('ThemeColors type can be assigned from dark theme', () => {
      // Since ThemeColors is typeof Colors.light and both themes have identical keys,
      // dark theme should be assignable to ThemeColors
      const darkTheme: ThemeColors = Colors.dark;
      expect(darkTheme).toBe(Colors.dark);
    });

    it('Colors object has exactly light and dark themes', () => {
      const themeKeys = Object.keys(Colors);
      expect(themeKeys).toHaveLength(2);
      expect(themeKeys).toContain('light');
      expect(themeKeys).toContain('dark');
    });
  });
});
