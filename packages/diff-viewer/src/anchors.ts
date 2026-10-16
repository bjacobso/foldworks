import { normalizeSelection, type DiffFile, type DiffSelectionRange, type DiffSide } from "./core";
import { diffFile, makeHunk, textLines } from "./file";

export type LineMapping =
  | Readonly<{ status: "mapped"; line: number }>
  | Readonly<{ status: "deleted" | "unknown" }>;
/** Exact monotone mapping; replaced lines are deleted, never guessed. */
export const mapLine = (file: DiffFile, side: DiffSide, line: number): LineMapping => {
  if (!Number.isInteger(line) || line < 1 || file.status === "binary") return { status: "unknown" };
  if (
    file.source &&
    line > textLines(side === "old" ? file.source.oldText : file.source.newText).length
  )
    return { status: "unknown" };
  let delta = 0;
  for (const hunk of file.hunks) {
    const start = side === "old" ? hunk.oldStart : hunk.newStart;
    const count = side === "old" ? hunk.oldCount : hunk.newCount;
    if (line < start || (count === 0 && line <= start))
      return { status: "mapped", line: line + delta };
    for (const row of hunk.lines) {
      if ((side === "old" ? row.oldLine : row.newLine) !== line) continue;
      const target = side === "old" ? row.newLine : row.oldLine;
      return target === null ? { status: "deleted" } : { status: "mapped", line: target };
    }
    delta =
      side === "old"
        ? hunk.newStart + hunk.newCount - (hunk.oldStart + hunk.oldCount)
        : hunk.oldStart + hunk.oldCount - (hunk.newStart + hunk.newCount);
    // Zero-count hunk coordinates address the preceding line.
    if (hunk.oldCount === 0) delta += side === "old" ? -1 : 1;
    if (hunk.newCount === 0) delta += side === "old" ? 1 : -1;
  }
  return { status: "mapped", line: line + delta };
};
export type RangeMapping =
  | Readonly<{ state: "current" | "moved"; range: DiffSelectionRange }>
  | Readonly<{ state: "outdated"; reason: "deleted" | "unknown" }>;
/** Maps a revision anchor onto the new side of a later revision. */
export const mapRange = (
  fromFile: DiffFile,
  range: DiffSelectionRange,
  toFile: DiffFile,
): RangeMapping => {
  const normalized = normalizeSelection(range);
  if (
    range.path !== fromFile.path ||
    (fromFile.path !== toFile.path &&
      fromFile.path !== toFile.oldPath &&
      fromFile.oldPath !== toFile.oldPath) ||
    !Number.isInteger(normalized.startLine) ||
    !Number.isInteger(normalized.endLine)
  )
    return { state: "outdated", reason: "unknown" };
  const revisionDiff =
    fromFile.source && toFile.source
      ? diffFile({
          path: toFile.path,
          oldText: range.side === "old" ? fromFile.source.oldText : fromFile.source.newText,
          newText: toFile.source.newText,
          context: 0,
        })
      : undefined;
  let start: number | undefined, previous: number | undefined;
  for (let line = normalized.startLine; line <= normalized.endLine; line++) {
    const base =
      range.side === "old" ? { status: "mapped" as const, line } : mapLine(fromFile, "new", line);
    const mapped = revisionDiff
      ? mapLine(revisionDiff, "old", line)
      : base.status === "mapped" && fromFile.oldPath === toFile.oldPath
        ? mapLine(toFile, "old", base.line)
        : { status: "unknown" as const };
    if (mapped.status !== "mapped") return { state: "outdated", reason: mapped.status };
    if (previous !== undefined && mapped.line !== previous + 1)
      return { state: "outdated", reason: "deleted" };
    start ??= mapped.line;
    previous = mapped.line;
  }
  if (start === undefined || previous === undefined)
    return { state: "outdated", reason: "unknown" };
  const mapped = { path: toFile.path, side: "new" as const, startLine: start, endLine: previous };
  return {
    state:
      range.path === mapped.path &&
      range.side === "new" &&
      normalized.startLine === start &&
      normalized.endLine === previous
        ? "current"
        : "moved",
    range: mapped,
  };
};

export type DiffGap = Readonly<{
  path: string;
  beforeHunkId: string;
  oldStart: number;
  newStart: number;
  count: number;
}>;
export const contextGaps = (file: DiffFile): readonly DiffGap[] =>
  file.hunks.flatMap((hunk, index) => {
    const previous = file.hunks[index - 1];
    const oldStart = previous ? previous.oldStart + previous.oldCount : 1;
    const newStart = previous ? previous.newStart + previous.newCount : 1;
    const count = Math.min(hunk.oldStart - oldStart, hunk.newStart - newStart);
    return count > 0 ? [{ path: file.path, beforeHunkId: hunk.id, oldStart, newStart, count }] : [];
  });
/** Expands from the end of a gap toward the preceding hunk; rejects stale inputs. */
export const expandContext = (
  file: DiffFile,
  source: Readonly<{ oldText: string; newText: string }>,
  gap: DiffGap,
  lines: number,
): DiffFile => {
  const actual = contextGaps(file).find((g) => g.beforeHunkId === gap.beforeHunkId);
  if (
    !actual ||
    Object.keys(actual).some((key) => actual[key as keyof DiffGap] !== gap[key as keyof DiffGap])
  )
    throw new RangeError("Stale context gap");
  if (!Number.isInteger(lines) || lines < 1)
    throw new RangeError("Expansion must be a positive line count");
  const old = textLines(source.oldText),
    next = textLines(source.newText);
  for (const hunk of file.hunks)
    for (const row of hunk.lines) {
      const check = (text: string | undefined) =>
        text !== undefined &&
        text.replace(/\n$/, "") === row.content &&
        !text.endsWith("\n") === !!row.noNewline;
      if (
        (row.oldLine !== null && !check(old[row.oldLine - 1])) ||
        (row.newLine !== null && !check(next[row.newLine - 1]))
      )
        throw new RangeError("Source does not match diff");
    }
  const take = Math.min(lines, gap.count);
  const oldStart = gap.oldStart + gap.count - take,
    newStart = gap.newStart + gap.count - take;
  const context = Array.from({ length: take }, (_, index) => {
    const text = old[oldStart + index - 1];
    if (text === undefined || text !== next[newStart + index - 1])
      throw new RangeError("Gap is not unchanged context");
    return {
      kind: "context" as const,
      content: text.replace(/\n$/, ""),
      oldLine: oldStart + index,
      newLine: newStart + index,
      ...(!text.endsWith("\n") ? { noNewline: true } : {}),
    };
  });
  const index = file.hunks.findIndex((h) => h.id === gap.beforeHunkId);
  const hunk = file.hunks[index]!;
  const expanded = makeHunk(file.path, [...context, ...hunk.lines], oldStart, newStart);
  const previous = file.hunks[index - 1];
  const joined =
    take === gap.count && previous
      ? [
          makeHunk(
            file.path,
            [...previous.lines, ...expanded.lines],
            previous.oldStart,
            previous.newStart,
          ),
        ]
      : [expanded];
  return {
    ...file,
    hunks: [
      ...file.hunks.slice(
        0,
        index - (joined.length === 1 && take === gap.count && previous ? 1 : 0),
      ),
      ...joined,
      ...file.hunks.slice(index + 1),
    ],
  };
};
