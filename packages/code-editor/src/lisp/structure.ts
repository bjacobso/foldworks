import type { Selection, TextEdit } from "../document";
import type { EditPlan } from "../native/operations";
import {
  enclosing,
  headSymbol,
  interior,
  isCollection,
  path,
  read,
  siblings,
  type Form,
} from "./reader";

/** Structural commands. Each one is an ordinary edit plan, so history and hosts see plain text edits. */
export const StructuralActions = [
  "expandSelection",
  "contractSelection",
  "forwardForm",
  "backwardForm",
  "slurp",
  "barf",
  "raise",
  "splice",
  "wrap",
] as const;
export type StructuralAction = (typeof StructuralActions)[number];

const bounds = (selection: Selection) => ({
  from: Math.min(selection.anchor, selection.head),
  to: Math.max(selection.anchor, selection.head),
});
const caret = (offset: number): Selection => ({ anchor: offset, head: offset });
const select = (from: number, to: number): Selection => ({ anchor: from, head: to });
const closerOf = (form: Form) => (form.kind === "vector" ? "]" : form.kind === "list" ? ")" : "}");
const shifted = (selection: Selection, edits: readonly TextEdit[]): Selection => {
  const map = (offset: number) => {
    let shift = 0;
    for (const edit of edits) {
      if (offset < edit.from) break;
      if (offset < edit.to) return edit.from + shift;
      shift += edit.insert.length - (edit.to - edit.from);
    }
    return offset + shift;
  };
  return { anchor: map(selection.anchor), head: map(selection.head) };
};

/** The smallest form at the cursor: the atom under it, or the form it touches. */
export const formAt = (text: string, offset: number): Form | undefined => {
  const chain = path(read(text).forms, offset);
  const last = chain.at(-1);
  if (!last) return undefined;
  // Inside a collection's interior but between children, there is no single form at the cursor.
  if (isCollection(last) && offset > last.from && offset < last.to) {
    const inner = interior(last);
    if (offset >= inner.from && offset <= inner.to) return undefined;
  }
  return last;
};

const expand = (text: string, selection: Selection): Selection | undefined => {
  const { from, to } = bounds(selection);
  const chain = path(read(text).forms, from);
  const candidates: { from: number; to: number }[] = [];
  for (const form of chain) {
    candidates.push({ from: form.from, to: form.to });
    if (isCollection(form)) candidates.push(interior(form));
  }
  const best = candidates
    .filter((range) => range.from <= from && range.to >= to && range.to - range.from > to - from)
    .sort((a, b) => a.to - a.from - (b.to - b.from))[0];
  return best ? select(best.from, best.to) : undefined;
};

const contract = (text: string, selection: Selection): Selection => {
  const { from, to } = bounds(selection);
  if (from === to) return selection;
  const target = [...path(read(text).forms, from)]
    .reverse()
    .find((form) => form.from === from && form.to === to);
  if (target && isCollection(target)) {
    const inner = interior(target);
    return inner.to > inner.from ? select(inner.from, inner.to) : caret(inner.from);
  }
  const parent = enclosing(read(text).forms, from);
  if (parent && interior(parent).from === from && interior(parent).to === to) {
    const child =
      parent.children.find((form) => form.from <= selection.head && selection.head <= form.to) ??
      parent.children[0];
    if (child) return select(child.from, child.to);
  }
  return caret(selection.head);
};

const forward = (text: string, offset: number): Selection => {
  const { parent, children } = siblings(read(text).forms, offset);
  const next = children.find((form) => form.to > offset);
  if (next) return caret(next.to);
  return caret(parent ? parent.to : text.length);
};

const backward = (text: string, offset: number): Selection => {
  const { parent, children } = siblings(read(text).forms, offset);
  const previous = [...children].reverse().find((form) => form.from < offset);
  if (previous) return caret(previous.from);
  return caret(parent ? parent.from : 0);
};

/** Pull the next sibling into the collection around the cursor: (a |b) c → (a |b c). */
const slurp = (text: string, selection: Selection): EditPlan | undefined => {
  const forms = read(text).forms;
  for (let list = enclosing(forms, selection.head); list; list = enclosing(forms, list.from)) {
    if (!list.closed) return undefined;
    const outer = siblings(forms, list.from).children;
    const next = outer.find((form) => form.from >= list!.to);
    if (!next) continue;
    const closer = closerOf(list);
    const removeFrom = list.children.length ? list.to - 1 : interior(list).from;
    const edits = list.children.length
      ? [
          { from: removeFrom, to: list.to, insert: "" },
          { from: next.to, to: next.to, insert: closer },
        ]
      : [
          { from: removeFrom, to: next.from, insert: "" },
          { from: next.to, to: next.to, insert: closer },
        ];
    return { edits, selection: shifted(selection, edits) };
  }
  return undefined;
};

