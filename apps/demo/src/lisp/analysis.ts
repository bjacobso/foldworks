import {
  ancestors,
  walk,
  type Item,
  type Items,
  type RowDecoration,
  type TextSpan,
} from "@foldworks/outliner";

import { elementCount, isComment, itemOf, readOutline, type Program } from "./codec";
import {
  BUILTINS,
  DEFINING_FORMS,
  SPECIAL_FORMS,
  evaluate,
  happensBefore,
  isStep,
  occurrences,
  type Evaluation,
  type Step,
} from "./evaluate";
import { code, descendants, tokenize, type Expr } from "./syntax";

export type DefinitionKind = "def" | "defn" | "defstep" | "workflow";

export type Definition = Readonly<{ name: string; kind: DefinitionKind; itemId: string }>;

export type Analysis = Readonly<{
  program: Program;
  evaluation: Evaluation;
  definitions: ReadonlyMap<string, Definition>;
  /** Items that refer to each defined name, in document order. */
  references: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Dataflow warnings by item id. */
  warnings: ReadonlyMap<string, ReadonlyArray<string>>;
  steps: ReadonlyArray<Step>;
}>;

const headName = (expr: Expr): string | undefined => {
  if (expr._tag !== "List") return undefined;
  const head = code(expr.items)[0];
  return head?._tag === "Symbol" ? head.name : undefined;
};

