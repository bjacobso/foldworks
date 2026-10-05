// The outline is the program. Each item is one form, written the way an
// indentation-sensitive Lisp (in the style of SRFI 119, "wisp") writes it:
//
//   defn invoice-total [revenue]        (defn invoice-total [revenue]
//     let [tax (* revenue tax-rate)]  =   (let [tax (* revenue tax-rate)]
//       + revenue tax                       (+ revenue tax)))
//
// An item's text holds the leading elements of its list and its children
// hold the rest. A childless item with one element is that element itself,
// so `(f)` must keep its parentheses. Text starting with `;` is a comment and
// comments out the item's children too.
//
// The source view prints the outline line for line, so both directions keep
// the author's layout.

import { item, walk, type Item, type Items } from "@foldworks/outliner";

import { ReadError, read, tokenize, type Expr } from "./syntax";

/** The item that owns an expression. Inline expressions are `<item id>#<n>`. */
export const itemOf = (exprId: string): string => exprId.split("#")[0]!;

export const isComment = (text: string): boolean => text.trimStart().startsWith(";");

export type Program = Readonly<{
  forms: ReadonlyArray<Expr>;
  /** Syntax errors by item id. */
  errors: ReadonlyMap<string, string>;
  /** Where each syntax error was found in its item's text. */
  errorOffsets: ReadonlyMap<string, number>;
  /** Every item-level expression by item id. */
  exprs: ReadonlyMap<string, Expr>;
  /** Parent item id by item id, for items that are code. */
  parents: ReadonlyMap<string, string | null>;
}>;

const withId = (expr: Expr, id: string): Expr => ({ ...expr, id });

/** Reads the outline as a program. Items with syntax errors are left out and reported. */
export const readOutline = (items: Items): Program => {
  const errors = new Map<string, string>();
  const errorOffsets = new Map<string, number>();
  const exprs = new Map<string, Expr>();
  const parents = new Map<string, string | null>();

  const readItem = (node: Item, parentId: string | null): Expr | null => {
    parents.set(node.id, parentId);
    if (isComment(node.text)) {
      const comment: Expr = {
        _tag: "Comment",
        id: node.id,
        text: node.text.trim(),
        start: 0,
        end: node.text.length,
      };
      exprs.set(node.id, comment);
      return comment;
    }
    let parts: ReadonlyArray<Expr>;
    try {
      parts = read(node.text, { prefix: `${node.id}#` });
    } catch (error) {
      errors.set(node.id, error instanceof ReadError ? error.message : String(error));
      errorOffsets.set(node.id, error instanceof ReadError ? error.at : 0);
      parts = [];
    }
    const children = node.children
      .map((child) => readItem(child, node.id))
      .filter((child) => child !== null);
    if (errors.has(node.id)) return null;
    let expr: Expr | null;
    if (children.length === 0 && parts.length <= 1) {
      expr = parts[0] === undefined ? null : withId(parts[0], node.id);
    } else {
      expr = {
        _tag: "List",
        id: node.id,
        items: [...parts, ...children],
        start: 0,
        end: node.text.length,
      };
    }
    if (expr !== null) exprs.set(node.id, expr);
    return expr;
  };

  const forms = items.map((node) => readItem(node, null)).filter((form) => form !== null);
  return { forms, errors, errorOffsets, exprs, parents };
};

/** The number of top-level expressions in a line of text, or `undefined` if it does not read. */
export const elementCount = (text: string): number | undefined => {
  try {
    return read(text).length;
  } catch {
    return undefined;
  }
};

const endsInComment = (line: string): boolean =>
  tokenize(line).some((token) => token.kind === "Comment");

export type Source = Readonly<{
  text: string;
  /** The item that each line of `text` begins, or `null` for a closing line. */
  lines: ReadonlyArray<string | null>;
}>;

/** Prints the outline as Lisp, one line per item. */
export const printOutline = (items: Items): Source => {
  const lines: Array<{ text: string; id: string | null }> = [];
  const close = (from: number) => {
    const last = lines[lines.length - 1];
    if (last === undefined || lines.length === from) return;
    if (endsInComment(last.text)) {
      const indent = /^\s*/.exec(lines[from]!.text)?.[0] ?? "";
      lines.push({ text: `${indent})`, id: null });
    } else {
      last.text += ")";
    }
  };
  const visit = (node: Item, indent: string, commented: boolean) => {
    const text = node.text.trim();
    if (commented || isComment(text)) {
      const body = isComment(text) || text === "" ? text : `; ${text}`;
      if (body !== "") lines.push({ text: `${indent}${body}`, id: node.id });
      for (const child of node.children) visit(child, `${indent}  `, true);
      return;
    }
    const count = elementCount(text) ?? 1;
    if (node.children.length === 0) {
      if (count === 0) return;
      lines.push({ text: `${indent}${count >= 2 ? `(${text})` : text}`, id: node.id });
      return;
    }
    const from = lines.length;
    lines.push({ text: `${indent}(${text}`, id: node.id });
    for (const child of node.children) visit(child, `${indent}  `, false);
    close(from);
  };
  for (const node of items) visit(node, "", false);
  return { text: lines.map((line) => line.text).join("\n"), lines: lines.map((line) => line.id) };
};

/** Makes ids in the outliner's `<prefix>-<n>` scheme that are unused in `items`. */
export const idSource = (prefix: string, items: Items): (() => string) => {
  let counter =
    walk(items).reduce((highest, node) => {
      const suffix = node.id.startsWith(`${prefix}-`)
        ? Number(node.id.slice(prefix.length + 1))
        : NaN;
      return Number.isSafeInteger(suffix) ? Math.max(highest, suffix) : highest;
    }, 0) + 1;
  return () => `${prefix}-${counter++}`;
};

/**
 * Reads Lisp source back into an outline, keeping its line structure: the
 * elements of a list that sit on its opening line become the item's text,
 * and the rest become children. Items at the same position as an item in
 * `previous` keep its id and folding. Throws `ReadError` when the source
 * does not read.
 */
export const parseSource = (source: string, previous: Items, nextId: () => string): Items => {
  const exprs = read(source, { comments: true });
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") lineStarts.push(index + 1);
  }
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle]! <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  };
  const slice = (from: Expr, to: Expr) => source.slice(from.start, to.end);

  const build = (expr: Expr, prior: Item | undefined): Item => {
    const make = (text: string, children: ReadonlyArray<Expr> = []): Item => {
      const built = children.map((child, index) => build(child, prior?.children[index]));
      return item(prior?.id ?? nextId(), text, built, {
        collapsed: built.length > 0 && (prior?.collapsed ?? false),
        checked: prior?.checked ?? false,
      });
    };
    if (expr._tag === "Comment") return make(expr.text);
    if (expr._tag === "List" && lineOf(expr.start) !== lineOf(expr.end - 1)) {
      const line = lineOf(expr.start);
      let split = 0;
      while (
        split < expr.items.length &&
        expr.items[split]!._tag !== "Comment" &&
        lineOf(expr.items[split]!.end - 1) === line
      ) {
        split += 1;
      }
      const header = expr.items.slice(0, split);
      const rest = expr.items.slice(split);
      if (rest.length > 0) {
        return make(header.length === 0 ? "" : slice(header[0]!, header.at(-1)!), rest);
      }
    }
    if (expr._tag === "List" && expr.items.length >= 2) {
      return make(slice(expr.items[0]!, expr.items.at(-1)!));
    }
    return make(source.slice(expr.start, expr.end));
  };

  return exprs.map((expr, index) => build(expr, previous[index]));
};
