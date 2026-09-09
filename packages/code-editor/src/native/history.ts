import { applyEdits, type Selection, type TextEdit } from "../document";
import type { HistoryGroup, Model } from "./model";
import { difference, invert } from "./operations";

/** The Foldkit model owns reversible range edits; no editor or browser undo stack is used. */
export const record = (model: Model, edits: readonly TextEdit[], before: Selection, after: Selection, kind: string, time: number): Pick<Model, "past" | "future" | "nextHistoryId"> => {
  const step = { edits, inverse: invert(model.document.text, edits), before, after };
  const last = model.past.at(-1);
  const priorStep = last?.steps.at(-1);
  const isComposition = kind.startsWith("composition:");
  const coalesce = last && last.kind === kind && (isComposition || ["insertText", "deleteContentBackward", "deleteContentForward"].includes(kind)) &&
    (isComposition || time - last.time < 750) && priorStep?.after.anchor === before.anchor && priorStep.after.head === before.head && last.steps.length < 100;
  const group: HistoryGroup = { id: coalesce ? last.id : model.nextHistoryId, kind, time, steps: coalesce ? [...last.steps, step] : [step] };
  return {
    past: [...(coalesce ? model.past.slice(0, -1) : model.past), group].slice(-100),
    future: [], nextHistoryId: coalesce ? model.nextHistoryId : model.nextHistoryId + 1,
  };
};

export const historyPlan = (model: Model, direction: "undo" | "redo") => {
  const group = (direction === "undo" ? model.past : model.future).at(-1);
  if (!group) return undefined;
  let text = model.document.text;
  for (const step of direction === "undo" ? [...group.steps].reverse() : group.steps) text = applyEdits(text, direction === "undo" ? step.inverse : step.edits);
  return {
    edits: difference(model.document.text, text),
    selection: direction === "undo" ? group.steps[0]!.before : group.steps.at(-1)!.after,
    groupId: group.id,
  };
};
