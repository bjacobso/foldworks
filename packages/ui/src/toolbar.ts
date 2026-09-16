import type { Html, HtmlBuilder } from "foldkit/html";

import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { toolbarStyles } from "./styles";

export type Slot = "root" | "copy" | "title" | "description" | "actions";

export type ViewConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  title: string;
  description?: string;
  leading?: Children;
  actions?: Children;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.header(rootAttrs(config, h, toolbarStyles.root), [
  h.div(slotAttrs(config.slotProps?.copy, h, toolbarStyles.copy), [
    ...(config.leading ?? []),
    h.h1(slotAttrs(config.slotProps?.title, h, toolbarStyles.title), [config.title]),
    ...(config.description === undefined
      ? []
      : [h.p(slotAttrs(config.slotProps?.description, h, toolbarStyles.description), [config.description])]),
  ]),
  h.div(slotAttrs(config.slotProps?.actions, h, toolbarStyles.actions), config.actions ?? []),
]);
