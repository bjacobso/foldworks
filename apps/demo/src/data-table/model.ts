import { Option, Schema as S } from "effect";

export const Sorting = S.Struct({
  columnId: S.String,
  direction: S.Literals(["Ascending", "Descending"]),
});
export type Sorting = typeof Sorting.Type;

export const Model = S.Struct({
  query: S.String,
  selectedRowIds: S.Array(S.String),
  sorting: S.Option(Sorting),
  density: S.Literals(["Compact", "Comfortable"]),
  activeContactId: S.String,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const init = (activeContactId = ""): Model => ({
  query: "",
  selectedRowIds: [],
  sorting: Option.some({ columnId: "lastContact", direction: "Ascending" }),
  density: "Compact",
  activeContactId,
  announcement: "People table ready.",
});

export const setActiveContact = (model: Model, activeContactId: string): Model =>
  model.activeContactId === activeContactId ? model : { ...model, activeContactId };
