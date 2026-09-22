import * as Desktop from "./desktop";
import { Schema as S } from "effect";
import { Stateful } from "@foldworks/ui";

export const Department = S.Literals(["Engineering", "Operations", "People"]);
export type Department = typeof Department.Type;

export const View = S.Literals(["Overview", "Details", "Activity"]);
export type View = typeof View.Type;

export const DemoAction = S.Literals(["Edit", "Duplicate", "Delete"]);
export type DemoAction = typeof DemoAction.Type;

export const Tool = S.Literals(["Menu", "Popover", "Combobox", "Toast"]);
export type Tool = typeof Tool.Type;

export const FoundationStep = S.Literals(["Compose", "Validate", "Ship"]);
export type FoundationStep = typeof FoundationStep.Type;

export const Model = S.Struct({
  desktop: Desktop.Model,
  tabs: Stateful.Tabs.Model,
  dialog: Stateful.Dialog.Model,
  departmentSelect: Stateful.Select.Model,
  command: Stateful.Command.Model,
  actionMenu: Stateful.Menu.Model,
  popover: Stateful.Popover.Model,
  tooltip: Stateful.Tooltip.Model,
  departmentCombobox: Stateful.Combobox.Model,
  toolCombobox: Stateful.Combobox.Multi.Model,
  toasts: Stateful.Toast.Model,
  name: S.String,
  email: S.String,
  notes: S.String,
  department: Department,
  selectedTools: S.Array(Tool),
  foundationStep: FoundationStep,
  selectedView: View,
  receivesUpdates: S.Boolean,
  securityAlerts: S.Boolean,
  termsAccepted: S.Boolean,
  mixedPermissions: S.Boolean,
  isDetailsOpen: S.Boolean,
  openComponent: S.String,
  sliderValue: S.Number,
  otp: S.String,
  commandQuery: S.String,
  page: S.Int,
  selectedCalendarDay: S.Int,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  desktop: Desktop.initialModel,
  tabs: Stateful.Tabs.init({ id: "catalog-tabs" }),
  dialog: Stateful.Dialog.init({ id: "catalog-dialog", isAnimated: true }),
  departmentSelect: Stateful.Select.init({ id: "catalog-select", isAnimated: true }),
  command: Stateful.Command.init({ id: "catalog-command" }),
  actionMenu: Stateful.Menu.init({ id: "catalog-action-menu", isAnimated: true }),
  popover: Stateful.Popover.init({ id: "catalog-stateful-popover", isAnimated: true }),
  tooltip: Stateful.Tooltip.init({ id: "catalog-stateful-tooltip", showDelay: 250 }),
  departmentCombobox: Stateful.Combobox.init({ id: "catalog-department-combobox", isAnimated: true }),
  toolCombobox: Stateful.Combobox.Multi.init({ id: "catalog-tool-combobox", isAnimated: true }),
  toasts: Stateful.Toast.init({ id: "catalog-toasts", defaultDuration: 4000 }),
  name: "Maya Chen",
  email: "maya@",
  notes: "Keep the experience concise and welcoming.",
  department: "People",
  selectedTools: ["Combobox", "Toast"],
  foundationStep: "Validate",
  selectedView: "Overview",
  receivesUpdates: true,
  securityAlerts: false,
  termsAccepted: false,
  mixedPermissions: false,
  isDetailsOpen: true,
  openComponent: "",
  sliderValue: 25,
  otp: "123",
  commandQuery: "",
  page: 2,
  selectedCalendarDay: 4,
  announcement: "UI component demo ready.",
};
