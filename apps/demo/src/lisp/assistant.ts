// A stand-in for a model. It turns a request about the selected items into
// a structural edit, never a text patch: the same contract a model would
// fill through structured output. It understands a handful of phrasings and
// says so when it does not.

import { Schema as S } from "effect";
import { ancestors, find, Items, walk, type Item } from "@foldworks/outliner";

import { analyze, describe, type Analysis } from "./analysis";
import { show, type Step } from "./evaluate";
import {
  explode,
  extract,
  join,
  moveToStart,
  precede,
  rename,
  simplify,
  wrap,
  type NextId,
} from "./refactor";

export const Proposal = S.Struct({
  prompt: S.String,
  title: S.String,
  notes: S.Array(S.String),
  items: Items,
  focusId: S.NullOr(S.String),
});
export type Proposal = typeof Proposal.Type;

export const Reply = S.Struct({ prompt: S.String, lines: S.Array(S.String) });
export type Reply = typeof Reply.Type;

export type Answer =
  | Readonly<{ _tag: "Proposal"; proposal: Proposal }>
  | Readonly<{ _tag: "Reply"; reply: Reply }>;

export type Context = Readonly<{
  items: Items;
  /** Outermost selected items, in document order. */
  selection: ReadonlyArray<string>;
  focusId: string | null;
  nextId: NextId;
}>;

export const SUGGESTIONS: ReadonlyArray<string> = [
  "Run these concurrently, but don't start the I-9 until identity verification succeeds",
  "Verify identity first",
  "Extract this as with-tax",
  "Rename tax-rate to sales-tax",
  "Explain this",
];

const STOP_WORDS = new Set(["the", "a", "an", "step", "it", "this", "that", "of", "to"]);

