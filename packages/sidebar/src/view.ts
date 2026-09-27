import type { LucideIconData } from "@lucide/icons";
import { Menu, PanelLeft, X } from "@lucide/icons";
import type * as stylex from "@stylexjs/stylex";
import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

import { Icon, sxAttrs } from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { styles } from "./styles";

/**
 * Supply `href` for router-driven applications, `onClick` for applications that
 * navigate with messages, or both. Activating either kind also closes the mobile drawer.
 */
export type NavigationTarget<ParentMessage> = Readonly<{
  href?: string;
  onClick?: ParentMessage;
}>;

export type NavigationSubItem<ParentMessage = never> = NavigationTarget<ParentMessage> &
  Readonly<{
    id: string;
    label: string;
    isActive?: boolean;
    /** Trailing count, such as the number of fields on a page. */
    count?: number | string;
    /** Accessible replacement for the visible count, for example "3 hidden fields". */
    countLabel?: string;
  }>;

export type NavigationItem<ParentMessage = never> = NavigationTarget<ParentMessage> &
  Readonly<{
    id: string;
    label: string;
    icon: LucideIconData;
    isActive?: boolean;
    badge?: string;
    /** Trailing count, such as the number of fields on a page. Hidden while collapsed. */
    count?: number | string;
    /** Accessible replacement for the visible count, for example "3 hidden fields". */
    countLabel?: string;
    items?: ReadonlyArray<NavigationSubItem<ParentMessage>>;
  }>;

export type NavigationGroup<ParentMessage = never> = Readonly<{
  id: string;
  label?: string;
  items: ReadonlyArray<NavigationItem<ParentMessage>>;
}>;

export type Brand = Readonly<{
  title: string;
  description?: string;
  href: string;
  icon: LucideIconData;
}>;

export type Identity = Readonly<{
  title: string;
  description?: string;
  icon: LucideIconData;
}>;

export type ViewConfig<ParentMessage> = Readonly<{
  model: Model;
  toParentMessage: (message: Message) => ParentMessage;
  brand: Brand;
  groups: ReadonlyArray<NavigationGroup<ParentMessage>>;
  header: Html;
  content: Html;
  footer?: Identity;
  ariaLabel?: string;
  variant?: "inset" | "sidebar";
  collapsible?: "icon" | "offcanvas" | "none";
}>;

/** A link for `href` targets, otherwise a button. Both dispatch `onClick` and close the mobile drawer. */
const navigationControl = <ParentMessage>(
  target: NavigationTarget<ParentMessage>,
  recipe: ReadonlyArray<stylex.StyleXStyles>,
  attributes: ReadonlyArray<Attribute<ParentMessage>>,
  toParentMessage: (message: Message) => ParentMessage,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const handlers = [
    ...(target.onClick === undefined ? [] : [h.OnClick(target.onClick)]),
    h.OnClick(toParentMessage(Message.ClosedMobile())),
  ];
  return target.href === undefined
    ? h.button(
        [...sxAttrs(h, ...recipe, styles.menuButton), ...attributes, h.Type("button"), ...handlers],
        children,
      )
    : h.a([...sxAttrs(h, ...recipe), ...attributes, h.Href(target.href), ...handlers], children);
};

