import type { Html, HtmlBuilder } from "foldkit/html";

import type { Tone } from "./badge";
import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { legendStyles as styles, toneColorStyles } from "./details.styles";
import * as Icon from "./icon";
import { sxAttrs } from "./sx";

export type { Tone };
export type SwatchShape = "square" | "circle" | "line";
/** `soft` pairs a tinted fill with a solid edge, matching highlighted regions and overlays. */
export type SwatchFill = "solid" | "soft" | "outline" | "dashed";
export type Slot = "root" | "item" | "marker" | "label" | "value" | "description";

/** Marker colors come from `tone` or any CSS color, such as `colors.success` or `"var(--chart-2)"`. */
type MarkerColor = Readonly<{ tone?: Tone; color?: string }>;

export type Marker =
  | (MarkerColor & Readonly<{ kind: "swatch"; shape?: SwatchShape; fill?: SwatchFill }>)
  | (MarkerColor & Readonly<{ kind: "symbol"; symbol: string }>)
  | (MarkerColor & Readonly<{ kind: "icon"; icon: Icon.IconData }>);

export type Item = Readonly<{
  label: string;
  marker: Marker;
  /** A count or measure shown after the label. */
  value?: string;
  description?: string;
}>;

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    items: ReadonlyArray<Item>;
    orientation?: "horizontal" | "vertical";
    /** Accessible name for the list. Defaults to "Legend". */
    ariaLabel?: string;
  }>;

const swatchStyles = (shape: SwatchShape, fill: SwatchFill) =>
  shape === "line"
    ? [
        styles.swatch,
        styles.line,
        fill === "dashed" || fill === "outline" ? styles.lineDashed : styles.solid,
      ]
    : [styles.swatch, styles[shape], styles[fill]];

const markerView = <Message>(
  marker: Marker,
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const colorAttrs = [
    ...slotAttrs(
      config.slotProps?.marker,
      h,
      styles.marker,
      toneColorStyles[marker.tone ?? "neutral"],
    ),
    ...(marker.color === undefined ? [] : [h.Style({ color: marker.color })]),
    h.AriaHidden(true),
  ];
  switch (marker.kind) {
    case "swatch":
      return h.span(colorAttrs, [
        h.span(sxAttrs(h, ...swatchStyles(marker.shape ?? "square", marker.fill ?? "solid"))),
      ]);
    case "symbol":
      return h.span(colorAttrs, [h.span(sxAttrs(h, styles.symbol), [marker.symbol])]);
    case "icon":
      return h.span(colorAttrs, [Icon.view({ icon: marker.icon, size: 14 }, h)]);
  }
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html =>
  h.ul(
    [
      ...rootAttrs(
        config,
        h,
        styles.root,
        config.orientation === "vertical" ? styles.vertical : styles.horizontal,
      ),
      h.Role("list"),
      h.AriaLabel(config.ariaLabel ?? "Legend"),
    ],
    config.items.map((item) =>
      h.li(
        slotAttrs(
          config.slotProps?.item,
          h,
          styles.item,
          item.description !== undefined && styles.itemWithDescription,
        ),
        [
          markerView(item.marker, config, h),
          h.span(sxAttrs(h, styles.copy), [
            h.span(sxAttrs(h, styles.labelRow), [
              h.span(slotAttrs(config.slotProps?.label, h), [item.label]),
              ...(item.value === undefined
                ? []
                : [h.span(slotAttrs(config.slotProps?.value, h, styles.value), [item.value])]),
            ]),
            ...(item.description === undefined
              ? []
              : [
                  h.span(slotAttrs(config.slotProps?.description, h, styles.description), [
                    item.description,
                  ]),
                ]),
          ]),
        ],
      ),
    ),
  );
