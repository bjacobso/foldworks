import { Schema as S } from "effect";

import { QueryBuilder } from "@foldworks/query-builder";

import { initialQuery } from "./configuration";

export const Model = S.Struct({
  builder: QueryBuilder.Model,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  builder: QueryBuilder.init({ id: "employee-query", query: initialQuery }),
  announcement: "Query builder ready.",
};
