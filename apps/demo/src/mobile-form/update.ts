import { Effect, Option, Schema as S } from "effect";
import { Command, Dom, Update } from "foldkit";
import * as Dialog from "@foldkit/ui/dialog";
import { formatMask, type MaskKind } from "./format";
import { Message } from "./message";
import {
  Draft,
  emptyValues,
  formSteps,
  type FieldId,
  type Model,
  type Step,
  type TextFieldId,
  type Values,
} from "./model";
import { invalidFields, stepFields } from "./validation";

type UpdateReturn = Update.Return<Model, Message>;

export const STORAGE_KEY = "foldworks-mobile-form";

const masks: Partial<Record<TextFieldId, MaskKind>> = {
  phone: "Phone",
  dob: "Date",
  "previous-end": "Month",
  zip: "Zip",
  otp: "Otp",
};

/** The DOM id that receives focus for a field, including grouped controls. */
export const focusTarget = (field: FieldId, values: Values): string => {
  switch (field) {
    case "employment":
      return `employment-${values.employment || "full-time"}`;
    case "shifts":
      return `shift-${values.shifts[0] ?? "mornings"}`;
    case "license":
    case "cdl":
    case "rehire":
      return `${field}-${values.answers[field] || "yes"}`;
    case "cdl-class":
      return `cdl-class-${values.cdlClass || "a"}`;
    default:
      return field;
  }
};

const Restore = Command.define("RestoreMobileForm", {
  messages: [Message.Restored],
  execute: Effect.sync(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      return Message.Restored({
        today,
        draft: json === null ? null : S.decodeUnknownSync(Draft)(JSON.parse(json)),
      });
    } catch {
      return Message.Restored({ today, draft: null });
    }
  }),
});

const Persist = Command.define("PersistMobileForm", {
  args: { draft: Draft },
  messages: [Message.CompletedPersist],
  execute: ({ draft }) =>
    Effect.sync(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        /* Private browsing: the form still works for this visit. */
      }
      return Message.CompletedPersist();
    }),
});

const Focus = Command.define("FocusMobileFormField", {
  args: { id: S.String },
  messages: [Message.CompletedFocus],
  execute: ({ id }) =>
    Dom.focus(`#${CSS.escape(id)}`, { preventScroll: true }).pipe(
      Effect.andThen(Dom.scrollIntoView(`#${CSS.escape(id)}`, { block: "center" })),
      Effect.ignore,
      Effect.as(Message.CompletedFocus()),
    ),
});

/** Moves to a step and puts focus on its heading so screen readers announce it. */
const ShowStep = Command.define("ShowMobileFormStep", {
  messages: [Message.CompletedFocus],
  execute: Dom.focus("#mobile-form-heading", { preventScroll: true, makeFocusable: true }).pipe(
    Effect.andThen(
      Effect.sync(() => document.querySelector("#mobile-form-scroll")?.scrollTo(0, 0)),
    ),
    Effect.ignore,
    Effect.as(Message.CompletedFocus()),
  ),
});

const persist = (model: Model, commands: UpdateReturn["commands"] = []): UpdateReturn => ({
  model,
  commands: [
    ...(commands ?? []),
    Persist({ draft: { version: 2, step: model.step, values: model.values } }),
  ],
});

const withValues = (model: Model, values: Partial<Values>): Model => ({
  ...model,
  values: { ...model.values, ...values },
});

const visit = (model: Model, fields: ReadonlyArray<FieldId>): Model => ({
  ...model,
  visited: [...new Set([...model.visited, ...fields])],
});

const stepTitles: Readonly<Record<Step, string>> = {
  About: "About you",
  Address: "Where do you live?",
  Work: "Your availability",
  Background: "A few more questions",
  Verify: "Verify your phone",
  Done: "You're all set",
};
export const stepTitle = (step: Step): string => stepTitles[step];

const goTo = (model: Model, step: Step): UpdateReturn => {
  const index = formSteps.indexOf(step as (typeof formSteps)[number]);
  return persist(
    {
      ...model,
      step,
      announcement:
        index === -1
          ? stepTitle(step)
          : `Step ${index + 1} of ${formSteps.length}: ${stepTitle(step)}`,
    },
    // The code field takes focus so Android opens the keypad and SMS autofill is one tap away.
    [step === "Verify" ? Focus({ id: "otp" }) : ShowStep()],
  );
};

