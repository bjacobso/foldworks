import type { Selection, TextEdit } from "../document";
import { applyEdits, validOffset, validSelection } from "../document";
import { keywords } from "./tokenize";

export type EditPlan = Readonly<{ edits: readonly TextEdit[]; selection: Selection }>;
export type EditingAction = "indent" | "outdent" | "newline" | "comment" | "duplicate" | "deleteLine";
const bounds = (selection: Selection) => ({ from: Math.min(selection.anchor, selection.head), to: Math.max(selection.anchor, selection.head) });
const collapsed = (offset: number): Selection => ({ anchor: offset, head: offset });

/** A browser input snapshot becomes one minimal replacement; offsets never cut a surrogate pair. */
export const difference = (before: string, after: string): readonly TextEdit[] => {
  if (before === after) return [];
  let from = 0, beforeEnd = before.length, afterEnd = after.length;
  while (from < Math.min(beforeEnd, afterEnd) && before[from] === after[from]) from++;
  while (!validOffset(before, from) || !validOffset(after, from)) from--;
  while (beforeEnd > from && afterEnd > from && before[beforeEnd - 1] === after[afterEnd - 1]) { beforeEnd--; afterEnd--; }
  while (!validOffset(before, beforeEnd) || !validOffset(after, afterEnd)) { beforeEnd++; afterEnd++; }
  return [{ from, to: beforeEnd, insert: after.slice(from, afterEnd) }];
};

export const invert = (text: string, edits: readonly TextEdit[]): readonly TextEdit[] => {
  applyEdits(text, edits);
  let shift = 0;
  return edits.map((edit) => {
    const inverse = { from: edit.from + shift, to: edit.from + shift + edit.insert.length, insert: text.slice(edit.from, edit.to) };
    shift += edit.insert.length - (edit.to - edit.from);
    return inverse;
  });
};

export const mapOffset = (offset: number, edits: readonly TextEdit[], association = 1): number => {
  let shift = 0;
  for (const edit of edits) {
    if (offset < edit.from || (offset === edit.from && association < 0)) break;
    if (offset <= edit.to) return edit.from + shift + (association < 0 ? 0 : edit.insert.length);
    shift += edit.insert.length - (edit.to - edit.from);
  }
  return offset + shift;
};
export const mapSelection = (selection: Selection, edits: readonly TextEdit[]): Selection => ({
  anchor: mapOffset(selection.anchor, edits), head: mapOffset(selection.head, edits),
});

const replace = (selection: Selection, insert: string, caret?: number): EditPlan => {
  const { from, to } = bounds(selection);
  return { edits: [{ from, to, insert }], selection: collapsed(caret ?? from + insert.length) };
};

export const editingPlan = (text: string, selection: Selection, action: EditingAction, tabSize = 2): EditPlan => {
  if (!validSelection(text, selection)) throw new Error("Invalid selection.");
  const { from, to } = bounds(selection);
  const start = from === 0 ? 0 : text.lastIndexOf("\n", from - 1) + 1;
  const last = to > from && text[to - 1] === "\n" ? to - 1 : to;
  const endAt = text.indexOf("\n", last);
  const end = endAt < 0 ? text.length : endAt;
  const lines = text.slice(start, end).split("\n");
  const unit = " ".repeat(tabSize);
  if (action === "newline") {
    const indent = /^\s*/.exec(text.slice(start, from))![0];
    const opener = /[{[(]$/.test(text.slice(0, from));
    const inner = indent + (opener ? unit : "");
    const closing = opener && /[}\])]/.test(text[to] ?? "");
    return replace(selection, `\n${inner}${closing ? `\n${indent}` : ""}`, from + inner.length + 1);
  }
  if (action === "duplicate") {
    if (from !== to) return { edits: [{ from: to, to, insert: text.slice(from, to) }], selection: { anchor: to, head: to + to - from } };
    const insert = `\n${text.slice(start, end)}`;
    return { edits: [{ from: end, to: end, insert }], selection: collapsed(selection.head + insert.length) };
  }
  if (action === "deleteLine") {
    const first = end === text.length && start > 0 ? start - 1 : start;
    const last = end < text.length ? end + 1 : end;
    return { edits: [{ from: first, to: last, insert: "" }], selection: collapsed(Math.min(first, text.length - (last - first))) };
  }
  const uncomment = lines.every((line) => !line.trim() || /^\s*\/\//.test(line));
  let at = start;
  const edits: TextEdit[] = [];
  for (const line of lines) {
    if (action === "indent") edits.push({ from: at, to: at, insert: unit });
    else if (action === "outdent") {
      const count = line.startsWith("\t") ? 1 : Math.min(tabSize, /^ */.exec(line)![0].length);
      if (count) edits.push({ from: at, to: at + count, insert: "" });
    } else if (line.trim()) {
      const whitespace = /^\s*/.exec(line)![0].length;
      const position = at + whitespace;
      edits.push(uncomment ? { from: position, to: position + (line.slice(whitespace).startsWith("// ") ? 3 : 2), insert: "" } : { from: position, to: position, insert: "// " });
    }
    at += line.length + 1;
  }
  return { edits, selection: mapSelection(selection, edits) };
};

export const pairPlan = (text: string, selection: Selection, character: string): EditPlan | undefined => {
  const { from, to } = bounds(selection);
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
  if (from === to && ")]}'\"`".includes(character) && text[from] === character) return { edits: [], selection: collapsed(from + 1) };
  const closing = pairs[character];
  if (!closing || (from === to && /[\p{L}\p{N}_$]/u.test(text[to] ?? ""))) return undefined;
  if (from !== to) return { edits: [{ from, to, insert: character + text.slice(from, to) + closing }], selection: selection.anchor <= selection.head ? { anchor: from + 1, head: to + 1 } : { anchor: to + 1, head: from + 1 } };
  return replace(selection, character + closing, from + 1);
};

export const findMatches = (text: string, query: string, caseSensitive: boolean, limit = 1000): readonly { from: number; to: number }[] => {
  if (!query) return [];
  // Match the original string so case-folding expansions cannot corrupt UTF-16 offsets.
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(escaped, caseSensitive ? "gu" : "giu");
  const matches: { from: number; to: number }[] = [];
  for (const match of text.matchAll(expression)) {
    const from = match.index, to = from + match[0].length;
    if (validOffset(text, from) && validOffset(text, to)) matches.push({ from, to });
    if (matches.length >= limit) break;
  }
  return matches;
};

export const completions = (text: string, selection: Selection): Readonly<{ from: number; items: readonly string[] }> => {
  const prefix = /[\p{L}\p{N}_$]*$/u.exec(text.slice(0, selection.head))![0];
  const words = new Set([...keywords, "string", "number", "boolean", "console", "log", ...text.matchAll(/[\p{L}_$][\p{L}\p{N}_$]*/gu)].map((word) => typeof word === "string" ? word : word[0]));
  return { from: selection.head - prefix.length, items: [...words].filter((word) => word !== prefix && word.startsWith(prefix)).sort().slice(0, 8) };
};
