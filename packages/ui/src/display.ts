import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import {
  clamp,
  rootAttrs,
  slotAttrs,
  styledAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { sxAttrs } from "./sx";

type Tone = "default" | "danger";

export type AlertSlot = "root" | "title" | "description";
export type AlertConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, AlertSlot> & Readonly<{
  title: string;
  description?: string;
  children?: Children;
  tone?: Tone;
  live?: "polite" | "assertive";
}>;

const alert = <Message>(
  config: AlertConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...rootAttrs(config, h, styles.surface, styles.alert, config.tone === "danger" && styles.alertDanger),
    h.Role(config.tone === "danger" ? "alert" : "status"),
    ...(config.live === undefined ? [] : [h.AriaLive(config.live)]),
  ],
  [
    h.div(slotAttrs(config.slotProps?.title, h, styles.title), [config.title]),
    ...(config.description === undefined
      ? []
      : [h.p(slotAttrs(config.slotProps?.description, h, styles.description), [config.description])]),
    ...(config.children ?? []),
  ],
);

const aspectRatio = <Message>(
  config: StyledConfig<Message> & Readonly<{ ratio?: number; children: Children }>,
  h: HtmlBuilder<Message>,
): Html => {
  const ratio = config.ratio ?? 16 / 9;
  return h.div(
    [
      ...styledAttrs(config, h, styles.aspectRatio),
      h.Style({ paddingBottom: `${100 / ratio}%` }),
    ],
    [h.div(sxAttrs(h, styles.aspectRatioContent), config.children)],
  );
};

const avatar = <Message>(
  config: StyledConfig<Message> & Readonly<{
    alt: string;
    fallback: string;
    src?: string;
    size?: "sm" | "md" | "lg";
  }>,
  h: HtmlBuilder<Message>,
): Html => h.span(
  styledAttrs(config, h, styles.avatar, config.size === "sm" && styles.avatarSm, config.size === "lg" && styles.avatarLg),
  config.src === undefined
    ? [h.span([h.AriaHidden(true)], [config.fallback])]
    : [h.img([...sxAttrs(h, styles.avatarImage), h.Src(config.src), h.Alt(config.alt)])],
);

export type CardSlot =
  | "root"
  | "header"
  | "heading"
  | "title"
  | "description"
  | "action"
  | "content"
  | "footer";

export type CardConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, CardSlot> & Readonly<{
    title?: string;
    description?: string;
    action?: Children;
    children: Children;
    footer?: Children;
}>;

