import * as stylex from "@stylexjs/stylex";
import { colors, motion, space } from "./tokens.stylex.js";

export const statefulStyles = stylex.create({
  verticalTabs: { alignItems: "stretch", flexDirection: "column" },
  disabled: { cursor: "not-allowed", opacity: 0.5 },
  dialogLayout: {
    alignItems: "center", display: "flex", inset: 0, justifyContent: "center",
    padding: space.lg, position: "fixed", pointerEvents: "none",
  },
  backdrop: { backgroundColor: colors.overlay, inset: 0, position: "fixed" },
  panel: {
    backgroundColor: colors.popover, color: colors.popoverForeground,
    maxHeight: "calc(100dvh - 32px)", overflowY: "auto", pointerEvents: "auto",
  },
  transition: {
    opacity: { default: 1, ':is([data-closed])': 0 },
    transitionProperty: "opacity",
    transitionDuration: { default: motion.fast, "@media (prefers-reduced-motion: reduce)": "0s" },
  },
  selectRoot: { display: "inline-block", position: "relative" },
  selectButton: {
    alignItems: "center", display: "flex", gap: space.sm, justifyContent: "space-between",
    opacity: { default: 1, ':is([data-disabled])': 0.5 },
  },
  selectContent: {
    backgroundColor: colors.popover, color: colors.popoverForeground,
    maxHeight: "min(320px, var(--available-height, 320px))", overflowY: "auto",
    minWidth: "var(--button-width, 180px)", zIndex: 50,
  },
  selectItem: { color: "inherit", cursor: "default" },
  activeItem: { backgroundColor: colors.surfaceHover, color: colors.accentForeground },
  selectedItem: { fontWeight: 650 },
  selectBackdrop: { inset: 0, position: "fixed" },
});