const stems = (text: string): ReadonlyArray<string> =>
  text
    .replace(/([a-z])-(\d)/gi, "$1$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "" && !STOP_WORDS.has(word))
    .map((word) => word.slice(0, 5));

/** The step a phrase most likely names, such as "the I-9" for `collect-i9`. */
export const matchStep = (phrase: string, steps: ReadonlyArray<Step>): Step | undefined => {
  const wanted = new Set(stems(phrase));
  let best: Step | undefined;
  let bestScore = 0;
  for (const step of steps) {
    const score = stems(step.name).filter((stem) => wanted.has(stem)).length;
    if (
      score > bestScore ||
      (score === bestScore && best !== undefined && step.name.length < best.name.length)
    ) {
      if (score > 0) {
        best = step;
        bestScore = score;
      }
    }
  }
  return best;
};

const label = (node: Item | undefined): string =>
  node === undefined ? "the item" : `“${node.text.split("\n")[0]?.trim() || "untitled"}”`;

/** The workflow item that encloses an item, or the first workflow in the outline. */
const workflowFor = (items: Items, id: string | null): Item | undefined => {
  const isWorkflow = (node: Item) => /^workflow\b/.test(node.text.trim());
  if (id !== null) {
    const enclosing = [...ancestors(items, id), id]
      .map((candidate) => find(items, candidate)!)
      .filter(isWorkflow)
      .at(-1);
    if (enclosing !== undefined) return enclosing;
  }
  return walk(items).find(isWorkflow);
};

/** Items that are a bare reference to a step. */
const occurrencesOf = (root: Item, name: string): ReadonlyArray<Item> =>
  walk(root.children).filter((node) => node.text.trim() === name && node.children.length === 0);

type Edit = Readonly<{ items: Items; note: string; focusId?: string }> | Readonly<{ fail: string }>;

const clauses = (prompt: string): ReadonlyArray<string> =>
  prompt
    .trim()
    .replace(/[.!]+$/, "")
    .split(/\s*(?:,\s*(?:but|and then|then|and)?|;|\bbut\b|\band then\b)\s*/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== "");

const editFor = (
  clause: string,
  context: Context,
  items: Items,
  analysis: Analysis,
): Edit | undefined => {
  const { selection, focusId, nextId } = context;
  const targets = selection.length > 0 ? selection : focusId === null ? [] : [focusId];
  const needTargets = (): Edit => ({
    fail: "Select the rows you mean first: press Esc on a row, then ⇧↓ to extend.",
  });

  const gate =
    /(?:don'?t|do not|never)\s+(?:start|run|begin|do)\s+(.+?)\s+(?:until|before)\s+(.+?)(?:\s+(?:succeeds|completes|finishes|is done|has run|runs))?$/i.exec(
      clause,
    );
  if (gate !== null) {
    const later = matchStep(gate[1]!, analysis.steps);
    const earlier = matchStep(gate[2]!, analysis.steps);
    if (later === undefined || earlier === undefined) {
      return { fail: `I couldn't tell which steps “${gate[1]}” and “${gate[2]}” mean.` };
    }
    const workflow = workflowFor(items, targets[0] ?? focusId);
    const scope = targets.map((id) => find(items, id)).filter((node) => node !== undefined);
    const inScope = scope.flatMap((node) =>
      node.text.trim() === later.name ? [node] : occurrencesOf(node, later.name),
    );
    const target =
      inScope[0] ?? (workflow === undefined ? undefined : occurrencesOf(workflow, later.name)[0]);
    if (target === undefined) return { fail: `${later.name} isn't in the workflow yet.` };
    const next = precede(items, target.id, "sequence", earlier.name, nextId);
    return next === undefined
      ? { fail: "That change didn't apply." }
      : { items: next, note: `Run ${earlier.name}, then ${later.name}, as a sequence.` };
  }

  if (
    /\b(concurrent(ly)?|in parallel|at the same time|simultaneous(ly)?|parallel)\b/i.test(clause)
  ) {
    if (targets.length === 0) return needTargets();
    const result = wrap(items, targets, "parallel", nextId);
    return result === undefined
      ? { fail: "Those rows can't be wrapped together." }
      : {
          items: result.items,
          note: `Wrapped ${targets.length === 1 ? label(find(items, targets[0]!)) : `${targets.length} steps`} in parallel.`,
          focusId: result.id,
        };
  }

  if (/\b(in order|sequentially|one after another|in sequence)\b/i.test(clause)) {
    if (targets.length === 0) return needTargets();
    const result = wrap(items, targets, "sequence", nextId);
    return result === undefined
      ? { fail: "Those rows can't be wrapped together." }
      : {
          items: result.items,
          note: `Wrapped ${targets.length} items in a sequence.`,
          focusId: result.id,
        };
  }

  const first =
    /^(?:(?:run|do|put|move)\s+)?(.+?)\s+(?:first|before everything(?: else)?)$/i.exec(clause) ??
    /^start with\s+(.+)$/i.exec(clause);
  if (first !== null) {
    const step = matchStep(first[1]!, analysis.steps);
    if (step === undefined) return { fail: `I couldn't tell which step “${first[1]}” means.` };
    const workflow = workflowFor(items, targets[0] ?? focusId);
    if (workflow === undefined) return { fail: "There is no workflow to change." };
    const existing = occurrencesOf(workflow, step.name);
    let next: Items | undefined = items;
    if (existing.length > 0) {
      next = moveToStart(items, existing[0]!.id, workflow.id);
      next = next === undefined ? undefined : simplify(next);
    } else {
      const id = nextId();
      next = moveToStart(
        [...items, { id, text: step.name, collapsed: false, checked: false, children: [] }],
        id,
        workflow.id,
      );
    }
    return next === undefined
      ? { fail: "That change didn't apply." }
      : {
          items: next,
          note: `${step.name} now runs before everything else in ${label(workflow)}.`,
        };
  }

  const renamed = /rename\s+(\S+)\s+(?:to|as)\s+(\S+)/i.exec(clause);
  if (renamed !== null) {
    const [, from, to] = renamed;
    if (!analysis.definitions.has(from!)) return { fail: `Nothing named ${from} is defined.` };
    const next = rename(items, from!, to!);
    const uses = analysis.references.get(from!)?.length ?? 0;
    return next === undefined
      ? { fail: `${to} isn't a valid name.` }
      : {
          items: next,
          note: `Renamed ${from} to ${to}: the definition and ${uses} ${uses === 1 ? "use" : "uses"}.`,
        };
  }

  const extracted = /extract(?:\s+(?:this|it|that))?\s+(?:as|into|to|called|named)\s+(\S+)/i.exec(
    clause,
  );
  if (extracted !== null) {
    if (focusId === null) return needTargets();
    const result = extract(items, focusId, extracted[1]!, analysis, nextId);
    return result === undefined
      ? {
          fail: `I can't extract ${label(find(items, focusId))} as ${extracted[1]}. It needs to sit inside a definition, and the name must be new.`,
        }
      : {
          items: result.items,
          note: `Extracted ${label(find(items, focusId))} into ${extracted[1]}.`,
          focusId: result.definitionId,
        };
  }

  const wrapped = /^wrap(?:\s+(?:this|these|it|them))?\s+in\s+(.+)$/i.exec(clause);
  if (wrapped !== null) {
    if (targets.length === 0) return needTargets();
    const result = wrap(items, targets, wrapped[1]!.trim(), nextId);
    return result === undefined
      ? { fail: "Those rows can't be wrapped together." }
      : { items: result.items, note: `Wrapped in ${wrapped[1]!.trim()}.`, focusId: result.id };
  }

  if (/\b(one line|single line|inline)\b/i.test(clause) && focusId !== null) {
    const next = join(items, focusId);
    return next === undefined
      ? { fail: "That item is already one line." }
      : { items: next, note: "Joined onto one line." };
  }

  if (/\b(break|split|spread)\b.*\b(lines|rows)\b/i.test(clause) && focusId !== null) {
    const next = explode(items, focusId, nextId);
    return next === undefined
      ? { fail: "There is nothing to break out." }
      : { items: next, note: "Moved each argument onto its own row." };
  }

  return undefined;
};

/** Values that are true or false in one analysis and different in the other. */
const changedChecks = (before: Analysis, after: Analysis, items: Items): ReadonlyArray<string> => {
  const lines: string[] = [];
  for (const node of walk(items)) {
    // A section's value is its last form's; the form itself is reported.
    if (/^section\b/.test(node.text.trim())) continue;
    const was = before.evaluation.values.get(node.id)?.value;
    const now = after.evaluation.values.get(node.id)?.value;
    if (typeof now === "boolean" && typeof was === "boolean" && was !== now) {
      lines.push(`${node.text.trim()} is now ${now ? "true ✓" : "false ✗"}.`);
    }
  }
  return lines;
};

const warningLines = (analysis: Analysis, items: Items): ReadonlyArray<string> =>
  [...analysis.warnings].flatMap(([id, messages]) =>
    messages.map((message) => `${find(items, id)?.text.trim() ?? id} ${message}.`),
  );

const explain = (prompt: string, context: Context, analysis: Analysis): Reply => {
  const id = context.selection[0] ?? context.focusId;
  const node = id === null ? undefined : find(context.items, id);
  const expr = id === null ? undefined : analysis.program.exprs.get(id);
  if (node === undefined || expr === undefined) {
    return {
      prompt,
      lines: ["Put the caret in a row and ask again; I explain the row you're on."],
    };
  }
  const lines = [
    `${label(node)} is a ${describe(expr, analysis).replace(/^./, (c) => c.toLowerCase())}.`,
  ];
  const observed = analysis.evaluation.values.get(node.id);
  if (observed !== undefined) {
    lines.push(
      observed.count > 1
        ? `It has run ${observed.count} times; the last result was ${show(observed.value)}.`
        : `It evaluates to ${show(observed.value)}.`,
    );
  }
  const error = analysis.program.errors.get(node.id) ?? analysis.evaluation.errors.get(node.id);
  if (error !== undefined) lines.push(`It fails: ${error}.`);
  for (const warning of analysis.warnings.get(node.id) ?? []) lines.push(`Careful: it ${warning}.`);
  const name = node.text.trim();
  const step = analysis.steps.find((candidate) => candidate.name === name);
  if (step !== undefined) {
    lines.push(
      `It calls ${step.system}${step.reads.length > 0 ? `, reads ${step.reads.map((key) => `:${key}`).join(" ")}` : ""}${step.writes.length > 0 ? `, and writes ${step.writes.map((key) => `:${key}`).join(" ")}` : ""}.`,
    );
  }
  const uses = analysis.references.get(name)?.length;
  if (uses !== undefined)
    lines.push(`${uses} ${uses === 1 ? "row refers" : "rows refer"} to ${name}.`);
  return { prompt, lines };
};

const HELP: ReadonlyArray<string> = [
  "This assistant runs locally and understands a few kinds of request:",
  "“run these concurrently” or “in order” to wrap the selected rows,",
  "“don't start X until Y” to put one step before another,",
  "“Y first” to move a step to the start of its workflow,",
  "“rename A to B”, “extract this as NAME”, “wrap these in FORM”,",
  "“make this one line”, “break this onto lines”, and “explain this”.",
];

/** Answers a request with a structural proposal, or with a reply when there is nothing to change. */
export const propose = (prompt: string, context: Context): Answer => {
  const analysis = analyze(context.items);
  if (/^\s*(why|what|explain|how|describe)\b/i.test(prompt)) {
    return { _tag: "Reply", reply: explain(prompt, context, analysis) };
  }
  let items = context.items;
  let focusId: string | null = null;
  const notes: string[] = [];
  for (const clause of clauses(prompt)) {
    const edit = editFor(clause, context, items, analyze(items));
    if (edit === undefined) continue;
    if ("fail" in edit) return { _tag: "Reply", reply: { prompt, lines: [edit.fail] } };
    items = edit.items;
    notes.push(edit.note);
    focusId = edit.focusId ?? focusId;
  }
  if (notes.length === 0) return { _tag: "Reply", reply: { prompt, lines: HELP } };
  const after = analyze(items);
  const checks = changedChecks(analysis, after, items);
  const remaining = warningLines(after, items);
  const resolved = analysis.warnings.size - after.warnings.size;
  const findings = [
    ...checks,
    ...(resolved > 0
      ? [`Clears ${resolved} dataflow ${resolved === 1 ? "warning" : "warnings"}.`]
      : []),
    ...remaining.map((line) => `Still: ${line}`),
  ];
  return {
    _tag: "Proposal",
    proposal: {
      prompt,
      title: notes.length === 1 ? notes[0]! : `${notes.length} structural edits`,
      notes: [...(notes.length === 1 ? [] : notes), ...findings],
      items,
      focusId,
    },
  };
};
