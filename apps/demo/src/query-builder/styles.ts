import * as stylex from "@stylexjs/stylex";

import {
  colors,
  radii,
  space,
  typography,
} from "@foldworks/ui/tokens.stylex";

export const styles = stylex.create({
  viewport: {
    backgroundColor: colors.canvas,
    minHeight: 0,
    overflowY: "auto",
    padding: {
      default: space.xl,
      "@media (max-width: 820px)": space.lg,
    },
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "1120px",
  },
  intro: {
    color: colors.foregroundMuted,
    fontSize: typography.sizeMd,
    lineHeight: typography.lineHeightNormal,
    margin: 0,
    maxWidth: "760px",
  },
  preview: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: "solid",
    borderWidth: "1px",
    padding: space.md,
  },
  previewLabel: {
    color: colors.foregroundSubtle,
    fontSize: typography.sizeXs,
    fontWeight: typography.weightBold,
    letterSpacing: "0.08em",
    marginBottom: space.sm,
    marginTop: 0,
    textTransform: "uppercase",
  },
  split: {
    alignItems: "start",
    display: "grid",
    gap: space.lg,
    gridTemplateColumns: {
      default: "minmax(0, 1.45fr) minmax(280px, 0.55fr)",
      "@media (max-width: 980px)": "1fr",
    },
  },
  code: {
    color: colors.foregroundMuted,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: typography.sizeXs,
    lineHeight: 1.55,
    margin: 0,
    maxHeight: "420px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },
});
