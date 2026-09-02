import type { Html, HtmlBuilder } from "foldkit/html";

import { toolbarStyles } from "./styles";
import { sxAttrs } from "./sx";

export const view = <Message>(
  config: Readonly<{
    title: string;
    description?: string;
    leading?: ReadonlyArray<Html | string>;
    actions?: ReadonlyArray<Html | string>;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.header(sxAttrs(h, toolbarStyles.root), [
  h.div(sxAttrs(h, toolbarStyles.copy), [
    ...(config.leading ?? []),
    h.h1(sxAttrs(h, toolbarStyles.title), [config.title]),
    ...(config.description === undefined
      ? []
      : [h.p(sxAttrs(h, toolbarStyles.description), [config.description])]),
  ]),
  h.div(sxAttrs(h, toolbarStyles.actions), config.actions ?? []),
]);
