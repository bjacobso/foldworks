import { walk, type Item, type Items } from "@foldworks/outliner";

export type DiffStatus = "Same" | "Added" | "Removed" | "Moved" | "Edited";

export type DiffRow = Readonly<{
  id: string;
  text: string;
  depth: number;
  status: DiffStatus;
  /** The previous text of an edited item. */
  was?: string;
}>;

type Place = Readonly<{ parentId: string | null; text: string }>;

const places = (items: Items): ReadonlyMap<string, Place> => {
  const result = new Map<string, Place>();
  const visit = (nodes: Items, parentId: string | null) =>
    nodes.forEach((node) => {
      result.set(node.id, { parentId, text: node.text });
      visit(node.children, node.id);
    });
  visit(items, null);
  return result;
};

/**
 * A structural diff of two outlines that share ids. Rows follow `after`;
 * removed items appear at the end of their old parent. Only the smallest
 * subtree that holds every change is returned.
 */
export const treeDiff = (before: Items, after: Items): ReadonlyArray<DiffRow> => {
  const old = places(before);
  const current = places(after);
  const removedRoots = walk(before).filter(
    (node) =>
      !current.has(node.id) &&
      (old.get(node.id)!.parentId === null || current.has(old.get(node.id)!.parentId!)),
  );
  const removedUnder = new Map<string | null, Item[]>();
  for (const node of removedRoots) {
    const parentId = old.get(node.id)!.parentId;
    removedUnder.set(parentId, [...(removedUnder.get(parentId) ?? []), node]);
  }

  const rows: DiffRow[] = [];
  const parentOf = new Map<string, string | null>();
  // Children that survive elsewhere are listed where they now live.
  const removedRows = (nodes: Items, depth: number, parentId: string | null) =>
    nodes.forEach((node) => {
      if (current.has(node.id)) return;
      rows.push({ id: node.id, text: node.text, depth, status: "Removed" });
      parentOf.set(node.id, parentId);
      removedRows(node.children, depth + 1, node.id);
    });
  const visit = (nodes: Items, depth: number, parentId: string | null) => {
    for (const node of nodes) {
      const previous = old.get(node.id);
      const status: DiffStatus =
        previous === undefined
          ? "Added"
          : previous.text !== node.text
            ? "Edited"
            : previous.parentId !== parentId
              ? "Moved"
              : "Same";
      rows.push({
        id: node.id,
        text: node.text,
        depth,
        status,
        ...(status === "Edited" ? { was: previous!.text } : {}),
      });
      parentOf.set(node.id, parentId);
      visit(node.children, depth + 1, node.id);
    }
    removedRows(removedUnder.get(parentId) ?? [], depth, parentId);
  };
  visit(after, 0, null);

  const changed = rows.filter((row) => row.status !== "Same");
  if (changed.length === 0) return [];
  // The deepest row whose subtree contains every change.
  const chain = (id: string): ReadonlyArray<string> => {
    const path: string[] = [];
    for (let at: string | null = id; at !== null; at = parentOf.get(at) ?? null) path.unshift(at);
    return path;
  };
  const chains = changed.map((row) => chain(parentOf.get(row.id) ?? row.id));
  let common: string | null = null;
  for (let index = 0; chains.every((path) => path[index] !== undefined); index += 1) {
    const candidate = chains[0]![index]!;
    if (!chains.every((path) => path[index] === candidate)) break;
    common = candidate;
  }
  if (common === null) {
    const tops = new Set(changed.map((row) => chain(row.id)[0]!));
    const kept = rows.filter((row) => tops.has(chain(row.id)[0]!));
    return kept;
  }
  const start = rows.findIndex((row) => row.id === common);
  const base = rows[start]!.depth;
  const subtree = [rows[start]!];
  for (const row of rows.slice(start + 1)) {
    if (row.depth <= base) break;
    subtree.push(row);
  }
  return subtree.map((row) => ({ ...row, depth: row.depth - base }));
};
