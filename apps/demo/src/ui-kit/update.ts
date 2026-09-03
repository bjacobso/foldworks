import { Update } from "foldkit";
import { evo } from "foldkit/struct";

import { Message } from "./message";
import type { Model } from "./model";

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    ChangedName: ({ value }) => ({ model: evo(model, { name: () => value }) }),
    ChangedEmail: ({ value }) => ({ model: evo(model, { email: () => value }) }),
    ChangedNotes: ({ value }) => ({ model: evo(model, { notes: () => value }) }),
    SelectedDepartment: ({ value }) => ({
      model: evo(model, {
        department: () => value,
        announcement: () => `${value} department selected.`,
      }),
    }),
    SelectedView: ({ value }) => ({
      model: evo(model, {
        selectedView: () => value,
        announcement: () => `${value} view selected.`,
      }),
    }),
    ToggledUpdates: ({ isChecked }) => ({
      model: evo(model, {
        receivesUpdates: () => isChecked,
        announcement: () => `Product updates ${isChecked ? "enabled" : "disabled"}.`,
      }),
    }),
    ToggledSecurityAlerts: ({ isChecked }) => ({
      model: evo(model, {
        securityAlerts: () => isChecked,
        announcement: () => `Security alerts ${isChecked ? "enabled" : "disabled"}.`,
      }),
    }),
    ToggledTerms: ({ isChecked }) => ({
      model: evo(model, {
        termsAccepted: () => isChecked,
        announcement: () => `Workspace terms ${isChecked ? "accepted" : "cleared"}.`,
      }),
    }),
    ToggledMixedPermissions: ({ isChecked }) => ({
      model: evo(model, {
        mixedPermissions: () => isChecked,
        announcement: () => `Team permissions ${isChecked ? "selected" : "cleared"}.`,
      }),
    }),
    ToggledDetails: ({ isOpen }) => ({
      model: evo(model, {
        isDetailsOpen: () => isOpen,
        announcement: () => `Disclosure ${isOpen ? "expanded" : "collapsed"}.`,
      }),
    }),
    ClickedAction: ({ action }) => ({
      model: evo(model, { announcement: () => `${action} button selected.` }),
    }),
  });
