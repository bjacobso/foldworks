import { Schema as S } from "effect";

export const TextEdit = S.Struct({ from: S.Number, to: S.Number, insert: S.String });
export type TextEdit = typeof TextEdit.Type;
export const Selection = S.Struct({ anchor: S.Number, head: S.Number });
export type Selection = typeof Selection.Type;
export const Document = S.Struct({
  uri: S.String,
  session: S.Number,
  revision: S.Number,
  languageId: S.String,
  text: S.String,
  lineEnding: S.Literals(["lf", "crlf"]),
});
export type Document = typeof Document.Type;

export const normalizeText = (text: string): string => text.replace(/\r\n?/g, "\n");
export const exportText = (document: Document): string => document.lineEnding === "crlf"
  ? document.text.replace(/\n/g, "\r\n") : document.text;

/** Offsets are UTF-16 code units, but may not split a surrogate pair. */
export const validOffset = (text: string, offset: number): boolean =>
  Number.isInteger(offset) && offset >= 0 && offset <= text.length && !(
    offset > 0 && offset < text.length &&
    /[\uD800-\uDBFF]/.test(text[offset - 1]!) && /[\uDC00-\uDFFF]/.test(text[offset]!)
  );

export const validSelection = (text: string, selection: Selection): boolean =>
  validOffset(text, selection.anchor) && validOffset(text, selection.head);

/** All ranges reference the same base document. Throws on invalid or overlapping edits. */
export const applyEdits = (text: string, edits: readonly TextEdit[]): string => {
  let end = 0;
  const parts: string[] = [];
  for (const edit of edits) {
    if (!validOffset(text, edit.from) || !validOffset(text, edit.to) ||
      edit.from < end || edit.to < edit.from || edit.insert.includes("\r")) {
      throw new Error("Edits must be ordered, nonoverlapping UTF-16 ranges with LF text.");
    }
    parts.push(text.slice(end, edit.from), edit.insert);
    end = edit.to;
  }
  return parts.join("") + text.slice(end);
};

export const positionAt = (text: string, offset: number): Readonly<{ line: number; character: number }> => {
  if (!validOffset(text, offset)) throw new Error("Invalid document offset.");
  const prefix = text.slice(0, offset);
  return { line: prefix.split("\n").length - 1, character: offset - prefix.lastIndexOf("\n") - 1 };
};

/** Converts zero-based LSP UTF-16 coordinates. Other encodings need a separate adapter. */
export const offsetAt = (text: string, position: Readonly<{ line: number; character: number }>): number => {
  const lines = text.split("\n");
  const line = lines[position.line];
  if (!Number.isInteger(position.line) || position.line < 0 || line === undefined ||
    !validOffset(line, position.character)) throw new Error("Invalid document position.");
  return lines.slice(0, position.line).reduce((sum, part) => sum + part.length + 1, 0) + position.character;
};