/** The name a defining form introduces, with its expression. */
export const definedName = (
  expr: Expr,
): Readonly<{ name: string; kind: DefinitionKind }> | undefined => {
  const head = headName(expr);
  if (head === undefined || !DEFINING_FORMS.has(head) || expr._tag !== "List") return undefined;
  const name = code(expr.items)[1];
  return name?._tag === "Symbol" ? { name: name.name, kind: head as DefinitionKind } : undefined;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const stepWarnings = (evaluation: Evaluation, steps: ReadonlyArray<Step>) => {
  const warnings = new Map<string, string[]>();
  for (const workflow of evaluation.workflows) {
    const before = happensBefore(workflow.node);
    const present = new Set(occurrences(workflow.node).map((node) => node.step.name));
    for (const node of occurrences(workflow.node)) {
      for (const key of node.step.reads) {
        const writers = steps.filter(
          (step) => step.name !== node.step.name && step.writes.includes(key),
        );
        if (writers.length === 0) continue;
        if (writers.some((writer) => before.get(node.at)?.has(writer.name) === true)) continue;
        const names = writers.map((writer) => writer.name).join(" or ");
        const message = writers.some((writer) => present.has(writer.name))
          ? `may read :${key} before ${names} writes it`
          : `reads :${key}, but ${names} never runs`;
        const id = itemOf(node.at);
        warnings.set(id, [...(warnings.get(id) ?? []), message]);
      }
    }
  }
  return warnings;
};

const cache = new WeakMap<Items, Analysis>();

/** Reads, evaluates, and indexes the outline. Results are cached per document. */
export const analyze = (items: Items): Analysis => {
  const cached = cache.get(items);
  if (cached !== undefined) return cached;
  const program = readOutline(items);
  const evaluation = evaluate(program.forms);
  const definitions = new Map<string, Definition>();
  const definitionNames = new Set<string>();
  for (const form of program.forms) {
    for (const expr of descendants(form)) {
      const defined = definedName(expr);
      if (defined === undefined || expr._tag !== "List") continue;
      definitionNames.add(code(expr.items)[1]!.id);
      if (!definitions.has(defined.name)) {
        definitions.set(defined.name, { ...defined, itemId: itemOf(expr.id) });
      }
    }
  }
  const references = new Map<string, string[]>();
  for (const form of program.forms) {
    for (const expr of descendants(form)) {
      if (expr._tag !== "Symbol" || definitionNames.has(expr.id)) continue;
      if (!definitions.has(expr.name)) continue;
      const list = references.get(expr.name) ?? [];
      const id = itemOf(expr.id);
      if (!list.includes(id)) list.push(id);
      references.set(expr.name, list);
    }
  }
  const steps = [...evaluation.globals.values()].filter(isStep);
  const analysis: Analysis = {
    program,
    evaluation,
    definitions,
    references,
    warnings: stepWarnings(evaluation, steps),
    steps,
  };
  cache.set(items, analysis);
  return analysis;
};

/** Syntax and semantic highlighting for one item's text. */
export const highlight = (text: string, analysis: Analysis): ReadonlyArray<TextSpan> => {
  if (isComment(text)) return [{ text, kind: "comment" }];
  const tokens = tokenize(text);
  // The head is the first symbol, after any opening parentheses on a source line.
  const meaningful = tokens.filter((token) => token.kind !== "Space");
  const headAt = meaningful.findIndex((token) => token.kind !== "Open");
  const head = meaningful[headAt]?.kind === "Symbol" ? meaningful[headAt].text : undefined;
  const namesDefinition = head !== undefined && DEFINING_FORMS.has(head);
  return tokens.map((token): TextSpan => {
    switch (token.kind) {
      case "Space":
        return { text: token.text };
      case "Open":
      case "Close":
      case "Quote":
        return { text: token.text, kind: "paren" };
      case "String":
        return { text: token.text, kind: "string" };
      case "Number":
        return { text: token.text, kind: "number" };
      case "Keyword":
        return { text: token.text, kind: "keyword" };
      case "Comment":
        return { text: token.text, kind: "comment" };
      case "Error":
        return { text: token.text, kind: "error" };
      case "Symbol": {
        const name = token.text;
        if (namesDefinition && token === meaningful[headAt + 1])
          return { text: name, kind: "definition" };
        if (SPECIAL_FORMS.has(name)) return { text: name, kind: "special" };
        if (name === "true" || name === "false" || name === "nil") {
          return { text: name, kind: "constant" };
        }
        const definition = analysis.definitions.get(name);
        if (definition !== undefined) {
          return { text: name, kind: definition.kind === "defstep" ? "step" : "defined" };
        }
        if (BUILTINS.has(name)) return { text: name, kind: "builtin" };
        return { text: name, kind: "local" };
      }
    }
  });
};

export type Notation = "Outline" | "Lisp";

export type DecorationOptions = Readonly<{
  notation: Notation;
  /** The hoisted item, whose own brackets are off screen. */
  scopeId: string | null;
  /** The row with the caret, whose closing bracket is highlighted. */
  focusId: string | null;
}>;

/** Whether a row reads as a list: it has children or more than one element. */
const isListRow = (node: Item): boolean =>
  !isComment(node.text) && (node.children.length > 0 || (elementCount(node.text) ?? 1) >= 2);

/** The visible row on which a list closes: its last descendant, stopping at a fold. */
const closingRow = (node: Item): Item =>
  node.collapsed || node.children.length === 0 ? node : closingRow(node.children.at(-1)!);

/**
 * In Lisp notation a list row's bullet becomes `(`, and its `)` is painted
 * after the last row it contains, so the outline reads as source.
 */
const brackets = (
  items: Items,
  options: DecorationOptions,
): ReadonlyMap<string, Pick<RowDecoration, "marker" | "suffix">> => {
  const offscreen = new Set(
    options.scopeId === null ? [] : [options.scopeId, ...ancestors(items, options.scopeId)],
  );
  const closers = new Map<string, string[]>();
  const markers = new Map<string, string>();
  const visit = (nodes: Items, commented: boolean) => {
    for (const node of nodes) {
      const quiet = commented || isComment(node.text);
      const list = !quiet && isListRow(node);
      markers.set(node.id, list ? "(" : "");
      if (list && !offscreen.has(node.id)) {
        const at = closingRow(node).id;
        // Outer lists are visited first and close last.
        closers.set(at, [node.id, ...(closers.get(at) ?? [])]);
      }
      visit(node.children, quiet);
    }
  };
  visit(items, false);
  const result = new Map<string, Pick<RowDecoration, "marker" | "suffix">>();
  for (const node of walk(items)) {
    const owners = closers.get(node.id) ?? [];
    const folded = node.collapsed && node.children.length > 0 && owners.includes(node.id);
    result.set(node.id, {
      marker: markers.get(node.id) ?? "",
      suffix: [
        ...(folded ? [{ text: " …", kind: "fold" }] : []),
        ...owners.map((owner) => ({
          text: ")",
          kind: owner === options.focusId ? "paren-match" : "paren",
        })),
      ],
    });
  }
  return result;
};

const decorationCache = new WeakMap<Items, Map<string, Readonly<Record<string, RowDecoration>>>>();

/** Highlighting, tones, and, in Lisp notation, brackets for every item. Cached per document. */
export const decorations = (
  items: Items,
  options: DecorationOptions = { notation: "Outline", scopeId: null, focusId: null },
): Readonly<Record<string, RowDecoration>> => {
  const key =
    options.notation === "Outline"
      ? "Outline"
      : `Lisp:${options.scopeId ?? ""}:${options.focusId ?? ""}`;
  const forItems = decorationCache.get(items) ?? new Map();
  decorationCache.set(items, forItems);
  const cached = forItems.get(key);
  if (cached !== undefined) return cached;
  const analysis = analyze(items);
  const bracketed = options.notation === "Lisp" ? brackets(items, options) : undefined;
  const result: Record<string, RowDecoration> = {};
  for (const node of walk(items)) {
    const tone =
      analysis.program.errors.has(node.id) || analysis.evaluation.errors.has(node.id)
        ? "error"
        : analysis.warnings.has(node.id)
          ? "warning"
          : undefined;
    result[node.id] = {
      spans: highlight(node.text, analysis),
      ...(tone === undefined ? {} : { tone }),
      ...bracketed?.get(node.id),
    };
  }
  forItems.set(key, result);
  return result;
};

/** A short description of what an item's expression is. */
export const describe = (expr: Expr, analysis: Analysis): string => {
  switch (expr._tag) {
    case "Comment":
      return "Comment";
    case "Number":
      return "Number";
    case "String":
      return "String";
    case "Keyword":
      return "Keyword";
    case "Vector":
      return `Vector of ${plural(code(expr.items).length, "item")}`;
    case "Map":
      return `Map of ${plural(Math.floor(code(expr.items).length / 2), "entry")}`;
    case "Symbol": {
      const definition = analysis.definitions.get(expr.name);
      if (definition !== undefined) {
        return definition.kind === "defstep"
          ? `Step ${expr.name}`
          : definition.kind === "workflow"
            ? `Workflow ${expr.name}`
            : `Reference to ${expr.name}`;
      }
      return BUILTINS.has(expr.name) ? `Built-in ${expr.name}` : `Local ${expr.name}`;
    }
    case "List": {
      const defined = definedName(expr);
      if (defined !== undefined) {
        return defined.kind === "defn"
          ? `Function ${defined.name}`
          : defined.kind === "defstep"
            ? `Step definition ${defined.name}`
            : defined.kind === "workflow"
              ? `Workflow ${defined.name}`
              : `Definition ${defined.name}`;
      }
      const head = headName(expr);
      if (head === undefined) return "List";
      if (SPECIAL_FORMS.has(head)) return `${head} form`;
      if (analysis.definitions.has(head)) return `Call to ${head}`;
      return BUILTINS.has(head) ? `Call to ${head} (built in)` : `Call to ${head}`;
    }
  }
};

/** The comment that documents an item: its first comment child, or a comment just above it. */
export const documentation = (items: Items, id: string): string | undefined => {
  const strip = (text: string) => text.trim().replace(/^;+\s*/, "");
  const visit = (nodes: Items): string | undefined => {
    for (const [index, node] of nodes.entries()) {
      if (node.id === id) {
        const child = node.children.find((candidate) => isComment(candidate.text));
        if (child !== undefined) return strip(child.text);
        const previous = nodes[index - 1];
        return previous !== undefined && isComment(previous.text)
          ? strip(previous.text)
          : undefined;
      }
      const found = visit(node.children);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return visit(items);
};
