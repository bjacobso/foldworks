import type { Attribute, ChildAttribute, Html, HtmlBuilder, KeyboardModifiers } from "foldkit/html";

import { Input, Select, Textarea } from "@foldkit/ui";

import * as Description from "./description";
import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { fieldStyles } from "./styles";

export type Slot = "root" | "label" | "controlWrapper" | "control" | "startAdornment" | "endAdornment" | "description";

type StyledFieldConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot>;

export type GroupConfig<Message> = StyledFieldConfig<Message> & Readonly<{ children: Children }>;

export const group = <Message>(
  config: GroupConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(rootAttrs(config, h, fieldStyles.root), config.children);

export type ViewConfig<Message> = StyledFieldConfig<Message> & Readonly<{
  id: string;
  label: string;
  children: Children;
  description?: string;
  error?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div([
  ...rootAttrs(config, h, fieldStyles.root),
  h.DataAttribute("invalid", config.error === undefined ? "false" : "true"),
  h.DataAttribute("disabled", config.isDisabled === true ? "true" : "false"),
], [
  h.label([h.For(config.id), ...slotAttrs(config.slotProps?.label, h, fieldStyles.label)], labelContent(config)),
  ...config.children,
  Description.view(
    config.error ?? config.description,
    [h.Id(`${config.id}-description`)],
    slotAttrs(config.slotProps?.description, h, fieldStyles.description,
      config.error !== undefined && fieldStyles.error),
    h,
  ),
]);

type CommonFields = Readonly<{
  id: string;
  label: string;
  description?: string;
  error?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  density?: "default" | "compact";
}>;

type TextControlFields<Message> = Readonly<{
  startAdornment?: Children;
  endAdornment?: Children;
  onKeyDown?: (key: string, modifiers: KeyboardModifiers) => Message;
}>;

type CommonConfig<Message> = StyledFieldConfig<Message> & CommonFields;
type TextControlConfig<Message> = CommonConfig<Message> & TextControlFields<Message>;

const labelContent = (config: CommonFields) => [
  config.label,
  ...(config.isRequired === true ? [" ", "*"] : []),
];

const supportingText = (config: CommonFields) => config.error ?? config.description;

const keyboardAttributes = <Message>(
  config: TextControlFields<unknown>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Attribute<Message>> =>
  config.onKeyDown === undefined
    ? []
    : [h.OnKeyDown((key, modifiers) => config.onKeyDown?.(key, modifiers) as Message)];

const hasAdornments = (config: TextControlFields<unknown>) =>
  config.startAdornment !== undefined || config.endAdornment !== undefined;

const adornment = <Message>(
  side: "start" | "end",
  config: TextControlConfig<Message>,
  h: HtmlBuilder<Message>,
): Html | undefined => {
  const children = side === "start" ? config.startAdornment : config.endAdornment;
  if (children === undefined) return undefined;
  const slot = side === "start" ? config.slotProps?.startAdornment : config.slotProps?.endAdornment;
  return h.span(slotAttrs(slot, h, fieldStyles.adornment), children);
};

const adornmentChildren = <Message>(
  side: "start" | "end",
  config: TextControlConfig<Message>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const child = adornment(side, config, h);
  return child === undefined ? [] : [child];
};

const inputControl = <Message>(
  config: InputConfig<Message>,
  attributes: ReadonlyArray<Attribute<Message> | ChildAttribute>,
  h: HtmlBuilder<Message>,
): Html => {
  const control = h.input([
    ...attributes,
    ...keyboardAttributes(config, h),
    ...slotAttrs(config.slotProps?.control, h, fieldStyles.control,
      hasAdornments(config) && fieldStyles.controlInWrapper,
      config.density === "compact" && fieldStyles.compact,
      !hasAdornments(config) && config.error !== undefined && fieldStyles.invalid),
  ]);
  if (!hasAdornments(config)) return control;
  return h.div(slotAttrs(config.slotProps?.controlWrapper, h,
    fieldStyles.controlWrapper, config.error !== undefined && fieldStyles.invalid), [
    ...adornmentChildren("start", config, h),
    control,
    ...adornmentChildren("end", config, h),
  ]);
};

export type InputConfig<Message> = TextControlConfig<Message> & Readonly<{
  value?: string;
  placeholder?: string;
  type?: string;
  onInput?: (value: string) => Message;
}>;

export const input = <Message>(
  config: InputConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Input.view(
  {
    id: config.id,
    ...(config.value === undefined ? {} : { value: config.value }),
    ...(config.placeholder === undefined ? {} : { placeholder: config.placeholder }),
    ...(config.type === undefined ? {} : { type: config.type }),
    ...(config.onInput === undefined ? {} : { onInput: config.onInput }),
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
    isInvalid: config.error !== undefined,
    toView: (attributes) => h.div(rootAttrs(config, h, fieldStyles.root), [
      h.label([...attributes.label, ...slotAttrs(config.slotProps?.label, h, fieldStyles.label)], labelContent(config)),
      inputControl(config, attributes.input, h),
      Description.view(supportingText(config), attributes.description,
        slotAttrs(config.slotProps?.description, h, fieldStyles.description,
          config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);

export type TextareaConfig<Message> = TextControlConfig<Message> & Readonly<{
  value?: string;
  placeholder?: string;
  rows?: number;
  minRows?: number;
  onInput?: (value: string) => Message;
}>;

const textareaControl = <Message>(
  config: TextareaConfig<Message>,
  attributes: ReadonlyArray<Attribute<Message> | ChildAttribute>,
  h: HtmlBuilder<Message>,
): Html => {
  const control = h.textarea([
    ...attributes,
    ...keyboardAttributes(config, h),
    ...(config.minRows === undefined ? [] : [h.Style({ minHeight: `calc(${config.minRows} * 1.5em + 20px)` })]),
    ...slotAttrs(config.slotProps?.control, h, fieldStyles.control, fieldStyles.textarea,
      hasAdornments(config) && fieldStyles.controlInWrapper,
      !hasAdornments(config) && config.error !== undefined && fieldStyles.invalid),
  ]);
  if (!hasAdornments(config)) return control;
  return h.div(slotAttrs(config.slotProps?.controlWrapper, h,
    fieldStyles.controlWrapper, fieldStyles.textareaWrapper, config.error !== undefined && fieldStyles.invalid), [
    ...adornmentChildren("start", config, h),
    control,
    ...adornmentChildren("end", config, h),
  ]);
};

export const textarea = <Message>(
  config: TextareaConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  if (config.minRows !== undefined && (!Number.isInteger(config.minRows) || config.minRows < 1)) {
    throw new Error("Field textarea minRows must be a positive integer.");
  }
  return Textarea.view(
  {
    id: config.id,
    ...(config.value === undefined ? {} : { value: config.value }),
    ...(config.placeholder === undefined ? {} : { placeholder: config.placeholder }),
    ...(config.rows === undefined ? {} : { rows: config.rows }),
    ...(config.onInput === undefined ? {} : { onInput: config.onInput }),
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
    isInvalid: config.error !== undefined,
    toView: (attributes) => h.div(rootAttrs(config, h, fieldStyles.root), [
      h.label([...attributes.label, ...slotAttrs(config.slotProps?.label, h, fieldStyles.label)], labelContent(config)),
      textareaControl(config, attributes.textarea, h),
      Description.view(supportingText(config), attributes.description,
        slotAttrs(config.slotProps?.description, h, fieldStyles.description,
          config.error !== undefined && fieldStyles.error), h),
    ]),
  },
    h,
  );
};

export type SelectConfig<Message> = CommonConfig<Message> & Readonly<{
  value?: string;
  options: ReadonlyArray<Readonly<{ value: string; label: string }>>;
  onChange?: (value: string) => Message;
}>;

export const select = <Message>(
  config: SelectConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Select.view(
  {
    id: config.id,
    ...(config.value === undefined ? {} : { value: config.value }),
    ...(config.onChange === undefined ? {} : { onChange: config.onChange }),
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    isInvalid: config.error !== undefined,
    toView: (attributes) => h.div(rootAttrs(config, h, fieldStyles.root), [
      h.label([...attributes.label, ...slotAttrs(config.slotProps?.label, h, fieldStyles.label)], labelContent(config)),
      h.select(
        [...attributes.select, ...slotAttrs(config.slotProps?.control, h, fieldStyles.control,
          config.density === "compact" && fieldStyles.compact, config.error !== undefined && fieldStyles.invalid)],
        config.options.map((option) => h.option(
          [h.Value(option.value), h.Selected(option.value === config.value)],
          [option.label],
        )),
      ),
      Description.view(supportingText(config), attributes.description,
        slotAttrs(config.slotProps?.description, h, fieldStyles.description,
          config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);
