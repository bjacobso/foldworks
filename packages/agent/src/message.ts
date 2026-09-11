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
  RegeneratedTurn: { turnId: S.String },
  CopiedTurn: { turnId: S.String },
  CompletedCopyTurn: { turnId: S.String },
  ClearedCopiedTurn: { turnId: S.String },
  Reset: {},
  ScrolledTranscript: { scrollTop: S.Number },
  CompletedMeasureTranscript: {
    isFollowing: S.Boolean,
    currentTurnId: S.String,
    visibleTurnIds: S.Array(S.String),
  },
  JumpedLatest: {},
  JumpedToTurn: { turnId: S.String },
  CompletedScrollLatest: {},
  CompletedScrollToTurn: { turnId: S.String },
});
export type Message = typeof Message.Type;
