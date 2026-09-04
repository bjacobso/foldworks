import type { Html, HtmlBuilder } from "foldkit/html";

import * as Disclosure from "./disclosure";
import { layoutStyles } from "./styles";
import { sxAttrs } from "./sx";

type AccordionItem<Message> = Readonly<{
  id: string;
  label: string;
  children: ReadonlyArray<Html | string>;
  isOpen: boolean;
  isDisabled?: boolean;
  onToggle: (isOpen: boolean) => Message;
}>;

const accordion = <Message>(
  config: Readonly<{ items: ReadonlyArray<AccordionItem<Message>> }>,
  h: HtmlBuilder<Message>,
): Html => h.div(sxAttrs(h, layoutStyles.stack), config.items.map((item) =>
  Disclosure.view(item, h),
));

export const Accordion = { view: accordion } as const;
export const Collapsible = { view: Disclosure.view } as const;
