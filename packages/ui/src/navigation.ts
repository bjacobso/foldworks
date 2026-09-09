import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

type Link = Readonly<{ label: string; href: string }>;

const breadcrumb = <Message>(
  config: StyledConfig<Message> & Readonly<{
    items: ReadonlyArray<Link>;
    current: string;
    separator?: string;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.nav(
  [...styledAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Breadcrumb")],
  [h.ol(sxAttrs(h, styles.breadcrumb), [
    ...config.items.map((item) => h.li(sxAttrs(h, styles.breadcrumbItem), [
      h.a([...sxAttrs(h, styles.breadcrumbLink, styles.focusable), h.Href(item.href)], [item.label]),
      h.span([h.AriaHidden(true)], [config.separator ?? "/"]),
    ])),
    h.li([...sxAttrs(h, styles.breadcrumbCurrent), h.AriaCurrent("page")], [config.current]),
  ])],
);

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

export const Breadcrumb = { view: breadcrumb } as const;
export const NavigationMenu = { view: navigationMenu } as const;
export const Pagination = { view: pagination } as const;
export const Sidebar = { view: sidebar } as const;
export const Tabs = { view: tabs } as const;
