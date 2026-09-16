import { ChevronDown } from "@lucide/icons";
import { Disclosure } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Icon from "./icon";
import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { disclosureStyles } from "./styles";

export type Slot = "root" | "trigger" | "icon" | "panel" | "panelInner";

export type ViewConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => Message;
  children: Children;
  isDisabled?: boolean;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => Disclosure.view(
  {
    id: config.id,
    isOpen: config.isOpen,
    onToggle: config.onToggle,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    toView: ({ button, panel, animatePanel }) => h.div(rootAttrs(config, h, disclosureStyles.root), [
      h.button([...button, ...slotAttrs(config.slotProps?.trigger, h, disclosureStyles.trigger)], [
        config.label,
        h.span(slotAttrs(config.slotProps?.icon, h,
          disclosureStyles.icon, config.isOpen && disclosureStyles.iconOpen), [
          Icon.view({ icon: ChevronDown, size: 16 }, h),
        ]),
      ]),
      animatePanel(h.div([...panel, ...slotAttrs(config.slotProps?.panel, h, disclosureStyles.panel)], [
        h.div(slotAttrs(config.slotProps?.panelInner, h, disclosureStyles.panelInner), config.children),
      ])),
    ]),
  },
  h,
);
