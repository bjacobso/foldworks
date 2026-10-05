import { Schema as S } from "effect";
export const Model = S.Struct({ query: S.String, explorer: S.String, events: S.Array(S.String) });
export type Model = typeof Model.Type;
export const init = (explorer = "sidebar"): Model => ({ query: "", explorer, events: [] });
