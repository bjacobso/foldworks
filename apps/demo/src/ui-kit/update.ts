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
    ToggledUpdates: ({ isChecked }) => ({
      model: evo(model, { receivesUpdates: () => isChecked }),
    }),
    ToggledTerms: ({ isChecked }) => ({
      model: evo(model, { termsAccepted: () => isChecked }),
    }),
    ToggledDetails: ({ isOpen }) => ({
      model: evo(model, { isDetailsOpen: () => isOpen }),
    }),
    ClickedAction: ({ action }) => ({
      model: evo(model, { announcement: () => `${action} button selected.` }),
    }),
  });
