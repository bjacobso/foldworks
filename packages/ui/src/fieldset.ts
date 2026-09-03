import { Fieldset } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Description from "./description";
import { fieldsetStyles } from "./styles";
import { sxAttrs } from "./sx";

export type ViewConfig = Readonly<{
  id: string;
  legend: string;
  description?: string;
  children: ReadonlyArray<Html | string>;
  isDisabled?: boolean;
}>;

export const view = <Message>(
  config: ViewConfig,
  h: HtmlBuilder<Message>,
): Html => Fieldset.view(
  {
    id: config.id,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    toView: (attributes) => h.fieldset(
      [...attributes.fieldset, ...sxAttrs(h, fieldsetStyles.root, config.isDisabled === true && fieldsetStyles.disabled)],
      [
        h.legend([...attributes.legend, ...sxAttrs(h, fieldsetStyles.legend)], [config.legend]),
        Description.view(config.description, attributes.description, sxAttrs(h, fieldsetStyles.description), h),
        h.div(sxAttrs(h, fieldsetStyles.content), config.children),
      ],
    ),
  },
  h,
);
