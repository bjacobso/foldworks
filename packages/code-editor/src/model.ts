import { Schema as S } from "effect";
import { Document, Selection, normalizeText } from "./document";
import { DiagnosticBatch } from "./diagnostics";

export const Options = S.Struct({
  readOnly: S.Boolean,
  lineNumbers: S.Boolean,
  lineWrapping: S.Boolean,
  tabSize: S.Number,
  theme: S.Literals(["light", "dark"]),
});
export type Options = typeof Options.Type;
export const Model = S.Struct({
  id: S.String,
  document: Document,
  selection: Selection,
  options: Options,
  diagnostics: S.Array(DiagnosticBatch),
  status: S.Literals(["Loading", "Ready", "Failed"]),
  error: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  text?: string;
  uri?: string;
  languageId?: string;
}> & Partial<Options>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  document: {
    uri: config.uri ?? `inmemory://foldworks/${encodeURIComponent(config.id)}`,
    session: 0,
    revision: 0,
    languageId: config.languageId ?? "text",
    text: normalizeText(config.text ?? ""),
    lineEnding: config.text?.includes("\r\n") ? "crlf" : "lf",
  },
  selection: { anchor: 0, head: 0 },
  options: {
    readOnly: config.readOnly ?? false,
    lineNumbers: config.lineNumbers ?? true,
    lineWrapping: config.lineWrapping ?? false,
    tabSize: Math.max(1, Math.min(8, Math.round(config.tabSize ?? 2) || 2)),
    theme: config.theme ?? "light",
  },
  diagnostics: [],
  status: "Loading",
  error: "",
});
