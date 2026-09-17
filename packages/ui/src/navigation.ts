import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import {
  rootAttrs,
  slotAttrs,
  styledAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { sxAttrs } from "./sx";

type Link = Readonly<{ label: string; href: string }>;

export type BreadcrumbItem<Message> = Readonly<{
  label: string;
  /** Native navigation target. Omit for a message-driven breadcrumb button. */
  href?: string;
  /** Message dispatched when the breadcrumb is activated. */
  onClick?: Message;
}>;

export type BreadcrumbSlot = "root" | "list" | "item" | "link" | "separator" | "current" | "overflow";

type BreadcrumbEntry<Message> =
  | Readonly<{ kind: "item"; item: BreadcrumbItem<Message> }>
  | Readonly<{ kind: "current"; label: string }>
  | Readonly<{ kind: "overflow"; hiddenCount: number }>;

export type BreadcrumbConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, BreadcrumbSlot> & Readonly<{
  items: ReadonlyArray<BreadcrumbItem<Message>>;
  current: string;
  separator?: string;
  ariaLabel?: string;
  /** Collapse the middle once the total number of items, including the current page, exceeds this value. */
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
  overflowLabel?: string;
  /** When supplied, the overflow indicator is an actionable expansion button. */
  onExpand?: Message;
}>;

export const collapseBreadcrumbItems = <Message>(
  items: ReadonlyArray<BreadcrumbItem<Message>>,
  current: string,
  options: Readonly<{ maxItems?: number; itemsBeforeCollapse?: number; itemsAfterCollapse?: number }> = {},
): ReadonlyArray<BreadcrumbEntry<Message>> => {
  const entries: ReadonlyArray<BreadcrumbEntry<Message>> = [
    ...items.map((item): BreadcrumbEntry<Message> => ({ kind: "item", item })),
    { kind: "current", label: current },
  ];
  if (options.maxItems === undefined) return entries;
  if (!Number.isInteger(options.maxItems) || options.maxItems < 1) {
    throw new Error("Breadcrumb maxItems must be a positive integer.");
  }
  if (entries.length <= options.maxItems) return entries;

  const before = options.itemsBeforeCollapse ?? 1;
  const after = options.itemsAfterCollapse ?? 1;
  if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || after < 1) {
    throw new Error("Breadcrumb collapse counts must use non-negative before and positive after values.");
  }
  if (before + after + 1 > options.maxItems) {
    throw new Error("Breadcrumb maxItems must fit itemsBeforeCollapse, itemsAfterCollapse, and the overflow item.");
  }

  const hiddenCount = entries.length - before - after;
  return [
    ...entries.slice(0, before),
    { kind: "overflow", hiddenCount },
    ...entries.slice(entries.length - after),
  ];
};

