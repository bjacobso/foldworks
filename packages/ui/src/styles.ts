import * as stylex from "@stylexjs/stylex";

import { colors, metrics } from "./tokens.stylex";

export const buttonStyles = stylex.create({
  base: {
    alignItems: "center",
    borderRadius: metrics.radiusMd,
    borderStyle: "solid",
    borderWidth: "1px",
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: metrics.font,
    fontSize: "13px",
    fontWeight: 650,
    gap: "7px",
    justifyContent: "center",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.focus}` },
    outlineOffset: "2px",
    transitionDuration: metrics.durationFast,
    transitionProperty: "background-color, border-color, color, opacity, transform",
    transitionTimingFunction: "ease-out",
    whiteSpace: "nowrap",
  },
  primary: {
    backgroundColor: { default: colors.primary, ":hover": colors.primaryHover },
    borderColor: colors.primary,
    color: colors.primaryForeground,
  },
  secondary: {
    backgroundColor: { default: colors.surfaceSubtle, ":hover": colors.surfaceHover },
    borderColor: "transparent",
    color: colors.foreground,
  },
  outline: {
    backgroundColor: { default: colors.surface, ":hover": colors.surfaceSubtle },
    borderColor: colors.borderStrong,
    boxShadow: metrics.shadowSm,
    color: colors.foreground,
  },
  ghost: {
    backgroundColor: { default: "transparent", ":hover": colors.surfaceSubtle },
    borderColor: "transparent",
    color: colors.foreground,
  },
  danger: {
    backgroundColor: { default: colors.surface, ":hover": colors.dangerSurface },
    borderColor: colors.dangerBorder,
    color: colors.danger,
  },
  sm: { height: "32px", paddingLeft: "11px", paddingRight: "11px" },
  md: { height: "36px", paddingLeft: "14px", paddingRight: "14px" },
  icon: { height: "32px", padding: 0, width: "32px" },
  fullWidth: { width: "100%" },
  disabled: { cursor: "not-allowed", opacity: 0.45 },
});

export const badgeStyles = stylex.create({
  base: {
    alignItems: "center",
    borderRadius: "999px",
    display: "inline-flex",
    fontSize: "11px",
    fontWeight: 700,
    gap: "6px",
    lineHeight: 1,
    padding: "7px 10px",
    whiteSpace: "nowrap",
  },
  neutral: { backgroundColor: colors.surfaceSubtle, color: colors.foregroundMuted },
  success: { backgroundColor: colors.successSurface, color: colors.success },
  warning: { backgroundColor: colors.warningSurface, color: colors.warning },
  danger: { backgroundColor: colors.dangerSurface, color: colors.danger },
  info: { backgroundColor: colors.infoSurface, color: colors.info },
  dot: { backgroundColor: "currentColor", borderRadius: "999px", height: "6px", width: "6px" },
});

export const layoutStyles = stylex.create({
  stack: { display: "flex", flexDirection: "column" },
  row: { alignItems: "center", display: "flex" },
  gapXs: { gap: "4px" },
  gapSm: { gap: "8px" },
  gapMd: { gap: "12px" },
  gapLg: { gap: "16px" },
  between: { justifyContent: "space-between" },
  start: { alignItems: "flex-start" },
  wrap: { flexWrap: "wrap" },
});

export const toolbarStyles = stylex.create({
  root: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "flex",
    gap: "16px",
    justifyContent: "space-between",
    minHeight: "64px",
    padding: "10px 20px",
  },
  copy: { minWidth: 0 },
  title: {
    color: colors.foreground,
    fontSize: "15px",
    fontWeight: 720,
    letterSpacing: "-0.015em",
    margin: 0,
  },
  description: { color: colors.foregroundMuted, fontSize: "11px", marginBottom: 0, marginTop: "3px" },
  actions: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" },
});

export const segmentedStyles = stylex.create({
  root: { backgroundColor: colors.surfaceSubtle, borderRadius: metrics.radiusMd, display: "inline-flex", padding: "3px" },
  item: {
    backgroundColor: { default: "transparent", ":hover": colors.surfaceHover },
    borderRadius: metrics.radiusSm,
    borderWidth: 0,
    color: colors.foregroundMuted,
    cursor: "pointer",
    fontFamily: metrics.font,
    fontSize: "12px",
    fontWeight: 650,
    height: "28px",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.focus}` },
    paddingLeft: "10px",
    paddingRight: "10px",
  },
  active: { backgroundColor: colors.surface, boxShadow: metrics.shadowSm, color: colors.foreground },
});

export const fieldStyles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { color: colors.foreground, fontSize: "11px", fontWeight: 650 },
  description: { color: colors.foregroundMuted, fontSize: "10px", lineHeight: 1.45, margin: 0 },
  control: {
    backgroundColor: colors.surface,
    borderColor: { default: colors.input, ":focus": colors.foregroundMuted },
    borderRadius: metrics.radiusMd,
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    fontFamily: metrics.font,
    fontSize: "12px",
    minHeight: "36px",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.focus}` },
    outlineOffset: "1px",
    paddingLeft: "10px",
    paddingRight: "10px",
    width: "100%",
  },
  compact: { minHeight: "32px" },
  selectControl: { minHeight: "32px", paddingRight: "28px", width: "auto" },
  textarea: { lineHeight: 1.5, minHeight: "84px", paddingBottom: "9px", paddingTop: "9px", resize: "vertical" },
});

export const panelStyles = stylex.create({
  root: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: metrics.radiusLg,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: metrics.shadowSm,
  },
  header: { borderBottomColor: colors.border, borderBottomStyle: "solid", borderBottomWidth: "1px", padding: "14px 16px" },
  title: { color: colors.foreground, fontSize: "14px", fontWeight: 700, margin: 0 },
  description: { color: colors.foregroundMuted, fontSize: "11px", marginBottom: 0, marginTop: "4px" },
  body: { padding: "16px" },
});
