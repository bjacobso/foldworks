import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

import { Input, Select, Textarea } from "@foldkit/ui";

import * as Description from "./description";
import { fieldStyles } from "./styles";
import { sxAttrs } from "./sx";

type CommonConfig = Readonly<{
  id: string;
  label: string;
  description?: string;
  error?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  density?: "default" | "compact";
}>;

const labelContent = (config: CommonConfig) => [
  config.label,
  ...(config.isRequired === true ? [" ", "*"] : []),
];

const supportingText = (config: CommonConfig) => config.error ?? config.description;

export const input = <Message>(
  config: CommonConfig & Readonly<{
    value?: string;
    placeholder?: string;
    type?: string;
    onInput?: (value: string) => Message;
  }>,
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
    toView: (attributes) => h.div(sxAttrs(h, fieldStyles.root), [
      h.label([...attributes.label, ...sxAttrs(h, fieldStyles.label)], labelContent(config)),
      h.input([...attributes.input, ...sxAttrs(h, fieldStyles.control, config.density === "compact" && fieldStyles.compact, config.error !== undefined && fieldStyles.invalid)]),
      Description.view(supportingText(config), attributes.description, sxAttrs(h, fieldStyles.description, config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);

export const textarea = <Message>(
  config: CommonConfig & Readonly<{
    value?: string;
    placeholder?: string;
    rows?: number;
    onInput?: (value: string) => Message;
  }>,
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
    toView: (attributes) => h.div(sxAttrs(h, fieldStyles.root), [
      h.label([...attributes.label, ...sxAttrs(h, fieldStyles.label)], labelContent(config)),
      h.textarea([...attributes.textarea, ...sxAttrs(h, fieldStyles.control, fieldStyles.textarea, config.error !== undefined && fieldStyles.invalid)]),
      Description.view(supportingText(config), attributes.description, sxAttrs(h, fieldStyles.description, config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);

export const select = <Message>(
  config: CommonConfig & Readonly<{
    value?: string;
    options: ReadonlyArray<Readonly<{ value: string; label: string }>>;
    onChange?: (value: string) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => Select.view(
  {
    id: config.id,
    ...(config.value === undefined ? {} : { value: config.value }),
    ...(config.onChange === undefined ? {} : { onChange: config.onChange }),
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    isInvalid: config.error !== undefined,
    toView: (attributes) => h.div(sxAttrs(h, fieldStyles.root), [
      h.label([...attributes.label, ...sxAttrs(h, fieldStyles.label)], labelContent(config)),
      h.select(
        [...attributes.select, ...sxAttrs(h, fieldStyles.control, config.density === "compact" && fieldStyles.compact, config.error !== undefined && fieldStyles.invalid)],
        config.options.map((option) => h.option(
          [h.Value(option.value), h.Selected(option.value === config.value)],
          [option.label],
        )),
      ),
      Description.view(supportingText(config), attributes.description, sxAttrs(h, fieldStyles.description, config.error !== undefined && fieldStyles.error), h),
    ]),
  },
  h,
);
