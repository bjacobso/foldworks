import { Schema as S } from "effect";
import { DragAndDrop } from "@foldkit/ui";

import { DEFAULT_ACTIVATION_THRESHOLD } from "./interaction";
import { QueryGroup, createEmptyQuery, findNode, type QueryGroup as QueryGroupValue } from "./query";

export const Model = S.Struct({
  id: S.String,
  query: QueryGroup,
  nextId: S.Number,
  interaction: DragAndDrop.Model,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  query?: QueryGroupValue;
  activationThreshold?: number;
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
    interaction: DragAndDrop.init({
      id: `${config.id}-rule-drag-and-drop`,
      orientation: "Vertical",
      activationThreshold: config.activationThreshold ?? DEFAULT_ACTIVATION_THRESHOLD,
    }),
  };
};
