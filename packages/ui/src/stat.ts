import { ArrowDown, ArrowUp, Minus } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import type { Tone } from "./badge";
import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { contentStyles } from "./primitive.styles";
import { statStyles as styles, toneColorStyles } from "./details.styles";
import * as Icon from "./icon";
import { sxAttrs } from "./sx";

export type { Tone };
export type Trend = "up" | "down" | "flat";
/** `tile` draws its own tinted surface; `plain` is for stats inside a Card or grid cell. */
export type Variant = "tile" | "plain";
export type Slot = "root" | "label" | "value" | "delta" | "description";

export type Delta = Readonly<{
  /** Formatted change, such as `"+12%"` or `"3"`. */
  value: string;
  trend: Trend;
  /** Defaults to `success` for up, `danger` for down, and `neutral` for flat. Override when down is good. */
  tone?: Tone;
  /** Visible context after the change, such as `"vs last release"`. */
  label?: string;
  /** Screen-reader prefix. Defaults to "Up", "Down", or "No change". */
  trendLabel?: string;
}>;

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    label: string;
    value: string;
    tone?: Tone;
    variant?: Variant;
    size?: "sm" | "md";
    description?: string;
    delta?: Delta;
    /** Decorative media before the label, usually an Icon. */
    media?: Html;
    /** Extra content below the value, such as a Progress meter. */
    children?: Children;
  }>;

const tileTones = {
  neutral: undefined,
  muted: undefined,
  accent: styles.tileAccent,
  success: styles.tileSuccess,
  warning: styles.tileWarning,
  danger: styles.tileDanger,
  info: styles.tileInfo,
} as const;

const valueTones = {
  neutral: undefined,
  muted: styles.valueMuted,
  accent: toneColorStyles.accent,
  success: toneColorStyles.success,
  warning: toneColorStyles.warning,
  danger: toneColorStyles.danger,
  info: toneColorStyles.info,
} as const;

const trendIcons = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const trendLabels = { up: "Up", down: "Down", flat: "No change" } as const;
const trendTones = { up: "success", down: "danger", flat: "neutral" } as const satisfies Record<
  Trend,
  Tone
>;

const deltaView = <Message>(
  delta: Delta,
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const tone = delta.tone ?? trendTones[delta.trend];
  return h.span(
    slotAttrs(
      config.slotProps?.delta,
      h,
      styles.delta,
      tone === "neutral" ? styles.valueMuted : valueTones[tone],
    ),
    [
      Icon.view({ icon: trendIcons[delta.trend], size: 12, strokeWidth: 2.25 }, h),
      h.span(sxAttrs(h, contentStyles.visuallyHidden), [
        `${delta.trendLabel ?? trendLabels[delta.trend]} `,
      ]),
      delta.value,
      ...(delta.label === undefined
        ? []
        : [h.span(sxAttrs(h, styles.deltaLabel), [` ${delta.label}`])]),
    ],
  );
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const tone = config.tone ?? "neutral";
  const isTile = (config.variant ?? "tile") === "tile";
  const isSmall = config.size === "sm";
  return h.dl(
    rootAttrs(
      config,
      h,
      styles.root,
      isTile && styles.tile,
      isTile && isSmall && styles.tileSm,
      isTile && tileTones[tone],
    ),
    [
      h.dt(slotAttrs(config.slotProps?.label, h, styles.label), [
        ...(config.media === undefined ? [] : [config.media]),
        config.label,
      ]),
      h.dd(sxAttrs(h, styles.valueRow), [
        h.span(
          slotAttrs(
            config.slotProps?.value,
            h,
            styles.value,
            isSmall && styles.valueSm,
            valueTones[tone],
          ),
          [config.value],
        ),
        ...(config.delta === undefined ? [] : [deltaView(config.delta, config, h)]),
      ]),
      ...(config.description === undefined
        ? []
        : [
            h.dd(slotAttrs(config.slotProps?.description, h, styles.description), [
              config.description,
            ]),
          ]),
      ...(config.children === undefined ? [] : [h.dd(sxAttrs(h, styles.extra), config.children)]),
    ],
  );
};
