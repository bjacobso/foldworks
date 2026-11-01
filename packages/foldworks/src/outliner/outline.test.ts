import { describe, expect, it } from "vitest";

import {
  dropTarget,
  indent,
  item,
  mergeIntoPrevious,
  mergeNext,
  moveDown,
  moveItems,
  moveUp,
  outdent,
  setCollapsed,
  split,
  visibleRows,
  type Items,
} from "./outline";

/** Renders an outline as indented ids, with `+` marking collapsed items. */
const shape = (items: Items | undefined, depth = 0): string =>
  (items ?? [])
    .map(
      (node) =>
        `${"  ".repeat(depth)}${node.id}${node.collapsed ? "+" : ""}${node.text === node.id || node.text === "" ? "" : `:${node.text}`}\n${shape(node.children, depth + 1)}`,
    )
    .join("");

const n = (id: string, children: Items = [], collapsed = false) =>
  item(id, id, children, { collapsed });

const sample: Items = [n("a", [n("a1"), n("a2"), n("a3")]), n("b", [n("b1")]), n("c")];

describe("visibleRows", () => {
  it("lists rows in order with depth and skips collapsed children", () => {
    const rows = visibleRows(setCollapsed(sample, "b", true));
    expect(rows.map((row) => `${row.id}@${row.depth}`)).toEqual([
      "a@0",
      "a1@1",
      "a2@1",
      "a3@1",
      "b@0",
      "c@0",
    ]);
    expect(rows.find((row) => row.id === "b")).toMatchObject({
      hasChildren: true,
      collapsed: true,
    });
  });

  it("starts below a hoisted item", () => {
    expect(visibleRows(sample, "a").map((row) => `${row.id}@${row.depth}`)).toEqual([
      "a1@0",
      "a2@0",
      "a3@0",
    ]);
  });
});

describe("indent and outdent", () => {
  it("indents under the previous sibling and expands it", () => {
    const collapsed = setCollapsed(sample, "a", true);
    expect(shape(indent(collapsed, ["b"]))).toBe("a\n  a1\n  a2\n  a3\n  b\n    b1\nc\n");
  });

  it("cannot indent a first child", () => {
    expect(indent(sample, ["a1"])).toBeUndefined();
  });

  it("indents a run of siblings together, keeping them siblings", () => {
    expect(shape(indent(sample, ["a2", "a3"]))).toBe("a\n  a1\n    a2\n    a3\nb\n  b1\nc\n");
  });

  it("holds a selection in place when its first item cannot indent", () => {
    expect(indent(sample, ["a1", "a2"])).toBeUndefined();
  });

  it("outdents in place, adopting the following siblings", () => {
    expect(shape(outdent(sample, ["a2"]))).toBe("a\n  a1\na2\n  a3\nb\n  b1\nc\n");
  });

  it("outdents a run of siblings in order", () => {
    expect(shape(outdent(sample, ["a1", "a2"]))).toBe("a\na1\na2\n  a3\nb\n  b1\nc\n");
  });

  it("does not outdent past the hoisted scope", () => {
    expect(outdent(sample, ["a1"], "a")).toBeUndefined();
  });
});

describe("moveUp and moveDown", () => {
  it("swaps with a sibling", () => {
    expect(shape(moveUp(sample, ["a2"]))).toBe("a\n  a2\n  a1\n  a3\nb\n  b1\nc\n");
    expect(shape(moveDown(sample, ["b"]))).toBe("a\n  a1\n  a2\n  a3\nc\nb\n  b1\n");
  });

  it("moves a first child into the end of the parent's previous sibling", () => {
    expect(shape(moveUp(sample, ["b1"]))).toBe("a\n  a1\n  a2\n  a3\n  b1\nb\nc\n");
  });

  it("moves a last child into the start of the parent's next sibling", () => {
    expect(shape(moveDown(sample, ["a3"]))).toBe("a\n  a1\n  a2\nb\n  a3\n  b1\nc\n");
  });

  it("moves out above the parent when there is nowhere to nest", () => {
    expect(shape(moveUp(sample, ["a1"]))).toBe("a1\na\n  a2\n  a3\nb\n  b1\nc\n");
  });

  it("moves a run of siblings", () => {
    expect(shape(moveDown(sample, ["a1", "a2"]))).toBe("a\n  a3\n  a1\n  a2\nb\n  b1\nc\n");
  });

  it("stays inside a hoisted scope", () => {
    expect(moveUp(sample, ["a1"], "a")).toBeUndefined();
  });
});

