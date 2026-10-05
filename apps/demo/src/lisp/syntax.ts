// A small Clojure-flavored Lisp: lists, vectors, maps, keywords, strings,
// numbers, quote, and `;` comments. Every expression carries an id and its
// span in the text it was read from.

export type Span = Readonly<{ start: number; end: number }>;

export type Expr =
  | Readonly<{ _tag: "List" | "Vector" | "Map"; id: string; items: ReadonlyArray<Expr> } & Span>
  | Readonly<{ _tag: "Symbol"; id: string; name: string } & Span>
  | Readonly<{ _tag: "Keyword"; id: string; name: string } & Span>
  | Readonly<{ _tag: "Number"; id: string; value: number } & Span>
  | Readonly<{ _tag: "String"; id: string; value: string } & Span>
  | Readonly<{ _tag: "Comment"; id: string; text: string } & Span>;

export type Collection = Extract<Expr, { _tag: "List" | "Vector" | "Map" }>;

export type TokenKind =
  | "Space"
  | "Open"
  | "Close"
  | "Quote"
  | "String"
  | "Number"
  | "Keyword"
  | "Symbol"
  | "Comment"
  | "Error";

export type Token = Readonly<{ kind: TokenKind; text: string } & Span>;

const DELIMITER = /[\s()[\]{}";']/;
const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

const OPENERS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

/** Splits text into tokens that cover it exactly, so highlighting can paint every character. */
export const tokenize = (text: string): ReadonlyArray<Token> => {
  const tokens: Token[] = [];
  let at = 0;
  const push = (kind: TokenKind, end: number) => {
    tokens.push({ kind, text: text.slice(at, end), start: at, end });
    at = end;
  };
  while (at < text.length) {
    const character = text[at]!;
    if (/\s|,/.test(character)) {
      let end = at + 1;
      while (end < text.length && /\s|,/.test(text[end]!)) end += 1;
      push("Space", end);
    } else if (character in OPENERS) {
      push("Open", at + 1);
    } else if (character === ")" || character === "]" || character === "}") {
      push("Close", at + 1);
    } else if (character === "'") {
      push("Quote", at + 1);
    } else if (character === ";") {
      const newline = text.indexOf("\n", at);
      push("Comment", newline < 0 ? text.length : newline);
    } else if (character === '"') {
      let end = at + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      push(end < text.length ? "String" : "Error", Math.min(end + 1, text.length));
    } else {
      let end = at + 1;
      while (end < text.length && !DELIMITER.test(text[end]!)) end += 1;
      const word = text.slice(at, end);
      push(word.startsWith(":") ? "Keyword" : NUMBER.test(word) ? "Number" : "Symbol", end);
    }
  }
  return tokens;
};

export class ReadError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
  }
}

const unescape = (literal: string): string =>
  literal
    .slice(1, -1)
    .replace(/\\(.)/g, (_, escaped: string) =>
      escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped,
    );

/**
 * Reads every expression in `text`. Ids are `prefix` plus a counter, so
 * expressions read from the same source get stable ids. Comments are kept
 * as expressions when `comments` is true.
 */
export const read = (
  text: string,
  options: Readonly<{ prefix?: string; comments?: boolean }> = {},
): ReadonlyArray<Expr> => {
  const tokens = tokenize(text).filter(
    (token) => token.kind !== "Space" && (options.comments === true || token.kind !== "Comment"),
  );
  const prefix = options.prefix ?? "x";
  let counter = 0;
  let position = 0;
  const nextId = () => `${prefix}${counter++}`;

  const readOne = (): Expr => {
    const token = tokens[position];
    if (token === undefined) throw new ReadError("Unexpected end of input", text.length);
    position += 1;
    switch (token.kind) {
      case "Open": {
        const id = nextId();
        const close = OPENERS[token.text]!;
        const items: Expr[] = [];
        for (;;) {
          const next = tokens[position];
          if (next === undefined) throw new ReadError(`Missing ${close}`, token.start);
          if (next.kind === "Close") {
            if (next.text !== close) throw new ReadError(`Expected ${close}`, next.start);
            position += 1;
            const tag = token.text === "(" ? "List" : token.text === "[" ? "Vector" : "Map";
            return { _tag: tag, id, items, start: token.start, end: next.end };
          }
          items.push(readOne());
        }
      }
      case "Close":
        throw new ReadError(`Unexpected ${token.text}`, token.start);
      case "Quote": {
        const id = nextId();
        const quoted = readOne();
        const symbol: Expr = {
          _tag: "Symbol",
          id: nextId(),
          name: "quote",
          start: token.start,
          end: token.end,
        };
        return { _tag: "List", id, items: [symbol, quoted], start: token.start, end: quoted.end };
      }
      case "String":
        return {
          _tag: "String",
          id: nextId(),
          value: unescape(token.text),
          start: token.start,
          end: token.end,
        };
      case "Number":
        return {
          _tag: "Number",
          id: nextId(),
          value: Number(token.text),
          start: token.start,
          end: token.end,
        };
      case "Keyword":
        return {
          _tag: "Keyword",
          id: nextId(),
          name: token.text.slice(1),
          start: token.start,
          end: token.end,
        };
      case "Symbol":
        return {
          _tag: "Symbol",
          id: nextId(),
          name: token.text,
          start: token.start,
          end: token.end,
        };
      case "Comment":
        return {
          _tag: "Comment",
          id: nextId(),
          text: token.text,
          start: token.start,
          end: token.end,
        };
      case "Error":
        throw new ReadError("Unterminated string", token.start);
      case "Space":
        return readOne();
    }
  };

  const exprs: Expr[] = [];
  while (position < tokens.length) exprs.push(readOne());
  return exprs;
};

export const isCollection = (expr: Expr): expr is Collection =>
  expr._tag === "List" || expr._tag === "Vector" || expr._tag === "Map";

/** Expressions with comments removed, for evaluation. */
export const code = (items: ReadonlyArray<Expr>): ReadonlyArray<Expr> =>
  items.filter((item) => item._tag !== "Comment");

const quoteString = (value: string): string =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

/** Prints an expression on one line. */
export const print = (expr: Expr): string => {
  switch (expr._tag) {
    case "List":
      return `(${expr.items.map(print).join(" ")})`;
    case "Vector":
      return `[${expr.items.map(print).join(" ")}]`;
    case "Map":
      return `{${expr.items.map(print).join(" ")}}`;
    case "Symbol":
      return expr.name;
    case "Keyword":
      return `:${expr.name}`;
    case "Number":
      return String(expr.value);
    case "String":
      return quoteString(expr.value);
    case "Comment":
      return expr.text;
  }
};

/** Every expression in a tree, parents before children. */
export const descendants = (expr: Expr): ReadonlyArray<Expr> =>
  isCollection(expr) ? [expr, ...expr.items.flatMap(descendants)] : [expr];
