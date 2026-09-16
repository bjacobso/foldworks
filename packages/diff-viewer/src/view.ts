import type { Html, HtmlBuilder } from "foldkit/html";

import { splitRows, type DiffFile, type DiffLine, type DiffSelection, type DiffSide, type DiffThreadMarker, type DiffViewMode } from "./core";

export type ViewConfig<Message> = Readonly<{
  file: DiffFile;
  mode?: DiffViewMode;
  selectedLine?: DiffSelection;
  threads?: readonly DiffThreadMarker[];
  reviewed?: boolean;
  onSelectLine?: (selection: DiffSelection) => Message;
  onReviewedChange?: (reviewed: boolean) => Message;
}>;

const tokenPattern = /(\/\/.*$|\/\*.*?\*\/|`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\b(?:const|let|var|function|return|if|else|for|while|type|interface|export|import|from|async|await|new|class|extends|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|\b[A-Z][A-Za-z0-9_]*\b)/gm;

const highlighted = <Message>(content: string, h: HtmlBuilder<Message>): readonly Html[] => {
  const result: Html[] = [];
  let cursor = 0;
  for (const match of content.matchAll(tokenPattern)) {
    const index = match.index;
    if (index > cursor) result.push(h.span([], [content.slice(cursor, index)]));
    const value = match[0];
    const kind = value.startsWith("//") || value.startsWith("/*") ? "comment"
      : value.startsWith("'") || value.startsWith('"') || value.startsWith("`") ? "string"
      : /^\d/.test(value) ? "number"
      : /^[A-Z]/.test(value) ? "type"
      : "keyword";
    result.push(h.span([h.Class(`fk-diff-viewer__token fk-diff-viewer__token--${kind}`)], [value]));
    cursor = index + value.length;
  }
  if (cursor < content.length) result.push(h.span([], [content.slice(cursor)]));
  return result.length === 0 ? [h.span([], [content || " "])] : result;
};

const markerCount = (markers: readonly DiffThreadMarker[], path: string, side: DiffSide, line: number): number =>
  markers.filter((marker) => marker.path === path && marker.side === side && marker.line === line && marker.resolved !== true)
    .reduce((sum, marker) => sum + marker.count, 0);

const gutter = <Message>(
  config: ViewConfig<Message>,
  side: DiffSide,
  line: number | null,
  h: HtmlBuilder<Message>,
): Html => {
  if (line === null) return h.span([h.Class("fk-diff-viewer__gutter fk-diff-viewer__gutter--empty")], []);
  const selection = { path: config.file.path, side, line } as const;
  const selected = config.selectedLine?.path === selection.path && config.selectedLine.side === side && config.selectedLine.line === line;
  const count = markerCount(config.threads ?? [], config.file.path, side, line);
  return h.button([
    h.Type("button"),
    h.Class("fk-diff-viewer__gutter"),
    h.DataAttribute("selected", selected ? "true" : "false"),
    h.AriaLabel(`${selected ? "Selected" : "Comment on"} ${side === "old" ? "old" : "new"} line ${line}`),
    ...(config.onSelectLine === undefined ? [h.Disabled(true)] : [h.OnClick(config.onSelectLine(selection))]),
  ], [
    h.span([h.Class("fk-diff-viewer__add-comment"), h.AriaHidden(true)], ["+"]),
    h.span([h.Class("fk-diff-viewer__line-number")], [String(line)]),
    ...(count > 0 ? [h.span([h.Class("fk-diff-viewer__thread-count"), h.AriaLabel(`${count} open comments`)], [String(count)])] : []),
  ]);
};

const unifiedLine = <Message>(config: ViewConfig<Message>, line: DiffLine, h: HtmlBuilder<Message>): Html => {
  const side: DiffSide = line.kind === "deletion" ? "old" : "new";
  const number = side === "old" ? line.oldLine : line.newLine;
  return h.div([
    h.Class(`fk-diff-viewer__line fk-diff-viewer__line--${line.kind}`),
    h.DataAttribute("line-kind", line.kind),
  ], [
    gutter(config, "old", line.oldLine, h),
    gutter(config, "new", line.newLine, h),
    h.span([h.Class("fk-diff-viewer__prefix"), h.AriaHidden(true)], [line.kind === "addition" ? "+" : line.kind === "deletion" ? "−" : " "]),
    h.code([h.Class("fk-diff-viewer__code")], highlighted(line.content, h)),
    ...(number === null ? [] : [h.span([h.Class("fk-diff-viewer__sr-only")], [`${side} line ${number}`])]),
  ]);
};

