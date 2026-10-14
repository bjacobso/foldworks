import * as stylex from "@stylexjs/stylex";
import { colors, space, radii } from "@foldworks/ui/tokens.stylex";
export const styles = stylex.create({
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: space.lg,
    height: "100%",
    minHeight: 0,
    padding: space.lg,
    "@media (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)", overflowY: "auto" },
  },
  pdf: {
    minHeight: 0,
    overflow: "hidden",
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    "@media (max-width: 900px)": { height: "500px" },
  },
  panel: { minWidth: 0, minHeight: 0, overflowY: "auto", padding: space.sm },
  section: { marginBottom: space.xl },
  controls: { display: "flex", flexWrap: "wrap", gap: space.sm, marginBlock: space.md },
  hint: { color: colors.foregroundMuted, fontSize: "12px" },
});
