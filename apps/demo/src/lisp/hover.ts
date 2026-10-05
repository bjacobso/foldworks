import { find, type Items } from "@foldworks/outliner";

import { documentation, type Analysis } from "./analysis";
import { isComment, itemOf } from "./codec";
import { DOCS, type Doc } from "./docs";
import { BUILTINS, SPECIAL_FORMS, isFlow, isStep, show, type Value } from "./evaluate";
import { tokenize, type Token } from "./syntax";

/** What hovering a token says: what it is, its documentation, and its last value. */
export type Description = Readonly<{
  from: number;
  to: number;
  /** What the token is, such as "function" or "local". */
  kind: string;
  title: string;
  usage?: string;
  summary?: string;
  /** The type and value the expression last had. */
  value?: Readonly<{ type: string; text: string; count: number }>;
  facts?: ReadonlyArray<readonly [string, string]>;
}>;

const MEANINGFUL: ReadonlySet<Token["kind"]> = new Set(["Symbol", "Keyword", "Number", "String"]);

/** The token under an offset. From the keyboard, the caret may also sit just after it. */
const tokenAt = (text: string, offset: number, lenient: boolean): Token | undefined => {
  const tokens = tokenize(text).filter((token) => MEANINGFUL.has(token.kind));
  return (
    tokens.find((token) => token.start <= offset && offset < token.end) ??
    (lenient ? tokens.find((token) => token.end === offset) : undefined)
  );
};

/** A plain name for a value's type. */
export const typeOf = (value: Value): string => {
  if (value === null) return "nil";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (isStep(value)) return "step";
  if (isFlow(value)) return "flow";
  switch (value._tag) {
    case "Keyword":
      return "keyword";
    case "Sym":
      return "symbol";
    case "List":
      return `list of ${value.items.length}`;
    case "Vector":
      return `vector of ${value.items.length}`;
    case "Map":
      return `map of ${value.entries.length}`;
    case "Fn":
      return "function";
  }
};

/** Describes the token at an offset of an item's text, or `undefined` when there is none. */
export const describeAt = (
  items: Items,
  analysis: Analysis,
  id: string,
  offset: number,
  lenient = false,
): Description | undefined => {
  const node = find(items, id);
  if (node === undefined || isComment(node.text)) return undefined;
  const token = tokenAt(node.text, offset, lenient);
  if (token === undefined) return undefined;
  const range = { from: token.start, to: token.end };
  const expr = [...analysis.allExprs.values()].find(
    (candidate) =>
      itemOf(candidate.id) === id && candidate.start === token.start && candidate.end === token.end,
  );
  const observed = expr === undefined ? undefined : analysis.evaluation.values.get(expr.id);
  const value =
    observed === undefined
      ? undefined
      : { type: typeOf(observed.value), text: show(observed.value, 160), count: observed.count };
  const withValue = value === undefined ? {} : { value };
  switch (token.kind) {
    case "Number":
      return { ...range, kind: "number", title: token.text };
    case "String":
      return { ...range, kind: "string", title: token.text };
    case "Keyword": {
      const name = token.text.slice(1);
      const writers = analysis.steps.filter((step) => step.writes.includes(name));
      const readers = analysis.steps.filter((step) => step.reads.includes(name));
      return {
        ...range,
        kind: "keyword",
        title: token.text,
        facts: [
          ["Written by", writers.map((step) => step.name).join(", ") || "no step"],
          ["Read by", readers.map((step) => step.name).join(", ") || "no step"],
        ],
      };
    }
    default:
      break;
  }
  const name = token.text;
  const definition = analysis.definitions.get(name);
  if (definition !== undefined) {
    const global = analysis.evaluation.globals.get(name);
    const doc = documentation(items, definition.itemId);
    const step = analysis.steps.find((candidate) => candidate.name === name);
    const kind =
      definition.kind === "defn"
        ? "function"
        : definition.kind === "defstep"
          ? "step"
          : definition.kind === "workflow"
            ? "workflow"
            : "definition";
    const usage =
      global !== undefined && typeof global === "object" && global !== null && global._tag === "Fn"
        ? `(${name}${global.params === "" ? "" : ` ${global.params.slice(1, -1)}`})`
        : undefined;
    const references = (analysis.references.get(name) ?? []).length;
    return {
      ...range,
      kind,
      title: name,
      ...(usage === undefined ? {} : { usage }),
      ...(doc === undefined ? {} : { summary: doc }),
      // A definition's own value; functions and steps are described by their usage and facts.
      ...(definition.kind === "def" && global !== undefined
        ? { value: { type: typeOf(global), text: show(global, 160), count: 1 } }
        : {}),
      facts: [
        ...(step === undefined
          ? []
          : ([
              ["System", step.system],
              ["Reads", step.reads.map((key) => `:${key}`).join(" ") || "nothing"],
              ["Writes", step.writes.map((key) => `:${key}`).join(" ") || "nothing"],
            ] as const)),
        ["Used", references === 1 ? "in 1 row" : `in ${references} rows`],
      ],
    };
  }
  const doc = DOCS.get(name);
  if (SPECIAL_FORMS.has(name)) {
    return { ...range, kind: "special form", title: name, ...docFields(doc) };
  }
  if (BUILTINS.has(name)) {
    return { ...range, kind: "built-in", title: name, ...docFields(doc) };
  }
  // A name that failed to resolve is explained by its diagnostic alone.
  if (expr !== undefined && analysis.evaluation.errorSites.get(id) === expr.id) return undefined;
  return { ...range, kind: "local", title: name, ...withValue };
};

const docFields = (doc: Doc | undefined) =>
  doc === undefined ? {} : { usage: doc.usage, summary: doc.summary };
