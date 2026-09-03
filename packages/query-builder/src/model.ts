import { Schema as S } from "effect";

import { QueryGroup, createEmptyQuery, findNode, type QueryGroup as QueryGroupValue } from "./query";

export const Model = S.Struct({
  id: S.String,
  query: QueryGroup,
  nextId: S.Number,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  query?: QueryGroupValue;
}>;

export const nextAvailableId = (query: QueryGroupValue, start: number): number => {
  let candidate = Math.max(1, start);
  while (
    findNode(query, `rule-${candidate}`) !== undefined ||
    findNode(query, `group-${candidate}`) !== undefined
  ) candidate += 1;
  return candidate;
};

export const init = (config: InitConfig): Model => {
  const query = config.query ?? createEmptyQuery(`${config.id}-root`);
  return {
    id: config.id,
    query,
    nextId: nextAvailableId(query, 1),
  };
};
