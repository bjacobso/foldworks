import { expect, it } from "vitest";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { diffFile, formatUnifiedDiff } from "./file";
import { parseUnifiedDiff } from "./core";
import { view } from "./view";

it("round trips line counts, blank lines, renames and missing final newlines", () => {
  for (const oldText of ["", "a\n", "a\n\nb", "last"])
    for (const newText of ["", "a\nb\n", "a\n\nc", "last\n"]) {
      const file = diffFile({ path: "config.json", oldText, newText });
      const parsed = parseUnifiedDiff(formatUnifiedDiff(file))[0]!;
      expect(parsed).toMatchObject({
        path: file.path,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      });
      expect(parsed.hunks.map((h) => h.lines)).toEqual(file.hunks.map((h) => h.lines));
    }
  expect(diffFile({ path: "new", oldPath: "old", oldText: "a", newText: "a" }).status).toBe(
    "renamed",
  );
});
it("merges nearby changes and bounds replacement searches", () => {
  const file = diffFile({
    path: "x",
    oldText: "a\nb\nc\nd\ne\n",
    newText: "a\nB\nc\nD\ne\n",
    context: 0,
  });
  expect(file.hunks).toHaveLength(2);
  expect(
    diffFile({ path: "x", oldText: "a\nb\n", newText: "c\nd\n", maxSearchCells: 0 }).additions,
  ).toBe(2);
});
it("renders full row slots, accessible annotations, custom tokens and semantic intraline edits in both modes", () => {
  const file = diffFile({
    path: "x.ts",
    oldText: "const a = false;\n",
    newText: "const a = true;\n",
  });
  const h = inertHtml as unknown as HtmlBuilder<string>;
  for (const mode of ["Unified", "Split"] as const) {
    const html = view(
      {
        file,
        mode,
        onSelectLine: () => "select",
        lineWidgets: (ref) => (ref.side === "new" ? h.p([], ["Thread"]) : undefined),
        annotations: [
          {
            path: "x.ts",
            side: "new",
            startLine: 1,
            endLine: 1,
            tone: "danger",
            label: "Invalid flag",
          },
        ],
        highlight: () => [{ from: 0, to: 5, kind: "keyword" }],
      },
      h,
    )!;
    expect(Scene.findAll(html, "ins")).toHaveLength(1);
    expect(Scene.findAll(html, "del")).toHaveLength(1);
    expect(Scene.findAll(html, ".fk-diff-viewer__widget")).toHaveLength(1);
    expect(Scene.findAll(html, '[data-annotation-tone="danger"]')).toHaveLength(1);
  }
});
