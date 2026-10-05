// Forms describe their parts, so a row can offer the ones it is missing as
// placeholder children: `+ body` under a function without one, `+ then` and
// `+ else` under an `if`, and `+ step` at the end of every flow.

import { find, type Items, type Placeholder } from "@foldworks/outliner";

import { elementCount, isComment } from "./codec";

type Slot = Readonly<{
  label: string;
  /** Text a new row starts with, and where the caret lands in it. */
  text?: string;
  caret?: number;
  /** A slot that takes any number of forms is always offered at the end. */
  repeats?: boolean;
}>;

/** Each form's arguments after its head. Names and parameters are typed on the head's row. */
const SLOTS: ReadonlyMap<string, ReadonlyArray<Slot>> = new Map<string, ReadonlyArray<Slot>>([
  ["def", [{ label: "name" }, { label: "value" }]],
  ["defn", [{ label: "name" }, { label: "parameters", text: "[]", caret: 1 }, { label: "body" }]],
  ["fn", [{ label: "parameters", text: "[]", caret: 1 }, { label: "body" }]],
  ["let", [{ label: "bindings", text: "[]", caret: 1 }, { label: "body" }]],
  ["if", [{ label: "test" }, { label: "then" }, { label: "else" }]],
  ["when", [{ label: "test" }, { label: "body" }]],
  [
    "defstep",
    [{ label: "name" }, { label: "spec", text: '{:system "" :reads [] :writes []}', caret: 10 }],
  ],
  ["workflow", [{ label: "name" }, { label: "step", repeats: true }]],
  ["sequence", [{ label: "step", repeats: true }]],
  ["parallel", [{ label: "step", repeats: true }]],
  ["branch", [{ label: "label", text: '""', caret: 1 }, { label: "flow" }]],
]);

/** Forms whose children are steps or flows. */
export const FLOW_FORMS: ReadonlySet<string> = new Set([
  "workflow",
  "sequence",
  "parallel",
  "branch",
]);

/** The symbol a row's text starts with, ignoring an opening parenthesis. */
export const headOf = (text: string): string | undefined =>
  /^\(?\s*([^\s()[\]{}";']+)/u.exec(text.trimStart())?.[1];

/** Placeholders for the parts a form is missing, plus a repeating part at its end. */
export const slotsFor = (items: Items, parentId: string | null): ReadonlyArray<Placeholder> => {
  if (parentId === null) return [];
  const node = find(items, parentId);
  if (node === undefined || isComment(node.text) || node.text.trimStart().startsWith("(")) {
    return [];
  }
  const slots = SLOTS.get(headOf(node.text) ?? "");
  if (slots === undefined) return [];
  const onHeadRow = Math.max(0, (elementCount(node.text) ?? 1) - 1);
  const present = onHeadRow + node.children.filter((child) => !isComment(child.text)).length;
  return slots.flatMap((slot, position) =>
    slot.repeats === true || position >= present
      ? [
          {
            key: slot.label,
            label: slot.label,
            ...(slot.text === undefined ? {} : { text: slot.text }),
            ...(slot.caret === undefined ? {} : { caret: slot.caret }),
          },
        ]
      : [],
  );
};
