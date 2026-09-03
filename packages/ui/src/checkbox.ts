import { Check, Minus } from "@lucide/icons";
import { Checkbox } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Description from "./description";
import * as Icon from "./icon";
import { choiceStyles } from "./styles";
import { sxAttrs } from "./sx";

export type ViewConfig<Message> = Readonly<{
  id: string;
  label: string;
  description?: string;
  isChecked: boolean;
  onToggle: (isChecked: boolean) => Message;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isIndeterminate?: boolean;
  name?: string;
  value?: string;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Checkbox.view(
  {
    id: config.id,
    isChecked: config.isChecked,
    onToggle: config.onToggle,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
    ...(config.isIndeterminate === undefined ? {} : { isIndeterminate: config.isIndeterminate }),
    ...(config.name === undefined ? {} : { name: config.name }),
    ...(config.value === undefined ? {} : { value: config.value }),
    toView: (attributes) => h.div(
      sxAttrs(h, choiceStyles.root, config.isDisabled === true && choiceStyles.disabled),
      [
        h.button(
          [
            ...attributes.checkbox,
            ...sxAttrs(
              h,
              choiceStyles.control,
              config.isChecked && choiceStyles.checked,
              config.isIndeterminate === true && choiceStyles.indeterminate,
            ),
          ],
          config.isChecked || config.isIndeterminate === true
            ? [Icon.view({ icon: config.isIndeterminate === true ? Minus : Check, size: 13, strokeWidth: 2.5 }, h)]
            : [],
        ),
        h.div(sxAttrs(h, choiceStyles.content), [
          h.span([...attributes.label, ...sxAttrs(h, choiceStyles.label)], [config.label]),
          Description.view(config.description, attributes.description, sxAttrs(h, choiceStyles.description), h),
        ]),
        ...(attributes.hiddenInput.length === 0
          ? []
          : [h.input([...attributes.hiddenInput, ...sxAttrs(h, choiceStyles.hiddenInput)])]),
      ],
    ),
  },
  h,
);