const splitCell = <Message>(config: ViewConfig<Message>, line: DiffLine | undefined, side: DiffSide, h: HtmlBuilder<Message>): Html => {
  if (line === undefined) return h.div([h.Class("fk-diff-viewer__split-cell fk-diff-viewer__split-cell--empty")], [gutter(config, side, null, h)]);
  const number = side === "old" ? line.oldLine : line.newLine;
  return h.div([
    h.Class(`fk-diff-viewer__split-cell fk-diff-viewer__split-cell--${line.kind}`),
  ], [
    gutter(config, side, number, h),
    h.span([h.Class("fk-diff-viewer__prefix"), h.AriaHidden(true)], [line.kind === "addition" ? "+" : line.kind === "deletion" ? "−" : " "]),
    h.code([h.Class("fk-diff-viewer__code")], highlighted(line.content, h)),
  ]);
};

const hiddenLinesBefore = (file: DiffFile, hunkIndex: number): number => {
  const current = file.hunks[hunkIndex];
  if (current === undefined) return 0;
  if (hunkIndex === 0) return Math.max(0, Math.min(current.oldStart, current.newStart) - 1);
  const previous = file.hunks[hunkIndex - 1]!;
  return Math.max(0, Math.min(
    current.oldStart - (previous.oldStart + previous.oldCount),
    current.newStart - (previous.newStart + previous.newCount),
  ));
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const mode = config.mode ?? "Unified";
  const markers = config.threads ?? [];
  return h.section([
    h.Class("fk-diff-viewer"),
    h.DataAttribute("mode", mode.toLowerCase()),
    h.AriaLabel(`Changes in ${config.file.path}`),
  ], [
    h.header([h.Class("fk-diff-viewer__header")], [
      h.div([h.Class("fk-diff-viewer__file")], [
        h.span([h.Class("fk-diff-viewer__status"), h.DataAttribute("status", config.file.status)], [config.file.status === "added" ? "A" : config.file.status === "deleted" ? "D" : config.file.status === "renamed" ? "R" : "M"]),
        h.strong([], [config.file.path.split("/").pop() ?? config.file.path]),
        h.span([h.Class("fk-diff-viewer__path")], [config.file.path.includes("/") ? config.file.path.slice(0, config.file.path.lastIndexOf("/")) : "Repository root"]),
      ]),
      h.div([h.Class("fk-diff-viewer__meta")], [
        h.span([h.Class("fk-diff-viewer__additions")], [`+${config.file.additions}`]),
        h.span([h.Class("fk-diff-viewer__deletions")], [`−${config.file.deletions}`]),
        ...(config.onReviewedChange === undefined ? [] : [h.button([
          h.Type("button"), h.Class("fk-diff-viewer__reviewed"),
          h.DataAttribute("checked", config.reviewed === true ? "true" : "false"),
          h.OnClick(config.onReviewedChange(config.reviewed !== true)),
          h.AriaLabel(`${config.reviewed === true ? "Unmark" : "Mark"} ${config.file.path} as viewed`),
        ], [config.reviewed === true ? "✓ Viewed" : "Mark viewed"])]),
      ]),
    ]),
    ...(config.file.status === "binary"
      ? [h.div([h.Class("fk-diff-viewer__empty")], ["Binary file changed. Preview is not available."])]
      : config.file.hunks.flatMap((hunk, hunkIndex) => {
          const hidden = hiddenLinesBefore(config.file, hunkIndex);
          const gap = hidden > 0 ? [h.div([h.Class("fk-diff-viewer__gap")], [`⋯ ${hidden} unchanged ${hidden === 1 ? "line" : "lines"}`])] : [];
          const header = h.div([h.Class("fk-diff-viewer__hunk-header")], [
            h.code([], [hunk.header.replace(/\s+@@.*$/, " @@")]),
            h.span([], [hunk.label || "Changed block"]),
          ]);
          const content = mode === "Unified"
            ? hunk.lines.map((line) => unifiedLine({ ...config, threads: markers }, line, h))
            : splitRows(hunk).map((row) => h.div([h.Class("fk-diff-viewer__split-row")], [
                splitCell({ ...config, threads: markers }, row.left, "old", h),
                splitCell({ ...config, threads: markers }, row.right, "new", h),
              ]));
          return [...gap, header, ...content];
        })),
  ]);
};
