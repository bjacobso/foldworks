import type { Html, HtmlBuilder } from "foldkit/html";
import { Check, ChevronLeft, Search } from "@lucide/icons";
import * as Dialog from "@foldkit/ui/dialog";
import * as Icon from "@foldworks/ui/icon";
import { Option } from "effect";
import { formatPhone } from "./format";
import {
  bottomSheet,
  choiceCards,
  reveal,
  yesNo,
  chips,
  codeInput,
  KeyboardInset,
  pickerTrigger,
  stepper,
  textField,
  toggle,
} from "./inputs";
import { Message } from "./message";
import {
  formSteps,
  type Employment,
  type FieldId,
  type Model,
  type Shift,
  type YesNoQuestion,
  type TextFieldId,
} from "./model";
import { filterStates, stateName, usStates } from "./states";
import { inputStyles } from "./inputs.styles";
import { className, styles } from "./styles";
import { stepTitle } from "./update";
import { emailFix, fieldError } from "./validation";

type H = HtmlBuilder<Message>;

const errorFor = (model: Model, field: FieldId): string | undefined =>
  model.visited.includes(field) ? fieldError(field, model.values, model.today) : undefined;

const text = (model: Model, field: TextFieldId) => ({
  id: field,
  value: model.values.text[field],
  onInput: (value: string) => Message.ChangedText({ field, value }),
  onBlur: Message.LeftField({ field }),
  error: errorFor(model, field),
});

const about = (model: Model, h: H): ReadonlyArray<Html> => {
  const fix = emailFix(model.values.text.email);
  return [
    h.div(
      [h.Class(className(styles.pair))],
      [
        textField(
          {
            ...text(model, "first-name"),
            label: "First name",
            autocomplete: "given-name",
            autocapitalize: "words",
            next: "last-name",
          },
          h,
        ),
        textField(
          {
            ...text(model, "last-name"),
            label: "Last name",
            autocomplete: "family-name",
            autocapitalize: "words",
            next: "email",
          },
          h,
        ),
      ],
    ),
    textField(
      {
        ...text(model, "email"),
        label: "Email",
        type: "email",
        inputMode: "email",
        autocomplete: "email",
        autocapitalize: "none",
        spellcheck: false,
        next: "phone",
        after:
          fix === undefined
            ? undefined
            : h.button(
                [
                  h.Type("button"),
                  h.Class(className(inputStyles.suggestion)),
                  h.OnClick(Message.AcceptedEmailFix({ email: fix })),
                ],
                ["Did you mean ", h.strong([], [fix]), "?"],
              ),
      },
      h,
    ),
    textField(
      {
        ...text(model, "phone"),
        label: "Mobile phone",
        hint: "We'll text a code to confirm it's you.",
        type: "tel",
        inputMode: "tel",
        autocomplete: "tel-national",
        placeholder: "(555) 123-4567",
        mask: "Phone",
        next: "dob",
      },
      h,
    ),
    textField(
      {
        ...text(model, "dob"),
        label: "Date of birth",
        inputMode: "numeric",
        autocomplete: "bday",
        placeholder: "MM/DD/YYYY",
        mask: "Date",
      },
      h,
    ),
  ];
};

const address = (model: Model, h: H): ReadonlyArray<Html> => [
  textField(
    {
      ...text(model, "street"),
      label: "Street address",
      autocomplete: "address-line1",
      autocapitalize: "words",
      next: "apt",
    },
    h,
  ),
  textField(
    {
      ...text(model, "apt"),
      label: "Apt, suite, unit",
      optional: true,
      autocomplete: "address-line2",
      next: "city",
    },
    h,
  ),
  textField(
    {
      ...text(model, "city"),
      label: "City",
      autocomplete: "address-level2",
      autocapitalize: "words",
      next: "zip",
    },
    h,
  ),
  h.div(
    [h.Class(className(styles.pair))],
    [
      pickerTrigger(
        {
          id: "state",
          label: "State",
          displayValue: stateName(model.values.state),
          placeholder: "Choose",
          onOpen: Message.OpenedStateSheet(),
          error: errorFor(model, "state"),
          autofill: {
            autocomplete: "address-level1",
            value: model.values.state,
            options: usStates.map((state) => ({ value: state.code, label: state.name })),
            onChange: (code) => Message.AutofilledState({ code }),
          },
        },
        h,
      ),
      textField(
        {
          ...text(model, "zip"),
          label: "ZIP code",
          inputMode: "numeric",
          autocomplete: "postal-code",
          mask: "Zip",
          maxLength: 10,
        },
        h,
      ),
    ],
  ),
];