const countView = <ParentMessage>(
  count: number | string,
  label: string | undefined,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.span(
    [...sxAttrs(h, styles.count), h.DataAttribute("count", String(count))],
    label === undefined
      ? [String(count)]
      : [h.span([h.AriaHidden(true)], [String(count)]), h.span(sxAttrs(h, styles.srOnly), [label])],
  );

const menuItem = <ParentMessage>(
  item: NavigationItem<ParentMessage>,
  isCollapsed: boolean,
  toParentMessage: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.li(sxAttrs(h, styles.menuItem), [
    navigationControl(
      item,
      [
        styles.menuLink,
        ...(item.isActive === true ? [styles.menuLinkActive] : []),
        ...(isCollapsed ? [styles.collapsedMenuLink] : []),
      ],
      [
        ...(isCollapsed ? [h.AriaLabel(item.label)] : []),
        h.AriaCurrent(item.isActive === true ? "page" : "false"),
        h.Title(item.label),
        h.DataAttribute("sidebar-item", item.id),
      ],
      toParentMessage,
      [
        h.span(sxAttrs(h, styles.menuIcon), [Icon.view({ icon: item.icon, size: 16 }, h)]),
        h.span(sxAttrs(h, styles.menuLabel, ...(isCollapsed ? [styles.collapsedCopy] : [])), [
          item.label,
        ]),
        ...(isCollapsed || (item.badge === undefined && item.count === undefined)
          ? []
          : [
              h.span(sxAttrs(h, styles.menuTrailing), [
                ...(item.count === undefined ? [] : [countView(item.count, item.countLabel, h)]),
                ...(item.badge === undefined
                  ? []
                  : [h.span(sxAttrs(h, styles.badge), [item.badge])]),
              ]),
            ]),
      ],
      h,
    ),
    ...(item.items === undefined
      ? []
      : [
          h.ul(
            sxAttrs(h, styles.submenu, ...(isCollapsed ? [styles.submenuHidden] : [])),
            item.items.map((subItem) =>
              h.li(
                [],
                [
                  navigationControl(
                    subItem,
                    [
                      styles.submenuLink,
                      ...(subItem.isActive === true ? [styles.submenuLinkActive] : []),
                    ],
                    [
                      h.AriaCurrent(subItem.isActive === true ? "page" : "false"),
                      h.DataAttribute("sidebar-item", subItem.id),
                    ],
                    toParentMessage,
                    [
                      subItem.label,
                      ...(subItem.count === undefined
                        ? []
                        : [countView(subItem.count, subItem.countLabel, h)]),
                    ],
                    h,
                  ),
                ],
              ),
            ),
          ),
        ]),
  ]);

const sidebarBody = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  isCollapsed: boolean,
  isMobile: boolean,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => [
  h.div(sxAttrs(h, styles.sidebarHeader, ...(isMobile ? [styles.mobileHeader] : [])), [
    h.a(
      [
        ...sxAttrs(h, styles.brand),
        h.Href(config.brand.href),
        h.AriaLabel(config.brand.title),
        h.OnClick(config.toParentMessage(Message.ClosedMobile())),
      ],
      [
        h.span(sxAttrs(h, styles.brandIcon), [Icon.view({ icon: config.brand.icon, size: 16 }, h)]),
        h.span(sxAttrs(h, styles.brandCopy, ...(isCollapsed ? [styles.collapsedCopy] : [])), [
          h.span(sxAttrs(h, styles.brandTitle), [config.brand.title]),
          ...(config.brand.description === undefined
            ? []
            : [h.span(sxAttrs(h, styles.brandDescription), [config.brand.description])]),
        ]),
      ],
    ),
    ...(isMobile
      ? [
          h.button(
            [
              ...sxAttrs(h, styles.trigger, styles.mobileClose),
              h.Type("button"),
              h.AriaLabel("Close navigation"),
              h.OnClick(config.toParentMessage(Message.ClosedMobile())),
            ],
            [Icon.view({ icon: X, size: 16 }, h)],
          ),
        ]
      : []),
  ]),
  h.nav(
    [...sxAttrs(h, styles.content), h.AriaLabel("Demo navigation")],
    config.groups.map((group) =>
      h.section(
        [...sxAttrs(h, styles.group), h.DataAttribute("sidebar-group", group.id)],
        [
          ...(group.label === undefined
            ? []
            : [
                h.div(
                  sxAttrs(
                    h,
                    styles.groupLabel,
                    ...(isCollapsed ? [styles.collapsedGroupLabel] : []),
                  ),
                  [group.label],
                ),
              ]),
          h.ul(
            sxAttrs(h, styles.menu),
            group.items.map((item) => menuItem(item, isCollapsed, config.toParentMessage, h)),
          ),
        ],
      ),
    ),
  ),
  ...(config.footer === undefined
    ? []
    : [
        h.footer(sxAttrs(h, styles.sidebarFooter), [
          h.div(sxAttrs(h, styles.identity), [
            h.span(sxAttrs(h, styles.identityIcon), [
              Icon.view({ icon: config.footer.icon, size: 15 }, h),
            ]),
            h.span(sxAttrs(h, styles.brandCopy, ...(isCollapsed ? [styles.collapsedCopy] : [])), [
              h.span(sxAttrs(h, styles.brandTitle), [config.footer.title]),
              ...(config.footer.description === undefined
                ? []
                : [h.span(sxAttrs(h, styles.brandDescription), [config.footer.description])]),
            ]),
          ]),
        ]),
      ]),
];

export const view = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const collapsible = config.collapsible ?? "icon";
  const desktopCollapsed = collapsible !== "none" && config.model.isCollapsed;
  const usesOffcanvas = collapsible === "offcanvas";
  return h.div(
    [
      ...sxAttrs(
        h,
        styles.provider,
        ...(desktopCollapsed && !usesOffcanvas ? [styles.providerCollapsed] : []),
        ...(desktopCollapsed && usesOffcanvas ? [styles.providerOffcanvasCollapsed] : []),
      ),
      h.DataAttribute("sidebar-provider", config.model.id),
      h.DataAttribute("state", desktopCollapsed ? "collapsed" : "expanded"),
    ],
    [
      h.aside(
        [
          ...sxAttrs(
            h,
            styles.desktopSidebar,
            ...(desktopCollapsed && usesOffcanvas ? [styles.desktopOffcanvasClosed] : []),
          ),
          h.Id(`${config.model.id}-desktop`),
          h.AriaLabel(config.ariaLabel ?? "Application navigation"),
          h.DataAttribute("sidebar", "desktop"),
        ],
        [
          ...sidebarBody(config, desktopCollapsed, false, h),
          ...(collapsible === "none"
            ? []
            : [
                h.button([
                  ...sxAttrs(h, styles.rail),
                  h.Type("button"),
                  h.AriaLabel(desktopCollapsed ? "Expand navigation" : "Collapse navigation"),
                  h.Title(desktopCollapsed ? "Expand navigation" : "Collapse navigation"),
                  h.OnClick(config.toParentMessage(Message.ToggledCollapsed())),
                ]),
              ]),
        ],
      ),
      h.section(
        sxAttrs(h, styles.inset, ...(config.variant === "sidebar" ? [styles.insetFlat] : [])),
        [
          h.div(sxAttrs(h, styles.topbar), [
            h.div(sxAttrs(h, styles.triggerCell), [
              ...(collapsible === "none"
                ? []
                : [
                    h.button(
                      [
                        ...sxAttrs(h, styles.trigger, styles.desktopTrigger),
                        h.Type("button"),
                        h.AriaLabel(desktopCollapsed ? "Expand navigation" : "Collapse navigation"),
                        h.AriaControls(`${config.model.id}-desktop`),
                        h.AriaExpanded(!desktopCollapsed),
                        h.OnClick(config.toParentMessage(Message.ToggledCollapsed())),
                      ],
                      [Icon.view({ icon: PanelLeft, size: 16 }, h)],
                    ),
                    h.button(
                      [
                        ...sxAttrs(h, styles.trigger, styles.mobileTrigger),
                        h.Type("button"),
                        h.AriaLabel("Open navigation"),
                        h.AriaControls(`${config.model.id}-mobile`),
                        h.AriaExpanded(config.model.isMobileOpen),
                        h.OnClick(config.toParentMessage(Message.ToggledMobile())),
                      ],
                      [Icon.view({ icon: Menu, size: 17 }, h)],
                    ),
                  ]),
            ]),
            h.div(sxAttrs(h, styles.headerSlot), [config.header]),
          ]),
          h.div(
            [...sxAttrs(h, styles.main), h.DataAttribute("sidebar-main", "true")],
            [config.content],
          ),
        ],
      ),
      h.button([
        ...sxAttrs(h, styles.overlay, ...(config.model.isMobileOpen ? [styles.overlayOpen] : [])),
        h.Type("button"),
        h.AriaLabel("Close navigation"),
        h.AriaHidden(!config.model.isMobileOpen),
        h.OnClick(config.toParentMessage(Message.ClosedMobile())),
      ]),
      h.aside(
        [
          ...sxAttrs(
            h,
            styles.mobileSidebar,
            ...(config.model.isMobileOpen ? [styles.mobileSidebarOpen] : []),
          ),
          h.Id(`${config.model.id}-mobile`),
          h.AriaLabel(config.ariaLabel ?? "Application navigation"),
          h.AriaHidden(!config.model.isMobileOpen),
          ...(config.model.isMobileOpen ? [] : [h.Attribute("inert", "")]),
          h.DataAttribute("sidebar", "mobile"),
        ],
        sidebarBody(config, false, true, h),
      ),
      h.div([...sxAttrs(h, styles.srOnly), h.AriaLive("polite")], [config.model.announcement]),
    ],
  );
};
