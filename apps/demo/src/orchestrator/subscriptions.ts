import { Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";
import { Message } from "./message";
import type { Model } from "./model";

/** A fixture clock advances every active thread independently, including folded threads. */
export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  fixtureClock: entry(
    { running: S.Boolean },
    {
      modelToDependencies: (model) => ({
        running: Object.values(model.threads).some(
          (thread) => thread.agent.runState._tag === "Streaming",
        ),
      }),
      dependenciesToStream: ({ running }) =>
        running
          ? Stream.tick("180 millis").pipe(Stream.map(() => Message.AdvancedRuns()))
          : Stream.empty,
    },
  ),
}));
