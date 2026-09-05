import { Option, Schema as S } from "effect";
import { DataGrid } from "@foldworks/data-grid";

import { initialSnapshot, Proposal, Snapshot } from "./domain";

export const Panel = S.Literals(["Overview", "Explain", "Edit", "Preview", "History"]);
export const Model = S.Struct({
  snapshot: Snapshot,
  grid: DataGrid.Model,
  selectedId: S.String,
  panel: Panel,
  proposal: S.Option(Proposal),
  applying: S.Boolean,
  error: S.String,
  storageError: S.String,
  announcement: S.String,
});
export type Model = typeof Model.Type;
export const init = (snapshot: Snapshot = initialSnapshot, storageError = ""): Model => ({
  snapshot,
  grid: DataGrid.init({ id: "workers", columns: [
    { id: "name", width: 205 }, { id: "employer", width: 100 },
    { id: "state", width: 84 }, { id: "i9", width: 105 },
    { id: "eligible", width: 125 }, { id: "tasks", width: 100 },
  ] }),
  selectedId: "",
  panel: "Overview",
  proposal: Option.none(),
  applying: false,
  error: "",
  storageError,
  announcement: "Workers ready. Select a worker to inspect their record.",
});
