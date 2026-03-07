export const colors = {
  // Primary
  primary: '#007AFF', // iOS System Blue

  // Background
  backgroundLight: '#F2F2F7', // System Grouped Background
  cardBackground: '#FFFFFF',

  // Text
  textPrimary: '#000000',
  textSecondary: '#8E8E93', // System Gray

  // Semantic
  danger: '#FF3B30', // System Red (Destructive/Undo)
  success: '#34C759', // System Green
  warning: '#FF9500', // System Orange

  // UI elements
  border: '#C6C6C8', // Standard iOS border
};

export const theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.backgroundLight,
    card: colors.cardBackground,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};
