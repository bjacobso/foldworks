import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Agent } from "@foldworks/agent";
import { Outliner } from "@foldworks/outliner";
import { DateInput } from "@foldworks/ui";
import { DetailView } from "./model";

export const Message = defineMessageUnion({
  GotOutlineMessage: { message: Outliner.Message },
  GotThreadMessage: { id: S.String, message: Agent.Message },
  OpenedNode: { id: S.String },
  ClosedDetail: {},
  AttachedThread: { id: S.String },
  AddedThread: {},
  StartedThread: { id: S.String },
  AdvancedRuns: {},
  ChangedDetailView: { value: DetailView },
  GotDueDateMessage: { id: S.String, message: DateInput.Message },
  PromotedResult: { id: S.String },
  ToggledFoldedViews: {},
  CompletedSave: { succeeded: S.Boolean },
});
export type Message = typeof Message.Type;