const submit = (model: Model): UpdateReturn => {
  const invalid = invalidFields(model.step, model.values, model.today);
  const first = invalid[0];
  if (first !== undefined) {
    return {
      model: {
        ...visit(model, stepFields[model.step]),
        announcement: `${invalid.length} ${invalid.length === 1 ? "field needs" : "fields need"} attention.`,
      },
      commands: [Focus({ id: focusTarget(first, model.values) })],
    };
  }
  const next = formSteps[formSteps.indexOf(model.step as (typeof formSteps)[number]) + 1];
  return goTo(model, next ?? "Done");
};

const foldStateSheet = Update.foldChild({
  update: Dialog.update,
  read: (model: Model) => Option.some(model.stateSheet),
  write: (model, stateSheet) => ({ ...model, stateSheet }),
  toParentMessage: (message) => Message.GotStateSheetMessage({ message }),
  foldOutMessage: (_message: Dialog.OutMessage) => (model: Model) => ({ model }),
});

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    Initialize: () => ({ model, commands: [Restore()] }),
    Restored: ({ today, draft }) =>
      draft === null
        ? { model: { ...model, today } }
        : { model: { ...model, today, step: draft.step, values: draft.values } },
    ChangedText: ({ field, value }) => {
      const mask = masks[field];
      const next = withValues(model, {
        text: {
          ...model.values.text,
          [field]: mask === undefined ? value : formatMask(mask, value),
        },
      });
      // One-time codes submit themselves once complete, matching SMS autofill.
      // Keystrokes stay in memory; the draft is written when the field is left.
      return field === "otp" && next.values.text.otp.length === 6 && model.step === "Verify"
        ? submit(next)
        : { model: next };
    },
    // Leaving a field saves the draft. Switching apps blurs the field, so a candidate
    // who opens Messages for the code keeps everything they typed.
    LeftField: ({ field }) => persist(visit(model, [field])),
    AcceptedEmailFix: ({ email }) =>
      persist(withValues(model, { text: { ...model.values.text, email } }), [
        Focus({ id: "email" }),
      ]),
    SelectedEmployment: ({ value }) =>
      persist(visit(withValues(model, { employment: value }), ["employment"])),
    ChangedHours: ({ value }) => {
      const hours = Number(value.replace(/\D/g, "").slice(0, 2));
      return persist(withValues(model, { hours: Number.isFinite(hours) ? hours : 0 }));
    },
    SteppedHours: ({ delta }) =>
      persist(withValues(model, { hours: Math.min(60, Math.max(1, model.values.hours + delta)) })),
    ToggledShift: ({ shift }) =>
      persist(
        visit(
          withValues(model, {
            shifts: model.values.shifts.includes(shift)
              ? model.values.shifts.filter((value) => value !== shift)
              : [...model.values.shifts, shift],
          }),
          ["shifts"],
        ),
      ),
    ToggledAlerts: ({ value }) => persist(withValues(model, { alerts: value })),
    Answered: ({ question, answer }) =>
      persist(
        visit(withValues(model, { answers: { ...model.values.answers, [question]: answer } }), [
          question,
        ]),
      ),
    SelectedCdlClass: ({ value }) =>
      persist(visit(withValues(model, { cdlClass: value }), ["cdl-class"])),
    OpenedStateSheet: () =>
      foldStateSheet({ ...model, stateQuery: "" }, Dialog.Message.RequestedOpen()),
    ChangedStateQuery: ({ value }) => ({ model: { ...model, stateQuery: value } }),
    ChosenState: ({ code }) => {
      const closed = foldStateSheet(
        visit(withValues(model, { state: code }), ["state"]),
        Dialog.Message.RequestedClose(),
      );
      return persist(closed.model, closed.commands);
    },
    AutofilledState: ({ code }) => persist(withValues(model, { state: code })),
    GotStateSheetMessage: ({ message: child }) => foldStateSheet(model, child),
    Submitted: () => submit(model),
    PressedBack: () => {
      const index = formSteps.indexOf(model.step as (typeof formSteps)[number]);
      return index > 0 ? goTo(model, formSteps[index - 1]!) : { model };
    },
    PressedEditPhone: () =>
      persist(
        { ...model, step: "About", announcement: `Step 1 of ${formSteps.length}: About you` },
        [Focus({ id: "phone" })],
      ),
    PressedResend: () => ({
      model: {
        ...withValues(model, { text: { ...model.values.text, otp: "" } }),
        announcement: "Code sent. It can take up to a minute to arrive.",
      },
    }),
    PressedStartOver: () => goTo({ ...model, values: emptyValues, visited: [] }, "About"),
    CompletedFocus: () => ({ model }),
    CompletedPersist: () => ({ model }),
  });
