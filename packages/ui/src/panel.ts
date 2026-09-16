import type { Html, HtmlBuilder } from "foldkit/html";

import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { panelStyles } from "./styles";

export type Slot = "root" | "header" | "title" | "description" | "body";

export type ViewConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  title?: string;
  description?: string;
  children: Children;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.section(rootAttrs(config, h, panelStyles.root), [
  ...(config.title === undefined && config.description === undefined
    ? []
    : [h.header(slotAttrs(config.slotProps?.header, h, panelStyles.header), [
        ...(config.title === undefined
          ? []
          : [h.h2(slotAttrs(config.slotProps?.title, h, panelStyles.title), [config.title])]),
        ...(config.description === undefined
          ? []
          : [h.p(slotAttrs(config.slotProps?.description, h, panelStyles.description), [config.description])]),
      ])]),
  h.div(slotAttrs(config.slotProps?.body, h, panelStyles.body), config.children),
]);
