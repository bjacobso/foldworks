import * as stylex from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { sxAttrs } from "./sx";
import { colors, radii, space, typography } from "./tokens.stylex.js";

/**
 * A node of any tree whose nodes keep their ids across versions, such as an
 * outline or a workflow. Ids are unique within each version.
 */
export type TreeDiffNode = Readonly<{
  id: string;
  label: string;
  children?: ReadonlyArray<TreeDiffNode>;
}>;

export type TreeDiffStatus = "Unchanged" | "Added" | "Removed" | "Moved" | "Edited";

export type TreeDiffNodeRow = Readonly<{
  _tag: "Node";
  id: string;
  label: string;
  depth: number;
  status: TreeDiffStatus;
  /** The previous label, when it changed. */
  was?: string;
}>;

/** Unchanged siblings left out of a changed region. */
export type TreeDiffElidedRow = Readonly<{ _tag: "Elided"; depth: number; count: number }>;

export type TreeDiffRow = TreeDiffNodeRow | TreeDiffElidedRow;

type Place = Readonly<{ parentId: string | null; index: number; node: TreeDiffNode }>;

const placesOf = (nodes: ReadonlyArray<TreeDiffNode>): ReadonlyMap<string, Place> => {
  const places = new Map<string, Place>();
  const visit = (level: ReadonlyArray<TreeDiffNode>, parentId: string | null) =>
    level.forEach((node, index) => {
      places.set(node.id, { parentId, index, node });
      visit(node.children ?? [], node.id);
    });
  visit(nodes, null);
  return places;
};

/** Positions in `values` that form a longest increasing run, keeping order. */
const longestIncreasing = (values: ReadonlyArray<number>): ReadonlySet<number> => {
  const tails: number[] = [];
  const previous: number[] = [];
  values.forEach((value, at) => {
    let low = 0,
      high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[tails[middle]!]! < value) low = middle + 1;
      else high = middle;
    }
    previous[at] = low > 0 ? tails[low - 1]! : -1;
    tails[low] = at;
  });
  const kept = new Set<number>();
  for (let at = tails.at(-1) ?? -1; at >= 0; at = previous[at]!) kept.add(at);
  return kept;
};

/**
 * Compares two versions of a tree whose nodes keep their ids. Rows follow the
 * new tree, with removed nodes where they used to be. A node is moved when its
 * parent changed, or when it is not part of the longest run of siblings that
 * kept their order, so a reordering is reported with the fewest moves.
 */
export const diffTrees = (
  before: ReadonlyArray<TreeDiffNode>,
  after: ReadonlyArray<TreeDiffNode>,
): ReadonlyArray<TreeDiffNodeRow> => {
  const old = placesOf(before);
  const now = placesOf(after);
  const reordered = new Set<string>();
  const findReordered = (nodes: ReadonlyArray<TreeDiffNode>, parentId: string | null) => {
    const stayed = nodes.filter((node) => old.get(node.id)?.parentId === parentId);
    const kept = longestIncreasing(stayed.map((node) => old.get(node.id)!.index));
    stayed.forEach((node, at) => {
      if (!kept.has(at)) reordered.add(node.id);
    });
    for (const node of nodes) findReordered(node.children ?? [], node.id);
  };
  findReordered(after, null);

  // Removed children of a parent, grouped by the surviving sibling they followed.
  const removedUnder = (
    parentId: string | null,
  ): ReadonlyMap<string | null, ReadonlyArray<TreeDiffNode>> => {
    const groups = new Map<string | null, TreeDiffNode[]>();
    const children = parentId === null ? before : (old.get(parentId)?.node.children ?? []);
    let anchor: string | null = null;
    for (const child of children) {
      const place = now.get(child.id);
      if (place === undefined) groups.set(anchor, [...(groups.get(anchor) ?? []), child]);
      else if (place.parentId === parentId) anchor = child.id;
    }
    return groups;
  };

  const rows: TreeDiffNodeRow[] = [];
  const emitRemoved = (node: TreeDiffNode, depth: number) => {
    rows.push({ _tag: "Node", id: node.id, label: node.label, depth, status: "Removed" });
    // Descendants that survive are shown where they are now.
    for (const child of node.children ?? []) if (!now.has(child.id)) emitRemoved(child, depth + 1);
  };
  const emit = (nodes: ReadonlyArray<TreeDiffNode>, parentId: string | null, depth: number) => {
    const removed =
      parentId === null || old.has(parentId)
        ? removedUnder(parentId)
        : new Map<string | null, ReadonlyArray<TreeDiffNode>>();
    for (const gone of removed.get(null) ?? []) emitRemoved(gone, depth);
    for (const node of nodes) {
      const previous = old.get(node.id);
      const status: TreeDiffStatus =
        previous === undefined
          ? "Added"
          : previous.parentId !== parentId || reordered.has(node.id)
            ? "Moved"
            : previous.node.label !== node.label
              ? "Edited"
              : "Unchanged";
      rows.push({
        _tag: "Node",
        id: node.id,
        label: node.label,
        depth,
        status,
        ...(previous !== undefined && previous.node.label !== node.label
          ? { was: previous.node.label }
          : {}),
      });
      emit(node.children ?? [], node.id, depth + 1);
      for (const gone of removed.get(node.id) ?? []) emitRemoved(gone, depth);
    }
  };
  emit(after, null, 0);
  return rows;
};

