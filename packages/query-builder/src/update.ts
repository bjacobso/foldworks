import type { Update } from "foldkit";

import { Message } from "./message";
import type { Model } from "./model";
import { nextAvailableId } from "./model";
import { appendNode, findNode, mapNode, removeNode } from "./query";

type UpdateReturn = Update.Return<Model, Message>;

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    AddedRule: ({ groupId, attributeId, operatorId, value }) => {
      const id = `rule-${model.nextId}`;
      const query = appendNode(model.query, groupId, {
        _tag: "Rule",
        id,
        attributeId,
        operatorId,
        value,
      });
      return query === undefined
        ? { model }
        : { model: { ...model, query, nextId: nextAvailableId(query, model.nextId + 1) } };
    },
    AddedGroup: ({ groupId }) => {
      const id = `group-${model.nextId}`;
      const query = appendNode(model.query, groupId, {
        _tag: "Group",
        id,
        combinator: "All",
        children: [],
      });
      return query === undefined
        ? { model }
        : { model: { ...model, query, nextId: nextAvailableId(query, model.nextId + 1) } };
    },
    RemovedNode: ({ nodeId }) => {
      const query = removeNode(model.query, nodeId);
      return query === undefined ? { model } : { model: { ...model, query } };
    },
    ChangedCombinator: ({ groupId, combinator }) => {
      const node = findNode(model.query, groupId);
      return node?._tag !== "Group"
        ? { model }
        : {
            model: {
              ...model,
              query: mapNode(model.query, groupId, (candidate) => candidate._tag === "Group"
                ? { ...candidate, combinator }
                : candidate),
            },
          };
    },
    ChangedAttribute: ({ ruleId, attributeId, operatorId, value }) => {
      const node = findNode(model.query, ruleId);
      return node?._tag !== "Rule"
        ? { model }
        : {
            model: {
              ...model,
              query: mapNode(model.query, ruleId, (candidate) => candidate._tag === "Rule"
                ? { ...candidate, attributeId, operatorId, value }
                : candidate),
            },
          };
    },
    ChangedOperator: ({ ruleId, operatorId }) => {
      const node = findNode(model.query, ruleId);
      return node?._tag !== "Rule"
        ? { model }
        : {
            model: {
              ...model,
              query: mapNode(model.query, ruleId, (candidate) => candidate._tag === "Rule"
                ? { ...candidate, operatorId }
                : candidate),
            },
          };
    },
    ChangedValue: ({ ruleId, value }) => {
      const node = findNode(model.query, ruleId);
      return node?._tag !== "Rule"
        ? { model }
        : {
            model: {
              ...model,
              query: mapNode(model.query, ruleId, (candidate) => candidate._tag === "Rule"
                ? { ...candidate, value }
                : candidate),
            },
          };
    },
  });
