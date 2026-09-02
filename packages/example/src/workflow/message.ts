import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Dialog } from "@foldkit/ui";
import { Workflow } from "@foldworks/workflow";

export const Message = defineMessageUnion({
  GotWorkflowMessage: { message: Workflow.Message },
  GotInspectorMessage: { message: Dialog.Message },
  ClickedNode: { nodeId: S.String },
  ClickedQuickAdd: { locationId: S.String },
  ChangedSelectedNodeTitle: { value: S.String },
  ChangedSelectedNodeDescription: { value: S.String },
  ChangedSelectedNodeType: { value: S.String },
  ChangedSelectedNodeSize: { value: S.String },
  ClickedDeleteSelectedNode: {},
  ClickedResetWorkflow: {},
});
export type Message = typeof Message.Type;
