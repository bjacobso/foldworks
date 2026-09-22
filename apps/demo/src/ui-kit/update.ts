import * as Desktop from "./desktop";
import { Update } from "foldkit";
import { Option } from "effect";
import { Stateful } from "@foldworks/ui";
import { evo } from "foldkit/struct";

import { Message } from "./message";
import type { Model } from "./model";
import { AccountTabs, ActionMenu, DepartmentCombobox, DepartmentSelect, ToolCombobox } from "./components";

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

const foldActionMenu = Update.foldChild({
  update: ActionMenu.update,
  read: (model: Model) => Option.some(model.actionMenu),
  write: (model, actionMenu) => ({ ...model, actionMenu }),
  toParentMessage: (message) => Message.GotActionMenuMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => ({
    model: { ...model, announcement: `${outMessage.value} selected from the stateful menu.` },
  }),
});

const foldPopover = Update.foldChild({
  update: Stateful.Popover.update,
  read: (model: Model) => Option.some(model.popover),
  write: (model, popover) => ({ ...model, popover }),
  toParentMessage: (message) => Message.GotPopoverMessage({ message }),
  foldOutMessage: (outMessage: Stateful.Popover.OutMessage) => (model: Model) => ({
    model: { ...model, announcement: `Stateful popover ${outMessage._tag === "Opened" ? "opened" : "closed"}.` },
  }),
});

const foldTooltip = Update.foldChild({
  update: Stateful.Tooltip.update,
  read: (model: Model) => Option.some(model.tooltip),
  write: (model, tooltip) => ({ ...model, tooltip }),
  toParentMessage: (message) => Message.GotTooltipMessage({ message }),
  foldOutMessage: (outMessage: Stateful.Tooltip.OutMessage) => (model: Model) => ({
    model: { ...model, announcement: `Stateful tooltip ${outMessage._tag === "Shown" ? "shown" : "hidden"}.` },
  }),
});

const foldCombobox = Update.foldChild({
  update: DepartmentCombobox.update,
  read: (model: Model) => Option.some(model.departmentCombobox),
  write: (model, departmentCombobox) => ({ ...model, departmentCombobox }),
  toParentMessage: (message) => Message.GotComboboxMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => ({
    model: outMessage._tag === "Selected"
      ? { ...model, department: outMessage.value, announcement: `${outMessage.value} selected from the combobox.` }
      : { ...model, announcement: "Combobox selection cleared." },
  }),
});

const foldMultiCombobox = Update.foldChild({
  update: ToolCombobox.update,
  read: (model: Model) => Option.some(model.toolCombobox),
  write: (model, toolCombobox) => ({ ...model, toolCombobox }),
  toParentMessage: (message) => Message.GotMultiComboboxMessage({ message }),
  foldOutMessage: (outMessage) => (model: Model) => {
    if (outMessage._tag !== "Selected") return { model };
    const isSelected = model.selectedTools.includes(outMessage.value);
    return {
      model: {
        ...model,
        selectedTools: isSelected
          ? model.selectedTools.filter((value) => value !== outMessage.value)
          : [...model.selectedTools, outMessage.value],
        announcement: `${outMessage.value} ${isSelected ? "removed from" : "added to"} the selected tools.`,
      },
    };
  },
});

const foldToast = Update.foldChild({
  update: Stateful.Toast.update,
  read: (model: Model) => Option.some(model.toasts),
  write: (model, toasts) => ({ ...model, toasts }),
  toParentMessage: (message) => Message.GotToastMessage({ message }),
  foldOutMessage: (outMessage: Stateful.Toast.OutMessage) => (model: Model) => ({
    model: { ...model, announcement: `${outMessage.payload.title} toast dismissed.` },
  }),
});

const showToast = (variant: Stateful.Toast.Variant) => Update.foldChildStep({
  update: (toasts: Stateful.Toast.Model) => Stateful.Toast.show(toasts, {
    payload: {
      title: `${variant} notification`,
      description: "Hover to pause the timer or use Dismiss to remove it.",
    },
    variant,
  }),
  read: (model: Model) => Option.some(model.toasts),
  write: (model, toasts) => ({ ...model, toasts, announcement: `${variant} toast shown.` }),
  toParentMessage: (message) => Message.GotToastMessage({ message }),
  foldOutMessage: (_outMessage: Stateful.Toast.OutMessage) => (model: Model) => ({ model }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotDesktop: ({ message }) => Update.foldChild({ update: Desktop.update, read: (model: Model) => Option.some(model.desktop), write: (model, desktop) => ({ ...model, desktop }), toParentMessage: message => Message.GotDesktop({ message }) })(model, message),
    GotTabsMessage: ({ message }) => foldTabs(model, message),
    GotDialogMessage: ({ message }) => foldDialog(model, message),
    GotSelectMessage: ({ message }) => foldSelect(model, message),
    GotCommandMessage: ({ message }) => foldCommand(model, message),
    GotActionMenuMessage: ({ message }) => foldActionMenu(model, message),
    GotPopoverMessage: ({ message }) => foldPopover(model, message),
    GotTooltipMessage: ({ message }) => foldTooltip(model, message),
    GotComboboxMessage: ({ message }) => foldCombobox(model, message),
    GotMultiComboboxMessage: ({ message }) => foldMultiCombobox(model, message),
    GotToastMessage: ({ message }) => foldToast(model, message),
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
    SelectedFoundationStep: ({ value }) => ({
      model: evo(model, {
        foundationStep: () => value,
        announcement: () => `${value} step selected.`,
      }),
    }),
    RemovedTool: ({ value }) => ({
      model: evo(model, {
        selectedTools: (values) => values.filter((selected) => selected !== value),
        announcement: () => `${value} removed from the selected tools.`,
      }),
    }),
    RequestedToast: ({ variant }) => showToast(variant)(model),
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
