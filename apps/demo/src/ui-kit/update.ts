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
        openComponent: () => "",
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
    ToggledComponent: ({ component, isOpen }) => ({
      model: evo(model, {
        openComponent: () => isOpen ? component : "",
        announcement: () => `${component} ${isOpen ? "opened" : "closed"}.`,
      }),
    }),
    ChangedSlider: ({ value }) => ({
      model: evo(model, {
        sliderValue: () => value,
        announcement: () => `Slider changed to ${value}.`,
      }),
    }),
    ChangedOtp: ({ value }) => ({
      model: evo(model, { otp: () => value }),
    }),
    ChangedCommandQuery: ({ value }) => ({
      model: evo(model, { commandQuery: () => value }),
    }),
    SelectedPage: ({ page }) => ({
      model: evo(model, {
        page: () => page,
        announcement: () => `Page ${page} selected.`,
      }),
    }),
    SelectedCalendarDay: ({ day }) => ({
      model: evo(model, {
        selectedCalendarDay: () => day,
        announcement: () => `September ${day} selected.`,
      }),
    }),
    ClickedAction: ({ action }) => ({
      model: evo(model, { announcement: () => `${action} button selected.` }),
    }),
  });