const employment: ReadonlyArray<{ value: Employment; label: string; description: string }> = [
  { value: "full-time", label: "Full-time", description: "35+ hours a week, with benefits" },
  { value: "part-time", label: "Part-time", description: "Flexible hours around your schedule" },
  { value: "seasonal", label: "Seasonal", description: "Peak periods, a few months at a time" },
];

const shifts: ReadonlyArray<{ value: Shift; label: string }> = [
  { value: "mornings", label: "Mornings" },
  { value: "afternoons", label: "Afternoons" },
  { value: "evenings", label: "Evenings" },
  { value: "overnight", label: "Overnight" },
  { value: "weekends", label: "Weekends" },
];

const work = (model: Model, h: H): ReadonlyArray<Html> => [
  choiceCards(
    {
      name: "employment",
      legend: "How do you want to work?",
      options: employment,
      value: model.values.employment,
      onSelect: (value) => Message.SelectedEmployment({ value }),
      error: errorFor(model, "employment"),
    },
    h,
  ),
  stepper(
    {
      id: "hours",
      label: "Hours per week",
      value: model.values.hours,
      min: 1,
      max: 60,
      suffix: "hrs",
      onStep: (delta) => Message.SteppedHours({ delta }),
      onInput: (value) => Message.ChangedHours({ value }),
      error: errorFor(model, "hours"),
    },
    h,
  ),
  textField(
    {
      ...text(model, "start-date"),
      label: "Earliest start date",
      type: "date",
      autocomplete: "off",
      ...(model.today === "" ? {} : { min: model.today }),
    },
    h,
  ),
  chips(
    {
      name: "shift",
      legend: "Which shifts work for you?",
      options: shifts,
      selected: model.values.shifts,
      onToggle: (shift) => Message.ToggledShift({ shift }),
      error: errorFor(model, "shifts"),
    },
    h,
  ),
  toggle(
    {
      id: "alerts",
      label: "Text me shift alerts",
      description: "Open shifts near you, up to 3 a week.",
      checked: model.values.alerts,
      onToggle: (value) => Message.ToggledAlerts({ value }),
    },
    h,
  ),
];

const question = (
  model: Model,
  name: YesNoQuestion,
  legend: string,
  followUp: ReadonlyArray<Html>,
  h: H,
): Html =>
  h.div(
    [h.Class(className(inputStyles.question))],
    [
      yesNo(
        {
          name,
          legend,
          value: model.values.answers[name],
          onAnswer: (answer) => Message.Answered({ question: name, answer }),
          error: errorFor(model, name),
        },
        h,
      ),
      reveal(
        {
          id: `${name}-follow-up`,
          isOpen: model.values.answers[name] === "yes",
          children: followUp,
        },
        h,
      ),
    ],
  );

const background = (model: Model, h: H): ReadonlyArray<Html> => [
  question(
    model,
    "license",
    "Do you have a valid driver's license?",
    [
      textField(
        {
          ...text(model, "license-number"),
          label: "License number",
          autocomplete: "off",
          autocapitalize: "characters",
          spellcheck: false,
          next: `cdl-${model.values.answers.cdl || "yes"}`,
        },
        h,
      ),
      // Conditions nest: the class only matters for a commercial license.
      question(
        model,
        "cdl",
        "Is it a commercial license (CDL)?",
        [
          choiceCards(
            {
              name: "cdl-class",
              legend: "CDL class",
              options: [
                { value: "a", label: "Class A", description: "Tractor-trailers and combinations" },
                { value: "b", label: "Class B", description: "Straight trucks and buses" },
                { value: "c", label: "Class C", description: "Passenger vans and hazmat" },
              ],
              value: model.values.cdlClass,
              onSelect: (value) => Message.SelectedCdlClass({ value }),
              error: errorFor(model, "cdl-class"),
            },
            h,
          ),
        ],
        h,
      ),
    ],
    h,
  ),
  question(
    model,
    "rehire",
    "Have you worked for us before?",
    [
      textField(
        {
          ...text(model, "previous-location"),
          label: "Which location?",
          autocomplete: "off",
          autocapitalize: "words",
          next: "previous-end",
        },
        h,
      ),
      textField(
        {
          ...text(model, "previous-end"),
          label: "When did you leave?",
          inputMode: "numeric",
          autocomplete: "off",
          placeholder: "MM/YYYY",
          mask: "Month",
        },
        h,
      ),
    ],
    h,
  ),
];