/**
 * Trims a diff to the region that changed: the deepest node holding every
 * change, its changed descendants with their ancestors, and `context`
 * unchanged siblings on either side of each change. Other unchanged siblings
 * fold into “N unchanged”; a lone one is shown instead.
 */
export const changedRegion = (
  rows: ReadonlyArray<TreeDiffNodeRow>,
  context = 1,
): ReadonlyArray<TreeDiffRow> => {
  const changed = rows.flatMap((row, at) => (row.status === "Unchanged" ? [] : [at]));
  if (changed.length === 0) return [];
  const parentOf: number[] = [];
  const stack: number[] = [];
  rows.forEach((row, at) => {
    while (stack.length > 0 && rows[stack.at(-1)!]!.depth >= row.depth) stack.pop();
    parentOf[at] = stack.at(-1) ?? -1;
    stack.push(at);
  });
  const chain = (at: number): number[] => {
    const path: number[] = [];
    for (let node = at; node >= 0; node = parentOf[node]!) path.unshift(node);
    return path;
  };
  const chains = changed.map((at) => chain(parentOf[at]!));
  let root = -1;
  for (
    let level = 0;
    chains.every((path) => path[level] !== undefined && path[level] === chains[0]![level]);
    level += 1
  ) {
    root = chains[0]![level]!;
  }
  const kept = new Set<number>([root]);
  // Hidden children are counted only where the change is: under the root, an
  // ancestor of a change, or a changed node. A context sibling hides its
  // children without a count.
  const counted = new Set<number>([root, ...changed]);
  const siblings = new Map<number, number[]>();
  rows.forEach((_, at) =>
    siblings.set(parentOf[at]!, [...(siblings.get(parentOf[at]!) ?? []), at]),
  );
  for (const at of changed) {
    for (const node of chain(at)) {
      kept.add(node);
      counted.add(node);
    }
    const around = siblings.get(parentOf[at]!) ?? [];
    const position = around.indexOf(at);
    for (const sibling of around.slice(Math.max(0, position - context), position + context + 1))
      kept.add(sibling);
  }
  const base = root < 0 ? 0 : rows[root]!.depth;
  const start = root < 0 ? 0 : root;
  const result: TreeDiffRow[] = [];
  let hidden: number[] = [];
  const flush = () => {
    if (hidden.length === 1)
      result.push({ ...rows[hidden[0]!]!, depth: rows[hidden[0]!]!.depth - base });
    else if (hidden.length > 1)
      result.push({ _tag: "Elided", depth: rows[hidden[0]!]!.depth - base, count: hidden.length });
    hidden = [];
  };
  for (let at = start; at < rows.length; at += 1) {
    const row = rows[at]!;
    if (root >= 0 && at > root && row.depth <= rows[root]!.depth) break;
    if (kept.has(at)) {
      flush();
      result.push({ ...row, depth: row.depth - base });
    } else if (counted.has(parentOf[at]!)) {
      // A hidden sibling under a shown parent; its own descendants are hidden with it.
      if (hidden.length > 0 && parentOf[hidden[0]!] !== parentOf[at]) flush();
      hidden.push(at);
    }
  }
  flush();
  return result;
};

/** How many nodes each kind of change touched. A node that moved and was edited counts as both. */
export const summarizeDiff = (
  rows: ReadonlyArray<TreeDiffRow>,
): Readonly<Record<Exclude<TreeDiffStatus, "Unchanged">, number>> => {
  const counts = { Added: 0, Removed: 0, Moved: 0, Edited: 0 };
  for (const row of rows) {
    if (row._tag !== "Node" || row.status === "Unchanged") continue;
    counts[row.status] += 1;
    // A node can move and be edited.
    if (row.status === "Moved" && row.was !== undefined) counts.Edited += 1;
  }
  return counts;
};

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: space.sm, minWidth: 0 },
  summary: { margin: 0, color: colors.foregroundMuted, fontSize: typography.sizeSm },
  list: {
    listStyle: "none",
    margin: 0,
    padding: space.xs,
    minWidth: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.surfaceForeground,
    fontSize: typography.sizeSm,
    lineHeight: "20px",
  },
  row: {
    display: "flex",
    alignItems: "baseline",
    gap: space.xs,
    minWidth: 0,
    paddingInlineEnd: space.xs,
    borderRadius: radii.sm,
  },
  added: { backgroundColor: colors.successSurface },
  removed: {
    backgroundColor: colors.dangerSurface,
    color: colors.foregroundMuted,
    textDecoration: "line-through",
  },
  moved: { backgroundColor: colors.infoSurface },
  edited: { backgroundColor: colors.warningSurface },
  marker: {
    flex: "none",
    width: "1.25em",
    textAlign: "center",
    fontWeight: typography.weightSemibold,
    color: colors.foregroundMuted,
  },
  addedMarker: { color: colors.success },
  removedMarker: { color: colors.danger },
  movedMarker: { color: colors.info },
  editedMarker: { color: colors.warning },
  label: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  was: {
    flex: "none",
    maxWidth: "45%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: colors.foregroundMuted,
  },
  elided: { color: colors.foregroundMuted, fontStyle: "italic" },
  hidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
});

