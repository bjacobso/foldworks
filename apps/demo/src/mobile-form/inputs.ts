import * as stylex from "@stylexjs/stylex";
import { Effect, Option, Schema as S, Stream } from "effect";
import { Mount } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Check, ChevronDown, CircleAlert, Minus, Plus } from "@lucide/icons";
import * as Dialog from "@foldkit/ui/dialog";
import * as Icon from "@foldworks/ui/icon";
import { caretAfterDigits, digitsOf, formatMask, MaskKind } from "./format";
import { inputStyles as styles } from "./inputs.styles";

/**
 * Stateless, touch-first form controls. Each control is one view function with
 * callbacks for its Messages, so a parent adds a field with one call and owns
 * its value; nothing here needs a Submodel, init, or update wiring.
 */

const cx = (...sx: ReadonlyArray<stylex.StyleXStyles | false | undefined>): string =>
  stylex.props(...sx).className ?? "";

/**
 * Formats masked input in place before Foldkit reads it, keeping the caret
 * after the same digit. Deleting a separator deletes the digit before it.
 * Capture listeners on the target run before the OnInput handler.
 */
export const MaskInput = Mount.defineStream("MobileMaskInput", {
  args: { kind: S.Literals(MaskKind) },
  messages: [S.Never],
  execute: ({ kind, element }) =>
    Stream.callback<never>(() =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const input = element as HTMLInputElement;
            let before = input.value;
            const onBeforeInput = () => {
              before = input.value;
            };
            const onInput = (event: Event) => {
              const raw = input.value;
              const caret = input.selectionStart ?? raw.length;
              let digits = digitsOf(raw);
              let digitsBeforeCaret = digitsOf(raw.slice(0, caret)).length;
              const deletedSeparator =
                (event as InputEvent).inputType === "deleteContentBackward" &&
                digits === digitsOf(before) &&
                digitsBeforeCaret > 0;
              if (deletedSeparator) {
                digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
                digitsBeforeCaret -= 1;
              }
              const formatted = formatMask(kind, digits);
              if (formatted === raw) return;
              input.value = formatted;
              if (document.activeElement === input) {
                const position = caretAfterDigits(formatted, digitsBeforeCaret);
                input.setSelectionRange(position, position);
              }
            };
            input.addEventListener("beforeinput", onBeforeInput, true);
            input.addEventListener("input", onInput, true);
            return () => {
              input.removeEventListener("beforeinput", onBeforeInput, true);
              input.removeEventListener("input", onInput, true);
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});

/**
 * Publishes the on-screen keyboard height as `--keyboard-inset` so a bottom
 * action bar can ride above it in Safari, which does not resize the layout
 * viewport. Browsers that resize content report zero.
 */
export const KeyboardInset = Mount.defineStream("MobileKeyboardInset", {
  messages: [S.Never],
  execute: ({ element }) =>
    Stream.callback<never>(() =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const viewport = window.visualViewport;
            if (viewport === null) return () => {};
            const target = element as HTMLElement;
            const sync = () => {
              const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
              target.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
            };
            viewport.addEventListener("resize", sync);
            viewport.addEventListener("scroll", sync);
            sync();
            return () => {
              viewport.removeEventListener("resize", sync);
              viewport.removeEventListener("scroll", sync);
            };
          }),
          (dispose) => Effect.sync(dispose),
        );
        return yield* Effect.never;
      }),
    ),
});

const errorId = (id: string) => `${id}-error`;
const hintId = (id: string) => `${id}-hint`;

const describedBy = <Message>(
  id: string,
  error: string | undefined,
  hint: string | undefined,
  h: HtmlBuilder<Message>,
) => {
  const ids = [
    ...(error === undefined ? [] : [errorId(id)]),
    ...(hint === undefined ? [] : [hintId(id)]),
  ];
  return ids.length === 0 ? [] : [h.AriaDescribedBy(ids.join(" "))];
};

const errorView = <Message>(id: string, error: string | undefined, h: HtmlBuilder<Message>) =>
  error === undefined
    ? h.empty
    : h.p(
        [h.Id(errorId(id)), h.Class(cx(styles.error))],
        [Icon.view({ icon: CircleAlert, size: 16, sx: styles.errorIcon }, h), error],
      );

