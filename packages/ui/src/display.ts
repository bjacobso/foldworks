import type * as stylex from "@stylexjs/stylex";
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import {
  clamp,
  rootAttrs,
  slotAttrs,
  styledAttrs,
  type Children,
  type SlotProps,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { denseStyles } from "./dense.styles";
import { sxAttrs } from "./sx";

type Tone = "default" | "danger";

const alert = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
      title: string;
      description?: string;
      children?: Children;
      tone?: Tone;
      live?: "polite" | "assertive";
    }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      ...styledAttrs(
        config,
        h,
        styles.surface,
        styles.alert,
        config.tone === "danger" && styles.alertDanger,
      ),
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
    [...styledAttrs(config, h, styles.aspectRatio), h.Style({ paddingBottom: `${100 / ratio}%` })],
    [h.div(sxAttrs(h, styles.aspectRatioContent), config.children)],
  );
};

const avatar = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
      alt: string;
      fallback: string;
      src?: string;
      size?: "sm" | "md" | "lg";
    }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    styledAttrs(
      config,
      h,
      styles.avatar,
      config.size === "sm" && styles.avatarSm,
      config.size === "lg" && styles.avatarLg,
    ),
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

export type CardConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, CardSlot> &
  Readonly<{
    title?: string;
    description?: string;
    action?: Children;
    children: Children;
    footer?: Children;
  }>;

const card = <Message>(config: CardConfig<Message>, h: HtmlBuilder<Message>): Html =>
  h.section(rootAttrs(config, h, styles.surface, styles.card), [
    ...(config.title === undefined &&
    config.description === undefined &&
    config.action === undefined
      ? []
      : [
          h.header(slotAttrs(config.slotProps?.header, h, styles.cardHeader), [
            h.div(slotAttrs(config.slotProps?.heading, h, styles.cardHeading), [
              ...(config.title === undefined
                ? []
                : [h.h3(slotAttrs(config.slotProps?.title, h, styles.title), [config.title])]),
              ...(config.description === undefined
                ? []
                : [
                    h.p(slotAttrs(config.slotProps?.description, h, styles.description), [
                      config.description,
                    ]),
                  ]),
            ]),
            ...(config.action === undefined
              ? []
              : [h.div(slotAttrs(config.slotProps?.action, h, styles.cardAction), config.action)]),
          ]),
        ]),
    h.div(slotAttrs(config.slotProps?.content, h, styles.cardContent), config.children),
    ...(config.footer === undefined
      ? []
      : [h.footer(slotAttrs(config.slotProps?.footer, h, styles.cardFooter), config.footer)]),
  ]);

const empty = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
      title: string;
      description?: string;
      media?: Html;
      actions?: Children;
    }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(styledAttrs(config, h, styles.inset, styles.empty), [
    ...(config.media === undefined ? [] : [h.div(sxAttrs(h, styles.emptyMedia), [config.media])]),
    h.h3(sxAttrs(h, styles.title), [config.title]),
    ...(config.description === undefined
      ? []
      : [h.p(sxAttrs(h, styles.description), [config.description])]),
    ...(config.actions ?? []),
  ]);

type ItemContent = Readonly<{
  title: string;
  description?: string;
  media?: Html;
}>;

export type StaticItemConfig<Message> = StyledConfig<Message> &
  ItemContent &
  Readonly<{
    actions?: Children;
    href?: undefined;
    onClick?: undefined;
  }>;

type ItemInteractionState = Readonly<{
  /** Marks the current item in a set, such as the open field in an index (`aria-current`). */
  isSelected?: boolean;
  isDisabled?: boolean;
  ariaLabel?: string;
  /** Non-interactive trailing content such as badges or counts. */
  trailing?: Children;
}>;

/** An item rendered as a button that dispatches `onClick`. */
export type ButtonItemConfig<Message> = StyledConfig<Message> &
  ItemContent &
  ItemInteractionState &
  Readonly<{
    onClick: Message;
    href?: undefined;
    /** Toggle state for items that switch something on or off (`aria-pressed`). */
    isPressed?: boolean;
  }>;

