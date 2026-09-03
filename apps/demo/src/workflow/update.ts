import { Effect, Match as M, Option, Schema as S } from "effect";
import { Command, File, Update } from "foldkit";
import { evo } from "foldkit/struct";

import { Dialog } from "@foldkit/ui";
import { History } from "@foldworks/history";
import { Workflow, applyReorder } from "@foldworks/workflow";

import {
  downloadJson,
  nextWorkflowId,
  parseWorkflowExport,
  serializeWorkflowExport,
} from "../document-storage";
import {
  canMoveNode,
  deleteNode,
  dropLocationFromTarget,
  findNode,
  insertNewNode,
  isNodeKind,
  isNodeSize,
  operations,
  updateNode,
} from "./graph";
import { Message, OutMessage } from "./message";
import { initialDocument, initialModel, type Model } from "./model";
import { nodeTypes } from "./node-types";

type UpdateReturn = Update.Return<Model, Message>;
type ChildUpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
type ImportResult = Extract<Message, {
  readonly _tag:
    | "CompletedImportDocument"
    | "CancelledImportDocument"
    | "FailedImportDocument";
}>;

const ExportDocument = Command.define("ExportWorkflowDocument", {
  args: { filename: S.String, json: S.String },
  messages: [Message.CompletedExportDocument],
  execute: ({ filename, json }) => Effect.sync(() => {
    downloadJson(filename, json);
    return Message.CompletedExportDocument();
  }),
});

const ImportDocument = Command.define("ImportWorkflowDocument", {
  args: {},
  messages: [
    Message.CompletedImportDocument,
    Message.CancelledImportDocument,
    Message.FailedImportDocument,
  ],
  execute: () => File.select(["application/json", ".json"]).pipe(
    Effect.flatMap((selected): Effect.Effect<ImportResult> => {
      if (Option.isNone(selected)) return Effect.succeed(Message.CancelledImportDocument());
      return File.readAsText(selected.value).pipe(
        Effect.map((json): ImportResult => Message.CompletedImportDocument({ json })),
        Effect.catch(() => Effect.succeed<ImportResult>(Message.FailedImportDocument({
          reason: "The selected file could not be read.",
        }))),
      );
    }),
  ),
});

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
  (model) => Workflow.OutMessage.match<UpdateReturn>(outMessage, {
    Cancelled: () => ({
      model: evo(model, {
        announcement: () => "Drag cancelled. The workflow was not changed.",
      }),
    }),
    Reordered: (reordered) => {
      const result = applyReorder({
        document: model.document,
        reordered: Workflow.OutMessage.Reordered(reordered),
        operations,
        createFromPalette: (type) =>
          isNodeKind(type) && nodeTypes[type].palette !== undefined
            ? nodeTypes[type].create(`node-${model.nextId}`)
            : undefined,
      });
      if (result === undefined) {
        const node = findNode(previousModel.document, reordered.itemId);
        return {
          model: evo(model, {
            announcement: () => node === undefined
              ? "Choose a highlighted insertion point."
              : `${node.data.title} cannot be moved to that location.`,
          }),
        };
      }
      if (result._tag === "Inserted") {
        return {
          model: evo(model, {
            document: () => result.document,
            nextId: (value) => value + 1,
            revision: (value) => value + 1,
            announcement: () => `${result.element.data.title} added to the workflow.`,
          }),
        };
      }
      const movedNode = findNode(model.document, result.elementId);
      return {
        model: evo(model, {
          document: () => result.document,
          revision: (value) => value + 1,
          announcement: () => `${movedNode?.data.title ?? "Node"} moved.`,
        }),
      };
    },
  });

const foldWorkflow = (previousModel: Model) => Update.foldChild({
  update: Workflow.update,
  read: (model: Model) => Option.some(model.workflow),
  write: (model, workflow) => evo(model, { workflow: () => workflow }),
  toParentMessage: (message) => Message.GotWorkflowMessage({ message }),
  foldOutMessage: (outMessage) => commitDrop(previousModel, outMessage),
});

const updateSelectedNode = (
  model: Model,
  change: Parameters<typeof updateNode>[2],
  shouldRebalance = false,
): UpdateReturn => Option.match(model.selectedNodeId, {
  onNone: () => ({ model }),
  onSome: (nodeId) => {
    const document = updateNode(model.document, nodeId, change);
    return document === undefined
      ? { model }
      : {
          model: evo(model, {
            document: () => document,
            revision: (value) => shouldRebalance ? value + 1 : value,
          }),
        };
  },
});

const coalescingKey = (model: Model, message: Message): string | undefined => {
  const nodeId = Option.getOrUndefined(model.selectedNodeId);
  if (nodeId === undefined) return undefined;
  switch (message._tag) {
    case "ChangedSelectedNodeTitle": return `workflow:${nodeId}:title`;
    case "ChangedSelectedNodeDescription": return `workflow:${nodeId}:description`;
    default: return undefined;
  }
};

const restoreFromHistory = (model: Model, direction: "Undo" | "Redo"): UpdateReturn => {
  const step = direction === "Undo"
    ? History.undo(model.workflowHistory, model.document)
    : History.redo(model.workflowHistory, model.document);
  if (step === undefined) return { model };
  const selectedNodeId = Option.getOrUndefined(model.selectedNodeId);
  const keepsSelection = selectedNodeId !== undefined &&
    findNode(step.value, selectedNodeId) !== undefined;
  return {
    model: evo(model, {
      document: () => step.value,
      workflowHistory: () => step.history,
      selectedNodeId: () => keepsSelection ? model.selectedNodeId : Option.none(),
      inspector: () => keepsSelection
        ? model.inspector
        : Dialog.init({ id: model.inspector.id, isAnimated: true }),
      nextId: () => nextWorkflowId(step.value),
      revision: (value) => value + 1,
      announcement: () => `${direction} completed for the workflow.`,
    }),
  };
};

