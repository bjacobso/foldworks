import { ActionIntent } from "@foldworks/generative-ui/core";
import { defineMessageUnion } from "foldkit/message";
import { Schema as S } from "effect";
import { CassetteId } from "./cassettes";
import { GenerationResult } from "./generation";

export const Message = defineMessageUnion({
  ReceivedIntent: { intent: ActionIntent },
  ReceivedGeneratedIntent: { intent: ActionIntent },
  ChangedPrompt: { value: S.String },
  SelectedCassette: { cassetteId: CassetteId },
  RequestedGeneration: {},
  CompletedGeneration: {
    requestId: S.Int,
    prompt: S.String,
    cassetteId: CassetteId,
    result: GenerationResult,
  },
  ToggledDocument: {},
  Reset: {},
});
export type Message = typeof Message.Type;