/** An item rendered as a link. `onClick` also dispatches when the link is activated. */
export type LinkItemConfig<Message> = StyledConfig<Message> &
  ItemContent &
  ItemInteractionState &
  Readonly<{
    href: string;
    onClick?: Message;
  }>;

export type InteractiveItemConfig<Message> = ButtonItemConfig<Message> | LinkItemConfig<Message>;

export type ItemConfig<Message> = StaticItemConfig<Message> | InteractiveItemConfig<Message>;

const isInteractiveItem = <Message>(
  config: ItemConfig<Message>,
): config is InteractiveItemConfig<Message> =>
  config.onClick !== undefined || config.href !== undefined;

const item = <Message>(config: ItemConfig<Message>, h: HtmlBuilder<Message>): Html =>
  isInteractiveItem(config)
    ? interactiveItem(config, h)
    : h.div(styledAttrs(config, h, styles.inset, styles.item), [
        ...(config.media === undefined
          ? []
          : [h.div(sxAttrs(h, styles.itemMedia), [config.media])]),
        h.div(sxAttrs(h, styles.itemContent), [
          h.div(sxAttrs(h, styles.title), [config.title]),
          ...(config.description === undefined
            ? []
            : [h.p(sxAttrs(h, styles.description), [config.description])]),
        ]),
        ...(config.actions ?? []),
      ]);

// Interactive content must be phrasing content, so the inner structure uses spans.
const interactiveItem = <Message>(
  config: InteractiveItemConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const isDisabled = config.isDisabled === true;
  const isPressed = config.href === undefined && config.isPressed === true;
  const attributes = [
    ...styledAttrs(
      config,
      h,
      styles.inset,
      styles.item,
      denseStyles.itemInteractive,
      styles.focusable,
      isPressed && denseStyles.itemPressed,
      config.isSelected === true && denseStyles.itemSelected,
      isDisabled && denseStyles.itemDisabled,
    ),
    ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
    ...(config.isSelected === true ? [h.AriaCurrent("true")] : []),
  ];
  const children = [
    ...(config.media === undefined ? [] : [h.span(sxAttrs(h, styles.itemMedia), [config.media])]),
    h.span(sxAttrs(h, styles.itemContent), [
      h.span(sxAttrs(h, styles.title), [config.title]),
      ...(config.description === undefined
        ? []
        : [h.span(sxAttrs(h, styles.description, denseStyles.itemBlock), [config.description])]),
    ]),
    ...(config.trailing === undefined
      ? []
      : [h.span(sxAttrs(h, denseStyles.itemTrailing), config.trailing)]),
  ];

  if (config.href !== undefined) {
    return h.a(
      [
        ...attributes,
        ...(isDisabled
          ? [h.AriaDisabled(true)]
          : [
              h.Href(config.href),
              ...(config.onClick === undefined ? [] : [h.OnClick(config.onClick)]),
            ]),
      ],
      children,
    );
  }
  return h.button(
    [
      ...attributes,
      h.Type("button"),
      h.Disabled(isDisabled),
      ...(config.isPressed === undefined ? [] : [h.AriaPressed(String(config.isPressed))]),
      ...(isDisabled ? [] : [h.OnClick(config.onClick)]),
    ],
    children,
  );
};

const kbd = <Message>(
  config: StyledConfig<Message> & Readonly<{ keys: ReadonlyArray<string> }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    styledAttrs(config, h, styles.group),
    config.keys.flatMap((key, index) => [
      ...(index === 0 ? [] : ["+"]),
      h.kbd(sxAttrs(h, styles.kbd), [key]),
    ]),
  );

