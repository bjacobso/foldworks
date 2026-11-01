import { expect, it } from "vitest";
import { diffFile, formatUnifiedDiff } from "./file";
import { parseUnifiedDiff } from "./core";
import { contextGaps, expandContext, mapLine, mapRange } from "./anchors";

it("maps both directions across insertions, deletions, hidden context and empty hunks", () => {
  const file = diffFile({
    path: "f",
    oldText: "a\nb\nc\nd\n",
    newText: "start\na\nc\nd\nend\n",
    context: 0,
  });
  expect(mapLine(file, "old", 1)).toEqual({ status: "mapped", line: 2 });
  expect(mapLine(file, "old", 2)).toEqual({ status: "deleted" });
  expect(mapLine(file, "old", 3)).toEqual({ status: "mapped", line: 3 });
  expect(mapLine(file, "new", 1)).toEqual({ status: "deleted" });
  expect(mapLine(file, "new", 5)).toEqual({ status: "deleted" });
  expect(mapLine(file, "old", 5)).toEqual({ status: "unknown" });
  for (const oldText of ["a\nb\nc\n", "a\n", "", "a\nb\nc"])
    for (const newText of ["x\na\nb\nc\n", "b\nc\n", "a\nb\ny\nc\n", ""]) {
      const diff = diffFile({ path: "f", oldText, newText, context: 0 });
      for (let line = 1; line <= oldText.split("\n").length; line++) {
        const mapped = mapLine(diff, "old", line);
        if (mapped.status === "mapped")
          expect(mapLine(diff, "new", mapped.line)).toEqual({ status: "mapped", line });
      }
    }
});
it("maps new-side additions across revisions and rejects changed or noncontiguous ranges", () => {
  const before = diffFile({ path: "f", oldText: "base\n", newText: "base\nadded\nkeep\n" });
  const after = diffFile({
    path: "f",
    oldText: "base\n",
    newText: "prefix\nbase\nadded\nchanged\n",
  });
  expect(mapRange(before, { path: "f", side: "new", startLine: 2, endLine: 2 }, after)).toEqual({
    state: "moved",
    range: { path: "f", side: "new", startLine: 3, endLine: 3 },
  });
  expect(mapRange(before, { path: "f", side: "new", startLine: 3, endLine: 3 }, after).state).toBe(
    "outdated",
  );
  const inserted = diffFile({
    path: "f",
    oldText: "base\n",
    newText: "base\nadded\ninsert\nkeep\n",
  });
  expect(
    mapRange(before, { path: "f", side: "new", startLine: 2, endLine: 3 }, inserted).state,
  ).toBe("outdated");
  const parsed = parseUnifiedDiff(formatUnifiedDiff(before))[0]!;
  expect(mapRange(parsed, { path: "f", side: "new", startLine: 2, endLine: 2 }, after).state).toBe(
    "outdated",
  );
});
it("expands supplied unchanged context, joins hunks and rejects stale source/gap data", () => {
  const source = { oldText: "a\nb\nc\nd\ne\nf\ng\n", newText: "A\nb\nc\nd\ne\nf\nG\n" };
  const file = diffFile({ path: "f", ...source, context: 0 });
  const gap = contextGaps(file)[0]!;
  expect(gap.count).toBe(5);
  const partial = expandContext(file, source, gap, 2);
  expect(partial.hunks[1]!.lines[0]!.oldLine).toBe(5);
  expect(() => expandContext(partial, source, gap, 2)).toThrow("Stale");
  const expanded = expandContext(partial, source, contextGaps(partial)[0]!, 99);
  expect(expanded.hunks).toHaveLength(1);
  expect(expanded.additions).toBe(file.additions);
  expect(() => expandContext(file, { ...source, newText: "mismatch" }, gap, 2)).toThrow();
});
