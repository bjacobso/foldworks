import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

type ControlConfig<Message> = StyledConfig<Message> & Readonly<{
  id?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  ariaLabel?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  onInput?: (value: string) => Message;
}>;

const controlAttributes = <Message>(
  config: ControlConfig<Message>,
  h: HtmlBuilder<Message>,
) => [
  ...styledAttrs(config, h, styles.control, styles.focusable),
  ...(config.id === undefined ? [] : [h.Id(config.id)]),
  ...(config.name === undefined ? [] : [h.Name(config.name)]),
  ...(config.value === undefined ? [] : [h.Value(config.value)]),
  ...(config.placeholder === undefined ? [] : [h.Placeholder(config.placeholder)]),
  ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
  ...(config.isDisabled === undefined ? [] : [h.Disabled(config.isDisabled)]),
  ...(config.isReadOnly === undefined ? [] : [h.Readonly(config.isReadOnly)]),
  ...(config.isRequired === undefined ? [] : [h.Required(config.isRequired)]),
  ...(config.isInvalid === undefined ? [] : [h.AriaInvalid(config.isInvalid)]),
  ...(config.onInput === undefined ? [] : [h.OnInput(config.onInput)]),
];

const input = <Message>(
  config: ControlConfig<Message> & Readonly<{ type?: string }>,
  h: HtmlBuilder<Message>,
): Html => h.input([
  ...controlAttributes(config, h),
  h.Type(config.type ?? "text"),
]);

const textarea = <Message>(
  config: ControlConfig<Message> & Readonly<{ rows?: number }>,
  h: HtmlBuilder<Message>,
): Html => h.textarea([
  ...controlAttributes(config, h),
  ...sxAttrs(h, styles.textarea),
  ...(config.rows === undefined ? [] : [h.Rows(config.rows)]),
]);

const label = <Message>(
  config: StyledConfig<Message> & Readonly<{ for: string; children: Children; isDisabled?: boolean }>,
  h: HtmlBuilder<Message>,
): Html => h.label(
  [
    ...styledAttrs(config, h, styles.label),
    h.For(config.for),
    ...(config.isDisabled === true ? [h.AriaDisabled(true)] : []),
  ],
  config.children,
);

type SelectOption = Readonly<{ value: string; label: string; isDisabled?: boolean }>;

