import * as stylex from "@stylexjs/stylex";

export const colors = stylex.defineConsts({
  background: "var(--background)",
  canvas: "var(--muted)",
  surface: "var(--card)",
  surfaceSubtle: "var(--secondary)",
  surfaceHover: "var(--accent)",
  foreground: "var(--foreground)",
  foregroundMuted: "var(--muted-foreground)",
  foregroundSubtle: "var(--ring)",
  border: "var(--border)",
  borderStrong: "var(--input)",
  input: "var(--input)",
  primary: "var(--primary)",
  primaryHover: "var(--primary-hover)",
  primaryForeground: "var(--primary-foreground)",
  brand: "var(--primary)",
  brandHover: "var(--primary-hover)",
  brandSurface: "var(--accent)",
  brandBorder: "var(--border)",
  brandForeground: "var(--accent-foreground)",
  focus: "var(--ring)",
  focusGlow: "var(--ring-muted)",
  success: "var(--foldworks-ui-success)",
  successSurface: "var(--foldworks-ui-success-surface)",
  warning: "var(--foldworks-ui-warning)",
  warningSurface: "var(--foldworks-ui-warning-surface)",
  danger: "var(--foldworks-ui-danger)",
  dangerSurface: "var(--foldworks-ui-danger-surface)",
  dangerBorder: "var(--foldworks-ui-danger-border)",
  info: "var(--foldworks-ui-info)",
  infoSurface: "var(--foldworks-ui-info-surface)",
  selection: "var(--foldworks-ui-selection)",
  selectionForeground: "var(--foldworks-ui-selection-foreground)",
  selectionBorder: "var(--foldworks-ui-selection-border)",
  dropTarget: "var(--foldworks-ui-drop-target)",
  dropTargetBorder: "var(--foldworks-ui-drop-target-border)",
  dropTargetActive: "var(--foldworks-ui-drop-target-active)",
  dropTargetActiveBorder: "var(--foldworks-ui-drop-target-active-border)",
  overlay: "var(--foldworks-ui-overlay)",
});

export const metrics = stylex.defineConsts({
  radiusSm: "var(--radius-sm)",
  radiusMd: "var(--radius-md)",
  radiusLg: "var(--radius-lg)",
  shadowSm: "var(--shadow-sm)",
  shadowControl: "var(--shadow-control)",
  shadowInteractive: "var(--shadow-interactive)",
  shadowPanel: "var(--shadow-panel)",
  shadowFloat: "var(--shadow-float)",
  shadowSheet: "var(--shadow-sheet)",
  durationFast: "var(--duration-fast)",
  durationNormal: "var(--duration-normal)",
  durationSlow: "var(--duration-slow)",
  easeOut: "var(--ease-out)",
  spring: "var(--spring)",
  font: "var(--font-sans)",
});

export const space = stylex.defineConsts({
  xxs: "2px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
});

export const typography = stylex.defineConsts({
  fontFamily: "var(--font-sans)",
  sizeXs: "11px",
  sizeSm: "12px",
  sizeMd: "13px",
  sizeLg: "14px",
  sizeXl: "16px",
  weightMedium: 550,
  weightSemibold: 650,
  weightBold: 700,
  lineHeightTight: 1.25,
  lineHeightNormal: 1.5,
});

export const radii = stylex.defineConsts({
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  full: "999px",
});

export const sizes = stylex.defineConsts({
  controlSm: "32px",
  controlMd: "36px",
  controlLg: "40px",
  iconSm: "14px",
  iconMd: "16px",
  iconLg: "20px",
});

export const shadows = stylex.defineConsts({
  sm: "var(--shadow-sm)",
  control: "var(--shadow-control)",
  interactive: "var(--shadow-interactive)",
  panel: "var(--shadow-panel)",
  float: "var(--shadow-float)",
  sheet: "var(--shadow-sheet)",
});

export const motion = stylex.defineConsts({
  fast: "var(--duration-fast)",
  normal: "var(--duration-normal)",
  slow: "var(--duration-slow)",
  easeOut: "var(--ease-out)",
  spring: "var(--spring)",
});
