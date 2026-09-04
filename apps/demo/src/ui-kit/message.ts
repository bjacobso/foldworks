import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Department, View } from "./model";

export const Message = defineMessageUnion({
  ChangedName: { value: S.String },
  ChangedEmail: { value: S.String },
  ChangedNotes: { value: S.String },
  SelectedDepartment: { value: Department },
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
