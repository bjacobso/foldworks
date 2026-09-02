import type { Html, HtmlBuilder } from "foldkit/html";

import { Input, Select, Textarea } from "@foldkit/ui";

import { fieldStyles } from "./styles";
import { sxAttrs } from "./sx";

type CommonConfig = Readonly<{
  id: string;
  label: string;
  description?: string;
  isDisabled?: boolean;
  density?: "default" | "compact";
}>;

const descriptionView = <Message>(description: string | undefined, h: HtmlBuilder<Message>) =>
  description === undefined ? [] : [h.p(sxAttrs(h, fieldStyles.description), [description])];

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
    toView: (attributes) => h.div(sxAttrs(h, fieldStyles.root), [
      h.label([...attributes.label, ...sxAttrs(h, fieldStyles.label)], [config.label]),
      h.input([...attributes.input, ...sxAttrs(h, fieldStyles.control, config.density === "compact" && fieldStyles.compact)]),
      ...descriptionView(config.description, h),
    ]),
  },
  h,
);

export const textarea = <Message>(
  config: CommonConfig & Readonly<{ value?: string; onInput?: (value: string) => Message }>,
  h: HtmlBuilder<Message>,
): Html => Textarea.view(
  {
    id: config.id,
    ...(config.value === undefined ? {} : { value: config.value }),
    ...(config.onInput === undefined ? {} : { onInput: config.onInput }),
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    toView: (attributes) => h.div(sxAttrs(h, fieldStyles.root), [
      h.label([...attributes.label, ...sxAttrs(h, fieldStyles.label)], [config.label]),
      h.textarea([...attributes.textarea, ...sxAttrs(h, fieldStyles.control, fieldStyles.textarea)]),
      ...descriptionView(config.description, h),
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
    toView: (attributes) => h.div(sxAttrs(h, fieldStyles.root), [
      h.label([...attributes.label, ...sxAttrs(h, fieldStyles.label)], [config.label]),
      h.select(
        [...attributes.select, ...sxAttrs(h, fieldStyles.control, config.density === "compact" && fieldStyles.compact)],
        config.options.map((option) => h.option(
          [h.Value(option.value), h.Selected(option.value === config.value)],
          [option.label],
        )),
      ),
      ...descriptionView(config.description, h),
    ]),
  },
  h,
);