/** Push the last child out of the collection around the cursor: (a |b c) → (a |b) c. */
const barf = (text: string, selection: Selection): EditPlan | undefined => {
  const list = enclosing(read(text).forms, selection.head);
  const last = list?.children.at(-1);
  if (!list || !list.closed || !last) return undefined;
  const previous = list.children.at(-2);
  const at = previous ? previous.to : interior(list).from;
  const edits = [
    { from: at, to: at, insert: closerOf(list) },
    { from: list.to - 1, to: list.to, insert: "" },
  ];
  // A cursor in the barfed form leaves with it; one before it stays inside.
  return {
    edits,
    selection: selection.head <= at ? caret(selection.head) : shifted(caret(selection.head), edits),
  };
};

/** Replace the enclosing collection with the form at the cursor: (f (g |x) y) → (f |x y). */
const raise = (text: string, selection: Selection): EditPlan | undefined => {
  const forms = read(text).forms;
  const { from, to } = bounds(selection);
  const target =
    from !== to
      ? [...path(forms, from)].reverse().find((form) => form.from === from && form.to === to)
      : (formAt(text, from) ?? siblings(forms, from).children.find((form) => form.from >= from));
  const owner = target && enclosing(forms, target.from);
  if (!target || !owner) return undefined;
  const replacement = text.slice(target.from, target.to);
  return {
    edits: [{ from: owner.from, to: owner.to, insert: replacement }],
    selection:
      from !== to
        ? select(owner.from, owner.from + replacement.length)
        : caret(
            owner.from + Math.max(0, Math.min(replacement.length, selection.head - target.from)),
          ),
  };
};

/** Remove the delimiters around the cursor: (a (b |c) d) → (a b |c d). */
const splice = (text: string, selection: Selection): EditPlan | undefined => {
  const list = enclosing(read(text).forms, selection.head);
  if (!list || !list.closed) return undefined;
  const edits = [
    { from: list.from, to: list.from + list.open, insert: "" },
    { from: list.to - 1, to: list.to, insert: "" },
  ];
  return { edits, selection: shifted(selection, edits) };
};

/** Wrap the form at the cursor (or the selection) in a new list and put the cursor at its head. */
const wrap = (text: string, selection: Selection): EditPlan | undefined => {
  let { from, to } = bounds(selection);
  if (from === to) {
    const target =
      formAt(text, from) ??
      siblings(read(text).forms, from).children.find((form) => form.from >= from);
    if (!target) return { edits: [{ from, to, insert: "()" }], selection: caret(from + 1) };
    ({ from, to } = target);
  }
  return {
    edits: [
      { from, to: from, insert: "( " },
      { from: to, to, insert: ")" },
    ],
    selection: caret(from + 1),
  };
};

export const structuralPlan = (
  text: string,
  selection: Selection,
  action: StructuralAction,
): EditPlan | undefined => {
  switch (action) {
    case "expandSelection": {
      const next = expand(text, selection);
      return next && { edits: [], selection: next };
    }
    case "contractSelection":
      return { edits: [], selection: contract(text, selection) };
    case "forwardForm":
      return { edits: [], selection: forward(text, bounds(selection).to) };
    case "backwardForm":
      return { edits: [], selection: backward(text, bounds(selection).from) };
    case "slurp":
      return slurp(text, selection);
    case "barf":
      return barf(text, selection);
    case "raise":
      return raise(text, selection);
    case "splice":
      return splice(text, selection);
    case "wrap":
      return wrap(text, selection);
  }
};

const inString = (text: string, offset: number) =>
  path(read(text).forms, offset).some(
    (form) =>
      (form.kind === "string" || form.kind === "regex") &&
      offset > form.from + form.open - 1 &&
      offset < form.to,
  );

/** Typing any closer moves past the end of the enclosing collection, dropping trailing whitespace. */
export const closePlan = (text: string, selection: Selection): EditPlan | undefined => {
  const { from, to } = bounds(selection);
  if (from !== to || inString(text, from)) return undefined;
  const list = enclosing(read(text).forms, from);
  if (!list || !list.closed) return undefined;
  const closerAt = list.to - 1;
  const gap = text.slice(from, closerAt);
  if (gap.trim() === "") {
    const start = from - /[ \t]*$/.exec(text.slice(interior(list).from, from))![0].length;
    const edits = start < closerAt ? [{ from: start, to: closerAt, insert: "" }] : [];
    return { edits, selection: caret(list.to - (closerAt - start)) };
  }
  return { edits: [], selection: caret(list.to) };
};

