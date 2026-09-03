import { Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";

import { DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";

const foldGrid = Update.foldChild({
  update: DataGrid.update,
  read: (model: Model) => Option.some(model.grid),
  write: (model, grid) => evo(model, { grid: () => grid }),
  toParentMessage: (message) => Message.GotGridMessage({ message }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotGridMessage: ({ message: gridMessage }) => foldGrid(model, gridMessage),
  });
