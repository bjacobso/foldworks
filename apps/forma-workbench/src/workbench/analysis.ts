// One analysis of one revision of the program. The outline is printed as
// source against the previous document, so unchanged rows keep their text
// and every row keeps its id. The language services then describe that
// source, and every fact is kept in source coordinates and keyed by node id.
// The adapter places the facts in rows and in the source pane.

import { Effect, Schema as S } from "effect";
import type {
  Diagnostic as HostDiagnostic,
  SymbolIndexResult,
  TypePolicy,
} from "@formalang/host/types";
import { defaultBuiltins } from "@formalang/ts/builtins";
import { elaborateProgram, type ElaboratedDeclaration } from "@formalang/ts/descriptor";
import {
  indexSyntax,
  type OutlineItem,
  type SyntaxIdentity,
  type SyntaxIndex,
} from "@formalang/ts/syntax";
import { builtinScheme } from "@formalang/ts/type";

import { Document, SyntaxIdentitySchema } from "./document.js";
import { FormaHost, call, required, type FormaHostService } from "./host.js";
import { requirementsFor } from "./requirements.js";
import { Suggestion, Slot } from "./assistance.js";
import {
  Observed,
  observeProgram,
  observationsOf,
  evaluationDiagnostics,
  projectionOf,
} from "./values.js";
import { rowLayouts, type RowLayout } from "./rows.js";
import type { SymbolKind } from "./tokens.js";

export const Severity = S.Literals(["error", "warning", "info"]);

/** A problem at a span of the document. */
export const SourceDiagnostic = S.Struct({
  sourceId: S.optional(S.String),
  start: S.Number,
  end: S.Number,
  severity: Severity,
  message: S.String,
  code: S.optional(S.String),
  phase: S.optional(S.String),
});
export type SourceDiagnostic = typeof SourceDiagnostic.Type;

/** What the analysis knows about a symbol node. */
export const SymbolFact = S.Struct({
  kind: S.String,
  name: S.String,
  /** The definition a reference resolves to, or that a definition's name introduces. */
  definition: S.optional(S.String),
});
export type SymbolFact = typeof SymbolFact.Type;

export const Definition = S.Struct({
  key: S.String,
  name: S.String,
  kind: S.String,
  scope: S.Literals(["global", "local"]),
  /** The defining name's node, when it is in this document. */
  nodeId: S.NullOr(S.String),
  /** The form that introduced the name, such as `define` or `step`. */
  form: S.String,
  formNodeId: S.NullOr(S.String),
  sourceId: S.String,
  visible: S.optional(S.Boolean),
  start: S.optional(S.Number),
  end: S.optional(S.Number),
  scopeNodeId: S.NullOr(S.String),
});
export type Definition = typeof Definition.Type;

const RowNodeSchema = S.Struct({
  nodeId: S.String,
  kind: S.Literals([
    "List",
    "Vector",
    "Map",
    "Set",
    "Symbol",
    "String",
    "Number",
    "Boolean",
    "ReaderMacro",
    "Error",
    "Comment",
  ]),
  from: S.Number,
  to: S.Number,
  start: S.Number,
  end: S.Number,
});

export const RowLayoutSchema = S.Struct({
  id: S.String,
  text: S.String,
  parentId: S.NullOr(S.String),
  start: S.Number,
  end: S.Number,
  nodes: S.Array(RowNodeSchema),
});

const Analyzed = S.Struct({ source: S.String, identity: SyntaxIdentitySchema });

