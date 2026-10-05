// Structural edits. Each takes the outline and returns a new one, or
// `undefined` when the edit does not apply. Untouched items keep their ids,
// so the result diffs cleanly against the original.

import {
  ancestors,
  childrenOf,
  find,
  insertItems,
  item,
  locate,
  removeItems,
  roots,
  updateItem,
  walk,
  type Item,
  type Items,
} from "@foldworks/outliner";

import type { Analysis } from "./analysis";
import { isComment, printOutline } from "./codec";
import { BUILTINS, SPECIAL_FORMS } from "./evaluate";
import { code, descendants, read, tokenize, type Expr } from "./syntax";

export type NextId = () => string;

/** Wraps sibling items in a new form whose text is `head`, at the first item's place. */
export const wrap = (
  items: Items,
  ids: ReadonlyArray<string>,
  head: string,
  nextId: NextId,
): Readonly<{ items: Items; id: string }> | undefined => {
  const targets = roots(items, ids);
  const first = targets[0] === undefined ? undefined : locate(items, targets[0]);
  if (first === undefined) return undefined;
  const { items: without, removed } = removeItems(items, targets);
  const id = nextId();
  const next = insertItems(without, first.parentId, first.index, [item(id, head, removed)]);
  return next === undefined ? undefined : { items: next, id };
};

/** Replaces an item with its children, dropping its own text. */
export const unwrap = (items: Items, id: string): Items | undefined => {
  const node = find(items, id);
  const location = locate(items, id);
  if (node === undefined || location === undefined || node.children.length === 0) {
    return undefined;
  }
  const without = removeItems(items, [id]).items;
  return insertItems(without, location.parentId, location.index, node.children);
};

/** Replaces an item's parent with the item, discarding its siblings. */
export const raise = (items: Items, id: string): Items | undefined => {
  const location = locate(items, id);
  if (location === undefined || location.parentId === null) return undefined;
  const node = find(items, id)!;
  const parent = locate(items, location.parentId)!;
  const without = removeItems(items, [location.parentId]).items;
  return insertItems(without, parent.parentId, parent.index, [node]);
};

/** Folds an item's children into its text: one line instead of several. */
export const join = (items: Items, id: string): Items | undefined => {
  const node = find(items, id);
  if (node === undefined || node.children.length === 0) return undefined;
  if (walk(node.children).some((child) => isComment(child.text))) return undefined;
  const parts = node.children.map((child) =>
    printOutline([child])
      .text.split("\n")
      .map((line) => line.trim())
      .join(" "),
  );
  const text = [node.text.trim(), ...parts].filter((part) => part !== "").join(" ");
  return updateItem(items, id, (current) => ({ ...current, text, children: [], collapsed: false }));
};

/** Moves every element after an item's head out of its text and into children. */
export const explode = (items: Items, id: string, nextId: NextId): Items | undefined => {
  const node = find(items, id);
  if (node === undefined || isComment(node.text)) return undefined;
  let parts: ReadonlyArray<Expr>;
  try {
    parts = read(node.text);
  } catch {
    return undefined;
  }
  if (parts.length < 2) return undefined;
  const source = node.text;
  const leaf = (expr: Expr): Item => {
    const inner = expr._tag === "List" ? code(expr.items) : [];
    const text =
      expr._tag === "List" && inner.length >= 2
        ? source.slice(inner[0]!.start, inner.at(-1)!.end)
        : source.slice(expr.start, expr.end);
    return item(nextId(), text);
  };
  const head = parts[0]!;
  return updateItem(items, id, (current) => ({
    ...current,
    text: source.slice(head.start, head.end),
    children: [...parts.slice(1).map(leaf), ...current.children],
  }));
};

