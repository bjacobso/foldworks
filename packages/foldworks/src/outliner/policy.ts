import { walk, type Item, type Items } from "./outline";

/** `Merge` is joining an item onto the one above, which carries its children to a new parent. */
export type MoveCause = "Indent" | "Outdent" | "MoveUp" | "MoveDown" | "Drop" | "Merge";

/** A proposed move: what asked for it, the items moved, and the document before and after. */
export type Move = Readonly<{
  cause: MoveCause;
  /** The outermost items being moved, in document order. */
  ids: ReadonlyArray<string>;
  before: Items;
  after: Items;
}>;

/**
 * Rules a host applies to an outline. Both are checked in `update`, so they
 * hold for keys, drags, and messages a host dispatches; pass the same policy
 * to the view for drag feedback and read-only text.
 */
export type Policy = Readonly<{
  /** Refuse a move by returning `false`. An outdent also moves the siblings it adopts. */
  canMove?: (move: Move) => boolean;
  /**
   * Items whose text, done state, parent, and children the user cannot change.
   * Moving an ancestor carries them along; make the ancestor read-only to pin them.
   */
  isReadOnly?: (item: Item) => boolean;
}>;

type Place = Readonly<{ parentId: string | null; index: number }>;

const placesOf = (items: Items): ReadonlyMap<string, Place> => {
  const places = new Map<string, Place>();
  const visit = (nodes: Items, parentId: string | null) =>
    nodes.forEach((node, index) => {
      places.set(node.id, { parentId, index });
      visit(node.children, node.id);
    });
  visit(items, null);
  return places;
};

export type Reparented = Readonly<{
  id: string;
  parentId: string | null;
  index: number;
  previousParentId: string | null;
}>;

/** Every item whose parent changed between two versions of an outline, in document order. */
export const reparented = (before: Items, after: Items): ReadonlyArray<Reparented> => {
  const old = placesOf(before);
  const now = placesOf(after);
  return walk(after).flatMap((node) => {
    const previous = old.get(node.id);
    const place = now.get(node.id)!;
    return previous === undefined || previous.parentId === place.parentId
      ? []
      : [{ id: node.id, ...place, previousParentId: previous.parentId }];
  });
};

/**
 * Whether every read-only item kept its text, done state, parent, and
 * children. Its position among its siblings may change as others move.
 */
export const keepsReadOnly = (
  before: Items,
  after: Items,
  isReadOnly: (item: Item) => boolean,
): boolean => {
  const locked = walk(before).filter(isReadOnly);
  if (locked.length === 0) return true;
  const old = placesOf(before);
  const now = placesOf(after);
  const items = new Map(walk(after).map((node) => [node.id, node]));
  const ids = (node: Item) => node.children.map((child) => child.id).join("\n");
  return locked.every((node) => {
    const current = items.get(node.id);
    return (
      current !== undefined &&
      current.text === node.text &&
      current.checked === node.checked &&
      now.get(node.id)?.parentId === old.get(node.id)?.parentId &&
      ids(current) === ids(node)
    );
  });
};

/** Why a change breaks a policy, or `undefined` when it is allowed. */
export const refusal = (
  policy: Policy,
  before: Items,
  after: Items,
  move: Readonly<{ cause: MoveCause; ids: ReadonlyArray<string> }> | undefined,
): string | undefined => {
  if (after === before) return undefined;
  const { canMove, isReadOnly } = policy;
  if (move !== undefined) {
    const locked =
      isReadOnly !== undefined &&
      walk(before).some((node) => move.ids.includes(node.id) && isReadOnly(node));
    if (locked) return "Read-only items can't move.";
    if (canMove !== undefined && !canMove({ ...move, before, after })) return "Can't move there.";
  }
  if (isReadOnly !== undefined && !keepsReadOnly(before, after, isReadOnly)) {
    return "Read-only items can't change.";
  }
  return undefined;
};
