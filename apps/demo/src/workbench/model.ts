import { Option, Schema as S } from "effect";
import { DataGrid } from "@foldworks/data-grid";
import { ValueTree } from "@foldworks/ui";

import { initialSnapshot, Proposal, Snapshot } from "./domain";
import { initialLoaded, ROOT_ID } from "./record";

export const Panel = S.Literals(["Overview", "Explain", "Edit", "Preview", "History", "Record"]);
export const Model = S.Struct({
  snapshot: Snapshot,
  grid: DataGrid.Model,
  selectedId: S.String,
  panel: Panel,
  /** The selected worker's source record, as a tree. */
  record: ValueTree.Model,
  /** How many children of each branch of the record have loaded. */
  loaded: S.Record(S.String, S.Number),
  proposal: S.Option(Proposal),
  applying: S.Boolean,
  error: S.String,
  storageError: S.String,
  announcement: S.String,
});
export type Model = typeof Model.Type;
/** A fresh record tree for a newly selected worker, open at its top level. */
export const initRecord = () => ({
  record: ValueTree.init({ id: "worker-record", expandedIds: [ROOT_ID] }),
  loaded: initialLoaded,
});
export const init = (snapshot: Snapshot = initialSnapshot, storageError = ""): Model => ({
  snapshot,
  grid: DataGrid.init({
    id: "workers",
    columns: [
      { id: "name", width: 205 },
      { id: "employer", width: 100 },
      { id: "state", width: 84 },
      { id: "i9", width: 105 },
      { id: "eligible", width: 125 },
      { id: "tasks", width: 100 },
    ],
  }),
  selectedId: "",
  panel: "Overview",
  ...initRecord(),
  proposal: Option.none(),
  applying: false,
  error: "",
  storageError,
  announcement: "Workers ready. Select a worker to inspect their record.",
});
