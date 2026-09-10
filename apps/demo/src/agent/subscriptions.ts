import { Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";

import { Message } from "./message";
import type { Model } from "./model";
import { Segment } from "./protocol";
import { scenarioStream } from "./scenario";

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  agentStream: entry(
    {
      runId: S.String,
      segment: S.Union([Segment, S.Literal("None")]),
      modelId: S.String,
    },
    {
      modelToDependencies: (model) => model.runState._tag === "Streaming"
        ? { runId: model.runState.runId, segment: model.runState.segment, modelId: model.selectedModel }
        : { runId: "", segment: "None" as const, modelId: model.selectedModel },
      dependenciesToStream: ({ runId, segment, modelId }) => segment === "None"
        ? Stream.empty
        : scenarioStream(segment, runId, modelId).pipe(
            Stream.map((envelope) => Message.ReceivedStreamEvent({ envelope })),
          ),
    },
  ),
}));
