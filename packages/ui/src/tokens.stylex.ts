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
  primary: "var(--foldworks-ui-primary)",
  primaryForeground: "var(--foldworks-ui-primary-foreground)",
  focus: "var(--foldworks-ui-focus)",
  success: "var(--foldworks-ui-success)",
  successSurface: "var(--foldworks-ui-success-surface)",
  warning: "var(--foldworks-ui-warning)",
  warningSurface: "var(--foldworks-ui-warning-surface)",
  danger: "var(--foldworks-ui-danger)",
  dangerSurface: "var(--foldworks-ui-danger-surface)",
  info: "var(--foldworks-ui-info)",
  infoSurface: "var(--foldworks-ui-info-surface)",
});

export const metrics = stylex.defineConsts({
  radiusSm: "var(--foldworks-ui-radius-sm)",
  radiusMd: "var(--foldworks-ui-radius-md)",
  radiusLg: "var(--foldworks-ui-radius-lg)",
  shadowSm: "var(--foldworks-ui-shadow-sm)",
  shadowPanel: "var(--foldworks-ui-shadow-panel)",
  durationFast: "var(--foldworks-ui-duration-fast)",
  durationNormal: "var(--foldworks-ui-duration-normal)",
  easeOut: "var(--foldworks-ui-ease-out)",
  font: "var(--foldworks-ui-font)",
});
