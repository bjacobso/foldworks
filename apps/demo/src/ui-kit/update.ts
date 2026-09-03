import { Update } from "foldkit";
import { evo } from "foldkit/struct";

import { Message } from "./message";
import type { Model } from "./model";

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    ChangedName: ({ value }) => ({ model: evo(model, { name: () => value }) }),
    ChangedNotes: ({ value }) => ({ model: evo(model, { notes: () => value }) }),
    SelectedDepartment: ({ value }) => ({
      model: evo(model, { department: () => value }),
    }),
    SelectedView: ({ value }) => ({
      model: evo(model, { selectedView: () => value }),
    }),
    ClickedAction: ({ action }) => ({
      model: evo(model, { announcement: () => `${action} button selected.` }),
    }),
  });