const verify = (model: Model, h: H): ReadonlyArray<Html> => [
  h.p(
    [h.Class(className(styles.lede))],
    [
      "Enter the 6-digit code we sent to ",
      h.strong([], [formatPhone(model.values.text.phone) || "your phone"]),
      ". ",
      h.button(
        [
          h.Type("button"),
          h.Class(className(styles.inlineLink)),
          h.OnClick(Message.PressedEditPhone()),
        ],
        ["Edit"],
      ),
    ],
  ),
  codeInput(
    {
      id: "otp",
      label: "Verification code",
      value: model.values.text.otp,
      length: 6,
      onInput: (value) => Message.ChangedText({ field: "otp", value }),
      error: errorFor(model, "otp"),
    },
    h,
  ),
  h.button(
    [h.Type("button"), h.Class(className(styles.secondary)), h.OnClick(Message.PressedResend())],
    ["Resend code"],
  ),
];

const done = (model: Model, h: H): Html => {
  const values = model.values;
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Name", `${values.text["first-name"]} ${values.text["last-name"]}`],
    ["Email", values.text.email],
    ["Phone", values.text.phone],
    ["State", stateName(values.state)],
  ];
  return h.div(
    [h.Class(className(styles.done))],
    [
      h.div(
        [h.Class(className(styles.doneBadge))],
        [Icon.view({ icon: Check, size: 36, strokeWidth: 3 }, h)],
      ),
      h.h1(
        [h.Id("mobile-form-heading"), h.Tabindex(-1), h.Class(className(styles.heading))],
        [stepTitle("Done")],
      ),
      h.p(
        [h.Class(className(styles.asideText))],
        ["Thanks for applying. We'll text you about next steps."],
      ),
      h.dl(
        [h.Class(className(styles.summary))],
        rows.flatMap(([term, value]) => [
          h.dt([h.Class(className(styles.summaryTerm))], [term]),
          h.dd([h.Class(className(styles.summaryValue))], [value]),
        ]),
      ),
      h.button(
        [
          h.Type("button"),
          h.Class(className(styles.secondary)),
          h.OnClick(Message.PressedStartOver()),
        ],
        ["Start over"],
      ),
    ],
  );
};

const ledes: Readonly<Record<Exclude<Model["step"], "Done" | "Verify">, string>> = {
  About: "It takes about two minutes. Your progress is saved as you go.",
  Address: "Autofill fills this whole page in one tap.",
  Work: "Pick everything that could work. You can change it later.",
  Background: "Answer yes and we'll ask a follow-up. Answer no and it disappears.",
};

const stepBody = (model: Model, h: H): ReadonlyArray<Html> => {
  switch (model.step) {
    case "About":
      return about(model, h);
    case "Address":
      return address(model, h);
    case "Work":
      return work(model, h);
    case "Background":
      return background(model, h);
    case "Verify":
      return verify(model, h);
    case "Done":
      return [];
  }
};

const topBar = (model: Model, h: H): Html => {
  const index = formSteps.indexOf(model.step as (typeof formSteps)[number]);
  const position = index === -1 ? formSteps.length : index + 1;
  return h.header(
    [h.Class(className(styles.top))],
    [
      index > 0
        ? h.button(
            [
              h.Type("button"),
              h.Class(className(styles.iconButton)),
              h.AriaLabel("Back"),
              h.OnClick(Message.PressedBack()),
            ],
            [Icon.view({ icon: ChevronLeft, size: 24 }, h)],
          )
        : h.span([], []),
      h.div(
        [h.Class(className(styles.progress))],
        [
          h.span(
            [h.Class(className(styles.progressLabel))],
            [index === -1 ? "Complete" : `Step ${position} of ${formSteps.length}`],
          ),
          h.div(
            [
              h.Class(className(styles.progressTrack)),
              h.Role("progressbar"),
              h.AriaLabel("Application progress"),
              h.AriaValuemin(0),
              h.AriaValuemax(formSteps.length),
              h.AriaValuenow(index === -1 ? formSteps.length : index),
            ],
            [
              h.div([
                h.Class(className(styles.progressFill)),
                h.Style({
                  transform: `scaleX(${(index === -1 ? formSteps.length : index + 1) / formSteps.length})`,
                }),
              ]),
            ],
          ),
        ],
      ),
      h.span([], []),
    ],
  );
};

