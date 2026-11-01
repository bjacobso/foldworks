import { Schema as S } from "effect";

/** One topic in an outline. Children are always present; an empty array is a leaf. */
export interface Item {
  readonly id: string;
  readonly text: string;
  readonly collapsed: boolean;
  readonly checked: boolean;
  readonly children: ReadonlyArray<Item>;
}
export const Item: S.Codec<Item> = S.suspend(() =>
  S.Struct({
    id: S.String,
    text: S.String,
    collapsed: S.Boolean,
    checked: S.Boolean,
    children: S.Array(Item),
  }),
);
export const Items = S.Array(Item);
export type Items = ReadonlyArray<Item>;

/** Saved JSON. Selection, hoisting, and history are view state and are not saved. */
export const Document = S.Struct({ version: S.Literal(1), items: Items });
export type Document = typeof Document.Type;

export const item = (
  id: string,
  text = "",
  children: Items = [],
  options: Readonly<{ collapsed?: boolean; checked?: boolean }> = {},
): Item => ({
  id,
  text,
  collapsed: options.collapsed ?? false,
  checked: options.checked ?? false,
  children,
});

/** A row as it appears on screen, in document order, below the hoisted scope. */
export type Row = Readonly<{
  id: string;
  text: string;
  depth: number;
  parentId: string | null;
  index: number;
  setSize: number;
  hasChildren: boolean;
  collapsed: boolean;
  checked: boolean;
}>;

export type Location = Readonly<{ parentId: string | null; index: number; depth: number }>;

/** Where moved items land: as the first or last child of a parent, or right after a sibling. */
export type Placement =
  | Readonly<{ _tag: "Start"; parentId: string | null }>
  | Readonly<{ _tag: "End"; parentId: string | null }>
  | Readonly<{ _tag: "After"; siblingId: string }>
  | Readonly<{ _tag: "Before"; siblingId: string }>;

export const walk = (items: Items): ReadonlyArray<Item> =>
  items.flatMap((node) => [node, ...walk(node.children)]);

export const find = (items: Items, id: string): Item | undefined => {
  for (const node of items) {
    if (node.id === id) return node;
    const found = find(node.children, id);
    if (found !== undefined) return found;
  }
  return undefined;
};

