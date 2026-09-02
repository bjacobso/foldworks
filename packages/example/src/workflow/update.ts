import { Match as M, Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";

import { Dialog } from "@foldkit/ui";
import { Workflow } from "@foldworks/workflow";

import {
  canMoveNode,
  deleteNode,
  dropLocationFromTarget,
  findNode,
  insertNewNode,
  isNodeKind,
  isNodeSize,
  kindFromPaletteItem,
  moveNode,
  updateNode,
} from "./graph";
import { Message } from "./message";
import { initialDocument, initialModel, type Model } from "./model";

type UpdateReturn = Update.Return<Model, Message>;

const foldInspectorOutMessage = M.type<Dialog.OutMessage>().pipe(
  M.withReturnType<Update.Step<Model, Message>>(),
  M.tagsExhaustive({
    Opened: () => (model) => ({ model }),
    Closed: () => (model) => ({
      model: evo(model, { selectedNodeId: () => Option.none() }),
    }),
  }),
);

const readInspector = (model: Model) => Option.some(model.inspector);
const writeInspector = (model: Model, inspector: Dialog.Model): Model =>
  evo(model, { inspector: () => inspector });
const toInspectorMessage = (message: Dialog.Message): Message =>
  Message.GotInspectorMessage({ message });

const foldInspector = Update.foldChild({
  update: Dialog.update,
  read: readInspector,
  write: writeInspector,
  toParentMessage: toInspectorMessage,
  foldOutMessage: foldInspectorOutMessage,
});

const foldInspectorOpen = Update.foldChildStep({
  update: Dialog.open,
  read: readInspector,
  write: writeInspector,
  toParentMessage: toInspectorMessage,
  foldOutMessage: foldInspectorOutMessage,
});

const foldInspectorClose = Update.foldChildStep({
  update: Dialog.close,
  read: readInspector,
  write: writeInspector,
  toParentMessage: toInspectorMessage,
  foldOutMessage: foldInspectorOutMessage,
});

const commitDrop = (
  previousModel: Model,
  outMessage: Workflow.OutMessage,
): Update.Step<Model, Message> =>
  (model) =>
    Workflow.OutMessage.match<UpdateReturn>(outMessage, {
      Cancelled: () => ({
        model: evo(model, {
          announcement: () => "Drag cancelled. The workflow was not changed.",
        }),
      }),
      Reordered: ({ itemId, toContainerId }) => {
        const location = dropLocationFromTarget(toContainerId);
        if (location === undefined) {
          return {
            model: evo(model, {
              announcement: () => "Choose a highlighted insertion point.",
            }),
          };
        }

        const paletteKind = kindFromPaletteItem(itemId);
        if (paletteKind !== undefined) {
          const inserted = insertNewNode(
            model.document,
            location,
            paletteKind,
            model.nextId,
          );
          if (inserted === undefined) return { model };
          return {
            model: evo(model, {
              document: () => inserted.document,
              nextId: (value) => value + 1,
              revision: (value) => value + 1,
              announcement: () => `${inserted.node.data.title} added to the workflow.`,
            }),
          };
        }

        const moved = moveNode(model.document, itemId, location);
        if (moved === undefined) {
          const node = findNode(previousModel.document, itemId);
          return {
            model: evo(model, {
              announcement: () =>
                node === undefined
                  ? "That node could not be moved."
                  : `${node.data.title} cannot be moved to that location.`,
            }),
          };
        }

        const movedNode = findNode(model.document, itemId);
        return {
          model: evo(model, {
            document: () => moved,
            revision: (value) => value + 1,
            announcement: () => `${movedNode?.data.title ?? "Node"} moved.`,
          }),
        };
      },
    });

const foldWorkflow = (previousModel: Model) =>
  Update.foldChild({
    update: Workflow.update,
    read: (model: Model) => Option.some(model.workflow),
    write: (model, workflow) => evo(model, { workflow: () => workflow }),
    toParentMessage: (message) => Message.GotWorkflowMessage({ message }),
    foldOutMessage: (outMessage) => commitDrop(previousModel, outMessage),
  });

const updateSelectedNode = (
  model: Model,
  update: Parameters<typeof updateNode>[2],
  shouldRebalance = false,
): UpdateReturn =>
  Option.match(model.selectedNodeId, {
    onNone: () => ({ model }),
    onSome: (nodeId) => ({
      model: evo(model, {
        document: (document) => updateNode(document, nodeId, update),
        revision: (value) => (shouldRebalance ? value + 1 : value),
      }),
    }),
  });

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    GotWorkflowMessage: ({ message: workflowMessage }) =>
      foldWorkflow(model)(model, workflowMessage),

    GotInspectorMessage: ({ message: inspectorMessage }) =>
      foldInspector(model, inspectorMessage),

    ClickedNode: ({ nodeId }) => {
      const selected = evo(model, {
        selectedNodeId: () => Option.some(nodeId),
      });
      return foldInspectorOpen(selected);
    },

    ClickedQuickAdd: ({ locationId }) => {
      const location = dropLocationFromTarget(locationId);
      if (location === undefined) return { model };
      const inserted = insertNewNode(
        model.document,
        location,
        "action",
        model.nextId,
      );
      if (inserted === undefined) return { model };
      const next = evo(model, {
        document: () => inserted.document,
        selectedNodeId: () => Option.some(inserted.node.id),
        nextId: (value) => value + 1,
        revision: (value) => value + 1,
        announcement: () => `${inserted.node.data.title} added.`,
      });
      return foldInspectorOpen(next);
    },

    ChangedSelectedNodeTitle: ({ value }) =>
      updateSelectedNode(model, (node) => ({
        ...node,
        data: { ...node.data, title: value },
      })),

    ChangedSelectedNodeDescription: ({ value }) =>
      updateSelectedNode(model, (node) => ({
        ...node,
        data: { ...node.data, description: value },
      })),

    ChangedSelectedNodeType: ({ value }) =>
      isNodeKind(value)
        ? updateSelectedNode(
            model,
            (node) => ({ ...node, type: value }),
            true,
          )
        : { model },

    ChangedSelectedNodeSize: ({ value }) =>
      isNodeSize(value)
        ? updateSelectedNode(
            model,
            (node) => ({
              ...node,
              data: { ...node.data, size: value },
            }),
            true,
          )
        : { model },

    ClickedDeleteSelectedNode: () =>
      Option.match(model.selectedNodeId, {
        onNone: () => ({ model }),
        onSome: (nodeId) => {
          const selected = findNode(model.document, nodeId);
          const document = deleteNode(model.document, nodeId);
          if (document === undefined) {
            return {
              model: evo(model, {
                announcement: () => "This structural node cannot be deleted.",
              }),
            };
          }
          const next = evo(model, {
            document: () => document,
            revision: (value) => value + 1,
            announcement: () => `${selected?.data.title ?? "Node"} deleted.`,
          });
          return foldInspectorClose(next);
        },
      }),

    ClickedResetWorkflow: () => {
      const reset = evo(model, {
        document: () => initialDocument,
        nextId: () => initialModel.nextId,
        revision: (value) => value + 1,
        announcement: () => "Workflow reset to the example.",
      });
      return model.inspector.isOpen ? foldInspectorClose(reset) : { model: reset };
    },
  });
