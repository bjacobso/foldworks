import { Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";
import { DragAndDrop } from "@foldkit/ui";

import { applyRuleReorder } from "./interaction";
import { Message } from "./message";
import type { Model } from "./model";
import { nextAvailableId } from "./model";
import { appendNode, findNode, mapNode, removeNode } from "./query";

type UpdateReturn = Update.Return<Model, Message>;

const commitDrop = (outMessage: DragAndDrop.OutMessage): Update.Step<Model, Message> =>
  (model) => DragAndDrop.OutMessage.match<UpdateReturn>(outMessage, {
    Cancelled: () => ({ model }),
    Reordered: (reordered) => {
      const query = applyRuleReorder({
        query: model.query,
        reordered: DragAndDrop.OutMessage.Reordered(reordered),
      });
      return query === undefined || query === model.query
        ? { model }
        : { model: { ...model, query } };
    },
  });

const foldInteraction = Update.foldChild({
  update: DragAndDrop.update,
  read: (model: Model) => Option.some(model.interaction),
  write: (model, interaction) => evo(model, { interaction: () => interaction }),
  toParentMessage: (message) => Message.GotInteractionMessage({ message }),
  foldOutMessage: commitDrop,
});

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotInteractionMessage: ({ message: interactionMessage }) =>
      foldInteraction(model, interactionMessage),
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
