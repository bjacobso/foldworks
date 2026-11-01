import type { Html, HtmlBuilder } from "foldkit/html";

import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { badgeStyles } from "./styles";

/** Seven generic tones shared by Badge, Tag, Stat, and Legend markers. */
export type Tone = "neutral" | "muted" | "accent" | "success" | "warning" | "danger" | "info";
/** `subtle` is the tinted default; `outline` keeps the tone on a transparent fill. */
export type Variant = "subtle" | "outline";
export type Slot = "root" | "dot";

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    label: string;
    tone?: Tone;
    variant?: Variant;
    /** Monospace text for identifiers, codes, and field types. */
    mono?: boolean;
    dot?: boolean;
  }>;

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const tone = config.tone ?? "neutral";
  const isOutline = config.variant === "outline";
  return h.span(
    rootAttrs(
      config,
      h,
      badgeStyles.base,
      badgeStyles[tone],
      isOutline && badgeStyles.outline,
      isOutline && tone === "neutral" && badgeStyles.outlineNeutral,
      isOutline && tone === "muted" && badgeStyles.outlineMuted,
      config.mono === true && badgeStyles.mono,
    ),
    [
      ...(config.dot === true
        ? [h.span([...slotAttrs(config.slotProps?.dot, h, badgeStyles.dot), h.AriaHidden(true)])]
        : []),
      config.label,
    ],
  );
};
