import * as stylex from "@stylexjs/stylex";
import { colors, radii, typography } from "./tokens.stylex.js";

export const citationStyles = stylex.create({
  marker: {
    appearance: "none",
    backgroundColor: colors.infoSurface,
    borderWidth: 0,
    borderRadius: radii.sm,
    color: colors.info,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: typography.fontFamily,
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.5,
    paddingBlock: "0px",
    paddingInline: "4px",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.focus}` },
    outlineOffset: "2px",
  },
  superscript: { verticalAlign: "super", fontSize: "10px", marginInline: "2px" },
  chip: { verticalAlign: "baseline", paddingBlock: "1px", paddingInline: "6px" },
});
