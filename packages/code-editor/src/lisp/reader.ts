/**
 * A tolerant reader for Clojure-flavored Lisp source. It never throws: unclosed
 * collections run to the end of the text and stray closers become problems.
 * Every form keeps its UTF-16 source range, so editing commands can work on
 * structure while the document remains plain text.
 */
export type FormKind =
  | "list"
  | "vector"
  | "map"
  | "set"
  | "symbol"
  | "keyword"
  | "number"
  | "string"
  | "regex"
  | "char"
  | "prefix";

export type Form = Readonly<{
  kind: FormKind;
  from: number;
  to: number;
  /** Opening delimiter or reader-macro prefix length, such as 1 for "(" and 2 for "#{". */
  open: number;
  /** Collections and strings are closed unless the text ended first. */
  closed: boolean;
  children: readonly Form[];
}>;

export type ReadProblem = Readonly<{ from: number; to: number; message: string }>;
export type ReadResult = Readonly<{ forms: readonly Form[]; problems: readonly ReadProblem[] }>;

export const lispLanguages: ReadonlySet<string> = new Set([
  "clojure",
  "clojurescript",
  "edn",
  "lisp",
  "scheme",
]);
export const isLisp = (languageId: string): boolean => lispLanguages.has(languageId);

const closers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const collectionKind: Record<string, FormKind> = { "(": "list", "[": "vector", "{": "map" };
const isWhitespace = (character: string) => /[\s,]/.test(character);
const isDelimiter = (character: string) => /[\s,()[\]{}";]/.test(character);
const prefixes = ["#'", "#_", "~@", "'", "`", "~", "@", "^"];

let memo: Readonly<{ text: string; result: ReadResult }> | undefined;

/** Reads every top-level form. The last result is memoized because views and commands reread often. */
export const read = (text: string): ReadResult => {
  if (memo?.text === text) return memo.result;
  const problems: ReadProblem[] = [];
  let i = 0;

  const skip = () => {
    while (i < text.length) {
      if (isWhitespace(text[i]!)) i++;
      else if (text[i] === ";") {
        const end = text.indexOf("\n", i);
        i = end < 0 ? text.length : end + 1;
      } else break;
    }
  };

  const quoted = (from: number, open: number, kind: FormKind): Form => {
    i = from + open;
    while (i < text.length) {
      if (text[i] === "\\") i += 2;
      else if (text[i++] === '"') return { kind, from, to: i, open, closed: true, children: [] };
    }
    i = text.length;
    problems.push({ from, to: from + open, message: "This string is never closed." });
    return { kind, from, to: i, open, closed: false, children: [] };
  };

  const collection = (from: number, open: number, opener: string, kind: FormKind): Form => {
    i = from + open;
    const closer = closers[opener]!;
    const children: Form[] = [];
    for (;;) {
      skip();
      if (i >= text.length) {
        problems.push({ from, to: from + open, message: `Missing ${closer} for this ${kind}.` });
        return { kind, from, to: text.length, open, closed: false, children };
      }
      const character = text[i]!;
      if (character === closer) {
        i++;
        return { kind, from, to: i, open, closed: true, children };
      }
      if (character === ")" || character === "]" || character === "}") {
        // A mismatched closer ends this collection, unclosed, so the outer form can recover.
        problems.push({
          from: i,
          to: i + 1,
          message: `Expected ${closer} but found ${character}.`,
        });
        i++;
        return { kind, from, to: i, open, closed: false, children };
      }
      children.push(form());
    }
  };

  const atom = (from: number): Form => {
    if (text[i] === "\\") i += 2; // A character literal may name a delimiter, as in \( or \space.
    while (i < text.length && !isDelimiter(text[i]!)) i++;
    const token = text.slice(from, i);
    const kind: FormKind = token.startsWith("\\")
      ? "char"
      : token.startsWith(":")
        ? "keyword"
        : /^[+-]?\d/.test(token)
          ? "number"
          : "symbol";
    return { kind, from, to: i, open: 0, closed: true, children: [] };
  };

  const form = (): Form => {
    const from = i;
    const character = text[i]!;
    if (character === "(" || character === "[" || character === "{")
      return collection(from, 1, character, collectionKind[character]!);
    if (text.startsWith("#{", i)) return collection(from, 2, "{", "set");
    if (text.startsWith("#(", i)) return collection(from, 2, "(", "list");
    if (character === '"') return quoted(from, 1, "string");
    if (text.startsWith('#"', i)) return quoted(from, 2, "regex");
    const prefix = prefixes.find((candidate) => text.startsWith(candidate, i));
    if (prefix) {
      i += prefix.length;
      skip();
      if (i >= text.length || /[)\]}]/.test(text[i]!)) {
        problems.push({
          from,
          to: from + prefix.length,
          message: `${prefix} needs a form after it.`,
        });
        return {
          kind: "prefix",
          from,
          to: from + prefix.length,
          open: prefix.length,
          closed: false,
          children: [],
        };
      }
      const child = form();
      return {
        kind: "prefix",
        from,
        to: child.to,
        open: prefix.length,
        closed: true,
        children: [child],
      };
    }
    return atom(from);
  };

  const forms: Form[] = [];
  for (;;) {
    skip();
    if (i >= text.length) break;
    if (/[)\]}]/.test(text[i]!)) {
      problems.push({ from: i, to: i + 1, message: `Unexpected ${text[i]}.` });
      i++;
      continue;
    }
    forms.push(form());
  }
  const result = { forms, problems };
  memo = { text, result };
  return result;
};

