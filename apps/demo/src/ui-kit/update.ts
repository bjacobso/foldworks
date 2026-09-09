import { Update } from "foldkit";
import { Option } from "effect";
import { Stateful } from "@foldworks/ui";
import { evo } from "foldkit/struct";

import { Message } from "./message";
import type { Model } from "./model";
import { AccountTabs, DepartmentSelect } from "./components";

const foldTabs = Update.foldChild({
  update: AccountTabs.update,
  read: (model: Model) => Option.some(model.tabs),
  write: (model, tabs) => ({ ...model, tabs }),
  toParentMessage: (message) => Message.GotTabsMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => ({
    model: { ...model, selectedView: outMessage.value, announcement: `${outMessage.value} view selected.` },
  }),
});

const foldDialog = Update.foldChild({
  update: Stateful.Dialog.update,
  read: (model: Model) => Option.some(model.dialog),
  write: (model, dialog) => ({ ...model, dialog }),
  toParentMessage: (message) => Message.GotDialogMessage({ message }),
  foldOutMessage: (outMessage: Stateful.Dialog.OutMessage) => (model: Model) => ({
    model: { ...model, announcement: `Dialog ${outMessage._tag === "Opened" ? "opened" : "closed"}.` },
  }),
});

const foldSelect = Update.foldChild({
  update: DepartmentSelect.update,
  read: (model: Model) => Option.some(model.departmentSelect),
  write: (model, departmentSelect) => ({ ...model, departmentSelect }),
  toParentMessage: (message) => Message.GotSelectMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => ({
    model: { ...model, department: outMessage.value, announcement: `${outMessage.value} department selected.` },
  }),
});

const foldCommand = Update.foldChild({
  update: Stateful.Command.update,
  read: (model: Model) => Option.some(model.command),
  write: (model, command) => ({ ...model, command }),
  toParentMessage: (message) => Message.GotCommandMessage({ message }),
  foldOutMessage: (outMessage: Stateful.Command.OutMessage) => (model: Model) => ({
    model: outMessage._tag === "Selected"
      ? { ...model, announcement: `${outMessage.value} command selected.` }
      : model,
  }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotTabsMessage: ({ message }) => foldTabs(model, message),
    GotDialogMessage: ({ message }) => foldDialog(model, message),
    GotSelectMessage: ({ message }) => foldSelect(model, message),
    GotCommandMessage: ({ message }) => foldCommand(model, message),
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
