import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Dialog } from "@foldkit/ui";
import { Workflow } from "@foldworks/workflow";
import { WorkflowOrientation } from "../app/route";

export const Message = defineMessageUnion({
  CompletedExportDocument: {},
  CompletedImportDocument: { json: S.String },
  CancelledImportDocument: {},
  FailedImportDocument: { reason: S.String },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedExportDocument: {},
  ClickedImportDocument: {},
  GotWorkflowMessage: { message: Workflow.Message },
  SelectedOrientation: { orientation: WorkflowOrientation },
  GotInspectorMessage: { message: Dialog.Message },
  ClickedNode: { nodeId: S.String },
  ClickedQuickAdd: { locationId: S.String },
  ChangedSelectedNodeTitle: { value: S.String },
  ChangedSelectedNodeDescription: { value: S.String },
  ChangedSelectedNodeType: { value: S.String },
  ChangedSelectedNodeSize: { value: S.String },
  ClickedDeleteSelectedNode: {},
  ClickedReset: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  Changed: {},
  RequestedOrientation: { orientation: WorkflowOrientation },
});
export type OutMessage = typeof OutMessage.Type;