export const locate = (
  items: Items,
  id: string,
  parentId: string | null = null,
  depth = 0,
): Location | undefined => {
  for (const [index, node] of items.entries()) {
    if (node.id === id) return { parentId, index, depth };
    const found = locate(node.children, id, node.id, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** Ancestor ids from the outermost to the direct parent. */
export const ancestors = (items: Items, id: string): ReadonlyArray<string> => {
  const path: string[] = [];
  const visit = (nodes: Items): boolean =>
    nodes.some((node) => {
      if (node.id === id) return true;
      path.push(node.id);
      if (visit(node.children)) return true;
      path.pop();
      return false;
    });
  return visit(items) ? path : [];
};

/** Whether `id` is `ancestorId` or below it. A `null` ancestor contains everything. */
export const isWithin = (items: Items, id: string, ancestorId: string | null): boolean =>
  ancestorId === null || id === ancestorId || ancestors(items, id).includes(ancestorId);

/** The children of an item, or the top-level items for `null`. */
export const childrenOf = (items: Items, parentId: string | null): Items | undefined =>
  parentId === null ? items : find(items, parentId)?.children;

/** Replaces one item, sharing every untouched branch. Returns `items` itself when nothing changes. */
export const updateItem = (items: Items, id: string, f: (node: Item) => Item): Items => {
  let changed = false;
  const next = items.map((node) => {
    if (node.id === id) {
      const updated = f(node);
      changed ||= updated !== node;
      return updated;
    }
    const children = updateItem(node.children, id, f);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : items;
};

const setChildren = (items: Items, parentId: string | null, children: Items): Items =>
  parentId === null ? children : updateItem(items, parentId, (node) => ({ ...node, children }));

/** Rows below `scopeId` (or the whole document), skipping collapsed descendants. */
export const visibleRows = (items: Items, scopeId: string | null = null): ReadonlyArray<Row> => {
  const rows: Row[] = [];
  const visit = (nodes: Items, parentId: string | null, depth: number) =>
    nodes.forEach((node, index) => {
      rows.push({
        id: node.id,
        text: node.text,
        depth,
        parentId,
        index,
        setSize: nodes.length,
        hasChildren: node.children.length > 0,
        collapsed: node.collapsed,
        checked: node.checked,
      });
      if (!node.collapsed) visit(node.children, node.id, depth + 1);
    });
  visit(childrenOf(items, scopeId) ?? [], scopeId, 0);
  return rows;
};

/**
 * Reduces a set of ids to the outermost ones, in document order. Operating on
 * a parent already carries its descendants along.
 */
export const roots = (items: Items, ids: Iterable<string>): ReadonlyArray<string> => {
  const wanted = new Set(ids);
  const result: string[] = [];
  const visit = (nodes: Items) =>
    nodes.forEach((node) => {
      if (wanted.has(node.id)) result.push(node.id);
      else visit(node.children);
    });
  visit(items);
  return result;
};

/** Removes items with their subtrees and returns them in document order. */
export const removeItems = (
  items: Items,
  ids: Iterable<string>,
): Readonly<{ items: Items; removed: Items }> => {
  const wanted = new Set(ids);
  const removed: Item[] = [];
  const prune = (nodes: Items): Items => {
    let changed = false;
    const kept: Item[] = [];
    for (const node of nodes) {
      if (wanted.has(node.id)) {
        removed.push(node);
        changed = true;
        continue;
      }
      const children = prune(node.children);
      if (children !== node.children) changed = true;
      kept.push(children === node.children ? node : { ...node, children });
    }
    return changed ? kept : nodes;
  };
  return { items: prune(items), removed };
};

/** Inserts items under a parent at an index, clamped to its children. */
export const insertItems = (
  items: Items,
  parentId: string | null,
  index: number,
  inserted: Items,
): Items | undefined => {
  const siblings = childrenOf(items, parentId);
  if (siblings === undefined) return undefined;
  const at = Math.max(0, Math.min(index, siblings.length));
  return setChildren(items, parentId, [
    ...siblings.slice(0, at),
    ...inserted,
    ...siblings.slice(at),
  ]);
};

const resolvePlacement = (items: Items, placement: Placement): Location | undefined => {
  switch (placement._tag) {
    case "Start":
    case "End": {
      const siblings = childrenOf(items, placement.parentId);
      if (siblings === undefined) return undefined;
      const parentDepth =
        placement.parentId === null ? -1 : (locate(items, placement.parentId)?.depth ?? -1);
      return {
        parentId: placement.parentId,
        index: placement._tag === "Start" ? 0 : siblings.length,
        depth: parentDepth + 1,
      };
    }
    case "After":
    case "Before": {
      const location = locate(items, placement.siblingId);
      return location === undefined
        ? undefined
        : { ...location, index: location.index + (placement._tag === "After" ? 1 : 0) };
    }
  }
};

/**
 * Moves items, with their subtrees, to a placement. The placement is resolved
 * after the moved items are removed, so it may refer to their old neighbours.
 * Returns `undefined` when the move is impossible, such as into itself.
 */
export const moveItems = (
  items: Items,
  ids: ReadonlyArray<string>,
  placement: Placement,
): Items | undefined => {
  const moving = roots(items, ids);
  if (moving.length === 0) return undefined;
  const anchor =
    placement._tag === "Start" || placement._tag === "End"
      ? placement.parentId
      : placement.siblingId;
  if (anchor !== null && moving.some((id) => isWithin(items, anchor, id))) return undefined;
  const { items: without, removed } = removeItems(items, moving);
  const target = resolvePlacement(without, placement);
  if (target === undefined) return undefined;
  const expanded =
    target.parentId === null
      ? without
      : updateItem(without, target.parentId, (node) =>
          node.collapsed ? { ...node, collapsed: false } : node,
        );
  const next = insertItems(expanded, target.parentId, target.index, removed);
  return next === undefined || sameStructure(items, next) ? undefined : next;
};

const sameStructure = (a: Items, b: Items): boolean =>
  a.length === b.length &&
  a.every((node, index) => {
    const other = b[index]!;
    return (
      node.id === other.id &&
      node.collapsed === other.collapsed &&
      sameStructure(node.children, other.children)
    );
  });

/**
 * Indents each item under its previous sibling. Items that cannot indent hold
 * the following selected siblings in place, so a selection never folds into
 * itself.
 */
export const indent = (items: Items, ids: ReadonlyArray<string>): Items | undefined => {
  let current = items;
  const blocked = new Set<string>();
  for (const id of roots(items, ids)) {
    const location = locate(current, id);
    const siblings = location && childrenOf(current, location.parentId);
    const previous = location && location.index > 0 ? siblings?.[location.index - 1] : undefined;
    if (previous === undefined || blocked.has(previous.id)) {
      blocked.add(id);
      continue;
    }
    current = moveItems(current, [id], { _tag: "End", parentId: previous.id }) ?? current;
  }
  return current === items ? undefined : current;
};

/**
 * Outdents each item to follow its parent. Following siblings become the
 * item's children, so nothing moves on screen except the outdented row.
 * Items directly below `scopeId` stay put.
 */
export const outdent = (
  items: Items,
  ids: ReadonlyArray<string>,
  scopeId: string | null = null,
): Items | undefined => {
  let current = items;
  for (const id of roots(items, ids)) {
    const location = locate(current, id);
    if (location === undefined || location.parentId === scopeId || location.parentId === null) {
      continue;
    }
    const parentId = location.parentId;
    const siblings = childrenOf(current, parentId)!;
    const following = siblings.slice(location.index + 1);
    const node = siblings[location.index]!;
    const adopted: Item =
      following.length === 0
        ? node
        : { ...node, collapsed: false, children: [...node.children, ...following] };
    const trimmed = setChildren(current, parentId, siblings.slice(0, location.index));
    const parentLocation = locate(trimmed, parentId)!;
    current =
      insertItems(trimmed, parentLocation.parentId, parentLocation.index + 1, [adopted]) ?? current;
  }
  return current === items ? undefined : current;
};

const siblingRun = (
  items: Items,
  ids: ReadonlyArray<string>,
): Readonly<{ parentId: string | null; first: number; last: number }> | undefined => {
  const moving = roots(items, ids);
  const locations = moving.map((id) => locate(items, id));
  const first = locations[0];
  if (first === undefined) return undefined;
  const contiguous = locations.every(
    (location, offset) =>
      location !== undefined &&
      location.parentId === first.parentId &&
      location.index === first.index + offset,
  );
  return contiguous
    ? { parentId: first.parentId, first: first.index, last: first.index + moving.length - 1 }
    : undefined;
};

/**
 * Moves a run of sibling items up one place. The first child moves into the
 * end of its parent's previous sibling, keeping its depth, or above its
 * parent when the parent is itself first.
 */
export const moveUp = (
  items: Items,
  ids: ReadonlyArray<string>,
  scopeId: string | null = null,
): Items | undefined => {
  const run = siblingRun(items, ids);
  if (run === undefined) return undefined;
  const moving = roots(items, ids);
  const siblings = childrenOf(items, run.parentId)!;
  if (run.first > 0) {
    return moveItems(items, moving, { _tag: "Before", siblingId: siblings[run.first - 1]!.id });
  }
  if (run.parentId === null || run.parentId === scopeId) return undefined;
  const parent = locate(items, run.parentId)!;
  const uncles = childrenOf(items, parent.parentId)!;
  const previousUncle = parent.index > 0 ? uncles[parent.index - 1] : undefined;
  return previousUncle === undefined
    ? moveItems(items, moving, { _tag: "Before", siblingId: run.parentId })
    : moveItems(items, moving, { _tag: "End", parentId: previousUncle.id });
};

/** The mirror of {@link moveUp}. */
export const moveDown = (
  items: Items,
  ids: ReadonlyArray<string>,
  scopeId: string | null = null,
): Items | undefined => {
  const run = siblingRun(items, ids);
  if (run === undefined) return undefined;
  const moving = roots(items, ids);
  const siblings = childrenOf(items, run.parentId)!;
  if (run.last < siblings.length - 1) {
    return moveItems(items, moving, { _tag: "After", siblingId: siblings[run.last + 1]!.id });
  }
  if (run.parentId === null || run.parentId === scopeId) return undefined;
  const parent = locate(items, run.parentId)!;
  const uncles = childrenOf(items, parent.parentId)!;
  const nextUncle = uncles[parent.index + 1];
  return nextUncle === undefined
    ? moveItems(items, moving, { _tag: "After", siblingId: run.parentId })
    : moveItems(items, moving, { _tag: "Start", parentId: nextUncle.id });
};

export type Split = Readonly<{ items: Items; focusId: string; offset: number }>;

/**
 * Splits an item at a text selection, as Return does. Text after the
 * selection moves to a new item, which becomes the first child of an
 * expanded parent or the next sibling otherwise. Return at the start of a
 * non-empty item opens an empty item above it instead.
 */
export const split = (
  items: Items,
  id: string,
  start: number,
  end: number,
  newId: string,
): Split | undefined => {
  const node = find(items, id);
  const location = locate(items, id);
  if (node === undefined || location === undefined) return undefined;
  const before = node.text.slice(0, start);
  const after = node.text.slice(end);
  if (start === 0 && end === 0 && node.text.length > 0) {
    const next = insertItems(items, location.parentId, location.index, [item(newId)]);
    return next === undefined ? undefined : { items: next, focusId: id, offset: 0 };
  }
  const updated = updateItem(items, id, (current) => ({ ...current, text: before }));
  const created = item(newId, after);
  const next =
    node.children.length > 0 && !node.collapsed
      ? insertItems(updated, id, 0, [created])
      : insertItems(updated, location.parentId, location.index + 1, [created]);
  return next === undefined ? undefined : { items: next, focusId: newId, offset: 0 };
};

export type Merge = Readonly<{ items: Items; focusId: string; offset: number }>;

/**
 * Joins an item onto the end of the row above it, as Backspace at the start
 * of a row does. The item's children follow it: into the row above when that
 * row has none showing, or into the item's old place otherwise.
 */
export const mergeIntoPrevious = (
  items: Items,
  id: string,
  scopeId: string | null = null,
): Merge | undefined => {
  const rows = visibleRows(items, scopeId);
  const position = rows.findIndex((row) => row.id === id);
  const previous = position > 0 ? rows[position - 1] : undefined;
  const node = find(items, id);
  const location = locate(items, id);
  if (previous === undefined || node === undefined || location === undefined) return undefined;
  const offset = previous.text.length;
  let next = removeItems(items, [id]).items;
  next = updateItem(next, previous.id, (current) => ({
    ...current,
    text: current.text + node.text,
  }));
  if (node.children.length > 0) {
    next =
      previous.id === location.parentId
        ? (insertItems(next, location.parentId, location.index, node.children) ?? next)
        : updateItem(next, previous.id, (current) => ({
            ...current,
            children: [...current.children, ...node.children],
          }));
  }
  return { items: next, focusId: previous.id, offset };
};

/** Joins the row below onto the end of this item, as Delete at the end of a row does. */
export const mergeNext = (
  items: Items,
  id: string,
  scopeId: string | null = null,
): Merge | undefined => {
  const rows = visibleRows(items, scopeId);
  const position = rows.findIndex((row) => row.id === id);
  const next = position >= 0 ? rows[position + 1] : undefined;
  return next === undefined ? undefined : mergeIntoPrevious(items, next.id, scopeId);
};

export const setCollapsed = (
  items: Items,
  id: string,
  collapsed: boolean,
  recursive = false,
): Items => {
  const apply = (node: Item): Item => {
    const children = recursive ? node.children.map(apply) : node.children;
    const value = node.children.length > 0 && collapsed;
    return value === node.collapsed && children === node.children
      ? node
      : { ...node, collapsed: value, children };
  };
  return updateItem(items, id, apply);
};

/** Expands or collapses every item with children below a scope. */
export const setAllCollapsed = (items: Items, collapsed: boolean): Items => {
  const apply = (nodes: Items): Items => {
    let changed = false;
    const next = nodes.map((node) => {
      const children = apply(node.children);
      const value = node.children.length > 0 && collapsed;
      if (children === node.children && value === node.collapsed) return node;
      changed = true;
      return { ...node, collapsed: value, children };
    });
    return changed ? next : nodes;
  };
  return apply(items);
};

/** Collapses everything deeper than `level` and expands everything above it. */
export const expandToLevel = (items: Items, level: number): Items => {
  const apply = (nodes: Items, depth: number): Items =>
    nodes.map((node) => ({
      ...node,
      collapsed: node.children.length > 0 && depth + 1 >= level,
      children: apply(node.children, depth + 1),
    }));
  return apply(items, 0);
};

export type DropTarget = Readonly<{
  placement: Placement;
  depth: number;
  /** The visible row the indicator follows; `null` places it above the first row. */
  afterRowId: string | null;
  /** The host's policy refuses a drop here; releasing does nothing. */
  refused?: boolean;
}>;

/**
 * Resolves a pointer position over visible rows to a drop placement. `gap` is
 * the index between rows, counted without the dragged rows; `depth` is the
 * requested indentation. Depth is clamped so the drop never adopts the row
 * below it and never skips a level.
 */
export const dropTarget = (
  rows: ReadonlyArray<Row>,
  draggedIds: ReadonlyArray<string>,
  gap: number,
  depth: number,
  scopeId: string | null = null,
): DropTarget => {
  const dragged = new Set(draggedIds);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const hidden = (row: Row): boolean => {
    for (let id: string | null = row.id; id !== null; id = byId.get(id)?.parentId ?? null) {
      if (dragged.has(id)) return true;
    }
    return false;
  };
  const candidates = rows.filter((row) => !hidden(row));
  const at = Math.max(0, Math.min(gap, candidates.length));
  const above = candidates[at - 1];
  const below = candidates[at];
  if (above === undefined) {
    return { placement: { _tag: "Start", parentId: scopeId }, depth: 0, afterRowId: null };
  }
  const minimum = below?.depth ?? 0;
  const maximum = above.depth + 1;
  const clamped = Math.max(minimum, Math.min(maximum, Math.round(depth)));
  if (clamped === above.depth + 1) {
    return {
      placement: {
        _tag: above.collapsed && above.hasChildren ? "End" : "Start",
        parentId: above.id,
      },
      depth: clamped,
      afterRowId: above.id,
    };
  }
  let sibling: Row = above;
  while (sibling.depth > clamped && sibling.parentId !== null) {
    const parent = byId.get(sibling.parentId);
    if (parent === undefined) break;
    sibling = parent;
  }
  return {
    placement: { _tag: "After", siblingId: sibling.id },
    depth: clamped,
    afterRowId: above.id,
  };
};
