import type { Model } from "./model";
import { roots, visibleRows, type Row } from "./outline";

export const rowsOf = (model: Model): ReadonlyArray<Row> => visibleRows(model.items, model.scopeId);

/** Visible rows between the selection's anchor and head, inclusive, in order. */
export const selectedIds = (
  model: Model,
  rows: ReadonlyArray<Row> = rowsOf(model),
): ReadonlyArray<string> => {
  if (model.selection === null) return [];
  const anchor = rows.findIndex((row) => row.id === model.selection!.anchorId);
  const head = rows.findIndex((row) => row.id === model.selection!.headId);
  if (head < 0) return [];
  if (anchor < 0) return [model.selection.headId];
  return rows.slice(Math.min(anchor, head), Math.max(anchor, head) + 1).map((row) => row.id);
};

/** The outermost selected items; their descendants travel with them. */
export const selectedRoots = (model: Model): ReadonlyArray<string> =>
  roots(model.items, selectedIds(model));
