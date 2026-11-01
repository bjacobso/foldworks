import * as stylex from "@stylexjs/stylex";

import { colors, motion, radii, space, typography, tooltipMarker } from "./tokens.stylex.js";

const rowHover = `linear-gradient(color-mix(in oklch, ${colors.foreground} 5%, transparent), color-mix(in oklch, ${colors.foreground} 5%, transparent))`;

/** Recipes for keyed tables, interactive items, and stateless tooltips. */
export const denseStyles = stylex.create({
  alignStart: { textAlign: "start" },
  alignCenter: { textAlign: "center" },
  alignEnd: { textAlign: "end" },
  rowHeader: { fontWeight: typography.weightMedium, textAlign: "start" },
  rowInteractive: {
    backgroundImage: { default: "none", ":hover": rowHover, ":focus-within": rowHover },
    cursor: "pointer",
  },
  rowInfo: { backgroundColor: colors.infoSurface },
  rowSuccess: { backgroundColor: colors.successSurface },
  rowWarning: { backgroundColor: colors.warningSurface },
  rowDanger: { backgroundColor: colors.dangerSurface },
  rowSelected: { backgroundColor: colors.selection },
  rowAction: {
    backgroundColor: "transparent",
    border: 0,
    borderRadius: radii.sm,
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    padding: 0,
    textAlign: "inherit",
  },
  itemInteractive: {
    backgroundColor: {
      default: colors.surfaceSubtle,
      ":hover": colors.surfaceHover,
      ":active": colors.surfaceHover,
    },
    color: colors.foreground,
    cursor: "pointer",
    font: "inherit",
    textAlign: "start",
    textDecoration: "none",
    transitionDuration: { default: motion.fast, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionProperty: "background-color, border-color",
    width: "100%",
  },
  itemPressed: { backgroundColor: colors.surfaceHover, borderColor: colors.borderStrong },
  itemSelected: { backgroundColor: colors.selection, borderColor: colors.selectionBorder },
  itemDisabled: { cursor: "not-allowed", opacity: 0.55 },
  itemBlock: { display: "block" },
  itemTrailing: { alignItems: "center", display: "inline-flex", flexShrink: 0, gap: space.sm },
  tooltipRoot: { display: "inline-flex", maxWidth: "100%", position: "relative" },
  tooltipTrigger: {
    alignItems: "center",
    borderRadius: radii.sm,
    display: "inline-flex",
    minWidth: 0,
  },
  tooltipPanel: {
    fontWeight: "normal",
    lineHeight: typography.lineHeightNormal,
    maxWidth: "240px",
    opacity: {
      default: 0,
      [stylex.when.ancestor(":hover", tooltipMarker)]: 1,
      [stylex.when.ancestor(":focus-within", tooltipMarker)]: 1,
    },
    position: "absolute",
    textAlign: "start",
    transitionDelay: {
      default: "0s",
      [stylex.when.ancestor(":hover", tooltipMarker)]: motion.slow,
    },
    transitionDuration: { default: motion.fast, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionProperty: "opacity, visibility",
    visibility: {
      default: "hidden",
      [stylex.when.ancestor(":hover", tooltipMarker)]: "visible",
      [stylex.when.ancestor(":focus-within", tooltipMarker)]: "visible",
    },
    whiteSpace: "pre-line",
    width: "max-content",
    zIndex: 50,
    // Bridges the gap to the trigger so the pointer can move onto the panel.
    "::before": { content: '""', inset: `calc(-1 * ${space.sm})`, position: "absolute" },
  },
  tooltipTop: {
    bottom: "100%",
    left: "50%",
    marginBottom: space.sm,
    transform: "translateX(-50%)",
  },
  tooltipBottom: { left: "50%", marginTop: space.sm, top: "100%", transform: "translateX(-50%)" },
  tooltipStart: {
    insetInlineEnd: "100%",
    marginInlineEnd: space.sm,
    top: "50%",
    transform: "translateY(-50%)",
  },
  tooltipEnd: {
    insetInlineStart: "100%",
    marginInlineStart: space.sm,
    top: "50%",
    transform: "translateY(-50%)",
  },
});