const hintView = <Message>(id: string, hint: string | undefined, h: HtmlBuilder<Message>) =>
  hint === undefined ? h.empty : h.p([h.Id(hintId(id)), h.Class(cx(styles.hint))], [hint]);

export type TextFieldConfig<Message> = Readonly<{
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => Message;
  onBlur: Message;
  /** Focus moves here on Enter. Omit on the last field so Enter submits the form. */
  next?: string;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean;
  type?: "text" | "email" | "tel" | "date";
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "search" | "none";
  autocomplete: string;
  autocapitalize?: "none" | "words" | "sentences" | "characters";
  spellcheck?: boolean;
  placeholder?: string;
  mask?: MaskKind;
  maxLength?: number;
  min?: string | undefined;
  after?: Html | undefined;
}>;

/** A labelled text input with the keyboard, autofill token, and Enter behavior a phone needs. */
export const textField = <Message>(config: TextFieldConfig<Message>, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    config.id,
    [h.Class(cx(styles.field))],
    [
      h.label(
        [h.For(config.id), h.Class(cx(styles.labelRow))],
        [
          h.span([h.Class(cx(styles.label))], [config.label]),
          config.optional === true ? h.span([h.Class(cx(styles.optional))], ["Optional"]) : h.empty,
        ],
      ),
      hintView(config.id, config.hint, h),
      h.input([
        h.Id(config.id),
        h.Name(config.id),
        h.Type(config.type ?? "text"),
        h.Value(config.value),
        h.Class(
          cx(
            styles.control,
            config.mask !== undefined && styles.numeric,
            config.type === "date" && styles.date,
            config.error !== undefined && styles.controlInvalid,
          ),
        ),
        h.Autocomplete(config.autocomplete),
        h.EnterKeyHint(config.next === undefined ? "done" : "next"),
        ...(config.inputMode === undefined ? [] : [h.InputMode(config.inputMode)]),
        ...(config.autocapitalize === undefined ? [] : [h.Autocapitalize(config.autocapitalize)]),
        ...(config.spellcheck === false ? [h.Spellcheck(false), h.Autocorrect("off")] : []),
        ...(config.placeholder === undefined ? [] : [h.Placeholder(config.placeholder)]),
        ...(config.maxLength === undefined ? [] : [h.Maxlength(config.maxLength)]),
        ...(config.min === undefined ? [] : [h.Min(config.min)]),
        ...(config.optional === true ? [] : [h.AriaRequired(true)]),
        h.AriaInvalid(config.error !== undefined),
        ...describedBy(config.id, config.error, config.hint, h),
        h.OnInput(config.onInput),
        h.OnBlur(config.onBlur),
        ...(config.next === undefined
          ? []
          : [
              h.OnKeyDownFocus((key) =>
                key === "Enter"
                  ? Option.some({ focusSelector: `#${config.next}`, message: config.onBlur })
                  : Option.none(),
              ),
            ]),
        ...(config.mask === undefined ? [] : [h.OnMount(MaskInput({ kind: config.mask }))]),
      ]),
      errorView(config.id, config.error, h),
      config.after ?? h.empty,
    ],
  );

export type Choice<Value extends string> = Readonly<{
  value: Value;
  label: string;
  description?: string;
}>;