describe("split", () => {
  it("moves text after the caret to a new sibling", () => {
    const result = split([item("x", "hello world")], "x", 5, 6, "y");
    expect(result?.items.map((node) => node.text)).toEqual(["hello", "world"]);
    expect(result).toMatchObject({ focusId: "y", offset: 0 });
  });

  it("puts the new item first under an expanded parent", () => {
    expect(shape(split(sample, "a", 1, 1, "new")?.items)).toBe(
      "a\n  new\n  a1\n  a2\n  a3\nb\n  b1\nc\n",
    );
  });

  it("opens an empty item above when splitting at the start", () => {
    const result = split(sample, "b", 0, 0, "new");
    expect(shape(result?.items)).toBe("a\n  a1\n  a2\n  a3\nnew\nb\n  b1\nc\n");
    expect(result?.focusId).toBe("b");
  });
});

describe("merging", () => {
  it("joins onto the previous row and keeps the caret at the seam", () => {
    const result = mergeIntoPrevious([item("x", "foo"), item("y", "bar")], "y");
    expect(result?.items.map((node) => node.text)).toEqual(["foobar"]);
    expect(result).toMatchObject({ focusId: "x", offset: 3 });
  });

  it("gives children to the previous row when it has none showing", () => {
    const items = [n("a"), n("b", [n("b1")])];
    expect(shape(mergeIntoPrevious(items, "b")?.items)).toBe("a:ab\n  b1\n");
  });

  it("keeps children in place when merging into the parent", () => {
    const items = [n("a", [n("a1", [n("x")]), n("a2")])];
    expect(shape(mergeIntoPrevious(items, "a1")?.items)).toBe("a:aa1\n  x\n  a2\n");
  });

  it("merges the next row with Delete", () => {
    expect(mergeNext([item("x", "foo"), item("y", "bar")], "x")?.items[0]?.text).toBe("foobar");
  });
});

describe("drag and drop", () => {
  const rows = visibleRows(sample);

  it("clamps depth so a drop never adopts the row below", () => {
    // Between a3 (depth 1) and b (depth 0): depth 0..2.
    expect(dropTarget(rows, ["c"], 4, 5)).toMatchObject({
      placement: { _tag: "Start", parentId: "a3" },
      depth: 2,
    });
    expect(dropTarget(rows, ["c"], 4, 1)).toMatchObject({
      placement: { _tag: "After", siblingId: "a3" },
      depth: 1,
    });
    expect(dropTarget(rows, ["c"], 4, -3)).toMatchObject({
      placement: { _tag: "After", siblingId: "a" },
      depth: 0,
    });
  });

  it("drops above the first row", () => {
    expect(dropTarget(rows, ["c"], 0, 3)).toMatchObject({
      placement: { _tag: "Start", parentId: null },
      afterRowId: null,
    });
  });

  it("skips the dragged rows and their children", () => {
    // Without a and its children, the first gap after b is index 1.
    expect(dropTarget(rows, ["a"], 1, 0)).toMatchObject({
      placement: { _tag: "Start", parentId: "b" },
      depth: 1,
    });
  });

  it("appends into a collapsed row", () => {
    const folded = visibleRows(setCollapsed(sample, "b", true));
    expect(dropTarget(folded, ["c"], 5, 1)).toMatchObject({
      placement: { _tag: "End", parentId: "b" },
    });
  });

  it("moves items to a placement and refuses moves into themselves", () => {
    expect(shape(moveItems(sample, ["c"], { _tag: "Start", parentId: "b" }))).toBe(
      "a\n  a1\n  a2\n  a3\nb\n  c\n  b1\n",
    );
    expect(moveItems(sample, ["a"], { _tag: "End", parentId: "a2" })).toBeUndefined();
    expect(moveItems(sample, ["a2"], { _tag: "After", siblingId: "a1" })).toBeUndefined();
  });
});
