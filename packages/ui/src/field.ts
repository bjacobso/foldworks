import type { Html, HtmlBuilder } from "foldkit/html";

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

export type Slot = "root" | "label" | "control" | "description";

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

type CommonConfig<Message> = StyledFieldConfig<Message> & CommonFields;

const labelContent = (config: CommonFields) => [
  config.label,
  ...(config.isRequired === true ? [" ", "*"] : []),
];

const supportingText = (config: CommonFields) => config.error ?? config.description;

export type InputConfig<Message> = CommonConfig<Message> & Readonly<{
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
      h.input([...attributes.input, ...slotAttrs(config.slotProps?.control, h, fieldStyles.control,
        config.density === "compact" && fieldStyles.compact, config.error !== undefined && fieldStyles.invalid)]),
      Description.view(supportingText(config), attributes.description,
        slotAttrs(config.slotProps?.description, h, fieldStyles.description,
          config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);

export type TextareaConfig<Message> = CommonConfig<Message> & Readonly<{
  value?: string;
  placeholder?: string;
  rows?: number;
  onInput?: (value: string) => Message;
}>;

export const textarea = <Message>(
  config: TextareaConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Textarea.view(
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
      h.textarea([...attributes.textarea, ...slotAttrs(config.slotProps?.control, h,
        fieldStyles.control, fieldStyles.textarea, config.error !== undefined && fieldStyles.invalid)]),
      Description.view(supportingText(config), attributes.description,
        slotAttrs(config.slotProps?.description, h, fieldStyles.description,
          config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);

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
