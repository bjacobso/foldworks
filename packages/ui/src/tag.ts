import { X } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Icon from "./icon";
import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import type { Tone } from "./badge";
import { primitiveStyles as styles } from "./primitive.styles";

/** Tag shares Badge's tones. Use Badge for read-only labels and Tag when the chip is selectable or removable. */
export type { Tone };
export type Slot = "root" | "label" | "remove";

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    label: string;
    media?: Children;
    tone?: Tone;
    /** Monospace text for identifiers and codes. */
    mono?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
    onSelect?: Message;
    onRemove?: Message;
    removeLabel?: string;
  }>;

const toneStyles = {
  muted: styles.tagMuted,
  accent: styles.tagAccent,
  success: styles.tagSuccess,
  warning: styles.tagWarning,
  danger: styles.tagDanger,
  info: styles.tagInfo,
} as const;

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const label =
    config.onSelect === undefined
      ? h.span(slotAttrs(config.slotProps?.label, h), [config.label])
      : h.button(
          [
            ...slotAttrs(config.slotProps?.label, h, styles.tagButton),
            h.Type("button"),
            h.AriaPressed(String(config.isSelected === true)),
            h.Disabled(config.isDisabled === true),
            h.OnClick(config.onSelect),
          ],
          [config.label],
        );
  return h.span(
    rootAttrs(
      config,
      h,
      styles.tag,
      config.isSelected === true && styles.tagSelected,
      config.tone === undefined || config.tone === "neutral" ? null : toneStyles[config.tone],
      config.mono === true && styles.tagMono,
    ),
    [
      ...(config.media ?? []),
      label,
      ...(config.onRemove === undefined
        ? []
        : [
            h.button(
              [
                ...slotAttrs(config.slotProps?.remove, h, styles.tagRemove),
                h.Type("button"),
                h.Disabled(config.isDisabled === true),
                h.AriaLabel(config.removeLabel ?? `Remove ${config.label}`),
                h.OnClick(config.onRemove),
              ],
              [Icon.view({ icon: X, size: 12 }, h)],
            ),
          ]),
    ],
  );
};

export const Tag = { view } as const;
