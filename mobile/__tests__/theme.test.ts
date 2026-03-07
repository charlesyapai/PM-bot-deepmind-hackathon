/**
 * Theme Tests
 * Verifies that color tokens and typography scale export the expected values
 * so that accidental changes to the design system are caught immediately.
 *
 * Dependencies required (not yet in mobile/package.json):
 *   npm install --save-dev jest @types/jest ts-jest
 *   (or use jest-expo preset which handles TypeScript automatically)
 *
 * NOTE: react-native's StyleSheet.create is a thin wrapper in tests —
 * it simply returns the style object unchanged in the Node environment,
 * so typography values are directly inspectable.
 */

import { colors, theme } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Color token tests
// ---------------------------------------------------------------------------
describe('colors', () => {
  it('exports a colors object', () => {
    expect(colors).toBeDefined();
    expect(typeof colors).toBe('object');
  });

  it('primary color is iOS System Blue (#007AFF)', () => {
    expect(colors.primary).toBe('#007AFF');
  });

  it('backgroundLight is iOS System Grouped Background (#F2F2F7)', () => {
    expect(colors.backgroundLight).toBe('#F2F2F7');
  });

  it('cardBackground is white (#FFFFFF)', () => {
    expect(colors.cardBackground).toBe('#FFFFFF');
  });

  it('textPrimary is black (#000000)', () => {
    expect(colors.textPrimary).toBe('#000000');
  });

  it('textSecondary is iOS System Gray (#8E8E93)', () => {
    expect(colors.textSecondary).toBe('#8E8E93');
  });

  it('danger color is iOS System Red (#FF3B30)', () => {
    expect(colors.danger).toBe('#FF3B30');
  });

  it('success color is iOS System Green (#34C759)', () => {
    expect(colors.success).toBe('#34C759');
  });

  it('warning color is iOS System Orange (#FF9500)', () => {
    expect(colors.warning).toBe('#FF9500');
  });

  it('border color is standard iOS border (#C6C6C8)', () => {
    expect(colors.border).toBe('#C6C6C8');
  });

  it('exports all required color keys', () => {
    const requiredKeys = [
      'primary',
      'backgroundLight',
      'cardBackground',
      'textPrimary',
      'textSecondary',
      'danger',
      'success',
      'warning',
      'border',
    ];
    requiredKeys.forEach((key) => {
      expect(colors).toHaveProperty(key);
    });
  });
});

// ---------------------------------------------------------------------------
// Theme object tests (React Navigation theme shape)
// ---------------------------------------------------------------------------
describe('theme', () => {
  it('exports a theme object', () => {
    expect(theme).toBeDefined();
    expect(typeof theme).toBe('object');
  });

  it('theme.dark is false (light mode)', () => {
    expect(theme.dark).toBe(false);
  });

  it('theme.colors.primary matches colors.primary', () => {
    expect(theme.colors.primary).toBe(colors.primary);
  });

  it('theme.colors.background matches colors.backgroundLight', () => {
    expect(theme.colors.background).toBe(colors.backgroundLight);
  });

  it('theme.colors.card matches colors.cardBackground', () => {
    expect(theme.colors.card).toBe(colors.cardBackground);
  });

  it('theme.colors.text matches colors.textPrimary', () => {
    expect(theme.colors.text).toBe(colors.textPrimary);
  });

  it('theme.colors.border matches colors.border', () => {
    expect(theme.colors.border).toBe(colors.border);
  });

  it('theme.colors.notification matches colors.danger', () => {
    expect(theme.colors.notification).toBe(colors.danger);
  });

  it('theme.colors has all required React Navigation keys', () => {
    const requiredKeys = ['primary', 'background', 'card', 'text', 'border', 'notification'];
    requiredKeys.forEach((key) => {
      expect(theme.colors).toHaveProperty(key);
    });
  });
});

// ---------------------------------------------------------------------------
// Typography scale tests
// ---------------------------------------------------------------------------
describe('typography', () => {
  it('exports a typography object', () => {
    expect(typography).toBeDefined();
    expect(typeof typography).toBe('object');
  });

  it('exports all required text style keys', () => {
    const requiredKeys = ['h1', 'h2', 'body', 'caption'];
    requiredKeys.forEach((key) => {
      expect(typography).toHaveProperty(key);
    });
  });

  describe('h1', () => {
    it('has fontSize 34', () => {
      expect(typography.h1.fontSize).toBe(34);
    });

    it('has fontWeight bold', () => {
      expect(typography.h1.fontWeight).toBe('bold');
    });
  });

  describe('h2', () => {
    it('has fontSize 28', () => {
      expect(typography.h2.fontSize).toBe(28);
    });

    it('has fontWeight 600', () => {
      expect(typography.h2.fontWeight).toBe('600');
    });
  });

  describe('body', () => {
    it('has fontSize 17 (iOS default body size)', () => {
      expect(typography.body.fontSize).toBe(17);
    });

    it('has fontWeight normal', () => {
      expect(typography.body.fontWeight).toBe('normal');
    });
  });

  describe('caption', () => {
    it('has fontSize 13', () => {
      expect(typography.caption.fontSize).toBe(13);
    });

    it('has fontWeight normal', () => {
      expect(typography.caption.fontWeight).toBe('normal');
    });
  });
});
