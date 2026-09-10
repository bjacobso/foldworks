import { Schema as S } from "effect";
import { Stateful } from "@foldworks/ui";
import { defineMessageUnion } from "foldkit/message";

import { EventEnvelope } from "./protocol";

export const Message = defineMessageUnion({
  GotModelPickerMessage: { message: Stateful.Select.Message },
  ChangedDraft: { value: S.String },
  Submitted: {},
  SelectedSuggestion: { prompt: S.String },
  ReceivedStreamEvent: { envelope: EventEnvelope },
  ChosePermission: { decision: S.Literals(["Allow", "Deny"]) },
  Stopped: {},
  Retried: {},
  Reset: {},
  ScrolledTranscript: { scrollTop: S.Number },
  CompletedMeasureFollowing: { isFollowing: S.Boolean },
  JumpedLatest: {},
  CompletedScrollLatest: {},
});
export type Message = typeof Message.Type;
