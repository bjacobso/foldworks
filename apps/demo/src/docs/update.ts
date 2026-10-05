import type { Update } from "foldkit";
import { explorers } from "./explorer";
import { Message } from "./message";
import type { Model } from "./model";
export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    Searched: ({ query }) => ({ model: { ...model, query } }),
    SelectedExplorer: ({ id }) => ({ model: { ...model, explorer: id, events: [] } }),
    SentEvent: ({ event }) => ({
      model: explorers.find((item) => item.id === model.explorer)?.events.includes(event)
        ? { ...model, events: [...model.events, event] }
        : model,
    }),
    Reset: () => ({ model: { ...model, events: [] } }),
  });
