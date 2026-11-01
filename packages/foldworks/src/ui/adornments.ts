import type * as stylex from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { slotAttrs, type Children, type SlotProps } from "./catalog.shared";
import { contentStyles } from "./primitive.styles";

/** A compact count shown after a label. `label` replaces the number for assistive technology. */
export const countView = <Message>(
  count: number | string,
  label: string | undefined,
  slot: SlotProps<Message> | undefined,
  h: HtmlBuilder<Message>,
  ...extra: ReadonlyArray<stylex.StyleXStyles>
): Html =>
  h.span(
    [
      ...slotAttrs<Message>(slot, h, styles.count, ...extra),
      h.DataAttribute("count", String(count)),
    ],
    label === undefined
      ? [String(count)]
      : [
          h.span([h.AriaHidden(true)], [String(count)]),
          h.span(slotAttrs<Message>(undefined, h, contentStyles.visuallyHidden), [label]),
        ],
  );

/** A decorative attention dot with a visually hidden explanation. */
export const attentionView = <Message>(
  label: string,
  slot: SlotProps<Message> | undefined,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.span([...slotAttrs<Message>(slot, h, styles.attentionDot), h.AriaHidden(true)]),
  h.span(slotAttrs<Message>(undefined, h, contentStyles.visuallyHidden), [label]),
];

/** Optional trailing content shared by segmented, toggle-group, and toggle options. */
export type AdornedOption = Readonly<{
  /** Trailing count, such as hidden fields on a page or matching rows for a filter. */
  count?: number | string;
  /** Accessible replacement for the visible count, for example "2 hidden fields". */
  countLabel?: string;
  /** Content after the label, such as a `Badge`. */
  badge?: Children;
  /** Marks the option as needing a look, for example because a linked field is there. */
  needsAttention?: boolean;
  /** Announced when `needsAttention` is set. Defaults to "Needs attention". */
  attentionLabel?: string;
}>;

export type AdornmentSlot = "count" | "badge" | "attention";

export const hasAdornments = (option: AdornedOption): boolean =>
  option.count !== undefined || option.badge !== undefined || option.needsAttention === true;

export const optionAdornments = <Message>(
  option: AdornedOption,
  slots: Readonly<Partial<Record<AdornmentSlot, SlotProps<Message>>>> | undefined,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  ...(option.count === undefined
    ? []
    : [countView<Message>(option.count, option.countLabel, slots?.count, h)]),
  ...(option.badge === undefined
    ? []
    : [h.span(slotAttrs<Message>(slots?.badge, h, styles.withAdornments), option.badge)]),
  ...(option.needsAttention === true
    ? attentionView<Message>(option.attentionLabel ?? "Needs attention", slots?.attention, h)
    : []),
];
