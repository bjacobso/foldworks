import { Schema as S } from "effect";

export const Department = S.Literals(["Engineering", "Operations", "People"]);
export type Department = typeof Department.Type;

export const View = S.Literals(["Overview", "Details", "Activity"]);
export type View = typeof View.Type;

export const Model = S.Struct({
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
