/**
 * theme.js
 * Modern Ride-Sharing UI Theme (inspired by Uber/Ola aesthetic)
 * Provides consistent design system across all pages
 */

export const THEME = {
  // Primary Colors - Professional Ride-Sharing
  colors: {
    // Brand colors
    primary: "#000000",        // Black (uber-style)
    secondary: "#1DB954",      // Green (action, confirm)
    accent: "#FFFFFF",         // White (contrast)
    danger: "#E74C3C",         // Red (cancel, error)
    warning: "#FFC107",        // Amber (caution)
    success: "#1DB954",        // Green (success)
    
    // Backgrounds
    bgPrimary: "#FFFFFF",      // White main
    bgSecondary: "#F5F5F5",    // Light gray
    bgTertiary: "#EEEEEE",     // Lighter gray
    bgDark: "#1F1F1F",         // Dark (for dark mode)
    
    // Text colors
    textPrimary: "#000000",    // Black text
    textSecondary: "#666666",  // Gray text
    textTertiary: "#999999",   // Light gray text
    textInverse: "#FFFFFF",    // White text on dark
    
    // UI Elements
    border: "#E0E0E0",         // Light border
    borderDark: "#CCCCCC",     // Darker border
    divider: "#F0F0F0",        // Subtle divider
    
    // Semantic
    info: "#0099FF",           // Blue (info)
    disabled: "#CCCCCC",       // Disabled elements
  },

  // Typography
  typography: {
    fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif",
    sizes: {
      h1: "32px",
      h2: "28px",
      h3: "24px",
      h4: "20px",
      h5: "16px",
      h6: "14px",
      body: "14px",
      small: "12px",
      xs: "11px",
    },
    weights: {
      thin: 100,
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },

  // Spacing (8px base unit)
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
    xxxl: "64px",
  },

  // Border Radius
  borderRadius: {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },

  // Shadows
  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.1)",
    xxl: "0 25px 50px rgba(0, 0, 0, 0.15)",
    elevation: "0 8px 16px rgba(0, 0, 0, 0.12)",
  },

  // Transitions
  transitions: {
    fast: "150ms ease-in-out",
    normal: "200ms ease-in-out",
    slow: "300ms ease-in-out",
    verySlow: "500ms ease-in-out",
  },

  // Z-index scale
  zIndex: {
    dropdown: 1000,
    sticky: 1010,
    fixed: 1020,
    modalBackdrop: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  },
};

// Preset button styles
export const BUTTON_STYLES = {
  primary: {
    background: THEME.colors.primary,
    color: THEME.colors.textInverse,
    border: `2px solid ${THEME.colors.primary}`,
    fontWeight: THEME.typography.weights.semibold,
    transition: THEME.transitions.normal,
  },
  secondary: {
    background: THEME.colors.secondary,
    color: THEME.colors.textInverse,
    border: `2px solid ${THEME.colors.secondary}`,
    fontWeight: THEME.typography.weights.semibold,
    transition: THEME.transitions.normal,
  },
  outline: {
    background: "transparent",
    color: THEME.colors.primary,
    border: `2px solid ${THEME.colors.primary}`,
    fontWeight: THEME.typography.weights.semibold,
    transition: THEME.transitions.normal,
  },
  ghost: {
    background: "transparent",
    color: THEME.colors.primary,
    border: "none",
    fontWeight: THEME.typography.weights.medium,
    transition: THEME.transitions.normal,
  },
  danger: {
    background: THEME.colors.danger,
    color: THEME.colors.textInverse,
    border: `2px solid ${THEME.colors.danger}`,
    fontWeight: THEME.typography.weights.semibold,
    transition: THEME.transitions.normal,
  },
};

// Preset card styles
export const CARD_STYLES = {
  default: {
    background: THEME.colors.bgPrimary,
    border: `1px solid ${THEME.colors.border}`,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    boxShadow: THEME.shadows.sm,
    transition: THEME.transitions.normal,
  },
  elevated: {
    background: THEME.colors.bgPrimary,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    boxShadow: THEME.shadows.lg,
    transition: THEME.transitions.normal,
  },
  interactive: {
    background: THEME.colors.bgSecondary,
    border: `1px solid ${THEME.colors.border}`,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    cursor: "pointer",
    transition: THEME.transitions.normal,
  },
};

// Utility function for responsive padding
export const responsivePadding = (mobile, tablet, desktop) => ({
  "@media (max-width: 640px)": { padding: mobile },
  "@media (min-width: 641px) and (max-width: 1024px)": { padding: tablet },
  "@media (min-width: 1025px)": { padding: desktop },
});

// Utility for flex centering
export const flexCenter = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Utility for truncating text
export const truncateText = (lines = 1) => ({
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
});
