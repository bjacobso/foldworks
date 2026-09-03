import { defineMessageUnion } from "foldkit/message";

import { QueryBuilder } from "@foldworks/query-builder";

export const Message = defineMessageUnion({
  GotQueryBuilderMessage: { message: QueryBuilder.Message },
});
export type Message = typeof Message.Type;
