import { Option } from "effect";
import { Update } from "foldkit";
import { evo } from "foldkit/struct";
import { Outliner } from "@foldworks/outliner";

import { Message } from "./message";
import type { Model } from "./model";

const foldOutliner = Update.foldChild({
  update: Outliner.update,
  read: (model: Model) => Option.some(model.outline),
  write: (model, outline) => evo(model, { outline: () => outline }),
  toParentMessage: (message) => Message.GotOutlinerMessage({ message }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotOutlinerMessage: ({ message: childMessage }) => foldOutliner(model, childMessage),
    ToggledCheckboxes: () => ({ model: evo(model, { showCheckboxes: (value) => !value }) }),
  });
