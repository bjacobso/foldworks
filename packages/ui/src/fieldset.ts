import { Fieldset } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Description from "./description";
import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { fieldsetStyles } from "./styles";

export type Slot = "root" | "legend" | "description" | "content";

export type ViewConfig<Message = never> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  id: string;
  legend: string;
  description?: string;
  children: Children;
  isDisabled?: boolean;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Fieldset.view(
  {
    id: config.id,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    toView: (attributes) => h.fieldset(
      [...attributes.fieldset, ...rootAttrs(config, h,
        fieldsetStyles.root, config.isDisabled === true && fieldsetStyles.disabled)],
      [
        h.legend([...attributes.legend, ...slotAttrs(config.slotProps?.legend, h, fieldsetStyles.legend)], [config.legend]),
        Description.view(config.description, attributes.description,
          slotAttrs(config.slotProps?.description, h, fieldsetStyles.description), h),
        h.div(slotAttrs(config.slotProps?.content, h, fieldsetStyles.content), config.children),
      ],
    ),
  },
  h,
);