export const isCollection = (form: Form): boolean =>
  form.kind === "list" || form.kind === "vector" || form.kind === "map" || form.kind === "set";

/** The offsets between a collection's delimiters. */
export const interior = (form: Form): Readonly<{ from: number; to: number }> => ({
  from: form.from + form.open,
  to: form.closed && isCollection(form) ? form.to - 1 : form.to,
});

/** Forms whose range contains the offset, from the top level inward. Boundaries count as inside. */
export const path = (forms: readonly Form[], offset: number): readonly Form[] => {
  const result: Form[] = [];
  let level = forms;
  for (;;) {
    const next = level.find((form) => form.from <= offset && offset <= form.to);
    if (!next) return result;
    result.push(next);
    level = next.children;
  }
};

/** The innermost collection whose interior holds the offset. */
export const enclosing = (forms: readonly Form[], offset: number): Form | undefined =>
  [...path(forms, offset)]
    .reverse()
    .find(
      (form) => isCollection(form) && interior(form).from <= offset && offset <= interior(form).to,
    );

/** The children of the collection around an offset, or the top-level forms outside every collection. */
export const siblings = (
  forms: readonly Form[],
  offset: number,
): Readonly<{
  parent: Form | undefined;
  children: readonly Form[];
}> => {
  const parent = enclosing(forms, offset);
  return { parent, children: parent ? parent.children : forms };
};

/**
 * The form a REPL should evaluate for the cursor: the top-level form, except
 * that forms inside a top-level `(comment …)` block are evaluated on their own.
 */
export const evaluationTarget = (text: string, offset: number): Form | undefined => {
  const { forms } = read(text);
  const top =
    forms.find((form) => form.from <= offset && offset <= form.to) ??
    [...forms].reverse().find((form) => form.to <= offset);
  if (!top) return undefined;
  if (isCommentBlock(text, top)) {
    const inner = top.children.slice(1).find((form) => form.from <= offset && offset <= form.to);
    return inner ?? top;
  }
  return top;
};

export const headSymbol = (text: string, form: Form): string | undefined => {
  const head = form.kind === "list" ? form.children[0] : undefined;
  return head?.kind === "symbol" ? text.slice(head.from, head.to) : undefined;
};

export const isCommentBlock = (text: string, form: Form): boolean =>
  headSymbol(text, form) === "comment";
