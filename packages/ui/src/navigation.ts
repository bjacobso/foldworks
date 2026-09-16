import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "./catalog.shared";

export type NavigationLink = Readonly<{ label: string; href: string }>;

export type BreadcrumbSlot = "root" | "list" | "item" | "link" | "separator" | "current";
export type BreadcrumbConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, BreadcrumbSlot> & Readonly<{
  items: ReadonlyArray<NavigationLink>;
  current: string;
  separator?: string;
  ariaLabel?: string;
}>;

const breadcrumb = <Message>(
  config: BreadcrumbConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.nav(
  [...rootAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Breadcrumb")],
  [h.ol(slotAttrs(config.slotProps?.list, h, styles.breadcrumb), [
    ...config.items.map((item) => h.li(slotAttrs(config.slotProps?.item, h, styles.breadcrumbItem), [
      h.a([...slotAttrs(config.slotProps?.link, h, styles.breadcrumbLink, styles.focusable), h.Href(item.href)], [item.label]),
      h.span([...slotAttrs(config.slotProps?.separator, h), h.AriaHidden(true)], [config.separator ?? "/"]),
    ])),
    h.li([...slotAttrs(config.slotProps?.current, h, styles.breadcrumbCurrent), h.AriaCurrent("page")], [config.current]),
  ])],
);

export type PaginationSlot = "root" | "list" | "previous" | "page" | "next";
export type PaginationConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, PaginationSlot> & Readonly<{
  page: number;
  pageCount: number;
  onChange: (page: number) => Message;
  ariaLabel?: string;
}>;

const pagination = <Message>(
  config: PaginationConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const pages = Array.from({ length: config.pageCount }, (_, index) => index + 1);
  return h.nav(
    [...rootAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Pagination")],
    [h.div(slotAttrs(config.slotProps?.list, h, styles.pagination), [
      h.button([
        ...slotAttrs(config.slotProps?.previous, h, styles.pageButton, styles.focusable),
        h.Type("button"),
        h.AriaLabel("Previous page"),
        h.Disabled(config.page <= 1),
        h.OnClick(config.onChange(Math.max(1, config.page - 1))),
      ], ["Previous"]),
      ...pages.map((page) => h.button([
        ...slotAttrs(config.slotProps?.page, h, styles.pageButton, styles.focusable, page === config.page && styles.pageButtonCurrent),
        h.Type("button"),
        h.AriaLabel(`Page ${page}`),
        h.AriaCurrent(page === config.page ? "page" : "false"),
        h.OnClick(config.onChange(page)),
      ], [String(page)])),
      h.button([
        ...slotAttrs(config.slotProps?.next, h, styles.pageButton, styles.focusable),
        h.Type("button"),
        h.AriaLabel("Next page"),
        h.Disabled(config.page >= config.pageCount),
        h.OnClick(config.onChange(Math.min(config.pageCount, config.page + 1))),
      ], ["Next"]),
    ])],
  );
};

type Tab<Value extends string> = Readonly<{ value: Value; label: string; content: Children; isDisabled?: boolean }>;

export type TabsSlot = "root" | "list" | "trigger" | "panel";
export type TabsConfig<Message, Value extends string> =
  StyledConfig<Message> & WithSlotProps<Message, TabsSlot> & Readonly<{
    id: string;
    value: Value;
    tabs: ReadonlyArray<Tab<Value>>;
    onChange: (value: Value) => Message;
    ariaLabel?: string;
  }>;

/** @deprecated Use Stateful.Tabs for keyboard navigation and managed focus. */
const tabs = <Message, Value extends string>(
  config: TabsConfig<Message, Value>,
  h: HtmlBuilder<Message>,
): Html => h.div(rootAttrs(config, h, styles.tabs), [
  h.div([...slotAttrs(config.slotProps?.list, h, styles.tabsList), h.Role("tablist"), h.AriaLabel(config.ariaLabel ?? "Tabs")],
    config.tabs.map((tab) => h.button([
      ...slotAttrs(config.slotProps?.trigger, h, styles.tabsTrigger, styles.focusable, tab.value === config.value && styles.tabsTriggerActive),
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
    ...slotAttrs(config.slotProps?.panel, h),
    h.Role("tabpanel"),
    h.Id(`${config.id}-panel-${tab.value}`),
    h.AriaLabelledBy(`${config.id}-tab-${tab.value}`),
    h.Hidden(tab.value !== config.value),
    h.Tabindex(0),
  ], tab.content)),
]);

export type NavigationMenuSlot = "root" | "list" | "item" | "link";
export type NavigationMenuConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, NavigationMenuSlot> & Readonly<{
  items: ReadonlyArray<NavigationLink>;
  ariaLabel?: string;
}>;

const navigationMenu = <Message>(
  config: NavigationMenuConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.nav(
  [...rootAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Primary navigation")],
  [h.ul(slotAttrs(config.slotProps?.list, h, styles.nav), config.items.map((item) => h.li(slotAttrs(config.slotProps?.item, h), [
    h.a([...slotAttrs(config.slotProps?.link, h, styles.navLink, styles.focusable), h.Href(item.href)], [item.label]),
  ])))],
);

export type SidebarGroup = Readonly<{
  label?: string;
  items: ReadonlyArray<NavigationLink & Readonly<{ isCurrent?: boolean; media?: Html }>>;
}>;
export type SidebarSlot = "root" | "group" | "groupLabel" | "item";
export type SidebarConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, SidebarSlot> & Readonly<{
  header?: Children;
  groups: ReadonlyArray<SidebarGroup>;
  footer?: Children;
  ariaLabel?: string;
}>;

const sidebar = <Message>(
  config: SidebarConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.aside(
  [...rootAttrs(config, h, styles.sidebar), h.AriaLabel(config.ariaLabel ?? "Sidebar")],
  [
    ...(config.header ?? []),
    ...config.groups.map((group) => h.div(slotAttrs(config.slotProps?.group, h, styles.sidebarGroup), [
      ...(group.label === undefined ? [] : [h.div(slotAttrs(config.slotProps?.groupLabel, h, styles.sidebarLabel), [group.label])]),
      ...group.items.map((item) => h.a([
        ...slotAttrs(config.slotProps?.item, h, styles.sidebarItem, styles.focusable),
        h.Href(item.href),
        h.AriaCurrent(item.isCurrent === true ? "page" : "false"),
      ], [...(item.media === undefined ? [] : [item.media]), item.label])),
    ])),
    ...(config.footer ?? []),
  ],
);

export const Breadcrumb = { view: breadcrumb } as const;
export const NavigationMenu = { view: navigationMenu } as const;
export const Pagination = { view: pagination } as const;
export const Sidebar = { view: sidebar } as const;
export const Tabs = { view: tabs } as const;