const nativeSelect = <Message>(
  config: StyledConfig<Message> & Readonly<{
    value: string;
    options: ReadonlyArray<SelectOption>;
    ariaLabel: string;
    name?: string;
    isDisabled?: boolean;
    onChange?: (value: string) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.select(
  [
    ...styledAttrs(config, h, styles.control, styles.focusable),
    h.Value(config.value),
    h.AriaLabel(config.ariaLabel),
    ...(config.name === undefined ? [] : [h.Name(config.name)]),
    ...(config.isDisabled === undefined ? [] : [h.Disabled(config.isDisabled)]),
    ...(config.onChange === undefined ? [] : [h.OnChange(config.onChange)]),
  ],
  config.options.map((option) => h.option([
    h.Value(option.value),
    h.Selected(option.value === config.value),
    ...(option.isDisabled === undefined ? [] : [h.Disabled(option.isDisabled)]),
  ], [option.label])),
);

const inputGroup = <Message>(
  config: StyledConfig<Message> & Readonly<{
    control: Html;
    prefix?: Children;
    suffix?: Children;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.inset, styles.inputGroup), [
  ...(config.prefix === undefined ? [] : [h.div(sxAttrs(h, styles.inputGroupAddon), config.prefix)]),
  h.div(sxAttrs(h, styles.inputGroupControl), [config.control]),
  ...(config.suffix === undefined ? [] : [h.div(sxAttrs(h, styles.inputGroupAddon), config.suffix)]),
]);

const inputGroupInput = <Message>(
  config: ControlConfig<Message> & Readonly<{ type?: string }>,
  h: HtmlBuilder<Message>,
): Html => h.input([
  ...styledAttrs(config, h, styles.control, styles.focusable, styles.inputGroupControl),
  ...(config.id === undefined ? [] : [h.Id(config.id)]),
  ...(config.name === undefined ? [] : [h.Name(config.name)]),
  ...(config.value === undefined ? [] : [h.Value(config.value)]),
  ...(config.placeholder === undefined ? [] : [h.Placeholder(config.placeholder)]),
  ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
  ...(config.isDisabled === undefined ? [] : [h.Disabled(config.isDisabled)]),
  ...(config.isReadOnly === undefined ? [] : [h.Readonly(config.isReadOnly)]),
  ...(config.onInput === undefined ? [] : [h.OnInput(config.onInput)]),
  h.Type(config.type ?? "text"),
]);

const inputOtp = <Message>(
  config: StyledConfig<Message> & Readonly<{
    value: string;
    length?: number;
    ariaLabel?: string;
    isDisabled?: boolean;
    onInput?: (value: string) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const length = config.length ?? 6;
  return h.div(styledAttrs(config, h, styles.otp), [
    h.input([
      ...sxAttrs(h, styles.control, styles.focusable),
      h.Value(config.value),
      h.AriaLabel(config.ariaLabel ?? "One-time password"),
      h.Attribute("inputmode", "numeric"),
      h.Attribute("autocomplete", "one-time-code"),
      h.Attribute("maxlength", String(length)),
      h.Style({ fontFamily: "ui-monospace, monospace", letterSpacing: "0.65em", width: `${length * 2.25}rem` }),
      ...(config.isDisabled === undefined ? [] : [h.Disabled(config.isDisabled)]),
      ...(config.onInput === undefined ? [] : [h.OnInput((value) => config.onInput?.(value.replace(/\D/g, "").slice(0, length)) as Message)]),
    ]),
  ]);
};

type RadioOption<Value extends string> = Readonly<{
  value: Value;
  label: string;
  description?: string;
  isDisabled?: boolean;
}>;

const radioGroup = <Message, Value extends string>(
  config: StyledConfig<Message> & Readonly<{
    name: string;
    value?: Value;
    options: ReadonlyArray<RadioOption<Value>>;
    ariaLabel: string;
    isDisabled?: boolean;
    onChange: (value: Value) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.fieldset(
  [...styledAttrs(config, h, styles.radioGroup), h.AriaLabel(config.ariaLabel), ...(config.isDisabled === true ? [h.Disabled(true)] : [])],
  config.options.map((option) => h.label(sxAttrs(h, styles.radioItem), [
    h.input([
      ...sxAttrs(h, styles.radioControl, styles.focusable),
      h.Type("radio"),
      h.Name(config.name),
      h.Value(option.value),
      h.Checked(option.value === config.value),
      h.OnChange(() => config.onChange(option.value)),
      ...(option.isDisabled === true ? [h.Disabled(true)] : []),
    ]),
    h.span([], [
      option.label,
      ...(option.description === undefined ? [] : [h.span(sxAttrs(h, styles.description), [option.description])]),
    ]),
  ])),
);

const slider = <Message>(
  config: StyledConfig<Message> & Readonly<{
    value: number;
    min?: number;
    max?: number;
    step?: number;
    ariaLabel: string;
    isDisabled?: boolean;
    onChange: (value: number) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.input([
  ...styledAttrs(config, h, styles.range, styles.focusable),
  h.Type("range"),
  h.Value(String(config.value)),
  h.AriaLabel(config.ariaLabel),
  h.Attribute("min", String(config.min ?? 0)),
  h.Attribute("max", String(config.max ?? 100)),
  h.Attribute("step", String(config.step ?? 1)),
  ...(config.isDisabled === true ? [h.Disabled(true)] : []),
  h.OnInput((value) => config.onChange(Number(value))),
]);

const toggle = <Message>(
  config: StyledConfig<Message> & Readonly<{
    label: string;
    isPressed: boolean;
    onToggle: (isPressed: boolean) => Message;
    isDisabled?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.button(
  [
    ...styledAttrs(config, h, styles.toggle, styles.focusable, config.isPressed && styles.togglePressed),
    h.Type("button"),
    h.AriaPressed(String(config.isPressed)),
    h.OnClick(config.onToggle(!config.isPressed)),
    ...(config.isDisabled === true ? [h.Disabled(true)] : []),
  ],
  [config.label],
);

const toggleGroup = <Message, Value extends string>(
  config: StyledConfig<Message> & Readonly<{
    values: ReadonlyArray<Value>;
    options: ReadonlyArray<Readonly<{ value: Value; label: string }>>;
    ariaLabel: string;
    multiple?: boolean;
    onChange: (values: ReadonlyArray<Value>) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [...styledAttrs(config, h, styles.inset, styles.group), h.Role("group"), h.AriaLabel(config.ariaLabel)],
  config.options.map((option, index) => {
    const isPressed = config.values.includes(option.value);
    const nextValues = config.multiple === true
      ? isPressed
        ? config.values.filter((value) => value !== option.value)
        : [...config.values, option.value]
      : [option.value];
    return h.button([
      ...sxAttrs(
        h,
        styles.toggle,
        styles.groupConnected,
        index === 0 && styles.groupFirst,
        index === config.options.length - 1 && styles.groupLast,
        isPressed && styles.togglePressed,
      ),
      h.Type("button"),
      h.AriaPressed(String(isPressed)),
      h.OnClick(config.onChange(nextValues)),
    ], [option.label]);
  }),
);

const buttonGroup = <Message>(
  config: StyledConfig<Message> & Readonly<{ children: Children; ariaLabel?: string }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [...styledAttrs(config, h, styles.group), h.Role("group"), ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)])],
  config.children,
);

const form = <Message>(
  config: StyledConfig<Message> & Readonly<{
    children: Children;
    onSubmit: Message;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.form(
  [...styledAttrs(config, h), h.OnSubmit(config.onSubmit), ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)])],
  config.children,
);

export const ButtonGroup = { view: buttonGroup } as const;
export const Form = { view: form } as const;
export const Input = { view: input } as const;
export const InputGroup = { view: inputGroup, input: inputGroupInput } as const;
export const InputOtp = { view: inputOtp } as const;
export const Label = { view: label } as const;
export const NativeSelect = { view: nativeSelect } as const;
export const RadioGroup = { view: radioGroup } as const;
export const Slider = { view: slider } as const;
export const Textarea = { view: textarea } as const;
export const Toggle = { view: toggle } as const;
export const ToggleGroup = { view: toggleGroup } as const;
