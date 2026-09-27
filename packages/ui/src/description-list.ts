import type { Html, HtmlBuilder } from "foldkit/html";

import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { descriptionListStyles as styles } from "./details.styles";
import { sxAttrs } from "./sx";

export type Layout = "horizontal" | "stacked";
/** `code` renders monospace text, `chips` lays out badges or tags, and `muted` de-emphasizes the value. */
export type ValueFormat = "text" | "code" | "muted" | "chips";
export type Slot = "root" | "row" | "term" | "value";

export type Item = Readonly<{
  term: string | Children;
  /** Omitted, empty, and blank values render `emptyValue`. */
  value?: string | Children;
  format?: ValueFormat;
}>;

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    items: ReadonlyArray<Item>;
    /** `horizontal` aligns terms in a shared column; `stacked` places each term above its value. */
    layout?: Layout;
    size?: "sm" | "md";
    /** Separate rows with a hairline. */
    dividers?: boolean;
    /** CSS width of the horizontal term column, such as `"10rem"`. Defaults to the widest term, up to 40%. */
    termWidth?: string;
    emptyValue?: string;
  }>;

const toChildren = (content: string | Children): Children =>
  typeof content === "string" ? [content] : content;

const isEmpty = (value: string | Children | undefined): boolean =>
  value === undefined || (typeof value === "string" ? value.trim() === "" : value.length === 0);

const valueView = <Message>(
  item: Item,
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  if (isEmpty(item.value)) {
    return h.dd(slotAttrs(config.slotProps?.value, h, styles.value, styles.empty), [
      config.emptyValue ?? "—",
    ]);
  }
  const children = toChildren(item.value ?? []);
  switch (item.format ?? "text") {
    case "code":
      return h.dd(slotAttrs(config.slotProps?.value, h, styles.value), [
        h.code(sxAttrs(h, styles.code, styles.codeChip), children),
      ]);
    case "chips":
      return h.dd(slotAttrs(config.slotProps?.value, h, styles.value, styles.chips), children);
    case "muted":
      return h.dd(slotAttrs(config.slotProps?.value, h, styles.value, styles.muted), children);
    case "text":
      return h.dd(slotAttrs(config.slotProps?.value, h, styles.value), children);
  }
};

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const horizontal = (config.layout ?? "horizontal") === "horizontal";
  const dividers = config.dividers === true;
  return h.dl(
    [
      ...rootAttrs(
        config,
        h,
        styles.root,
        config.size === "sm" && styles.sm,
        horizontal ? styles.horizontal : styles.stacked,
        dividers && styles.divided,
      ),
      ...(horizontal && config.termWidth !== undefined
        ? [h.Style({ gridTemplateColumns: `${config.termWidth} minmax(0, 1fr)` })]
        : []),
    ],
    config.items.map((item, index) =>
      h.div(
        slotAttrs(
          config.slotProps?.row,
          h,
          horizontal ? styles.rowHorizontal : styles.rowStacked,
          dividers && styles.rowDivided,
          dividers && index > 0 && styles.rowDivider,
        ),
        [
          h.dt(slotAttrs(config.slotProps?.term, h, styles.term), toChildren(item.term)),
          valueView(item, config, h),
        ],
      ),
    ),
  );
};
