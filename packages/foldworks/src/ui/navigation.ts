import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { countView } from "./adornments";
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

export type BreadcrumbSlot =
  | "root"
  | "list"
  | "item"
  | "link"
  | "separator"
  | "current"
  | "overflow";

type BreadcrumbEntry<Message> =
  | Readonly<{ kind: "item"; item: BreadcrumbItem<Message> }>
  | Readonly<{ kind: "current"; label: string }>
  | Readonly<{ kind: "overflow"; hiddenCount: number }>;

export type BreadcrumbConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, BreadcrumbSlot> &
  Readonly<{
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
  options: Readonly<{
    maxItems?: number;
    itemsBeforeCollapse?: number;
    itemsAfterCollapse?: number;
  }> = {},
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
    throw new Error(
      "Breadcrumb collapse counts must use non-negative before and positive after values.",
    );
  }
  if (before + after + 1 > options.maxItems) {
    throw new Error(
      "Breadcrumb maxItems must fit itemsBeforeCollapse, itemsAfterCollapse, and the overflow item.",
    );
  }

  const hiddenCount = entries.length - before - after;
  return [
    ...entries.slice(0, before),
    { kind: "overflow", hiddenCount },
    ...entries.slice(entries.length - after),
  ];
};

const breadcrumb = <Message>(config: BreadcrumbConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const entries = collapseBreadcrumbItems(config.items, config.current, config);
  const separator = () =>
    h.span(
      [...slotAttrs(config.slotProps?.separator, h), h.AriaHidden(true)],
      [config.separator ?? "/"],
    );
  const actionable = (item: BreadcrumbItem<Message>) => {
    if (item.href !== undefined)
      return h.a(
        [
          ...slotAttrs(config.slotProps?.link, h, styles.breadcrumbLink, styles.focusable),
          h.Href(item.href),
          ...(item.onClick === undefined ? [] : [h.OnClick(item.onClick)]),
        ],
        [item.label],
      );
    if (item.onClick !== undefined)
      return h.button(
        [
          ...slotAttrs(
            config.slotProps?.link,
            h,
            styles.breadcrumbLink,
            styles.focusable,
            styles.breadcrumbButton,
          ),
          h.Type("button"),
          h.OnClick(item.onClick),
        ],
        [item.label],
      );
    return h.span(slotAttrs(config.slotProps?.link, h, styles.breadcrumbLink, styles.focusable), [
      item.label,
    ]);
  };

  return h.nav(
    [...rootAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Breadcrumb")],
    [
      h.ol(
        slotAttrs(config.slotProps?.list, h, styles.breadcrumb),
        entries.map((entry, index) => {
          if (entry.kind === "current")
            return h.li(
              [
                ...slotAttrs(config.slotProps?.current, h, styles.breadcrumbCurrent),
                h.AriaCurrent("page"),
              ],
              [entry.label],
            );

          const content =
            entry.kind === "item"
              ? actionable(entry.item)
              : config.onExpand === undefined
                ? h.span(
                    [
                      ...slotAttrs(config.slotProps?.overflow, h, styles.breadcrumbOverflow),
                      h.AriaLabel(`${entry.hiddenCount} hidden breadcrumb items`),
                    ],
                    [config.overflowLabel ?? "…"],
                  )
                : h.button(
                    [
                      ...slotAttrs(
                        config.slotProps?.overflow,
                        h,
                        styles.breadcrumbLink,
                        styles.breadcrumbButton,
                        styles.breadcrumbOverflow,
                      ),
                      h.Type("button"),
                      h.AriaLabel(`Show ${entry.hiddenCount} hidden breadcrumb items`),
                      h.OnClick(config.onExpand),
                    ],
                    [config.overflowLabel ?? "…"],
                  );
          return h.li(slotAttrs(config.slotProps?.item, h, styles.breadcrumbItem), [
            content,
            ...(index === entries.length - 1 ? [] : [separator()]),
          ]);
        }),
      ),
    ],
  );
};

const pagination = <Message>(
  config: StyledConfig<Message> &
    Readonly<{
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
    [
      h.div(sxAttrs(h, styles.pagination), [
        h.button(
          [
            ...sxAttrs(h, styles.pageButton, styles.focusable),
            h.Type("button"),
            h.AriaLabel("Previous page"),
            h.Disabled(config.page <= 1),
            h.OnClick(config.onChange(Math.max(1, config.page - 1))),
          ],
          ["Previous"],
        ),
        ...pages.map((page) =>
          h.button(
            [
              ...sxAttrs(
                h,
                styles.pageButton,
                styles.focusable,
                page === config.page && styles.pageButtonCurrent,
              ),
              h.Type("button"),
              h.AriaLabel(`Page ${page}`),
              h.AriaCurrent(page === config.page ? "page" : "false"),
              h.OnClick(config.onChange(page)),
            ],
            [String(page)],
          ),
        ),
        h.button(
          [
            ...sxAttrs(h, styles.pageButton, styles.focusable),
            h.Type("button"),
            h.AriaLabel("Next page"),
            h.Disabled(config.page >= config.pageCount),
            h.OnClick(config.onChange(Math.min(config.pageCount, config.page + 1))),
          ],
          ["Next"],
        ),
      ]),
    ],
  );
};

type Tab<Value extends string> = Readonly<{
  value: Value;
  label: string;
  content: Children;
  isDisabled?: boolean;
}>;

/** @deprecated Use Stateful.Tabs for keyboard navigation and managed focus. */
const tabs = <Message, Value extends string>(
  config: StyledConfig<Message> &
    Readonly<{
      id: string;
      value: Value;
      tabs: ReadonlyArray<Tab<Value>>;
      onChange: (value: Value) => Message;
      ariaLabel?: string;
    }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(styledAttrs(config, h, styles.tabs), [
    h.div(
      [...sxAttrs(h, styles.tabsList), h.Role("tablist"), h.AriaLabel(config.ariaLabel ?? "Tabs")],
      config.tabs.map((tab) =>
        h.button(
          [
            ...sxAttrs(
              h,
              styles.tabsTrigger,
              styles.focusable,
              tab.value === config.value && styles.tabsTriggerActive,
            ),
            h.Type("button"),
            h.Role("tab"),
            h.Id(`${config.id}-tab-${tab.value}`),
            h.AriaControls(`${config.id}-panel-${tab.value}`),
            h.AriaSelected(tab.value === config.value),
            h.Tabindex(tab.value === config.value ? 0 : -1),
            h.Disabled(tab.isDisabled === true),
            h.OnClick(config.onChange(tab.value)),
          ],
          [tab.label],
        ),
      ),
    ),
    ...config.tabs.map((tab) =>
      h.div(
        [
          h.Role("tabpanel"),
          h.Id(`${config.id}-panel-${tab.value}`),
          h.AriaLabelledBy(`${config.id}-tab-${tab.value}`),
          h.Hidden(tab.value !== config.value),
          h.Tabindex(0),
        ],
        tab.content,
      ),
    ),
  ]);

const navigationMenu = <Message>(
  config: StyledConfig<Message> & Readonly<{ items: ReadonlyArray<Link>; ariaLabel?: string }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.nav(
    [...styledAttrs(config, h), h.AriaLabel(config.ariaLabel ?? "Primary navigation")],
    [
      h.ul(
        sxAttrs(h, styles.nav),
        config.items.map((item) =>
          h.li(
            [],
            [
              h.a(
                [...sxAttrs(h, styles.navLink, styles.focusable), h.Href(item.href)],
                [item.label],
              ),
            ],
          ),
        ),
      ),
    ],
  );

export type SidebarItem<Message> = Readonly<{
  label: string;
  /** Native navigation target. Omit for a message-driven item rendered as a button. */
  href?: string;
  /** Message dispatched when the item is activated, with or without an `href`. */
  onClick?: Message;
  isCurrent?: boolean;
  media?: Html;
  /** Trailing count, such as the number of fields on a page. */
  count?: number | string;
  /** Accessible replacement for the visible count, for example "3 hidden fields". */
  countLabel?: string;
}>;

export type SidebarGroup<Message> = Readonly<{
  label?: string;
  items: ReadonlyArray<SidebarItem<Message>>;
}>;

export type SidebarConfig<Message> = StyledConfig<Message> &
  Readonly<{
    header?: Children;
    groups: ReadonlyArray<SidebarGroup<Message>>;
    footer?: Children;
    ariaLabel?: string;
  }>;

const sidebarItem = <Message>(item: SidebarItem<Message>, h: HtmlBuilder<Message>): Html => {
  const isCurrent = item.isCurrent === true;
  const attributes = (isButton: boolean) => [
    ...sxAttrs<Message>(
      h,
      styles.sidebarItem,
      styles.focusable,
      isButton && styles.sidebarButton,
      isCurrent && styles.sidebarItemCurrent,
    ),
    h.AriaCurrent(isCurrent ? "page" : "false"),
  ];
  const children = [
    ...(item.media === undefined ? [] : [item.media]),
    item.label,
    ...(item.count === undefined
      ? []
      : [countView<Message>(item.count, item.countLabel, undefined, h, styles.sidebarCount)]),
  ];
  if (item.href !== undefined)
    return h.a(
      [
        ...attributes(false),
        h.Href(item.href),
        ...(item.onClick === undefined ? [] : [h.OnClick(item.onClick)]),
      ],
      children,
    );
  if (item.onClick !== undefined)
    return h.button([...attributes(true), h.Type("button"), h.OnClick(item.onClick)], children);
  return h.span(attributes(false), children);
};

const sidebar = <Message>(config: SidebarConfig<Message>, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [
      ...styledAttrs<Message>(config, h, styles.sidebar),
      h.AriaLabel(config.ariaLabel ?? "Sidebar"),
    ],
    [
      ...(config.header ?? []),
      ...config.groups.map((group) =>
        h.div(sxAttrs<Message>(h, styles.sidebarGroup), [
          ...(group.label === undefined
            ? []
            : [h.div(sxAttrs<Message>(h, styles.sidebarLabel), [group.label])]),
          ...group.items.map((item) => sidebarItem(item, h)),
        ]),
      ),
      ...(config.footer ?? []),
    ],
  );

export type TabBarTab<Value extends string> = Readonly<{
  value: Value;
  label: string;
  /** Native navigation target. Only used with navigation semantics. */
  href?: string;
  /** Secondary text, announced as the tab's description. Use it to say why a tab is disabled. */
  hint?: string;
  /** Content after the label, such as a `Badge`. */
  badge?: Children;
  /** Disabled tabs stay discoverable: they render `aria-disabled` and dispatch nothing. */
  isDisabled?: boolean;
}>;

export type TabBarSlot = "root" | "list" | "item" | "tab" | "label" | "hint" | "badge" | "trailing";

type TabBarBase<Message, Value extends string> = StyledConfig<Message> &
  WithSlotProps<Message, TabBarSlot> &
  Readonly<{
    /** Prefix for tab element IDs. See `TabBar.tabId`. */
    id: string;
    tabs: ReadonlyArray<TabBarTab<Value>>;
    /** The current tab. Omit when no tab matches the visible screen. */
    value?: Value;
    ariaLabel: string;
    /** Content after the tabs, for example a release status `Badge`. */
    trailing?: Children;
  }>;

export type TabBarConfig<Message, Value extends string> = TabBarBase<Message, Value> &
  (
    | Readonly<{
        /** A navigation landmark whose current tab has `aria-current="page"`. Tab moves between tabs. */
        semantics?: "navigation";
        onChange?: (value: Value) => Message;
      }>
    | Readonly<{
        /** A tablist with one tab stop. Arrow keys, Home, and End move focus and select. */
        semantics: "tablist";
        onChange: (value: Value) => Message;
        /** ID of the single `tabpanel` the application renders for the selected tab. */
        panelId?: string;
      }>
  );

/** The element ID of a tab. A tablist panel can use it for `aria-labelledby`. */
export const tabBarTabId = (id: string, value: string): string => `${id}-tab-${value}`;

const nextEnabledIndex = (
  tabs: ReadonlyArray<TabBarTab<string>>,
  index: number,
  key: string,
): number | undefined => {
  const enabled = (candidate: number) => tabs[candidate]?.isDisabled !== true;
  const search = (start: number, step: 1 | -1) => {
    for (let offset = 0; offset < tabs.length; offset += 1) {
      const candidate = (((start + offset * step) % tabs.length) + tabs.length) % tabs.length;
      if (enabled(candidate)) return candidate;
    }
    return undefined;
  };
  if (key === "ArrowRight") return search(index + 1, 1);
  if (key === "ArrowLeft") return search(index - 1, -1);
  if (key === "Home") return search(0, 1);
  if (key === "End") return search(tabs.length - 1, -1);
  return undefined;
};

const tabBar = <Message, Value extends string>(
  config: TabBarConfig<Message, Value>,
  h: HtmlBuilder<Message>,
): Html => {
  const slots = config.slotProps;
  const isTablist = config.semantics === "tablist";
  const selectedIndex = config.tabs.findIndex(
    (tab) => tab.value === config.value && tab.isDisabled !== true,
  );
  const tabStop =
    selectedIndex >= 0 ? selectedIndex : config.tabs.findIndex((tab) => tab.isDisabled !== true);

  const tabView = (tab: TabBarTab<Value>, index: number): Html => {
    const id = tabBarTabId(config.id, tab.value);
    const isCurrent = tab.value === config.value;
    const isDisabled = tab.isDisabled === true;
    const hintId = `${id}-hint`;
    const children = [
      h.span(slotAttrs<Message>(slots?.label, h, isDisabled && styles.tabBarLabelDisabled), [
        tab.label,
      ]),
      ...(tab.badge === undefined
        ? []
        : [h.span(slotAttrs<Message>(slots?.badge, h, styles.tabBarBadge), tab.badge)]),
      ...(tab.hint === undefined
        ? []
        : [
            h.span(
              [...slotAttrs<Message>(slots?.hint, h, styles.tabBarHint), h.Id(hintId)],
              [tab.hint],
            ),
          ]),
    ];
    const attributes = [
      ...slotAttrs<Message>(
        slots?.tab,
        h,
        styles.focusable,
        styles.tabBarTab,
        isCurrent && styles.tabBarTabCurrent,
        isDisabled && styles.tabBarTabDisabled,
      ),
      h.Id(id),
      ...(tab.hint === undefined ? [] : [h.AriaDescribedBy(hintId)]),
      ...(isDisabled ? [h.AriaDisabled(true)] : []),
    ];

    if (config.semantics === "tablist") {
      const onChange = config.onChange;
      return h.button(
        [
          ...attributes,
          h.Type("button"),
          h.Role("tab"),
          h.AriaSelected(isCurrent),
          h.Tabindex(index === tabStop ? 0 : -1),
          ...(config.panelId === undefined ? [] : [h.AriaControls(config.panelId)]),
          ...(isDisabled ? [] : [h.OnClick(onChange(tab.value))]),
          h.OnKeyDownFocus((key) => {
            const next = nextEnabledIndex(config.tabs, index, key);
            const target = next === undefined ? undefined : config.tabs[next];
            return target === undefined || next === index
              ? Option.none()
              : Option.some({
                  focusSelector: `[id="${tabBarTabId(config.id, target.value)}"]`,
                  message: onChange(target.value),
                });
          }),
        ],
        children,
      );
    }

    const current = isCurrent ? [h.AriaCurrent("page")] : [];
    const onClick =
      isDisabled || config.onChange === undefined ? [] : [h.OnClick(config.onChange(tab.value))];
    const control =
      tab.href !== undefined && !isDisabled
        ? h.a([...attributes, ...current, h.Href(tab.href), ...onClick], children)
        : h.button([...attributes, ...current, h.Type("button"), ...onClick], children);
    return h.li(slotAttrs<Message>(slots?.item, h, styles.tabBarItem), [control]);
  };

  const tabs = config.tabs.map(tabView);
  const trailing =
    config.trailing === undefined
      ? []
      : [h.div(slotAttrs<Message>(slots?.trailing, h, styles.tabBarTrailing), config.trailing)];

  return isTablist
    ? h.div(
        [...rootAttrs<Message>(config, h, styles.tabBar), h.DataAttribute("tab-bar", "tablist")],
        [
          h.div(
            [
              ...slotAttrs<Message>(slots?.list, h, styles.tabBarList),
              h.Role("tablist"),
              h.AriaLabel(config.ariaLabel),
              h.AriaOrientation("horizontal"),
            ],
            tabs,
          ),
          ...trailing,
        ],
      )
    : h.nav(
        [
          ...rootAttrs<Message>(config, h, styles.tabBar),
          h.AriaLabel(config.ariaLabel),
          h.DataAttribute("tab-bar", "navigation"),
        ],
        [h.ul(slotAttrs<Message>(slots?.list, h, styles.tabBarList), tabs), ...trailing],
      );
};

export const Breadcrumb = { view: breadcrumb, collapseItems: collapseBreadcrumbItems } as const;
export const NavigationMenu = { view: navigationMenu } as const;
export const Pagination = { view: pagination } as const;
export const Sidebar = { view: sidebar } as const;
export const TabBar = { view: tabBar, tabId: tabBarTabId } as const;
export const Tabs = { view: tabs } as const;
