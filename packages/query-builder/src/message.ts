import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Combinator } from "./query";

export const Message = defineMessageUnion({
  AddedRule: {
    groupId: S.String,
    attributeId: S.String,
    operatorId: S.String,
    value: S.String,
  },
  AddedGroup: { groupId: S.String },
  RemovedNode: { nodeId: S.String },
  ChangedCombinator: { groupId: S.String, combinator: Combinator },
  ChangedAttribute: {
    ruleId: S.String,
    attributeId: S.String,
    operatorId: S.String,
    value: S.String,
  },
  ChangedOperator: { ruleId: S.String, operatorId: S.String },
  ChangedValue: { ruleId: S.String, value: S.String },
});
export type Message = typeof Message.Type;
