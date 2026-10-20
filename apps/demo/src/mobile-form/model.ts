import { Schema as S } from "effect";
import * as Dialog from "@foldkit/ui/dialog";

export const Step = S.Literals(["About", "Address", "Work", "Background", "Verify", "Done"]);
export type Step = typeof Step.Type;
export const formSteps = ["About", "Address", "Work", "Background", "Verify"] as const;

export const Employment = S.Literals(["full-time", "part-time", "seasonal"]);
export type Employment = typeof Employment.Type;
export const Shift = S.Literals(["mornings", "afternoons", "evenings", "overnight", "weekends"]);
export type Shift = typeof Shift.Type;
/** An unanswered question is the empty string, so "No" is a real answer. */
export const YesNo = S.Literals(["", "yes", "no"]);
export type YesNo = typeof YesNo.Type;
export const YesNoQuestion = S.Literals(["license", "cdl", "rehire"]);
export type YesNoQuestion = typeof YesNoQuestion.Type;
export const CdlClass = S.Literals(["a", "b", "c"]);
export type CdlClass = typeof CdlClass.Type;

/** Text inputs share one change message; their ids double as DOM ids. */
export const TextFieldId = S.Literals([
  "first-name",
  "last-name",
  "email",
  "phone",
  "dob",
  "street",
  "apt",
  "city",
  "zip",
  "start-date",
  "license-number",
  "previous-location",
  "previous-end",
  "otp",
]);
export type TextFieldId = typeof TextFieldId.Type;
export const FieldId = S.Union([
  TextFieldId,
  S.Literals(["state", "employment", "hours", "shifts", "cdl-class"]),
  YesNoQuestion,
]);
export type FieldId = typeof FieldId.Type;

export const Values = S.Struct({
  text: S.Record(TextFieldId, S.String),
  state: S.String,
  employment: S.String,
  hours: S.Number,
  shifts: S.Array(Shift),
  alerts: S.Boolean,
  answers: S.Record(YesNoQuestion, YesNo),
  cdlClass: S.String,
});
export type Values = typeof Values.Type;

/** What survives a reload, such as a candidate switching to Messages for the code. */
export const Draft = S.Struct({ version: S.Literal(2), step: Step, values: Values });
export type Draft = typeof Draft.Type;

export const Model = S.Struct({
  step: Step,
  values: Values,
  /** Fields whose errors are visible: blurred once, or the step was submitted. */
  visited: S.Array(FieldId),
  stateSheet: Dialog.Model,
  stateQuery: S.String,
  announcement: S.String,
  /** ISO date read when the form loads; empty until then. */
  today: S.String,
});
export type Model = typeof Model.Type;

export const emptyValues: Values = {
  text: {
    "first-name": "",
    "last-name": "",
    email: "",
    phone: "",
    dob: "",
    street: "",
    apt: "",
    city: "",
    zip: "",
    "start-date": "",
    "license-number": "",
    "previous-location": "",
    "previous-end": "",
    otp: "",
  },
  state: "",
  employment: "",
  hours: 20,
  shifts: [],
  alerts: true,
  answers: { license: "", cdl: "", rehire: "" },
  cdlClass: "",
};

export const init = (): Model => ({
  step: "About",
  values: emptyValues,
  visited: [],
  stateSheet: Dialog.init({ id: "mobile-form-state-sheet" }),
  stateQuery: "",
  announcement: "",
  today: "",
});