const card = <Message>(
  config: CardConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.section(rootAttrs(config, h, styles.surface, styles.card), [
  ...(config.title === undefined && config.description === undefined && config.action === undefined
    ? []
    : [h.header(slotAttrs(config.slotProps?.header, h, styles.cardHeader), [
        h.div(slotAttrs(config.slotProps?.heading, h, styles.cardHeading), [
          ...(config.title === undefined
            ? []
            : [h.h3(slotAttrs(config.slotProps?.title, h, styles.title), [config.title])]),
          ...(config.description === undefined
            ? []
            : [h.p(slotAttrs(config.slotProps?.description, h, styles.description), [config.description])]),
        ]),
        ...(config.action === undefined
          ? []
          : [h.div(slotAttrs(config.slotProps?.action, h, styles.cardAction), config.action)]),
      ])]),
  h.div(slotAttrs(config.slotProps?.content, h, styles.cardContent), config.children),
  ...(config.footer === undefined
    ? []
    : [h.footer(slotAttrs(config.slotProps?.footer, h, styles.cardFooter), config.footer)]),
]);

export type EmptySlot = "root" | "media" | "title" | "description" | "actions";
export type EmptyConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, EmptySlot> & Readonly<{
  title: string;
  description?: string;
  media?: Html;
  actions?: Children;
}>;

const empty = <Message>(
  config: EmptyConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(rootAttrs(config, h, styles.inset, styles.empty), [
  ...(config.media === undefined ? [] : [h.div(slotAttrs(config.slotProps?.media, h, styles.emptyMedia), [config.media])]),
  h.h3(slotAttrs(config.slotProps?.title, h, styles.title), [config.title]),
  ...(config.description === undefined ? [] : [h.p(slotAttrs(config.slotProps?.description, h, styles.description), [config.description])]),
  ...(config.actions === undefined ? [] : [h.div(slotAttrs(config.slotProps?.actions, h), config.actions)]),
]);

export type ItemSlot = "root" | "media" | "content" | "title" | "description" | "actions";
export type ItemConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, ItemSlot> & Readonly<{
  title: string;
  description?: string;
  media?: Html;
  actions?: Children;
}>;

const item = <Message>(
  config: ItemConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(rootAttrs(config, h, styles.inset, styles.item), [
  ...(config.media === undefined ? [] : [h.div(slotAttrs(config.slotProps?.media, h, styles.itemMedia), [config.media])]),
  h.div(slotAttrs(config.slotProps?.content, h, styles.itemContent), [
    h.div(slotAttrs(config.slotProps?.title, h, styles.title), [config.title]),
    ...(config.description === undefined ? [] : [h.p(slotAttrs(config.slotProps?.description, h, styles.description), [config.description])]),
  ]),
  ...(config.actions === undefined ? [] : [h.div(slotAttrs(config.slotProps?.actions, h), config.actions)]),
]);

const kbd = <Message>(
  config: StyledConfig<Message> & Readonly<{ keys: ReadonlyArray<string> }>,
  h: HtmlBuilder<Message>,
): Html => h.span(styledAttrs(config, h, styles.group), config.keys.flatMap((key, index) => [
  ...(index === 0 ? [] : ["+"]),
  h.kbd(sxAttrs(h, styles.kbd), [key]),
]));

const separator = <Message>(
  config: StyledConfig<Message> & Readonly<{ orientation?: "horizontal" | "vertical"; decorative?: boolean }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...styledAttrs(config, h, config.orientation === "vertical" ? styles.separatorVertical : styles.separatorHorizontal),
    ...(config.decorative === false
      ? [h.Role("separator"), h.AriaOrientation(config.orientation ?? "horizontal")]
      : [h.AriaHidden(true)]),
  ],
);

export type TableSlot =
  | "root"
  | "table"
  | "caption"
  | "head"
  | "headRow"
  | "headerCell"
  | "body"
  | "row"
  | "cell";
export type TableConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, TableSlot> & Readonly<{
  caption?: string;
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<Html | string>>;
}>;

const table = <Message>(
  config: TableConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(rootAttrs(config, h, styles.tableWrap), [
  h.table(slotAttrs(config.slotProps?.table, h, styles.table), [
    ...(config.caption === undefined ? [] : [h.caption(slotAttrs(config.slotProps?.caption, h), [config.caption])]),
    h.thead(slotAttrs(config.slotProps?.head, h), [h.tr(slotAttrs(config.slotProps?.headRow, h),
      config.columns.map((column) => h.th(slotAttrs(config.slotProps?.headerCell, h, styles.tableHead), [column])))]),
    h.tbody(slotAttrs(config.slotProps?.body, h), config.rows.map((row) => h.tr(slotAttrs(config.slotProps?.row, h),
      row.map((cell) => h.td(slotAttrs(config.slotProps?.cell, h, styles.tableCell), [cell]))))),
  ]),
]);

const chart = <Message>(
  config: StyledConfig<Message> & Readonly<{
    ariaLabel: string;
    values: ReadonlyArray<number>;
    max?: number;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const max = config.max ?? Math.max(...config.values, 1);
  return h.div(
    [...styledAttrs(config, h, styles.chart), h.Role("img"), h.AriaLabel(config.ariaLabel)],
    config.values.map((value, index) => h.div([
      ...sxAttrs(h, styles.chartBar),
      h.Style({ height: `${clamp(value / max, 0, 1) * 100}%`, backgroundColor: `var(--chart-${index % 5 + 1})` }),
      h.Title(String(value)),
    ])),
  );
};

export const Alert = { view: alert } as const;
export const AspectRatio = { view: aspectRatio } as const;
export const Avatar = { view: avatar } as const;
export const Card = { view: card } as const;
export const Chart = { view: chart } as const;
export const Empty = { view: empty } as const;
export const Item = { view: item } as const;
export const Kbd = { view: kbd } as const;
export const Separator = { view: separator } as const;
export const Table = { view: table } as const;
