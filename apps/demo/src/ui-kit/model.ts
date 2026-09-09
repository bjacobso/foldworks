import { Schema as S } from "effect";
import { Stateful } from "@foldworks/ui";

export const Department = S.Literals(["Engineering", "Operations", "People"]);
export type Department = typeof Department.Type;

export const View = S.Literals(["Overview", "Details", "Activity"]);
export type View = typeof View.Type;

export const Model = S.Struct({
  tabs: Stateful.Tabs.Model,
  dialog: Stateful.Dialog.Model,
  departmentSelect: Stateful.Select.Model,
  command: Stateful.Command.Model,
  name: S.String,
  email: S.String,
  notes: S.String,
  department: Department,
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
  tabs: Stateful.Tabs.init({ id: "catalog-tabs" }),
  dialog: Stateful.Dialog.init({ id: "catalog-dialog", isAnimated: true }),
  departmentSelect: Stateful.Select.init({ id: "catalog-select", isAnimated: true }),
  command: Stateful.Command.init({ id: "catalog-command" }),
  name: "Maya Chen",
  email: "maya@",
  notes: "Keep the experience concise and welcoming.",
  department: "People",
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