/** Native radios drawn as large cards: arrow keys, labels, and form semantics stay intact. */
export const choiceCards = <Message, Value extends string>(
  config: Readonly<{
    name: string;
    legend: string;
    options: ReadonlyArray<Choice<Value>>;
    value: string;
    onSelect: (value: Value) => Message;
    error?: string | undefined;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("fieldset")(
    config.name,
    [
      h.Id(`${config.name}-group`),
      h.Class(cx(styles.fieldset)),
      ...describedBy(config.name, config.error, undefined, h),
    ],
    [
      h.legend([h.Class(cx(styles.legend))], [config.legend]),
      ...config.options.map((option) =>
        h.label(
          [h.Class(cx(styles.card, config.value === option.value && styles.cardSelected))],
          [
            h.input([
              h.Id(`${config.name}-${option.value}`),
              h.Type("radio"),
              h.Name(config.name),
              h.Value(option.value),
              h.Checked(config.value === option.value),
              h.Class(cx(styles.radio)),
              h.OnChange(() => config.onSelect(option.value)),
            ]),
            h.span(
              [],
              [
                h.span([h.Class(cx(styles.cardTitle))], [option.label]),
                option.description === undefined
                  ? h.empty
                  : h.span(
                      [h.Class(cx(styles.cardDescription)), h.Style({ display: "block" })],
                      [option.description],
                    ),
              ],
            ),
          ],
        ),
      ),
      errorView(config.name, config.error, h),
    ],
  );

/** A required yes/no question: two native radios drawn as large side-by-side buttons. */
export const yesNo = <Message>(
  config: Readonly<{
    name: string;
    legend: string;
    value: "" | "yes" | "no";
    onAnswer: (answer: "yes" | "no") => Message;
    error?: string | undefined;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("fieldset")(
    config.name,
    [
      h.Class(cx(styles.fieldset)),
      h.AriaInvalid(config.error !== undefined),
      ...describedBy(config.name, config.error, undefined, h),
    ],
    [
      h.legend([h.Class(cx(styles.legend))], [config.legend]),
      h.div(
        [h.Class(cx(styles.yesNo))],
        (["yes", "no"] as const).map((answer) =>
          h.label(
            [h.Class(cx(styles.yesNoOption, config.value === answer && styles.yesNoSelected))],
            [
              h.input([
                h.Id(`${config.name}-${answer}`),
                h.Type("radio"),
                h.Name(config.name),
                h.Value(answer),
                h.Checked(config.value === answer),
                h.Class(cx(styles.srOnly)),
                h.OnChange(() => config.onAnswer(answer)),
              ]),
              answer === "yes" ? "Yes" : "No",
            ],
          ),
        ),
      ),
      errorView(config.name, config.error, h),
    ],
  );

/**
 * Shows or hides follow-up content with an animated expand and collapse. The
 * content stays rendered so it can animate closed and keep its DOM state;
 * while collapsed it is inert, so it cannot be focused or announced. Motion is
 * pure CSS (`grid-template-rows` from 0fr to 1fr), so there is no animation
 * state in the Model, and reduced-motion users get an instant change.
 */
export const reveal = <Message>(
  config: Readonly<{ id: string; isOpen: boolean; children: ReadonlyArray<Html> }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
    config.id,
    [
      h.Id(config.id),
      h.Class(cx(styles.reveal, config.isOpen && styles.revealOpen)),
      h.Inert(!config.isOpen),
      h.AriaHidden(!config.isOpen),
    ],
    [
      h.div(
        [h.Class(cx(styles.revealClip))],
        [
          h.div(
            [h.Class(cx(styles.revealBody, config.isOpen && styles.revealBodyOpen))],
            config.children,
          ),
        ],
      ),
    ],
  );

/** Multi-select pills backed by checkboxes. */
export const chips = <Message, Value extends string>(
  config: Readonly<{
    name: string;
    legend: string;
    options: ReadonlyArray<Choice<Value>>;
    selected: ReadonlyArray<string>;
    onToggle: (value: Value) => Message;
    error?: string | undefined;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("fieldset")(
    config.name,
    [h.Class(cx(styles.fieldset)), ...describedBy(config.name, config.error, undefined, h)],
    [
      h.legend([h.Class(cx(styles.legend))], [config.legend]),
      h.div(
        [h.Class(cx(styles.chips))],
        config.options.map((option) => {
          const isSelected = config.selected.includes(option.value);
          return h.label(
            [h.Class(cx(styles.chip, isSelected && styles.chipSelected))],
            [
              h.input([
                h.Id(`${config.name}-${option.value}`),
                h.Type("checkbox"),
                h.Name(config.name),
                h.Value(option.value),
                h.Checked(isSelected),
                h.Class(cx(styles.srOnly)),
                h.OnChange(() => config.onToggle(option.value)),
              ]),
              isSelected ? Icon.view({ icon: Check, size: 16, strokeWidth: 2.5 }, h) : h.empty,
              option.label,
            ],
          );
        }),
      ),
      errorView(config.name, config.error, h),
    ],
  );

/** Large minus/plus targets around a directly editable number. */
export const stepper = <Message>(
  config: Readonly<{
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    suffix: string;
    onStep: (delta: number) => Message;
    onInput: (value: string) => Message;
    error?: string | undefined;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
    config.id,
    [h.Class(cx(styles.field))],
    [
      h.label([h.For(config.id), h.Class(cx(styles.label))], [config.label]),
      h.div(
        [h.Class(cx(styles.stepper))],
        [
          h.button(
            [
              h.Type("button"),
              h.Class(cx(styles.stepperButton)),
              h.AriaLabel("Fewer hours"),
              h.AriaControls(config.id),
              h.Disabled(config.value <= config.min),
              h.OnClick(config.onStep(-1)),
            ],
            [Icon.view({ icon: Minus, size: 22 }, h)],
          ),
          h.div(
            [h.Class(cx(styles.stepperValue))],
            [
              h.input([
                h.Id(config.id),
                h.Type("text"),
                h.InputMode("numeric"),
                h.Pattern("[0-9]*"),
                h.Maxlength(2),
                h.Autocomplete("off"),
                h.EnterKeyHint("done"),
                h.Value(config.value === 0 ? "" : String(config.value)),
                h.Class(cx(styles.stepperInput)),
                h.AriaInvalid(config.error !== undefined),
                ...describedBy(config.id, config.error, undefined, h),
                h.OnInput(config.onInput),
              ]),
              h.span([h.Class(cx(styles.stepperSuffix)), h.AriaHidden(true)], [config.suffix]),
            ],
          ),
          h.button(
            [
              h.Type("button"),
              h.Class(cx(styles.stepperButton)),
              h.AriaLabel("More hours"),
              h.AriaControls(config.id),
              h.Disabled(config.value >= config.max),
              h.OnClick(config.onStep(1)),
            ],
            [Icon.view({ icon: Plus, size: 22 }, h)],
          ),
        ],
      ),
      errorView(config.id, config.error, h),
    ],
  );

/** A checkbox with the `switch` attribute, which Safari renders natively with haptics. */
export const toggle = <Message>(
  config: Readonly<{
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onToggle: (checked: boolean) => Message;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("label")(
    config.id,
    [h.Class(cx(styles.switchRow)), h.For(config.id)],
    [
      h.span(
        [],
        [
          h.span([h.Class(cx(styles.cardTitle)), h.Style({ display: "block" })], [config.label]),
          h.span([h.Class(cx(styles.cardDescription))], [config.description]),
        ],
      ),
      h.input([
        h.Id(config.id),
        h.Type("checkbox"),
        h.Attribute("switch", ""),
        h.Role("switch"),
        h.Checked(config.checked),
        h.Class(cx(styles.switch)),
        h.OnChange(() => config.onToggle(!config.checked)),
      ]),
    ],
  );

/**
 * One real input drawn as six cells, so SMS autofill, paste, and the numeric
 * keypad behave exactly like a native one-time-code field.
 */
export const codeInput = <Message>(
  config: Readonly<{
    id: string;
    label: string;
    value: string;
    length: number;
    onInput: (value: string) => Message;
    error?: string | undefined;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
    config.id,
    [h.Class(cx(styles.field))],
    [
      h.label([h.For(config.id), h.Class(cx(styles.srOnly))], [config.label]),
      h.div(
        [h.Class(stylex.props(styles.code, stylex.defaultMarker()).className ?? "")],
        [
          h.input([
            h.Id(config.id),
            h.Type("text"),
            h.InputMode("numeric"),
            h.Autocomplete("one-time-code"),
            h.Pattern(`\\d{${config.length}}`),
            h.Maxlength(config.length),
            h.EnterKeyHint("done"),
            h.Value(config.value),
            h.Class(cx(styles.codeInput)),
            h.AriaInvalid(config.error !== undefined),
            ...describedBy(config.id, config.error, undefined, h),
            h.OnInput(config.onInput),
            h.OnMount(MaskInput({ kind: "Otp" })),
          ]),
          ...Array.from({ length: config.length }, (_, index) =>
            h.span(
              [
                h.AriaHidden(true),
                h.Class(
                  cx(
                    styles.codeCell,
                    index === Math.min(config.value.length, config.length - 1) &&
                      styles.codeCellActive,
                  ),
                ),
              ],
              [
                config.value[index] ??
                  (index === config.value.length
                    ? h.span([h.Class(cx(styles.codeCaret))], [])
                    : ""),
              ],
            ),
          ),
        ],
      ),
      errorView(config.id, config.error, h),
    ],
  );

export type PickerTriggerConfig<Message> = Readonly<{
  id: string;
  label: string;
  displayValue: string;
  placeholder: string;
  onOpen: Message;
  error?: string | undefined;
  /** A visually hidden native select so browser autofill can still fill the value. */
  autofill: Readonly<{
    autocomplete: string;
    value: string;
    options: ReadonlyArray<Readonly<{ value: string; label: string }>>;
    onChange: (value: string) => Message;
  }>;
}>;

/** Looks like an input, opens a bottom sheet, and still participates in autofill. */
export const pickerTrigger = <Message>(
  config: PickerTriggerConfig<Message>,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
    config.id,
    [h.Class(cx(styles.field)), h.Style({ position: "relative" })],
    [
      h.span([h.Id(`${config.id}-label`), h.Class(cx(styles.label))], [config.label]),
      h.button(
        [
          h.Id(config.id),
          h.Type("button"),
          h.Class(
            cx(styles.control, styles.trigger, config.error !== undefined && styles.controlInvalid),
          ),
          h.AriaHasPopup("dialog"),
          h.AriaLabelledBy(`${config.id}-label ${config.id}`),
          h.AriaInvalid(config.error !== undefined),
          ...describedBy(config.id, config.error, undefined, h),
          h.OnClick(config.onOpen),
        ],
        [
          h.span(config.displayValue === "" ? [h.Class(cx(styles.triggerPlaceholder))] : [], [
            config.displayValue === "" ? config.placeholder : config.displayValue,
          ]),
          Icon.view({ icon: ChevronDown, size: 20 }, h),
        ],
      ),
      h.select(
        [
          h.Id(`${config.id}-autofill`),
          h.Name(config.id),
          h.Autocomplete(config.autofill.autocomplete),
          h.Tabindex(-1),
          h.AriaHidden(true),
          h.Class(cx(styles.autofill)),
          h.OnChange(config.autofill.onChange),
        ],
        [
          h.option([h.Value("")], [""]),
          ...config.autofill.options.map((option) =>
            h.option(
              [h.Value(option.value), h.Selected(option.value === config.autofill.value)],
              [option.label],
            ),
          ),
        ],
      ),
      errorView(config.id, config.error, h),
    ],
  );

/**
 * A modal bottom sheet for the headless Foldkit Dialog: focus trap, Escape,
 * backdrop dismissal, scroll lock, and focus return come from the Dialog.
 */
export const bottomSheet = <Message>(
  config: Readonly<{
    title: string;
    content: (initialFocus: Dialog.RenderInfo["initialFocus"]) => ReadonlyArray<Html>;
  }>,
  h: HtmlBuilder<Message>,
): Dialog.ViewInputs => ({
  toView: ({ dialog, backdrop, panel, title, initialFocus, isVisible }) =>
    h.dialog(
      [...dialog, h.AriaModal(true), h.Class(cx(styles.sheetRoot))],
      isVisible
        ? [
            h.div([...backdrop, h.Class(cx(styles.sheetBackdrop))]),
            h.section(
              [...panel, h.Class(cx(styles.sheet))],
              [
                h.h2([...title, h.Class(cx(styles.sheetTitle))], [config.title]),
                ...config.content(initialFocus),
              ],
            ),
          ]
        : [],
    ),
});
