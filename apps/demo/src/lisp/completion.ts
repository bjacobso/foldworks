import { ancestors, find, locate, type Items } from "@foldworks/outliner";
import { Completion, type CompletionItem } from "@foldworks/text-intelligence";

import type { Analysis } from "./analysis";
import { isComment } from "./codec";
import { DOCS } from "./docs";
import { BUILTINS, SPECIAL_FORMS } from "./evaluate";
import { FLOW_FORMS, headOf } from "./slots";
import { code } from "./syntax";

/** A symbol or keyword: anything up to a space, a bracket, a quote, or a comment. */
const SYMBOL_BEFORE = /[^\s()[\]{}";',]+$/u;
const SYMBOL_AFTER = /^[^\s()[\]{}";',]*/u;

export type Offer = Readonly<{ from: number; to: number; items: ReadonlyArray<CompletionItem> }>;

/** Names bound around an item: the parameters of enclosing functions and `let` bindings. */
const localsAround = (items: Items, analysis: Analysis, id: string): ReadonlyArray<string> => {
  const names = new Set<string>();
  for (const ancestor of [...ancestors(items, id), id]) {
    const expr = analysis.program.exprs.get(ancestor);
    if (expr?._tag !== "List") continue;
    const [head, , third] = code(expr.items);
    const binding =
      head?._tag === "Symbol" && head.name === "defn"
        ? third
        : head?._tag === "Symbol" && (head.name === "let" || head.name === "fn")
          ? code(expr.items)[1]
          : undefined;
    if (binding?._tag !== "Vector") continue;
    const symbols = code(binding.items);
    symbols.forEach((symbol, index) => {
      // `let` binds every other element; parameters bind all of them.
      if (symbol._tag !== "Symbol" || symbol.name === "&") return;
      if (head?._tag === "Symbol" && head.name === "let" && index % 2 === 1) return;
      names.add(symbol.name);
    });
  }
  return [...names];
};

const definitionItems = (analysis: Analysis): ReadonlyArray<CompletionItem> =>
  [...analysis.definitions.values()].map((definition) => {
    const value = analysis.evaluation.globals.get(definition.name);
    const params =
      value !== undefined && value !== null && typeof value === "object" && value._tag === "Fn"
        ? ` ${value.params}`
        : "";
    return {
      label: definition.name,
      kind: definition.kind === "defstep" ? "step" : definition.kind,
      detail: `${definition.kind === "defn" ? "function" : definition.kind === "defstep" ? "step" : definition.kind}${params}`,
    };
  });

const libraryItems: ReadonlyArray<CompletionItem> = [
  ...[...SPECIAL_FORMS].map((name) => ({
    label: name,
    kind: "special",
    detail: DOCS.get(name)?.usage ?? "special form",
  })),
  ...[...BUILTINS].map((name) => ({
    label: name,
    kind: "builtin",
    detail: DOCS.get(name)?.usage ?? "built-in",
  })),
];

/**
 * What can be typed for a word: in a flow, steps and flows; after `:`, data
 * keys; otherwise the locals around an item, definitions, special forms, and
 * built-ins.
 */
export const candidatesFor = (
  items: Items,
  analysis: Analysis,
  word: string,
  id: string | undefined,
  inFlow: boolean,
): ReadonlyArray<CompletionItem> => {
  const candidates: ReadonlyArray<CompletionItem> = inFlow
    ? [
        ...definitionItems(analysis).filter(
          (item) => item.kind === "step" || item.kind === "workflow",
        ),
        ...libraryItems.filter((item) => ["sequence", "parallel", "branch"].includes(item.label)),
      ]
    : word.startsWith(":")
      ? [...new Set(analysis.steps.flatMap((step) => [...step.writes, ...step.reads]))].map(
          (key) => ({
            label: `:${key}`,
            kind: "keyword",
            detail: `written by ${
              analysis.steps
                .filter((step) => step.writes.includes(key))
                .map((step) => step.name)
                .join(", ") || "no step"
            }`,
          }),
        )
      : [
          ...(id === undefined ? [] : localsAround(items, analysis, id)).map((name) => ({
            label: name,
            kind: "local",
            detail: "local",
          })),
          ...definitionItems(analysis),
          ...libraryItems,
        ];
  return candidates.filter(
    (item, index) => candidates.findIndex((other) => other.label === item.label) === index,
  );
};

/**
 * Suggestions for the symbol at the caret of an item. Typing asks only once a
 * word has started, and only when something new matches.
 */
export const completionsAt = (
  items: Items,
  analysis: Analysis,
  id: string,
  caret: number,
  invoked: boolean,
): Offer | undefined => {
  const node = find(items, id);
  if (node === undefined || isComment(node.text)) return undefined;
  const { from, word } = Completion.wordBefore(node.text, caret, SYMBOL_BEFORE);
  const to = caret + (SYMBOL_AFTER.exec(node.text.slice(caret))?.[0].length ?? 0);
  if (!invoked && word === "") return undefined;
  const parentId = locate(items, id)?.parentId ?? null;
  const parentHead = parentId === null ? undefined : headOf(find(items, parentId)?.text ?? "");
  // Inside a flow, a row names a step or opens another flow.
  const inFlow = parentHead !== undefined && FLOW_FORMS.has(parentHead) && from === 0;
  const unique = candidatesFor(items, analysis, word, id, inFlow);
  const list = Completion.open(from, to, unique);
  if (!invoked && Completion.visible(list, node.text, caret).length === 0) return undefined;
  return { from, to, items: unique };
};