const separator = <Message>(
  config: StyledConfig<Message> &
    Readonly<{ orientation?: "horizontal" | "vertical"; decorative?: boolean }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([
    ...styledAttrs(
      config,
      h,
      config.orientation === "vertical" ? styles.separatorVertical : styles.separatorHorizontal,
    ),
    ...(config.decorative === false
      ? [h.Role("separator"), h.AriaOrientation(config.orientation ?? "horizontal")]
      : [h.AriaHidden(true)]),
  ]);

export type TableAlign = "start" | "center" | "end";

export type TableRowTone = "default" | "info" | "success" | "warning" | "danger";

export type TableSlot =
  | "root"
  | "table"
  | "caption"
  | "head"
  | "body"
  | "headerCell"
  | "row"
  | "cell";

/** A column label, or a label with alignment and width for the whole column. */
export type TableColumn<Message> =
  | string
  | (SlotProps<Message> &
      Readonly<{
        label: Html | string;
        /** Aligns the header and every body cell in the column. */
        align?: TableAlign;
        /** Header-only alignment. Defaults to `align`. */
        headerAlign?: TableAlign;
        /** CSS width applied to the column through `<colgroup>`. */
        width?: string;
      }>);

export type TableCellConfig<Message> = SlotProps<Message> &
  Readonly<{
    content: Html | string | Children;
    /** Overrides the column alignment for this cell. */
    align?: TableAlign;
    /** CSS width for this cell. */
    width?: string;
    colSpan?: number;
    rowSpan?: number;
    /** Render the cell as a row header (`<th scope="row">`). */
    isHeader?: boolean;
  }>;

export type TableCell<Message> = Html | string | TableCellConfig<Message>;

export type TableRowConfig<Message> = SlotProps<Message> &
  Readonly<{
    /** Stable identity used for keyed diffing. Must be unique within the table. */
    key: string;
    cells: ReadonlyArray<TableCell<Message>>;
    /**
     * Makes the whole row a click target. The first cell's content is wrapped in
     * a button so the row is also reachable and activatable from the keyboard.
     */
    onClick?: Message;
    isSelected?: boolean;
    tone?: TableRowTone;
    /** Accessible name for the row's button, or for the row when it is not clickable. */
    ariaLabel?: string;
  }>;

export type TableRow<Message> = ReadonlyArray<TableCell<Message>> | TableRowConfig<Message>;

export type TableConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, TableSlot> &
  Readonly<{
    caption?: string;
    columns: ReadonlyArray<TableColumn<Message>>;
    rows: ReadonlyArray<TableRow<Message>>;
    /** Render the first cell of every body row as a row header. */
    rowHeaders?: boolean;
  }>;

const alignStyles = {
  start: denseStyles.alignStart,
  center: denseStyles.alignCenter,
  end: denseStyles.alignEnd,
} as const;

const toneStyles = {
  default: undefined,
  info: denseStyles.rowInfo,
  success: denseStyles.rowSuccess,
  warning: denseStyles.rowWarning,
  danger: denseStyles.rowDanger,
} as const;

const isCellConfig = <Message>(cell: TableCell<Message>): cell is TableCellConfig<Message> =>
  typeof cell === "object" && cell !== null && "content" in cell;

const isRowConfig = <Message>(row: TableRow<Message>): row is TableRowConfig<Message> =>
  !Array.isArray(row);

const cellContent = (content: Html | string | Children): Children =>
  Array.isArray(content) ? content : [content as Html | string];

/** Attributes from each layer in order, with every layer's `sx` applied after the recipe. */
const layeredAttrs = <Message>(
  layers: ReadonlyArray<SlotProps<Message> | undefined>,
  h: HtmlBuilder<Message>,
  ...recipe: ReadonlyArray<stylex.StyleXStyles | stylex.CompiledStyles>
): ReadonlyArray<Attribute<Message> | ChildAttribute> => [
  ...layers.flatMap((layer) => layer?.attributes ?? []),
  ...sxAttrs(h, ...recipe, ...layers.map((layer) => layer?.sx)),
];

const table = <Message>(config: TableConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const slots = config.slotProps;
  const columns: ReadonlyArray<Exclude<TableColumn<Message>, string>> = config.columns.map(
    (column) => (typeof column === "string" ? { label: column } : column),
  );
  const columnAlign = (index: number) => columns[index]?.align;

  const row = (entry: TableRow<Message>): Html => {
    const rowConfig = isRowConfig(entry) ? entry : undefined;
    const isInteractive = rowConfig?.onClick !== undefined;
    const isSelected = rowConfig?.isSelected === true;
    let column = 0;
    const cells = (rowConfig?.cells ?? (entry as ReadonlyArray<TableCell<Message>>)).map(
      (cell, index) => {
        const cellConfig = isCellConfig(cell) ? cell : undefined;
        const align = cellConfig?.align ?? columnAlign(column);
        column += cellConfig?.colSpan ?? 1;
        const isHeader = cellConfig?.isHeader ?? (config.rowHeaders === true && index === 0);
        const content =
          cellConfig === undefined ? [cell as Html | string] : cellContent(cellConfig.content);
        const attributes = [
          ...layeredAttrs(
            [slots?.cell, cellConfig],
            h,
            styles.tableCell,
            isHeader && denseStyles.rowHeader,
            align !== undefined && alignStyles[align],
          ),
          ...(isHeader ? [h.Scope("row")] : []),
          ...(cellConfig?.colSpan === undefined ? [] : [h.Colspan(cellConfig.colSpan)]),
          ...(cellConfig?.rowSpan === undefined ? [] : [h.Rowspan(cellConfig.rowSpan)]),
          ...(cellConfig?.width === undefined ? [] : [h.Style({ width: cellConfig.width })]),
        ];
        const children =
          isInteractive && index === 0
            ? [
                h.button(
                  [
                    ...sxAttrs(h, denseStyles.rowAction, styles.focusable),
                    h.Type("button"),
                    ...(rowConfig?.ariaLabel === undefined
                      ? []
                      : [h.AriaLabel(rowConfig.ariaLabel)]),
                    ...(isSelected ? [h.AriaCurrent("true")] : []),
                  ],
                  content,
                ),
              ]
            : content;
        return isHeader ? h.th(attributes, children) : h.td(attributes, children);
      },
    );
    if (rowConfig === undefined) return h.tr(slotAttrs(slots?.row, h), cells);

    const tone = rowConfig.tone ?? "default";
    return h.keyed("tr")(
      rowConfig.key,
      [
        ...layeredAttrs(
          [slots?.row, rowConfig],
          h,
          toneStyles[tone],
          isSelected && denseStyles.rowSelected,
          isInteractive && denseStyles.rowInteractive,
        ),
        ...(tone === "default" ? [] : [h.DataAttribute("tone", tone)]),
        ...(isSelected ? [h.DataAttribute("selected", "true")] : []),
        ...(rowConfig.onClick === undefined ? [] : [h.OnClick(rowConfig.onClick)]),
        ...(!isInteractive && isSelected ? [h.AriaCurrent("true")] : []),
        ...(!isInteractive && rowConfig.ariaLabel !== undefined
          ? [h.AriaLabel(rowConfig.ariaLabel)]
          : []),
      ],
      cells,
    );
  };

  return h.div(rootAttrs(config, h, styles.tableWrap), [
    h.table(slotAttrs(slots?.table, h, styles.table), [
      ...(config.caption === undefined
        ? []
        : [h.caption(slotAttrs(slots?.caption, h), [config.caption])]),
      ...(columns.some((column) => column.width !== undefined)
        ? [
            h.colgroup(
              [],
              columns.map((column) =>
                h.col(column.width === undefined ? [] : [h.Style({ width: column.width })]),
              ),
            ),
          ]
        : []),
      h.thead(slotAttrs(slots?.head, h), [
        h.tr(
          [],
          columns.map((column) => {
            const align = column.headerAlign ?? column.align;
            return h.th(
              [
                ...layeredAttrs(
                  [slots?.headerCell, column],
                  h,
                  styles.tableHead,
                  align !== undefined && alignStyles[align],
                ),
                h.Scope("col"),
              ],
              [column.label],
            );
          }),
        ),
      ]),
      h.tbody(slotAttrs(slots?.body, h), config.rows.map(row)),
    ]),
  ]);
};

const chart = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
      ariaLabel: string;
      values: ReadonlyArray<number>;
      max?: number;
    }>,
  h: HtmlBuilder<Message>,
): Html => {
  const max = config.max ?? Math.max(...config.values, 1);
  return h.div(
    [...styledAttrs(config, h, styles.chart), h.Role("img"), h.AriaLabel(config.ariaLabel)],
    config.values.map((value, index) =>
      h.div([
        ...sxAttrs(h, styles.chartBar),
        h.Style({
          height: `${clamp(value / max, 0, 1) * 100}%`,
          backgroundColor: `var(--chart-${(index % 5) + 1})`,
        }),
        h.Title(String(value)),
      ]),
    ),
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
