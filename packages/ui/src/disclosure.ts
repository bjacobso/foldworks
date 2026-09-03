import { ChevronDown } from "@lucide/icons";
import { Disclosure } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Icon from "./icon";
import { disclosureStyles } from "./styles";
import { sxAttrs } from "./sx";

export type ViewConfig<Message> = Readonly<{
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => Message;
  children: ReadonlyArray<Html | string>;
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
    toView: ({ button, panel, animatePanel }) => h.div(sxAttrs(h, disclosureStyles.root), [
      h.button([...button, ...sxAttrs(h, disclosureStyles.trigger)], [
        config.label,
        h.span(sxAttrs(h, disclosureStyles.icon, config.isOpen && disclosureStyles.iconOpen), [
          Icon.view({ icon: ChevronDown, size: 16 }, h),
        ]),
      ]),
      animatePanel(h.div([...panel, ...sxAttrs(h, disclosureStyles.panel)], [
        h.div(sxAttrs(h, disclosureStyles.panelInner), config.children),
      ])),
    ]),
  },
  h,
);