export const Analysis = S.Struct({
  sourceId: S.optional(S.String),
  /** The outline revision the analysis describes. */
  revision: S.Number,
  /** The outline printed as written. */
  document: Document,
  /**
   * The text the services analyzed, when rows that do not read made it
   * differ from the document: those rows are commented out so the rest of
   * the program still reads. Node ids agree with the document's. Every span
   * in the analysis is in this text.
   */
  analyzed: S.NullOr(Analyzed),
  /** Rows whose text does not read on its own. */
  brokenRows: S.Array(S.Struct({ id: S.String, message: S.String })),
  /** Where each analyzed row's text sits in the analyzed text. */
  rows: S.Array(RowLayoutSchema),
  symbols: S.Record(S.String, SymbolFact),
  /** Inferred types by node id. */
  types: S.Record(S.String, S.String),
  requirements: S.Record(S.String, S.Array(S.String)),
  suggestions: S.Array(Suggestion),
  slots: S.Record(S.String, S.Array(Slot)),
  values: S.Record(S.String, Observed),
  valueSession: S.NullOr(S.String),
  diagnostics: S.Array(SourceDiagnostic),
  definitions: S.Array(Definition),
  /** Node ids of the references to each definition, by definition key. */
  references: S.Record(S.String, S.Array(S.String)),
});
export type Analysis = typeof Analysis.Type;

/** The text an analysis's spans are in, and its ids. */
export const analyzedText = (
  analysis: Analysis,
): { readonly source: string; readonly identity: SyntaxIdentity } =>
  analysis.analyzed ?? analysis.document;

export type AnalyzeInput = Readonly<{
  revision: number;
  rows: ReadonlyArray<OutlineItem>;
  /** The previous document, whose layout unchanged rows keep. */
  base: Document | null;
}>;

/** Forms the evaluator and type checker handle themselves. */
export const SPECIAL_FORMS: ReadonlySet<string> = new Set([
  "define",
  "macro",
  "type",
  "typeclass",
  "form",
  "class",
  "error",
  "service",
  "layer",
  "do!",
  "instance",
  "fn",
  "let",
  "if",
  "do",
  "match",
  "quote",
  "quasiquote",
  "unquote",
  ":",
]);

/** Macros every program has, from the kernel prelude. */
export const KERNEL_MACROS: ReadonlySet<string> = new Set([
  "not",
  "when",
  "cond",
  "and",
  "or",
  "->",
  "->>",
]);

/**
 * Runtime builtins the type checker has no scheme for. They are typed as
 * unknown, so programs that use them are still checked everywhere else.
 */
const untypedBuiltins = (): TypePolicy => ({
  unboundSymbols: Object.keys(defaultBuiltins)
    .filter((name) => builtinScheme(name) === undefined)
    .map((name) => ({
      match: { kind: "exact" as const, value: name },
      type: { kind: "any" as const },
      reason: "runtime builtin without a type scheme",
    })),
});

/** Replaces the text of spans with spaces, keeping line breaks, so offsets do not move. */
export const blank = (
  source: string,
  spans: ReadonlyArray<{ start: number; end: number }>,
): string => {
  if (spans.length === 0) return source;
  const units = source.split("");
  for (const { start, end } of spans) {
    for (let at = start; at < end && at < units.length; at += 1) {
      if (units[at] !== "\n") units[at] = " ";
    }
  }
  return units.join("");
};

/** The parts of a text outside some spans. */
const outside = (
  length: number,
  spans: ReadonlyArray<{ start: number; end: number }>,
): ReadonlyArray<{ start: number; end: number }> => {
  const gaps: Array<{ start: number; end: number }> = [];
  let at = 0;
  for (const span of [...spans].sort((left, right) => left.start - right.start)) {
    if (span.start > at) gaps.push({ start: at, end: span.start });
    at = Math.max(at, span.end);
  }
  if (at < length) gaps.push({ start: at, end: length });
  return gaps;
};

/** Top-level forms whose head is a domain form a prelude registered. */
export const descriptorForms = (
  identity: SyntaxIdentity,
  source: string,
  isDescriptor: (head: string) => boolean,
): ReadonlyArray<{ start: number; end: number; nodeId: string; head: string }> => {
  const index = indexSyntax(identity);
  return index.children(null).flatMap((node) => {
    if (node.kind !== "List") return [];
    const head = index.children(node.id)[0];
    if (head?.kind !== "Symbol") return [];
    const name = source.slice(head.span.start, head.span.end);
    return isDescriptor(name) ? [{ ...node.span, nodeId: node.id, head: name }] : [];
  });
};

/** Messages place themselves; the span already does. */
const withoutOffset = (message: string): string => message.replace(/ \(at offset \d+\)$/, "");

