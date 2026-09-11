import * as stylex from "@stylexjs/stylex";

export const className = (...values: ReadonlyArray<stylex.StyleXStyles>) =>
  stylex.props(...values).className ?? "";

export const styles = stylex.create({
  markdown: { display: "flex", flexDirection: "column", gap: "8px" },
  paragraph: { margin: 0 },
  heading: { fontSize: "15px", margin: "6px 0 0" },
  list: { display: "grid", gap: "4px", margin: 0, paddingLeft: "20px" },
  listItem: { paddingLeft: "2px" },
  code: { backgroundColor: "var(--secondary)", borderRadius: "4px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.92em", padding: "1px 4px" },
  pre: { backgroundColor: "var(--secondary)", borderColor: "var(--border)", borderRadius: "8px", borderStyle: "solid", borderWidth: "1px", margin: 0, overflowX: "auto", padding: "10px 12px" },
  permissionDetail: { color: "var(--muted-foreground)", fontSize: "12px", lineHeight: 1.5, margin: 0 },
});
