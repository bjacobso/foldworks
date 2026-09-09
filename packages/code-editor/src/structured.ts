import { Result, Schema as S, SchemaIssue } from "effect";
import { isMap, isNode, isScalar, isSeq, parseDocument, type Node } from "yaml";
import type { Document, EditorImplementation } from "./contracts";
import { Operation } from "./contracts";
import { jsonDiagnostics, type Diagnostic } from "./diagnostics";
import { validOffset } from "./document";

export type ValidationOptions = Readonly<{ onExcessProperty?: "ignore" | "error" }>;
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();
const supported = (language: string) => ["json", "yaml", "yml"].includes(language);
const source = (language: string) => language === "json" ? "json" : "yaml";

const range = (text: string, from = 0, to = Math.min(text.length, from + 1)) => {
  from = Math.max(0, Math.min(text.length, from));
  to = Math.max(from, Math.min(text.length, to));
  if (!validOffset(text, from)) from--;
  if (!validOffset(text, to)) to++;
  return { from, to };
};

/** Missing fields and paths through aliases point to the nearest available container. */
const location = (text: string, root: Node | null, path: readonly PropertyKey[]) => {
  let node = root;
  for (const key of path) {
    let child: unknown;
    if (isMap(node)) {
      // JSON permits duplicate keys; JSON.parse uses the last value.
      child = [...node.items].reverse().find((pair) => isScalar(pair.key) && String(pair.key.value) === String(key))?.value;
    } else if (isSeq(node)) child = node.items[Number(key)];
    if (!isNode(child)) break;
    node = child;
  }
  return range(text, node?.range?.[0], node?.range?.[1]);
};

// YAML can represent cyclic objects, which recursive configuration schemas cannot decode.
const hasCycle = (value: unknown): boolean => {
  const active = new Set<object>();
  const visited = new Set<object>();
  const stack = [{ value, leaving: false }];
  while (stack.length) {
    const item = stack.pop()!;
    if (item.value === null || typeof item.value !== "object") continue;
    if (item.leaving) { active.delete(item.value); continue; }
    if (active.has(item.value)) return true;
    if (visited.has(item.value)) continue;
    active.add(item.value); visited.add(item.value);
    stack.push({ value: item.value, leaving: true });
    for (const value of Object.values(item.value)) stack.push({ value, leaving: false });
  }
  return false;
};

/** Strict JSON or YAML 1.2 syntax followed by synchronous Effect Schema decoding. */
export const validate = <Schema extends S.ConstraintDecoder<unknown>>(
  schema: Schema, document: Document, options: ValidationOptions = {},
): readonly Diagnostic[] => {
  const { text, languageId } = document;
  if (!supported(languageId)) return [];
  const json = languageId === "json";
  const syntax = json ? jsonDiagnostics(document) : [];
  if (syntax.length) return syntax;
  const parsed = parseDocument(text, { version: "1.2", stringKeys: true, uniqueKeys: !json, prettyErrors: false });
  const diagnostic = (message: string, from?: number, to?: number): Diagnostic => ({
    ...range(text, from, to), severity: "error", message,
  });
  if (parsed.errors.length) return parsed.errors.map((error) => diagnostic(error.message, ...error.pos));
  const warnings: Diagnostic[] = parsed.warnings.map((warning) => ({
    ...range(text, ...warning.pos), severity: "warning", message: warning.message,
  }));
  let value: unknown;
  try {
    // JSON.parse remains authoritative for JSON semantics; YAML nodes only supply locations.
    value = json ? JSON.parse(text) : parsed.toJS({ maxAliasCount: 100 });
  } catch (error) {
    return [diagnostic(error instanceof Error ? error.message : String(error))];
  }
  if (hasCycle(value)) return [diagnostic("Cyclic YAML aliases are not supported.")];
  const result = S.decodeUnknownResult(schema, { errors: "all", onExcessProperty: options.onExcessProperty ?? "error" })(value);
  if (Result.isSuccess(result)) return warnings;
  const diagnostics = formatIssues(result.failure.issue).issues.map((issue): Diagnostic => {
    const path = (issue.path ?? []).map((segment) => typeof segment === "object" ? segment.key : segment);
    return { ...location(text, parsed.contents, path), severity: "error",
      message: `${path.length ? path.map(String).join(".") : "$"}: ${issue.message}` };
  });
  // Union branches can report identical leaf errors.
  return [...warnings, ...diagnostics.filter((issue, index) => diagnostics.findIndex((other) =>
    issue.from === other.from && issue.to === other.to && issue.message === other.message) === index)];
};

/** Decorate any editor implementation without putting schemas or callbacks in its model. */
export const withSchema = <State, Message, Schema extends S.ConstraintDecoder<unknown>>(
  editor: EditorImplementation<State, Message>, schema: Schema, options: ValidationOptions = {},
): EditorImplementation<State, Message> => {
  const validated = (model: State): State => {
    const { document } = editor.snapshot(model);
    if (!supported(document.languageId)) return model;
    return editor.update(model, editor.execute(Operation.SetDiagnostics({
      ...document, source: source(document.languageId), diagnostics: validate(schema, document, options),
    }))).model;
  };
  return { ...editor,
    init: (config) => validated(editor.init(config)),
    update: (model, message) => {
      const before = editor.snapshot(model);
      const result = editor.update(model, message);
      const after = editor.snapshot(result.model);
      const ownSource = source(after.document.languageId);
      const changed = before.document !== after.document ||
        before.diagnostics.find((batch) => batch.source === ownSource) !== after.diagnostics.find((batch) => batch.source === ownSource);
      return changed ? { ...result, model: validated(result.model) } : result;
    },
  };
};
