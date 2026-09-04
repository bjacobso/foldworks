import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { clamp, styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

type Tone = "default" | "danger";

const alert = <Message>(
  config: StyledConfig<Message> & Readonly<{
    title: string;
    description?: string;
    children?: Children;
    tone?: Tone;
    live?: "polite" | "assertive";
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...styledAttrs(config, h, styles.surface, styles.alert, config.tone === "danger" && styles.alertDanger),
    h.Role(config.tone === "danger" ? "alert" : "status"),
    ...(config.live === undefined ? [] : [h.AriaLive(config.live)]),
  ],
  [
    h.div(sxAttrs(h, styles.title), [config.title]),
    ...(config.description === undefined
      ? []
      : [h.p(sxAttrs(h, styles.description), [config.description])]),
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

const card = <Message>(
  config: StyledConfig<Message> & Readonly<{
    title?: string;
    description?: string;
    children: Children;
    footer?: Children;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.section(styledAttrs(config, h, styles.surface, styles.card), [
  ...(config.title === undefined && config.description === undefined
    ? []
    : [h.header(sxAttrs(h, styles.cardHeader), [
        ...(config.title === undefined ? [] : [h.h3(sxAttrs(h, styles.title), [config.title])]),
        ...(config.description === undefined ? [] : [h.p(sxAttrs(h, styles.description), [config.description])]),
      ])]),
  h.div(sxAttrs(h, styles.cardContent), config.children),
  ...(config.footer === undefined ? [] : [h.footer(sxAttrs(h, styles.cardFooter), config.footer)]),
]);

const empty = <Message>(
  config: StyledConfig<Message> & Readonly<{
    title: string;
    description?: string;
    media?: Html;
    actions?: Children;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.inset, styles.empty), [
  ...(config.media === undefined ? [] : [h.div(sxAttrs(h, styles.emptyMedia), [config.media])]),
  h.h3(sxAttrs(h, styles.title), [config.title]),
  ...(config.description === undefined ? [] : [h.p(sxAttrs(h, styles.description), [config.description])]),
  ...(config.actions ?? []),
]);

const item = <Message>(
  config: StyledConfig<Message> & Readonly<{
    title: string;
    description?: string;
    media?: Html;
    actions?: Children;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.inset, styles.item), [
  ...(config.media === undefined ? [] : [h.div(sxAttrs(h, styles.itemMedia), [config.media])]),
  h.div(sxAttrs(h, styles.itemContent), [
    h.div(sxAttrs(h, styles.title), [config.title]),
    ...(config.description === undefined ? [] : [h.p(sxAttrs(h, styles.description), [config.description])]),
  ]),
  ...(config.actions ?? []),
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

const table = <Message>(
  config: StyledConfig<Message> & Readonly<{
    caption?: string;
    columns: ReadonlyArray<string>;
    rows: ReadonlyArray<ReadonlyArray<Html | string>>;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.tableWrap), [
  h.table(sxAttrs(h, styles.table), [
    ...(config.caption === undefined ? [] : [h.caption([], [config.caption])]),
    h.thead([], [h.tr([], config.columns.map((column) => h.th(sxAttrs(h, styles.tableHead), [column])))]),
    h.tbody([], config.rows.map((row) => h.tr([], row.map((cell) => h.td(sxAttrs(h, styles.tableCell), [cell]))))),
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