const severityOf = (severity: string): SourceDiagnostic["severity"] =>
  severity === "warning" || severity === "info" ? severity : "error";

const fromHost = (diagnostic: HostDiagnostic): SourceDiagnostic | undefined =>
  diagnostic.span === undefined
    ? undefined
    : {
        sourceId: diagnostic.span.sourceId,
        start: diagnostic.span.startOffset,
        end: diagnostic.span.endOffset,
        severity: severityOf(diagnostic.severity),
        message: withoutOffset(diagnostic.message),
        code: diagnostic.code,
        ...(diagnostic.phase === undefined ? {} : { phase: diagnostic.phase }),
      };

/** Symbol kinds and references from the symbol index, for this document's nodes. */
const symbolFacts = (
  index: SymbolIndexResult,
  sourceId: string,
  source: string,
  syntax: SyntaxIndex,
  capabilities: ReadonlySet<string>,
  isDescriptor: (head: string) => boolean,
) => {
  const symbols: Record<string, SymbolFact> = {};
  const references: Record<string, string[]> = {};
  const definitions: Definition[] = index.definitions.map((definition) => ({
    key: definition.key,
    name: definition.name,
    kind: definition.kind,
    scope: definition.scope,
    nodeId: definition.span.sourceId === sourceId ? definition.nodeId : null,
    form: definition.form,
    formNodeId: definition.span.sourceId === sourceId ? (definition.formNodeId ?? null) : null,
    sourceId: definition.span.sourceId,
    start: definition.span.startOffset,
    end: definition.span.endOffset,
    scopeNodeId: definition.scopeNodeId ?? null,
  }));
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  for (const definition of definitions) {
    if (definition.nodeId === null) continue;
    symbols[definition.nodeId] = {
      kind: "definition" satisfies SymbolKind,
      name: definition.name,
      definition: definition.key,
    };
  }
  for (const reference of index.references) {
    if (reference.span.sourceId !== sourceId || symbols[reference.nodeId] !== undefined) continue;
    const definition =
      reference.definition === undefined ? undefined : byKey.get(reference.definition);
    const kind: SymbolKind =
      reference.resolution === "builtin"
        ? "builtin"
        : reference.resolution === "form"
          ? "form"
          : reference.resolution === "unresolved"
            ? capabilities.has(reference.name)
              ? "capability"
              : "unresolved"
            : definition === undefined
              ? "defined"
              : definition.scope === "local"
                ? "local"
                : definition.kind === "declaration"
                  ? "declared"
                  : definition.kind === "macro"
                    ? "macro"
                    : "defined";
    symbols[reference.nodeId] = {
      kind,
      name: reference.name,
      ...(reference.definition === undefined ? {} : { definition: reference.definition }),
    };
    if (reference.definition !== undefined) {
      (references[reference.definition] ??= []).push(reference.nodeId);
    }
  }
  // Heads of special forms, macros, and descriptor forms are not references.
  for (const node of syntax.identity.nodes) {
    if (node.kind !== "Symbol" || symbols[node.id] !== undefined || node.parent === null) continue;
    if (syntax.children(node.parent)[0]?.id !== node.id) continue;
    const name = source.slice(node.span.start, node.span.end);
    const kind: SymbolKind | undefined = SPECIAL_FORMS.has(name)
      ? "special"
      : KERNEL_MACROS.has(name)
        ? "macro"
        : isDescriptor(name)
          ? "form"
          : undefined;
    if (kind !== undefined) symbols[node.id] = { kind, name };
  }
  return { symbols, references, definitions };
};

/** Types by node, from typed spans that match a node's span exactly. */
const typesByNode = (
  typedSpans: ReadonlyArray<{ span: { startOffset: number; endOffset: number }; display: string }>,
  syntax: SyntaxIndex,
): Record<string, string> => {
  const types: Record<string, string> = {};
  for (const typed of typedSpans) {
    const node = syntax.withSpan(typed.span.startOffset, typed.span.endOffset);
    if (node !== undefined && types[node.id] === undefined) types[node.id] = typed.display;
  }
  return types;
};

