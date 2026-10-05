import { Option } from "effect";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import {
  TreeDiff,
  changedRegion,
  diffTrees,
  type TreeDiffNode,
  type TreeDiffRow,
} from "./tree-diff";

const node = (
  id: string,
  label = id,
  children: ReadonlyArray<TreeDiffNode> = [],
): TreeDiffNode => ({ id, label, children });
const show = (rows: ReadonlyArray<TreeDiffRow>) =>
  rows.map((row) =>
    row._tag === "Elided"
      ? `${"  ".repeat(row.depth)}… ${row.count}`
      : `${"  ".repeat(row.depth)}${{ Unchanged: " ", Added: "+", Removed: "-", Moved: ">", Edited: "~" }[row.status]}${row.label}${row.was === undefined ? "" : ` (was ${row.was})`}`,
  );

const flow = [node("w", "workflow", [node("a"), node("b"), node("c"), node("d"), node("e")])];

describe("diffTrees", () => {
  it("reports additions, removals in place, edits, and reparenting", () => {
    const after = [
      node("w", "workflow", [
        node("p", "parallel", [node("a"), node("b")]),
        node("c", "C!"),
        node("e"),
      ]),
    ];
    expect(show(diffTrees(flow, after))).toEqual([
      " workflow",
      "  +parallel",
      "    >a",
      "    >b",
      "  ~C! (was c)",
      "  -d",
      "   e",
    ]);
  });

  it("reports the fewest moves for a reordering", () => {
    const after = [node("w", "workflow", [node("a"), node("d"), node("b"), node("c"), node("e")])];
    expect(show(diffTrees(flow, after))).toEqual([
      " workflow",
      "   a",
      "  >d",
      "   b",
      "   c",
      "   e",
    ]);
  });

  it("keeps descendants that survive a removed parent where they now are", () => {
    const before = [node("s", "section", [node("x", "x", [node("y"), node("z")])])];
    const after = [node("s", "section", [node("y")])];
    // The removed parent stays where it was; its surviving child is shown where it is now.
    expect(show(diffTrees(before, after))).toEqual([" section", "  -x", "    -z", "  >y"]);
  });
});

describe("changedRegion", () => {
  it("roots the region at the deepest node holding every change, with context", () => {
    const before = [
      node("top"),
      node("w", "workflow", [node("a"), node("b"), node("c"), node("d"), node("e"), node("f")]),
      node("end"),
    ];
    const after = [
      node("top"),
      node("w", "workflow", [
        node("a"),
        node("b", "B!"),
        node("c"),
        node("d"),
        node("e"),
        node("f"),
      ]),
      node("end"),
    ];
    expect(show(changedRegion(diffTrees(before, after)))).toEqual([
      " workflow",
      "   a",
      "  ~B! (was b)",
      "   c",
      "  … 3",
    ]);
    expect(changedRegion(diffTrees(before, before))).toEqual([]);
  });

  it("shows a lone unchanged sibling instead of folding it, and spans the forest when it must", () => {
    const before = [node("a"), node("b"), node("c")];
    const after = [node("a", "A!"), node("b"), node("c", "C!")];
    expect(show(changedRegion(diffTrees(before, after), 0))).toEqual([
      "~A! (was a)",
      " b",
      "~C! (was c)",
    ]);
  });
});

describe("TreeDiff view", () => {
  it("renders marked rows with their status for screen readers and a summary", () => {
    const after = [
      node("w", "workflow", [
        node("a"),
        node("b"),
        node("c"),
        node("d"),
        node("e"),
        node("n", "new"),
      ]),
    ];
    const html = TreeDiff.view(
      { label: "Proposed change", before: flow, after },
      inertHtml as unknown as HtmlBuilder<never>,
    );
    if (html === null) throw new Error("Expected diff HTML");
    expect(Scene.textContent(Option.getOrThrow(Scene.find(html, "p")))).toBe("1 added");
    expect(Scene.findAll(html, "li").map((row) => Scene.textContent(row))).toEqual([
      "workflow",
      "⋯ 4 unchanged",
      "e",
      "+new (added)",
    ]);
  });
});