/** Renames a symbol everywhere it appears as a symbol. */
export const rename = (items: Items, from: string, to: string): Items | undefined => {
  if (from === to || to.trim() === "" || /[\s()[\]{}";']/.test(to)) return undefined;
  const visit = (nodes: Items): Items => {
    let changed = false;
    const next = nodes.map((node) => {
      const text = isComment(node.text)
        ? node.text
        : tokenize(node.text)
            .map((token) => (token.kind === "Symbol" && token.text === from ? to : token.text))
            .join("");
      const children = visit(node.children);
      if (text === node.text && children === node.children) return node;
      changed = true;
      return { ...node, text, children };
    });
    return changed ? next : nodes;
  };
  const next = visit(items);
  return next === items ? undefined : next;
};

/** Names bound inside an expression by `let`, `fn`, and `defn`. */
const boundWithin = (expr: Expr): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const current of descendants(expr)) {
    if (current._tag !== "List") continue;
    const [head, ...rest] = code(current.items);
    if (head?._tag !== "Symbol") continue;
    const vector =
      head.name === "let" || head.name === "fn"
        ? rest.find((part) => part._tag === "Vector")
        : head.name === "defn"
          ? rest.find((part) => part._tag === "Vector")
          : undefined;
    if (vector?._tag !== "Vector") continue;
    const symbols = code(vector.items);
    symbols.forEach((symbol, index) => {
      if (symbol._tag === "Symbol" && (head.name !== "let" || index % 2 === 0)) {
        names.add(symbol.name);
      }
    });
  }
  return names;
};

/** Local names an expression uses but does not bind: the parameters an extracted function needs. */
export const freeLocals = (expr: Expr, analysis: Analysis): ReadonlyArray<string> => {
  const bound = boundWithin(expr);
  const result: string[] = [];
  for (const current of descendants(expr)) {
    if (current._tag !== "Symbol") continue;
    const { name } = current;
    if (
      bound.has(name) ||
      SPECIAL_FORMS.has(name) ||
      BUILTINS.has(name) ||
      analysis.definitions.has(name) ||
      name === "&" ||
      result.includes(name)
    ) {
      continue;
    }
    result.push(name);
  }
  return result;
};

const isSection = (node: Item): boolean => /^section\b/.test(node.text.trim());

/**
 * Moves an item into a new function, placed just above the definition or
 * top-level form it came from, and calls that function in its place.
 */
export const extract = (
  items: Items,
  id: string,
  name: string,
  analysis: Analysis,
  nextId: NextId,
): Readonly<{ items: Items; definitionId: string }> | undefined => {
  const node = find(items, id);
  const expr = analysis.program.exprs.get(id);
  // The outermost enclosing form that is not a section heading.
  const container = ancestors(items, id).find((ancestor) => !isSection(find(items, ancestor)!));
  if (node === undefined || expr === undefined || container === undefined) return undefined;
  if (analysis.definitions.has(name) || /[\s()[\]{}";']/.test(name) || name === "") {
    return undefined;
  }
  const params = freeLocals(expr, analysis);
  const call = item(nextId(), params.length === 0 ? `(${name})` : `${name} ${params.join(" ")}`);
  const location = locate(items, id)!;
  let next = removeItems(items, [id]).items;
  next = insertItems(next, location.parentId, location.index, [call]) ?? next;
  const definitionId = nextId();
  const definition = item(definitionId, `defn ${name} [${params.join(" ")}]`, [node]);
  const at = locate(next, container)!;
  next = insertItems(next, at.parentId, at.index, [definition]) ?? next;
  return { items: next, definitionId };
};

/** Inserts new leaf items before an item, inside a new form with the item. */
export const precede = (
  items: Items,
  id: string,
  head: string,
  first: string,
  nextId: NextId,
): Items | undefined => {
  const node = find(items, id);
  const location = locate(items, id);
  if (node === undefined || location === undefined) return undefined;
  const without = removeItems(items, [id]).items;
  const wrapper = item(nextId(), head, [item(nextId(), first), node]);
  return insertItems(without, location.parentId, location.index, [wrapper]);
};

/** Replaces `sequence` and `parallel` forms that hold a single item with that item. */
export const simplify = (items: Items): Items => {
  const visit = (nodes: Items): Items => {
    let changed = false;
    const next = nodes.map((node) => {
      const children = visit(node.children);
      const trivial =
        (node.text.trim() === "sequence" || node.text.trim() === "parallel") &&
        children.length === 1;
      if (trivial) {
        changed = true;
        return children[0]!;
      }
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : nodes;
  };
  return visit(items);
};

/** Moves an item to be the first child of `parentId`. */
export const moveToStart = (
  items: Items,
  id: string,
  parentId: string | null,
): Items | undefined => {
  const node = find(items, id);
  if (node === undefined || childrenOf(items, parentId) === undefined) return undefined;
  return insertItems(removeItems(items, [id]).items, parentId, 0, [node]);
};
