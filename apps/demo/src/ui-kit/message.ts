import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Stateful } from "@foldworks/ui";

import { Department, FoundationStep, Tool, View } from "./model";

export const Message = defineMessageUnion({
  GotTabsMessage: { message: Stateful.Tabs.Message },
  GotDialogMessage: { message: Stateful.Dialog.Message },
  GotSelectMessage: { message: Stateful.Select.Message },
  GotCommandMessage: { message: Stateful.Command.Message },
  GotActionMenuMessage: { message: Stateful.Menu.Message },
  GotPopoverMessage: { message: Stateful.Popover.Message },
  GotTooltipMessage: { message: Stateful.Tooltip.Message },
  GotComboboxMessage: { message: Stateful.Combobox.Message },
  GotMultiComboboxMessage: { message: Stateful.Combobox.Message },
  GotToastMessage: { message: Stateful.Toast.Message },
  ChangedName: { value: S.String },
  ChangedEmail: { value: S.String },
  ChangedNotes: { value: S.String },
  SelectedDepartment: { value: Department },
  SelectedFoundationStep: { value: FoundationStep },
  RemovedTool: { value: Tool },
  RequestedToast: { variant: Stateful.Toast.Variant },
  SelectedView: { value: View },
  ToggledUpdates: { isChecked: S.Boolean },
  ToggledSecurityAlerts: { isChecked: S.Boolean },
  ToggledTerms: { isChecked: S.Boolean },
  ToggledMixedPermissions: { isChecked: S.Boolean },
  ToggledDetails: { isOpen: S.Boolean },
  ToggledComponent: { component: S.String, isOpen: S.Boolean },
  ChangedSlider: { value: S.Number },
  ChangedOtp: { value: S.String },
  ChangedCommandQuery: { value: S.String },
  SelectedPage: { page: S.Int },
  SelectedCalendarDay: { day: S.Int },
  ClickedAction: { action: S.String },
});
export type Message = typeof Message.Type;
