import type * as stylex from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { panelStyles } from "./styles";
import { sxAttrs } from "./sx";

export const view = <Message>(
  config: Readonly<{
    title?: string;
    description?: string;
    children: ReadonlyArray<Html | string>;
    style?: stylex.StyleXStyles;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.section(sxAttrs(h, panelStyles.root, config.style), [
  ...(config.title === undefined && config.description === undefined
    ? []
    : [h.header(sxAttrs(h, panelStyles.header), [
        ...(config.title === undefined ? [] : [h.h2(sxAttrs(h, panelStyles.title), [config.title])]),
        ...(config.description === undefined
          ? []
          : [h.p(sxAttrs(h, panelStyles.description), [config.description])]),
      ])]),
  h.div(sxAttrs(h, panelStyles.body), config.children),
]);