const stateSheet = (model: Model, h: H): Html => {
  const matches = filterStates(model.stateQuery);
  return h.submodel({
    slotId: "mobile-form-state-sheet",
    model: model.stateSheet,
    view: Dialog.view,
    toParentMessage: (message) => Message.GotStateSheetMessage({ message }),
    viewInputs: bottomSheet(
      {
        title: "State",
        content: (initialFocus) => [
          h.div(
            [h.Class(className(styles.sheetSearch))],
            [
              h.label(
                [h.For("state-search"), h.Class(className(styles.srOnly))],
                ["Search states"],
              ),
              h.div(
                [h.Style({ position: "relative" })],
                [
                  h.input([
                    ...initialFocus,
                    h.Id("state-search"),
                    h.Type("search"),
                    h.Placeholder("Search"),
                    h.Autocomplete("off"),
                    h.Autocapitalize("none"),
                    h.Spellcheck(false),
                    h.EnterKeyHint("done"),
                    h.Value(model.stateQuery),
                    h.Class(className(inputStyles.control, styles.searchControl)),
                    h.OnInput((value) => Message.ChangedStateQuery({ value })),
                    h.OnKeyDownPreventDefault((key) =>
                      key === "Enter" && matches[0] !== undefined
                        ? Option.some(Message.ChosenState({ code: matches[0].code }))
                        : Option.none(),
                    ),
                  ]),
                  h.span(
                    [h.Class(className(styles.searchIcon))],
                    [Icon.view({ icon: Search, size: 18 }, h)],
                  ),
                ],
              ),
            ],
          ),
          matches.length === 0
            ? h.p([h.Class(className(styles.sheetEmpty))], ["No matching state"])
            : h.ul(
                [h.Class(className(styles.sheetList)), h.AriaLabel("States")],
                matches.map((state) =>
                  h.keyed("li")(
                    state.code,
                    [],
                    [
                      h.button(
                        [
                          h.Type("button"),
                          h.Class(className(styles.sheetRow)),
                          h.AriaPressed(model.values.state === state.code ? "true" : "false"),
                          h.OnClick(Message.ChosenState({ code: state.code })),
                        ],
                        [
                          h.span(
                            [],
                            [
                              state.name,
                              h.span([h.Class(className(styles.sheetCode))], [state.code]),
                            ],
                          ),
                          model.values.state === state.code
                            ? Icon.view({ icon: Check, size: 20, strokeWidth: 2.5 }, h)
                            : h.empty,
                        ],
                      ),
                    ],
                  ),
                ),
              ),
        ],
      },
      h,
    ),
  });
};

/** The form application itself, shared by the demo route and the standalone build. */
export const formApp = (model: Model, h: H): Html =>
  h.div(
    [h.Class(className(styles.app)), h.OnMount(KeyboardInset())],
    [
      topBar(model, h),
      h.div(
        [h.Id("mobile-form-scroll"), h.Class(className(styles.scroll))],
        [
          model.step === "Done"
            ? done(model, h)
            : h.form(
                [
                  h.Id("mobile-form"),
                  h.Class(className(styles.form)),
                  h.Novalidate(true),
                  h.OnSubmit(Message.Submitted()),
                ],
                [
                  h.keyed("div")(
                    model.step,
                    [h.Class(className(styles.body))],
                    [
                      h.h1(
                        [
                          h.Id("mobile-form-heading"),
                          h.Tabindex(-1),
                          h.Class(className(styles.heading)),
                        ],
                        [stepTitle(model.step)],
                      ),
                      model.step === "Verify"
                        ? h.empty
                        : h.p([h.Class(className(styles.lede))], [ledes[model.step]]),
                      ...stepBody(model, h),
                    ],
                  ),
                  h.div(
                    [h.Class(className(styles.actions))],
                    [
                      h.button(
                        [h.Type("submit"), h.Class(className(styles.primary))],
                        [model.step === "Verify" ? "Verify" : "Continue"],
                      ),
                    ],
                  ),
                ],
              ),
        ],
      ),
      h.div(
        [h.Class(className(styles.srOnly)), h.Role("status"), h.AriaLive("polite")],
        [model.announcement],
      ),
      stateSheet(model, h),
    ],
  );
