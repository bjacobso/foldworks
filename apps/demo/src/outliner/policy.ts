// What the outline lets a person change. The Leave No Trace principles are
// quoted word for word, so they are read only. A done item is signed off:
// moving something into it would reopen it without anyone noticing.

import { reparented, walk, type Items, type Policy } from "@foldworks/outliner";

import { QUOTED_ID } from "./sample";

const lockedCache = new WeakMap<Items, ReadonlySet<string>>();

/** The quoted principles and everything in them. */
const lockedIds = (items: Items): ReadonlySet<string> => {
  const cached = lockedCache.get(items);
  if (cached !== undefined) return cached;
  const locked = new Set(
    walk(items)
      .filter((node) => node.id === QUOTED_ID)
      .flatMap((node) => walk([node]).map((inner) => inner.id)),
  );
  lockedCache.set(items, locked);
  return locked;
};

export const isQuoted = (items: Items, id: string): boolean => lockedIds(items).has(id);

/** The outline's rules for the current document. */
export const outlinePolicy = (items: Items): Policy => ({
  isReadOnly: (node) => lockedIds(items).has(node.id),
  canMove: ({ before, after }) => {
    const done = new Set(
      walk(before)
        .filter((node) => node.checked)
        .map((node) => node.id),
    );
    return reparented(before, after).every(
      (move) => move.parentId === null || !done.has(move.parentId),
    );
  },
});
