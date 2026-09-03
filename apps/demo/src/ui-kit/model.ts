import { Schema as S } from "effect";

export const Department = S.Literals(["Engineering", "Operations", "People"]);
export type Department = typeof Department.Type;

export const View = S.Literals(["Overview", "Details", "Activity"]);
export type View = typeof View.Type;

export const Model = S.Struct({
  name: S.String,
  notes: S.String,
  department: Department,
  selectedView: View,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  name: "Maya Chen",
  notes: "Keep the experience concise and welcoming.",
  department: "People",
  selectedView: "Overview",
  announcement: "UI component demo ready.",
};
