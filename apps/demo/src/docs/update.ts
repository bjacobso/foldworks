import { Effect, Schema as S } from "effect";
import { Command, type Update } from "foldkit";
import { scrollIntoView } from "foldkit/dom";
import { explorers } from "./explorer";
import { Message } from "./message";
import type { Model } from "./model";

const ScrollToSection = Command.define("ScrollToSection", {
  args: { id: S.String },
  messages: [Message.CompletedJump],
  execute: ({ id }) =>
    scrollIntoView(`#${CSS.escape(id)}`, { block: "start" }).pipe(
      Effect.ignore,
      Effect.as(Message.CompletedJump()),
    ),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    Searched: ({ query }) => ({ model: { ...model, query } }),
    FilteredModules: ({ query }) => ({ model: { ...model, moduleQuery: query } }),
    SelectedExplorer: ({ id }) => ({ model: { ...model, explorer: id, events: [] } }),
    SentEvent: ({ event }) => ({
      model: explorers.find((item) => item.id === model.explorer)?.events.includes(event)
        ? { ...model, events: [...model.events, event] }
        : model,
    }),
    Reset: () => ({ model: { ...model, events: [] } }),
    JumpedTo: ({ id }) => ({ model, commands: [ScrollToSection({ id })] }),
    CompletedJump: () => ({ model }),
  });
