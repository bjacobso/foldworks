// The source pane shows the outline printed as Lisp. While its text is
// exactly the printed outline, every line starts one item, so offsets map
// between the source and items' text and the outline's analysis can explain
// the source: highlighting, problems, hover, and completion.

import { find, type Items } from "@foldworks/outliner";
import {
  Completion,
  type Diagnostic,
  type SemanticToken,
  type TextRange,
} from "@foldworks/text-intelligence";

import { diagnosticsOf, highlight, type Analysis } from "./analysis";
import { printOutline, type Source } from "./codec";
import { candidatesFor, type Offer } from "./completion";
import { describeAt, type Description } from "./hover";
import { ReadError, read } from "./syntax";

/** Where each line starts, and where the item it begins starts its text on it. */
type Line = Readonly<{
  start: number;
  text: string;
  id: string | null;
  column: number;
  lead: number;
}>;

const linesOf = (items: Items, source: Source): ReadonlyArray<Line> => {
  let start = 0;
  return source.text.split("\n").map((text, index) => {
    const id = source.lines[index] ?? null;
    const own = id === null ? undefined : find(items, id)?.text;
    const trimmed = own?.trim() ?? "";
    const indent = /^\s*/.exec(text)![0].length;
    const found = own === undefined ? -1 : text.indexOf(trimmed, indent);
    const line: Line = {
      start,
      text,
      id: found < 0 ? null : id,
      column: Math.max(found, 0),
      lead: own === undefined ? 0 : own.length - own.trimStart().length,
    };
    start += text.length + 1;
    return line;
  });
};

const lineAt = (lines: ReadonlyArray<Line>, offset: number): Line | undefined =>
  [...lines].reverse().find((line) => line.start <= offset);

/** The printed outline, or `undefined` while the source differs from it. */
export const printedFor = (items: Items, text: string): Source | undefined => {
  const printed = printOutline(items);
  return printed.text === text ? printed : undefined;
};

/** The item and offset in its text for a source offset. */
export const itemAt = (
  items: Items,
  source: Source,
  offset: number,
): Readonly<{ id: string; offset: number }> | undefined => {
  const line = lineAt(linesOf(items, source), offset);
  if (line === undefined || line.id === null) return undefined;
  const local = offset - line.start - line.column;
  const length = (find(items, line.id)?.text.trim() ?? "").length;
  return local < 0 || local > length ? undefined : { id: line.id, offset: local + line.lead };
};

/** The source range of a range of an item's text. */
export const sourceRange = (
  items: Items,
  source: Source,
  id: string,
  range: TextRange,
): TextRange | undefined => {
  const line = linesOf(items, source).find((candidate) => candidate.id === id);
  if (line === undefined) return undefined;
  const at = (offset: number) => line.start + line.column + Math.max(0, offset - line.lead);
  return { from: at(range.from), to: at(range.to) };
};

/** The source line that starts an item, for highlighting it. */
export const lineOf = (items: Items, source: Source, id: string): TextRange | undefined => {
  const line = linesOf(items, source).find((candidate) => candidate.id === id);
  return line === undefined ? undefined : { from: line.start, to: line.start + line.text.length };
};

/** Highlighting for any source text, line by line, from the outline's analysis. */
export const sourceTokens = (text: string, analysis: Analysis): ReadonlyArray<SemanticToken> => {
  const tokens: SemanticToken[] = [];
  let start = 0;
  for (const line of text.split("\n")) {
    let at = start;
    for (const span of highlight(line, analysis)) {
      if (span.kind !== undefined)
        tokens.push({ from: at, to: at + span.text.length, kind: span.kind });
      at += span.text.length;
    }
    start += line.length + 1;
  }
  return tokens;
};

/**
 * Problems in the source: where reading stopped, or, while the source is the
 * printed outline, each item's errors and warnings at their place in it.
 */
export const sourceDiagnostics = (
  items: Items,
  analysis: Analysis,
  text: string,
): ReadonlyArray<Diagnostic> => {
  try {
    read(text);
  } catch (error) {
    if (error instanceof ReadError) {
      const at = Math.max(0, Math.min(error.at, text.length - 1));
      return [
        { from: at, to: Math.min(at + 1, text.length), severity: "error", message: error.message },
      ];
    }
  }
  const printed = printedFor(items, text);
  if (printed === undefined) return [];
  return linesOf(items, printed).flatMap((line) => {
    const node = line.id === null ? undefined : find(items, line.id);
    if (node === undefined) return [];
    return diagnosticsOf(analysis, node).flatMap((diagnostic) => {
      const range = sourceRange(items, printed, node.id, diagnostic);
      return range === undefined ? [] : [{ ...diagnostic, ...range }];
    });
  });
};

/** Suggestions at a source offset; locals are known while the source is the printed outline. */
export const sourceCompletions = (
  items: Items,
  analysis: Analysis,
  text: string,
  caret: number,
  invoked: boolean,
): Offer | undefined => {
  const { from, word } = Completion.wordBefore(text, caret, /[^\s()[\]{}";',]+$/u);
  const to = caret + (/^[^\s()[\]{}";',]*/u.exec(text.slice(caret))?.[0].length ?? 0);
  if (!invoked && word === "") return undefined;
  const printed = printedFor(items, text);
  const at = printed === undefined ? undefined : itemAt(items, printed, from);
  const offered = candidatesFor(items, analysis, word, at?.id, false);
  const list = Completion.open(from, to, offered);
  if (!invoked && Completion.visible(list, text, caret).length === 0) return undefined;
  return { from, to, items: offered };
};

/** What hovering the source at an offset describes, in source coordinates. */
export const sourceHover = (
  items: Items,
  analysis: Analysis,
  text: string,
  offset: number,
  lenient: boolean,
): Description | undefined => {
  const printed = printedFor(items, text);
  const at = printed === undefined ? undefined : itemAt(items, printed, offset);
  if (printed === undefined || at === undefined) return undefined;
  const description = describeAt(items, analysis, at.id, at.offset, lenient);
  const range =
    description === undefined ? undefined : sourceRange(items, printed, at.id, description);
  return description === undefined || range === undefined
    ? undefined
    : { ...description, ...range };
};