const updateCore = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    CompletedExportDocument: () => ({
      model: evo(model, { announcement: () => "Workflow JSON exported." }),
    }),
    CancelledImportDocument: () => ({ model }),
    FailedImportDocument: ({ reason }) => ({
      model: evo(model, { announcement: () => reason }),
    }),
    ClickedUndo: () => restoreFromHistory(model, "Undo"),
    ClickedRedo: () => restoreFromHistory(model, "Redo"),
    ClickedExportDocument: () => ({
      model,
      commands: [ExportDocument({
        filename: "candidate-workflow.workflow.json",
        json: serializeWorkflowExport(model.document),
      })],
    }),
    ClickedImportDocument: () => ({ model, commands: [ImportDocument({})] }),
    CompletedImportDocument: ({ json }) => {
      const document = parseWorkflowExport(json);
      return document === undefined
        ? {
            model: evo(model, {
              announcement: () => "That file is not a valid workflow export.",
            }),
          }
        : {
            model: evo(model, {
              document: () => document,
              workflow: (workflow) => Workflow.init({
                id: workflow.id,
                orientation: workflow.orientation,
                activationThreshold: workflow.activationThreshold,
              }),
              selectedNodeId: () => Option.none(),
              inspector: () => Dialog.init({ id: model.inspector.id, isAnimated: true }),
              nextId: () => nextWorkflowId(document),
              revision: (value) => value + 1,
              announcement: () => "Workflow imported.",
            }),
          };
    },
    GotWorkflowMessage: ({ message: workflowMessage }) =>
      foldWorkflow(model)(model, workflowMessage),
    SelectedOrientation: () => ({ model }),
    GotInspectorMessage: ({ message: inspectorMessage }) =>
      foldInspector(model, inspectorMessage),
    ClickedNode: ({ nodeId }) => {
      const selected = evo(model, {
        selectedNodeId: () => Option.some(nodeId),
        workflowHistory: (history) => History.breakCoalescing(history),
      });
      return foldInspectorOpen(selected);
    },
    ClickedQuickAdd: ({ locationId }) => {
      const location = dropLocationFromTarget(locationId);
      if (location === undefined) return { model };
      const inserted = insertNewNode(model.document, location, "action", model.nextId);
      if (inserted === undefined) return { model };
      return foldInspectorOpen(evo(model, {
        document: () => inserted.document,
        selectedNodeId: () => Option.some(inserted.node.id),
        nextId: (value) => value + 1,
        revision: (value) => value + 1,
        announcement: () => `${inserted.node.data.title} added.`,
      }));
    },
    ChangedSelectedNodeTitle: ({ value }) => updateSelectedNode(model, (node) => ({
      ...node,
      data: { ...node.data, title: value },
    })),
    ChangedSelectedNodeDescription: ({ value }) => updateSelectedNode(model, (node) => ({
      ...node,
      data: { ...node.data, description: value },
    })),
    ChangedSelectedNodeType: ({ value }) => isNodeKind(value)
      ? updateSelectedNode(model, (node) => ({ ...node, type: value }), true)
      : { model },
    ChangedSelectedNodeSize: ({ value }) => isNodeSize(value)
      ? updateSelectedNode(model, (node) => ({
          ...node,
          data: { ...node.data, size: value },
        }), true)
      : { model },
    ClickedDeleteSelectedNode: () => Option.match(model.selectedNodeId, {
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
        return foldInspectorClose(evo(model, {
          document: () => document,
          revision: (value) => value + 1,
          announcement: () => `${selected?.data.title ?? "Node"} deleted.`,
        }));
      },
    }),
    ClickedReset: () => {
      const reset = evo(model, {
        document: () => initialDocument,
        nextId: () => initialModel.nextId,
        revision: (value) => value + 1,
        announcement: () => "Workflow reset to the example.",
      });
      return model.inspector.isOpen ? foldInspectorClose(reset) : { model: reset };
    },
  });

export const setOrientation = (model: Model, orientation: Model["workflow"]["orientation"]): Model =>
  model.workflow.orientation === orientation
    ? model
    : evo(model, {
        workflow: (workflow) => Workflow.init({
          id: workflow.id,
          orientation,
          activationThreshold: workflow.activationThreshold,
        }),
        workflowHistory: (history) => History.breakCoalescing(history),
        revision: (value) => value + 1,
        announcement: () => `${orientation} workflow layout selected.`,
      });

export const update = (model: Model, message: Message): ChildUpdateReturn => {
  if (message._tag === "SelectedOrientation") {
    return {
      model,
      outMessage: OutMessage.RequestedOrientation({ orientation: message.orientation }),
    };
  }

  const result = updateCore(model, message);
  if (result.model.document === model.document) return result;
  const traversedHistory = message._tag === "ClickedUndo" || message._tag === "ClickedRedo";
  const key = coalescingKey(model, message);
  return {
    ...result,
    model: evo(result.model, {
      workflowHistory: () => traversedHistory
        ? result.model.workflowHistory
        : History.record(
            model.workflowHistory,
            model.document,
            key === undefined ? {} : { coalescingKey: key },
          ),
    }),
    outMessage: OutMessage.Changed(),
  };
};
