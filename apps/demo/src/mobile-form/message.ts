import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import * as Dialog from "@foldkit/ui/dialog";
import { CdlClass, Draft, Employment, FieldId, Shift, TextFieldId, YesNoQuestion } from "./model";

export const Message = defineMessageUnion({
  Initialize: {},
  Restored: { today: S.String, draft: S.NullOr(Draft) },
  ChangedText: { field: TextFieldId, value: S.String },
  LeftField: { field: FieldId },
  AcceptedEmailFix: { email: S.String },
  SelectedEmployment: { value: Employment },
  ChangedHours: { value: S.String },
  SteppedHours: { delta: S.Number },
  ToggledShift: { shift: Shift },
  ToggledAlerts: { value: S.Boolean },
  Answered: { question: YesNoQuestion, answer: S.Literals(["yes", "no"]) },
  SelectedCdlClass: { value: CdlClass },
  OpenedStateSheet: {},
  ChangedStateQuery: { value: S.String },
  ChosenState: { code: S.String },
  AutofilledState: { code: S.String },
  GotStateSheetMessage: { message: Dialog.Message },
  Submitted: {},
  PressedBack: {},
  PressedEditPhone: {},
  PressedResend: {},
  PressedStartOver: {},
  CompletedFocus: {},
  CompletedPersist: {},
});
export type Message = typeof Message.Type;
