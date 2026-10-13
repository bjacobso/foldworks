import { Option, Schema as S } from "effect";
import { Spec } from "@foldworks/generative-ui/core";

import { CrewId } from "./catalog";
import { CassetteId, cassettes } from "./cassettes";

export const Model = S.Struct({
  filter: S.String,
  selected: CrewId,
  note: S.String,
  outcome: S.Literals(["Idle", "Accepted", "Refused", "Invalid"]),
  receipt: S.String,
  lastIntent: S.String,
  showDocument: S.Boolean,
  prompt: S.String,
  cassetteId: CassetteId,
  generationState: S.Literals(["Idle", "Loading", "Ready", "Error"]),
  generationError: S.String,
  requestId: S.Int,
  generatedSpec: S.Option(Spec),
  generatedPrompt: S.String,
  generatedCassette: CassetteId,
});
export type Model = typeof Model.Type;

export const init = (): Model => ({
  filter: "",
  selected: "arthur",
  note: "",
  outcome: "Idle",
  receipt: "Choose a crew member and add a note. The fixture host reviews each request.",
  lastIntent: "",
  showDocument: false,
  prompt: cassettes["crew-cards"].examplePrompt,
  cassetteId: "crew-cards",
  generationState: "Idle",
  generationError: "",
  requestId: 0,
  generatedSpec: Option.none(),
  generatedPrompt: "",
  generatedCassette: "crew-cards",
});