const breadcrumb = <Message>(
  config: BreadcrumbConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const entries = collapseBreadcrumbItems(config.items, config.current, config);
  const separator = () => h.span([
    ...slotAttrs(config.slotProps?.separator, h),
    h.AriaHidden(true),
  ], [config.separator ?? "/"]);
  const actionable = (item: BreadcrumbItem<Message>) => {
    const attributes = slotAttrs(config.slotProps?.link, h, styles.breadcrumbLink, styles.focusable);
    if (item.href !== undefined) return h.a([
      ...attributes,
      h.Href(item.href),
      ...(item.onClick === undefined ? [] : [h.OnClick(item.onClick)]),
    ], [item.label]);
    if (item.onClick !== undefined) return h.button([
      ...attributes,
      ...sxAttrs(h, styles.breadcrumbButton),
      h.Type("button"),
      h.OnClick(item.onClick),
    ], [item.label]);
    return h.span(attributes, [item.label]);
  };

  return h.nav(
    [...rootAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Breadcrumb")],
    [h.ol(slotAttrs(config.slotProps?.list, h, styles.breadcrumb), entries.map((entry, index) => {
      if (entry.kind === "current") return h.li([
        ...slotAttrs(config.slotProps?.current, h, styles.breadcrumbCurrent),
        h.AriaCurrent("page"),
      ], [entry.label]);

      const content = entry.kind === "item"
        ? actionable(entry.item)
        : config.onExpand === undefined
          ? h.span([
              ...slotAttrs(config.slotProps?.overflow, h, styles.breadcrumbOverflow),
              h.AriaLabel(`${entry.hiddenCount} hidden breadcrumb items`),
            ], [config.overflowLabel ?? "…"])
          : h.button([
              ...slotAttrs(config.slotProps?.overflow, h, styles.breadcrumbLink, styles.breadcrumbButton, styles.breadcrumbOverflow),
              h.Type("button"),
              h.AriaLabel(`Show ${entry.hiddenCount} hidden breadcrumb items`),
              h.OnClick(config.onExpand),
            ], [config.overflowLabel ?? "…"]);
      return h.li(slotAttrs(config.slotProps?.item, h, styles.breadcrumbItem), [
        content,
        ...(index === entries.length - 1 ? [] : [separator()]),
      ]);
    }))],
  );
};

const pagination = <Message>(
  config: StyledConfig<Message> & Readonly<{
    page: number;
    pageCount: number;
    onChange: (page: number) => Message;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const pages = Array.from({ length: config.pageCount }, (_, index) => index + 1);
  return h.nav(
    [...styledAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Pagination")],
    [h.div(sxAttrs(h, styles.pagination), [
      h.button([
        ...sxAttrs(h, styles.pageButton, styles.focusable),
        h.Type("button"),
        h.AriaLabel("Previous page"),
        h.Disabled(config.page <= 1),
        h.OnClick(config.onChange(Math.max(1, config.page - 1))),
      ], ["Previous"]),
      ...pages.map((page) => h.button([
        ...sxAttrs(h, styles.pageButton, styles.focusable, page === config.page && styles.pageButtonCurrent),
        h.Type("button"),
        h.AriaLabel(`Page ${page}`),
        h.AriaCurrent(page === config.page ? "page" : "false"),
        h.OnClick(config.onChange(page)),
      ], [String(page)])),
      h.button([
        ...sxAttrs(h, styles.pageButton, styles.focusable),
        h.Type("button"),
        h.AriaLabel("Next page"),
        h.Disabled(config.page >= config.pageCount),
        h.OnClick(config.onChange(Math.min(config.pageCount, config.page + 1))),
      ], ["Next"]),
    ])],
  );
};

type Tab<Value extends string> = Readonly<{ value: Value; label: string; content: Children; isDisabled?: boolean }>;

/** @deprecated Use Stateful.Tabs for keyboard navigation and managed focus. */
const tabs = <Message, Value extends string>(
  config: StyledConfig<Message> & Readonly<{
    id: string;
    value: Value;
    tabs: ReadonlyArray<Tab<Value>>;
    onChange: (value: Value) => Message;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h, styles.tabs), [
  h.div([...sxAttrs(h, styles.tabsList), h.Role("tablist"), h.AriaLabel(config.ariaLabel ?? "Tabs")],
    config.tabs.map((tab) => h.button([
      ...sxAttrs(h, styles.tabsTrigger, styles.focusable, tab.value === config.value && styles.tabsTriggerActive),
      h.Type("button"),
      h.Role("tab"),
      h.Id(`${config.id}-tab-${tab.value}`),
      h.AriaControls(`${config.id}-panel-${tab.value}`),
      h.AriaSelected(tab.value === config.value),
      h.Tabindex(tab.value === config.value ? 0 : -1),
      h.Disabled(tab.isDisabled === true),
      h.OnClick(config.onChange(tab.value)),
    ], [tab.label])),
  ),
  ...config.tabs.map((tab) => h.div([
    h.Role("tabpanel"),
    h.Id(`${config.id}-panel-${tab.value}`),
    h.AriaLabelledBy(`${config.id}-tab-${tab.value}`),
    h.Hidden(tab.value !== config.value),
    h.Tabindex(0),
  ], tab.content)),
]);

const navigationMenu = <Message>(
  config: StyledConfig<Message> & Readonly<{ items: ReadonlyArray<Link>; ariaLabel?: string }>,
  h: HtmlBuilder<Message>,
): Html => h.nav(
  [...styledAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Primary navigation")],
  [h.ul(sxAttrs(h, styles.nav), config.items.map((item) => h.li([], [
    h.a([...sxAttrs(h, styles.navLink, styles.focusable), h.Href(item.href)], [item.label]),
  ])))],
);

type SidebarGroup = Readonly<{ label?: string; items: ReadonlyArray<Link & Readonly<{ isCurrent?: boolean; media?: Html }>> }>;

const sidebar = <Message>(
  config: StyledConfig<Message> & Readonly<{
    header?: Children;
    groups: ReadonlyArray<SidebarGroup>;
    footer?: Children;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.aside(
  [...styledAttrs(config, h, styles.sidebar), h.AriaLabel(config.ariaLabel ?? "Sidebar")],
  [
    ...(config.header ?? []),
    ...config.groups.map((group) => h.div(sxAttrs(h, styles.sidebarGroup), [
      ...(group.label === undefined ? [] : [h.div(sxAttrs(h, styles.sidebarLabel), [group.label])]),
      ...group.items.map((item) => h.a([
        ...sxAttrs(h, styles.sidebarItem, styles.focusable),
        h.Href(item.href),
        h.AriaCurrent(item.isCurrent === true ? "page" : "false"),
      ], [...(item.media === undefined ? [] : [item.media]), item.label])),
    ])),
    ...(config.footer ?? []),
  ],
);

export const Breadcrumb = { view: breadcrumb, collapseItems: collapseBreadcrumbItems } as const;
export const NavigationMenu = { view: navigationMenu } as const;
export const Pagination = { view: pagination } as const;
export const Sidebar = { view: sidebar } as const;
export const Tabs = { view: tabs } as const;
