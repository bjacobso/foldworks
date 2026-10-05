// What the outline lets a person change. The Library section is shared code
// shown in context, so its rows are read only. A step in a flow stays in a
// flow: moving it out would silently drop it from the workflow.

import { walk, type Items, type Policy } from "@foldworks/outliner";
import { reparented } from "@foldworks/outliner";

import { analyze } from "./analysis";
import { FLOW_FORMS, headOf } from "./slots";

export const LIBRARY = 'section "Library"';

const lockedCache = new WeakMap<Items, ReadonlySet<string>>();

/** The Library section and everything in it. */
const lockedIds = (items: Items): ReadonlySet<string> => {
  const cached = lockedCache.get(items);
  if (cached !== undefined) return cached;
  const locked = new Set(
    items
      .filter((node) => node.text === LIBRARY)
      .flatMap((node) => walk([node]).map((inner) => inner.id)),
  );
  lockedCache.set(items, locked);
  return locked;
};

export const isLocked = (items: Items, id: string): boolean => lockedIds(items).has(id);

/** The outline's rules for the current document. */
export const outlinePolicy = (items: Items): Policy => ({
  isReadOnly: (node) => lockedIds(items).has(node.id),
  canMove: ({ before, after }) => {
    const steps = new Set(analyze(before).steps.map((step) => step.name));
    const texts = new Map(walk(before).map((node) => [node.id, node.text]));
    const nowTexts = new Map(walk(after).map((node) => [node.id, node.text]));
    const inFlow = (text: string | undefined) => FLOW_FORMS.has(headOf(text ?? "") ?? "");
    return reparented(before, after).every(
      (move) =>
        !steps.has((texts.get(move.id) ?? "").trim()) ||
        !inFlow(move.previousParentId === null ? undefined : texts.get(move.previousParentId)) ||
        inFlow(move.parentId === null ? undefined : nowTexts.get(move.parentId)),
    );
  },
});