const MARKERS: Readonly<Record<TreeDiffStatus, string>> = {
  Unchanged: "",
  Added: "+",
  Removed: "−",
  Moved: "→",
  Edited: "~",
};

const plural = (count: number, noun: string) => `${count} ${noun}`;

export type TreeDiffConfig = Readonly<{
  /** Accessible name for the diff. */
  label: string;
  before: ReadonlyArray<TreeDiffNode>;
  after: ReadonlyArray<TreeDiffNode>;
  /** Unchanged siblings shown beside each change. Defaults to 1. */
  context?: number;
  /** Shown when nothing changed. */
  emptyText?: string;
}>;

/**
 * The changed region of two versions of a tree, one row per node, marked as
 * added, removed, moved, or edited. Unchanged runs fold into a count.
 */
export const TreeDiff = {
  view: <Message>(config: TreeDiffConfig, h: HtmlBuilder<Message>): Html => {
    const rows = changedRegion(diffTrees(config.before, config.after), config.context ?? 1);
    const counts = summarizeDiff(rows);
    const summary = [
      counts.Added > 0 ? plural(counts.Added, "added") : "",
      counts.Removed > 0 ? plural(counts.Removed, "removed") : "",
      counts.Moved > 0 ? plural(counts.Moved, "moved") : "",
      counts.Edited > 0 ? plural(counts.Edited, "edited") : "",
    ]
      .filter((part) => part !== "")
      .join(" · ");
    return h.section(
      [...sxAttrs(h, styles.root), h.AriaLabel(config.label), h.DataAttribute("tree-diff", "true")],
      [
        h.p(sxAttrs(h, styles.summary), [
          rows.length === 0 ? (config.emptyText ?? "No changes.") : summary,
        ]),
        ...(rows.length === 0
          ? []
          : [
              h.ul(
                [...sxAttrs(h, styles.list), h.Role("list")],
                rows.map((row) =>
                  row._tag === "Elided"
                    ? h.li(
                        [
                          ...sxAttrs(h, styles.row, styles.elided),
                          h.DataAttribute("tree-diff-elided", String(row.count)),
                          h.Style({
                            paddingInlineStart: `calc(${row.depth} * 16px + 1.25em + 4px)`,
                          }),
                        ],
                        [`⋯ ${row.count} unchanged`],
                      )
                    : h.li(
                        [
                          ...sxAttrs(
                            h,
                            styles.row,
                            row.status === "Added" && styles.added,
                            row.status === "Removed" && styles.removed,
                            row.status === "Moved" && styles.moved,
                            row.status === "Edited" && styles.edited,
                          ),
                          h.DataAttribute("tree-diff-row", row.id),
                          h.DataAttribute("status", row.status),
                          h.Style({ paddingInlineStart: `calc(${row.depth} * 16px + 4px)` }),
                        ],
                        [
                          h.span(
                            [
                              ...sxAttrs(
                                h,
                                styles.marker,
                                row.status === "Added" && styles.addedMarker,
                                row.status === "Removed" && styles.removedMarker,
                                row.status === "Moved" && styles.movedMarker,
                                row.status === "Edited" && styles.editedMarker,
                              ),
                              h.AriaHidden(true),
                            ],
                            [MARKERS[row.status]],
                          ),
                          h.span(
                            [...sxAttrs(h, styles.label), h.Title(row.label)],
                            [row.label.split("\n")[0] || "Untitled"],
                          ),
                          ...(row.was === undefined
                            ? []
                            : [
                                h.span(
                                  [...sxAttrs(h, styles.was), h.Title(row.was)],
                                  [`was ${row.was.split("\n")[0]}`],
                                ),
                              ]),
                          ...(row.status === "Unchanged"
                            ? []
                            : [
                                h.span(sxAttrs(h, styles.hidden), [
                                  ` (${row.status === "Moved" && row.was !== undefined ? "moved and edited" : row.status.toLowerCase()})`,
                                ]),
                              ]),
                        ],
                      ),
                ),
              ),
            ]),
      ],
    );
  },
};
