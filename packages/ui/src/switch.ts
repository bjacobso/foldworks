import { Switch } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Description from "./description";
import { switchStyles } from "./styles";
import { sxAttrs } from "./sx";

export type ViewConfig<Message> = Readonly<{
  id: string;
  label: string;
  description?: string;
  isChecked: boolean;
  onToggle: (isChecked: boolean) => Message;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  name?: string;
  value?: string;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Switch.view(
  {
    id: config.id,
    isChecked: config.isChecked,
    onToggle: config.onToggle,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
    ...(config.name === undefined ? {} : { name: config.name }),
    ...(config.value === undefined ? {} : { value: config.value }),
    toView: (attributes) => h.div(
      sxAttrs(h, switchStyles.root, config.isDisabled === true && switchStyles.disabled),
      [
        h.div(sxAttrs(h, switchStyles.copy), [
          h.span([...attributes.label, ...sxAttrs(h, switchStyles.label)], [config.label]),
          Description.view(config.description, attributes.description, sxAttrs(h, switchStyles.description), h),
        ]),
        h.button(
          [...attributes.button, ...sxAttrs(h, switchStyles.control, config.isChecked && switchStyles.checked)],
          [h.span(sxAttrs(h, switchStyles.thumb, config.isChecked && switchStyles.thumbChecked))],
        ),
        ...(attributes.hiddenInput.length === 0
          ? []
          : [h.input([...attributes.hiddenInput, ...sxAttrs(h, switchStyles.hiddenInput)])]),
      ],
    ),
  },
  h,
);
