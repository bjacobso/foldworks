import { Switch } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Description from "./description";
import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { switchStyles } from "./styles";

export type Slot = "root" | "copy" | "label" | "description" | "control" | "thumb" | "hiddenInput";

export type ViewConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
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
      rootAttrs(config, h, switchStyles.root, config.isDisabled === true && switchStyles.disabled),
      [
        h.div(slotAttrs(config.slotProps?.copy, h, switchStyles.copy), [
          h.span([...attributes.label, ...slotAttrs(config.slotProps?.label, h, switchStyles.label)], [config.label]),
          Description.view(config.description, attributes.description,
            slotAttrs(config.slotProps?.description, h, switchStyles.description), h),
        ]),
        h.button(
          [...attributes.button, ...slotAttrs(config.slotProps?.control, h,
            switchStyles.control, config.isChecked && switchStyles.checked)],
          [h.span(slotAttrs(config.slotProps?.thumb, h,
            switchStyles.thumb, config.isChecked && switchStyles.thumbChecked))],
        ),
        ...(attributes.hiddenInput.length === 0
          ? []
          : [h.input([...attributes.hiddenInput,
              ...slotAttrs(config.slotProps?.hiddenInput, h, switchStyles.hiddenInput)])]),
      ],
    ),
  },
  h,
);
