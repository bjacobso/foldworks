import type { Html, HtmlBuilder } from "foldkit/html";

import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { badgeStyles } from "./styles";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";
export type Slot = "root" | "dot";

export type ViewConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  label: string;
  tone?: Tone;
  dot?: boolean;
}>;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const tone = config.tone ?? "neutral";
  return h.span(
    rootAttrs(config, h, badgeStyles.base, badgeStyles[tone]),
    [
      ...(config.dot === true
        ? [h.span([...slotAttrs(config.slotProps?.dot, h, badgeStyles.dot), h.AriaHidden(true)])]
        : []),
      config.label,
    ],
  );
};