/** Elaborates the descriptor forms, with the code around them blanked, and runs the checks. */
const elaborate = (
  service: FormaHostService,
  source: string,
  spans: ReadonlyArray<{ start: number; end: number }>,
): {
  readonly declarations: ReadonlyArray<ElaboratedDeclaration>;
  readonly diagnostics: ReadonlyArray<HostDiagnostic>;
} => {
  const prelude = service.prelude;
  if (prelude === undefined || spans.length === 0) return { declarations: [], diagnostics: [] };
  const text = blank(source, outside(source.length, spans));
  const result = elaborateProgram(text, { prelude, sourceId: service.config.sourceId });
  const checks = (service.config.checks ?? []).flatMap((check) => check(result.declarations, text));
  return { declarations: result.declarations, diagnostics: [...result.diagnostics, ...checks] };
};

/** Prints and analyzes one revision of the outline. */
export const analyzeProgram = (input: AnalyzeInput): Effect.Effect<Analysis, string, FormaHost> =>
  Effect.gen(function* () {
    const service = yield* FormaHost;
    const { host, sessionId, config } = service;
    const sourceId = config.sourceId;
    const outlineToSource = yield* required(host, "outlineToSource");
    const analyzeEditor = yield* required(host, "analyzeEditor");
    const symbolIndex = yield* required(host, "symbolIndex");

    const printed = yield* call(() =>
      outlineToSource({
        sourceId,
        items: input.rows,
        ...(input.base === null
          ? {}
          : { base: { source: input.base.source, identity: input.base.identity } }),
      }),
    );
    const document: Document = {
      revision: input.revision,
      source: printed.source,
      identity: printed.identity as Document["identity"],
    };
    // Rows that do not read are commented out for analysis, so one unclosed
    // bracket does not swallow the rest of the program.
    const analyzed =
      printed.errors.length === 0
        ? undefined
        : yield* call(() =>
            outlineToSource({
              sourceId,
              items: input.rows,
              base: { source: printed.source, identity: printed.identity },
              brokenRows: "comment",
            }),
          );
    const text = analyzed ?? printed;
    const syntax = indexSyntax(text.identity);
    const descriptors = service.prelude?.descriptions;
    const isDescriptor = (head: string) => descriptors?.get(head)?.phase === "domain";
    const domainForms = descriptorForms(text.identity, text.source, isDescriptor);
    const capabilities = new Set((config.capabilities ?? []).map((capability) => capability.name));

    // Code is typed with descriptor forms blanked; they are elaborated instead.
    const code = blank(text.source, domainForms);
    const typed = yield* call(() =>
      analyzeEditor({ sourceId, source: code, sessionId, typePolicy: untypedBuiltins() }),
    );
    const elaborated = elaborate(service, text.source, domainForms);
    const index = yield* call(() =>
      symbolIndex({ sourceId, source: text.source, identity: text.identity, sessionId }),
    );
    const facts = symbolFacts(index, sourceId, text.source, syntax, capabilities, isDescriptor);
    const projectFiles = new Set((config.sources ?? []).map((source) => source.sourceId));
    facts.definitions = facts.definitions.map((definition) => ({
      ...definition,
      visible: definition.sourceId === sourceId || !projectFiles.has(definition.sourceId),
    }));

    const parseErrors: SourceDiagnostic[] = text.identity.errors.map((error) => ({
      start: error.span.start,
      end: Math.max(error.span.end, error.span.start + 1),
      severity: "error",
      message: error.message,
      code: "parse/syntax",
      phase: "parse",
    }));
    const typeErrors: SourceDiagnostic[] = typed.errors.flatMap((error) =>
      error.span === undefined
        ? []
        : [
            {
              start: error.span.startOffset,
              end: error.span.endOffset,
              severity: "error" as const,
              message: withoutOffset(error.message),
              phase: "typecheck",
            },
          ],
    );
    const diagnostics = [
      ...(service.sourceDiagnostics ?? [])
        .filter((diagnostic) => diagnostic.span?.sourceId !== sourceId)
        .flatMap((diagnostic) => fromHost(diagnostic) ?? []),
      ...parseErrors,
      // A program that does not parse has no type errors worth showing.
      ...(parseErrors.length > 0 ? [] : typeErrors),
      ...typed.diagnostics.flatMap((diagnostic) => fromHost(diagnostic) ?? []),
      ...elaborated.diagnostics.flatMap((diagnostic) => fromHost(diagnostic) ?? []),
    ];

    const types = typesByNode(typed.typedSpans, syntax);
    const suggestions = [
      ...index.references
        .filter(
          (reference) => reference.span.sourceId === sourceId && reference.definition !== undefined,
        )
        .flatMap((reference) => {
          const definition = facts.definitions.find(
            (definition) => definition.key === reference.definition,
          );
          return definition?.visible === false
            ? [{ name: reference.name, kind: definition.kind }]
            : [];
        }),
      ...Object.keys(defaultBuiltins).map((name) => ({ name, kind: "builtin" })),
      ...[...SPECIAL_FORMS].map((name) => ({ name, kind: "special" })),
      ...[...KERNEL_MACROS].map((name) => ({ name, kind: "macro" })),
      ...(config.capabilities ?? []).map((capability) => ({
        name: capability.name,
        kind: "capability",
        doc: capability.description,
      })),
      ...(descriptors?.list() ?? [])
        .filter((descriptor) => descriptor.phase === "domain")
        .map((descriptor) => ({ name: descriptor.name, kind: "form", doc: descriptor.doc })),
    ];
    const slots: Record<string, Array<typeof Slot.Type>> = {};
    if (host.formSlots !== undefined) {
      for (const form of domainForms) {
        const result = yield* call(() =>
          host.formSlots!({
            sourceId,
            source: text.source,
            identity: text.identity,
            sessionId,
            nodeId: form.nodeId,
          }),
        );
        // A filled slot is offered again only when it repeats, as a policy's children do.
        slots[form.nodeId] = result.slots
          .filter((slot) => slot.available && (slot.occurrences.length === 0 || slot.many))
          .map((slot) => {
            // The service supplies a source form; its outer parentheses are painted by the outline.
            const insertion = slot.insertion;
            const listed = insertion.text.startsWith("(") && insertion.text.endsWith(")");
            return {
              key: slot.name,
              label: slot.many && slot.childForm !== undefined ? slot.childForm : slot.name,
              text: listed ? insertion.text.slice(1, -1) : insertion.text,
              inline: !listed && insertion.text.trimStart().startsWith(":"),
              caret: Math.max(0, insertion.cursor - (listed ? 1 : 0)),
              doc: slot.doc,
            };
          });
      }
    }
    const observed =
      parseErrors.length > 0
        ? undefined
        : yield* observeProgram(
            { ...document, identity: text.identity as Document["identity"] },
            code,
          );
    const runtimeErrors =
      observed === undefined ||
      typed.errors.length > 0 ||
      typed.diagnostics.some((diagnostic) => diagnostic.severity === "error")
        ? []
        : evaluationDiagnostics(observed.state).flatMap((diagnostic) => fromHost(diagnostic) ?? []);

    const values = { ...(observed === undefined ? {} : observationsOf(observed.state)) };
    for (const declaration of elaborated.declarations) {
      const node = syntax.withSpan(declaration.span.startOffset, declaration.span.endOffset);
      if (node === undefined) continue;
      values[node.id] = {
        count: 1,
        value: projectionOf(declaration.payload),
        failure: null,
        origin: "elaboration",
      };
      types[node.id] = declaration.summary.resultType;
    }

    return {
      sourceId,
      revision: input.revision,
      document,
      analyzed:
        analyzed === undefined
          ? null
          : { source: analyzed.source, identity: analyzed.identity as Document["identity"] },
      brokenRows: printed.errors,
      rows: [...rowLayouts(input.rows, text.identity).values()].map((layout): RowLayout => layout),
      symbols: facts.symbols,
      types,
      requirements: requirementsFor(text.identity, facts.symbols, facts.definitions),
      suggestions,
      slots,
      values,
      valueSession: observed?.sessionId ?? null,
      diagnostics: [...diagnostics, ...runtimeErrors],
      definitions: facts.definitions,
      references: facts.references,
    };
  });
