import * as stylex from "@stylexjs/stylex";

export const colors = stylex.defineConsts({
  background: "var(--foldworks-ui-background)",
  canvas: "var(--foldworks-ui-canvas)",
  surface: "var(--foldworks-ui-surface)",
  surfaceSubtle: "var(--foldworks-ui-surface-subtle)",
  surfaceHover: "var(--foldworks-ui-surface-hover)",
  foreground: "var(--foldworks-ui-foreground)",
  foregroundMuted: "var(--foldworks-ui-foreground-muted)",
  foregroundSubtle: "var(--foldworks-ui-foreground-subtle)",
  border: "var(--foldworks-ui-border)",
  borderStrong: "var(--foldworks-ui-border-strong)",
  input: "var(--foldworks-ui-input)",
  primary: "var(--foldworks-ui-primary)",
  primaryHover: "var(--foldworks-ui-primary-hover)",
  primaryForeground: "var(--foldworks-ui-primary-foreground)",
  brand: "var(--foldworks-ui-brand)",
  brandHover: "var(--foldworks-ui-brand-hover)",
  brandSurface: "var(--foldworks-ui-brand-surface)",
  brandBorder: "var(--foldworks-ui-brand-border)",
  brandForeground: "var(--foldworks-ui-brand-foreground)",
  focus: "var(--foldworks-ui-focus)",
  focusGlow: "var(--foldworks-ui-focus-glow)",
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
  radiusSm: "var(--foldworks-ui-radius-sm)",
  radiusMd: "var(--foldworks-ui-radius-md)",
  radiusLg: "var(--foldworks-ui-radius-lg)",
  shadowSm: "var(--foldworks-ui-shadow-sm)",
  shadowControl: "var(--foldworks-ui-shadow-control)",
  shadowInteractive: "var(--foldworks-ui-shadow-interactive)",
  shadowPanel: "var(--foldworks-ui-shadow-panel)",
  shadowFloat: "var(--foldworks-ui-shadow-float)",
  shadowSheet: "var(--foldworks-ui-shadow-sheet)",
  durationFast: "var(--foldworks-ui-duration-fast)",
  durationNormal: "var(--foldworks-ui-duration-normal)",
  durationSlow: "var(--foldworks-ui-duration-slow)",
  easeOut: "var(--foldworks-ui-ease-out)",
  spring: "var(--foldworks-ui-spring)",
  font: "var(--foldworks-ui-font)",
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
  fontFamily: "var(--foldworks-ui-font)",
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
  sm: "var(--foldworks-ui-radius-sm)",
  md: "var(--foldworks-ui-radius-md)",
  lg: "var(--foldworks-ui-radius-lg)",
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
  sm: "var(--foldworks-ui-shadow-sm)",
  control: "var(--foldworks-ui-shadow-control)",
  interactive: "var(--foldworks-ui-shadow-interactive)",
  panel: "var(--foldworks-ui-shadow-panel)",
  float: "var(--foldworks-ui-shadow-float)",
  sheet: "var(--foldworks-ui-shadow-sheet)",
});

export const motion = stylex.defineConsts({
  fast: "var(--foldworks-ui-duration-fast)",
  normal: "var(--foldworks-ui-duration-normal)",
  slow: "var(--foldworks-ui-duration-slow)",
  easeOut: "var(--foldworks-ui-ease-out)",
  spring: "var(--foldworks-ui-spring)",
});