/**
 * Deletion keeps delimiters balanced: an empty pair is deleted together, and a
 * delimiter of a nonempty collection or string is stepped over instead.
 */
export const deletePlan = (
  text: string,
  selection: Selection,
  direction: "backward" | "forward",
): EditPlan | undefined => {
  if (selection.anchor !== selection.head) return undefined;
  const offset = selection.head;
  const at = direction === "backward" ? offset - 1 : offset;
  if (at < 0 || at >= text.length || !/[()[\]{}"]/.test(text[at]!)) return undefined;
  const form = [...path(read(text).forms, at)]
    .reverse()
    .find(
      (candidate) =>
        (isCollection(candidate) || candidate.kind === "string" || candidate.kind === "regex") &&
        (at < candidate.from + candidate.open || (candidate.closed && at === candidate.to - 1)),
    );
  if (!form) return undefined;
  if (!form.closed) return undefined;
  const inner = interior(form);
  const empty =
    form.kind === "string" || form.kind === "regex"
      ? form.to - form.from === form.open + 1
      : inner.from === inner.to;
  if (empty)
    return { edits: [{ from: form.from, to: form.to, insert: "" }], selection: caret(form.from) };
  // Step over the delimiter, into or out of the form, without deleting it.
  return { edits: [], selection: caret(direction === "backward" ? offset - 1 : offset + 1) };
};

const bodyForms = new Set(
  "def defn defn- defmacro defmulti defmethod defprotocol defrecord deftype defonce fn fn* let letfn loop when when-not when-let when-some if-let if-some binding doseq dotimes for while ns comment do try catch finally case cond condp locking future with-open with-redefs reify extend-type extend-protocol proxy lambda define".split(
    " ",
  ),
);

const column = (text: string, offset: number) => offset - text.lastIndexOf("\n", offset - 1) - 1;
const lineOf = (text: string, offset: number) => text.slice(0, offset).split("\n").length - 1;

/**
 * Clojure-style indentation for a line that starts at `offset`: bodies indent two
 * spaces, call arguments align with the first argument, and data aligns with its
 * first element. `columnAt` lets a reindent pass account for lines it already moved.
 */
export const indentationAt = (
  text: string,
  offset: number,
  columnAt: (offset: number) => number = (at) => column(text, at),
): number => {
  const list = enclosing(read(text).forms, offset);
  if (!list) return 0;
  const start = columnAt(list.from);
  if (list.kind !== "list") return start + list.open;
  const head = list.children[0];
  if (!head || head.from >= offset) return start + list.open;
  const name = headSymbol(text, list);
  if (name !== undefined && (bodyForms.has(name) || /^(def|with-|when-|if-)/.test(name)))
    return start + 2;
  const argument = list.children[1];
  if (argument && argument.from < offset && lineOf(text, argument.from) === lineOf(text, head.from))
    return columnAt(argument.from);
  return start + list.open;
};

/** Enter splits the line and indents the new line for its enclosing form. */
export const newlinePlan = (text: string, selection: Selection): EditPlan => {
  const { from, to } = bounds(selection);
  const lineStart = text.lastIndexOf("\n", from - 1) + 1;
  const trailing = /[ \t]*$/.exec(text.slice(lineStart, from))![0].length;
  const leading = /^[ \t]*/.exec(text.slice(to))![0].length;
  const start = from - trailing;
  const probe = `${text.slice(0, start)}\n${text.slice(to + leading)}`;
  const indent = " ".repeat(indentationAt(probe, start + 1));
  return {
    edits: [{ from: start, to: to + leading, insert: `\n${indent}` }],
    selection: caret(start + 1 + indent.length),
  };
};

/** Reindents every line outside strings. One read serves the whole pass. */
export const reindentPlan = (text: string, selection: Selection): EditPlan => {
  const lines = text.split("\n");
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + 1;
  }
  const delta: number[] = lines.map(() => 0);
  const edits: TextEdit[] = [];
  const columnAt = (offset: number) => {
    const line = lineOf(text, offset);
    return column(text, offset) + delta[line]!;
  };
  for (let index = 1; index < lines.length; index++) {
    const start = starts[index]!;
    const current = /^[ \t]*/.exec(lines[index]!)![0].length;
    if (inString(text, start) || lines[index]!.trim() === "") continue;
    const wanted = indentationAt(text, start + current, columnAt);
    delta[index] = wanted - current;
    if (wanted !== current)
      edits.push({ from: start, to: start + current, insert: " ".repeat(wanted) });
  }
  return { edits, selection: shifted(selection, edits) };
};
