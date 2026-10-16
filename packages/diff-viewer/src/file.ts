import { languageFromPath, type DiffFile, type DiffHunk, type DiffLine } from "./core";
import { myers } from "./myers";

export type DiffFileOptions = Readonly<{
  path: string;
  oldPath?: string;
  oldText: string;
  newText: string;
  context?: number;
  maxSearchCells?: number;
}>;

/** Split LF/CRLF text without inventing a line after the final newline. */
export const textLines = (text: string): string[] =>
  text.replace(/\r\n/g, "\n").match(/[^\n]*\n|[^\n]+$/g) ?? [];

export const makeHunk = (
  path: string,
  lines: readonly DiffLine[],
  oldStart: number,
  newStart: number,
): DiffHunk => {
  const oldCount = lines.filter((line) => line.kind !== "addition").length;
  const newCount = lines.filter((line) => line.kind !== "deletion").length;
  return {
    id: `${path}:${oldStart}:${newStart}`,
    header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
    label: "",
    oldStart,
    oldCount,
    newStart,
    newCount,
    lines,
  };
};

/** Bounded line-level Myers diff. Empty sources imply added/deleted status. */
export const diffFile = (options: DiffFileOptions): DiffFile => {
  const old = textLines(options.oldText);
  const next = textLines(options.newText);
  let prefix = 0;
  while (prefix < Math.min(old.length, next.length) && old[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < Math.min(old.length, next.length) - prefix &&
    old.at(-1 - suffix) === next.at(-1 - suffix)
  )
    suffix++;
  const budget = options.maxSearchCells ?? 1_000_000;
  const edits = [
    ...old.slice(0, prefix).map((text) => ({ kind: "equal" as const, text })),
    ...myers(
      old.slice(prefix, old.length - suffix),
      next.slice(prefix, next.length - suffix),
      Number.isFinite(budget) ? Math.max(0, budget) : 1_000_000,
    ),
    ...old.slice(old.length - suffix).map((text) => ({ kind: "equal" as const, text })),
  ];
  let oldLine = 1,
    newLine = 1;
  const positions: { old: number; next: number }[] = [];
  const lines: DiffLine[] = edits.map((edit) => {
    positions.push({ old: oldLine, next: newLine });
    return {
      kind: edit.kind === "equal" ? "context" : edit.kind === "removal" ? "deletion" : "addition",
      content: edit.text.replace(/\n$/, ""),
      oldLine: edit.kind === "addition" ? null : oldLine++,
      newLine: edit.kind === "removal" ? null : newLine++,
      ...(!edit.text.endsWith("\n") ? { noNewline: true } : {}),
    };
  });
  const context = Number.isFinite(options.context ?? 3)
    ? Math.max(0, Math.floor(options.context ?? 3))
    : 3;
  const intervals: { start: number; end: number }[] = [];
  lines.forEach((line, index) => {
    if (line.kind === "context") return;
    const start = Math.max(0, index - context),
      end = Math.min(lines.length, index + context + 1);
    const previous = intervals.at(-1);
    if (previous && previous.end >= start) previous.end = end;
    else intervals.push({ start, end });
  });
  const hunks = intervals.map(({ start, end }) => {
    const block = lines.slice(start, end);
    const pos = positions[start]!;
    return makeHunk(
      options.path,
      block,
      pos.old - (block.every((l) => l.oldLine === null) ? 1 : 0),
      pos.next - (block.every((l) => l.newLine === null) ? 1 : 0),
    );
  });
  return {
    path: options.path,
    oldPath: options.oldPath ?? options.path,
    status:
      options.oldPath !== undefined && options.oldPath !== options.path
        ? "renamed"
        : options.oldText === "" && options.newText !== ""
          ? "added"
          : options.newText === "" && options.oldText !== ""
            ? "deleted"
            : "modified",
    language: languageFromPath(options.path),
    additions: lines.filter((l) => l.kind === "addition").length,
    deletions: lines.filter((l) => l.kind === "deletion").length,
    hunks,
  };
};

export const formatUnifiedDiff = (file: DiffFile): string =>
  [
    `diff --git a/${file.oldPath} b/${file.path}`,
    ...(file.status === "added"
      ? ["new file mode 100644"]
      : file.status === "deleted"
        ? ["deleted file mode 100644"]
        : file.status === "renamed"
          ? [`rename from ${file.oldPath}`, `rename to ${file.path}`]
          : []),
    `--- ${file.status === "added" ? "/dev/null" : `a/${file.oldPath}`}`,
    `+++ ${file.status === "deleted" ? "/dev/null" : `b/${file.path}`}`,
    ...file.hunks.flatMap((hunk) => [
      hunk.header,
      ...hunk.lines.flatMap((line) => [
        `${line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " "}${line.content}`,
        ...(line.noNewline ? ["\\ No newline at end of file"] : []),
      ]),
    ]),
  ].join("\n") + "\n";
