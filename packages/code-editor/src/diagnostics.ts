import { Schema as S } from "effect";
import type { Document } from "./document";
import { offsetAt, validOffset } from "./document";

export const Diagnostic = S.Struct({
  from: S.Number,
  to: S.Number,
  severity: S.Literals(["error", "warning", "info", "hint"]),
  message: S.String,
  code: S.optional(S.String),
});
export type Diagnostic = typeof Diagnostic.Type;
export const DiagnosticBatch = S.Struct({
  uri: S.String,
  session: S.Number,
  revision: S.Number,
  languageId: S.String,
  source: S.String,
  diagnostics: S.Array(Diagnostic),
});
export type DiagnosticBatch = typeof DiagnosticBatch.Type;

export const validDiagnostics = (text: string, diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.every((issue) => validOffset(text, issue.from) && validOffset(text, issue.to) && issue.from <= issue.to);

export type Validator = Readonly<{
  source: string;
  validate: (document: Document, signal: AbortSignal) => readonly Diagnostic[] | Promise<readonly Diagnostic[]>;
}>;

/** JSON syntax validation. Engines without a position in their error use a document-level marker. */
export const jsonDiagnostics = ({ text, languageId }: Document): readonly Diagnostic[] => {
  if (languageId !== "json") return [];
  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    const position = /position (\d+)/i.exec(message);
    const line = /line (\d+) column (\d+)/i.exec(message);
    let from = /end of/i.test(message) ? text.length : 0;
    if (position) from = Number(position[1]);
    else if (line) {
      try { from = offsetAt(text, { line: Number(line[1]) - 1, character: Number(line[2]) - 1 }); }
      catch { from = 0; }
    }
    if (!validOffset(text, from)) from = 0;
    let to = Math.min(text.length, from + 1);
    if (!validOffset(text, to)) to++;
    return [{ from, to, severity: "error", message }];
  }
};

export const jsonValidator: Validator = { source: "json", validate: jsonDiagnostics };
