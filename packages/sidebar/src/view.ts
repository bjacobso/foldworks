import type { LucideIconData } from "@lucide/icons";
import { Menu, PanelLeft, X } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Icon, sxAttrs } from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { styles } from "./styles";

export type NavigationSubItem = Readonly<{
  id: string;
  label: string;
  href: string;
  isActive?: boolean;
}>;

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  href: string;
  icon: LucideIconData;
  isActive?: boolean;
  badge?: string;
  items?: ReadonlyArray<NavigationSubItem>;
}>;

export type NavigationGroup = Readonly<{
  id: string;
  label?: string;
  items: ReadonlyArray<NavigationItem>;
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
  groups: ReadonlyArray<NavigationGroup>;
  header: Html;
  content: Html;
  footer?: Identity;
  ariaLabel?: string;
  variant?: "inset" | "sidebar";
  collapsible?: "icon" | "offcanvas" | "none";
}>;

const menuItem = <ParentMessage>(
  item: NavigationItem,
  isCollapsed: boolean,
  toParentMessage: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html => h.li(sxAttrs(h, styles.menuItem), [
  h.a([
    ...sxAttrs(
      h,
      styles.menuLink,
      ...(item.isActive === true ? [styles.menuLinkActive] : []),
      ...(isCollapsed ? [styles.collapsedMenuLink] : []),
    ),
    h.Href(item.href),
    h.AriaLabel(item.label),
    h.AriaCurrent(item.isActive === true ? "page" : "false"),
    h.Title(item.label),
    h.OnClick(toParentMessage(Message.ClosedMobile())),
  ], [
    h.span(sxAttrs(h, styles.menuIcon), [Icon.view({ icon: item.icon, size: 16 }, h)]),
    h.span(sxAttrs(h, styles.menuLabel, ...(isCollapsed ? [styles.collapsedCopy] : [])), [item.label]),
    ...(item.badge === undefined || isCollapsed
      ? []
      : [h.span(sxAttrs(h, styles.badge), [item.badge])]),
  ]),
  ...(item.items === undefined
    ? []
    : [h.ul(sxAttrs(h, styles.submenu, ...(isCollapsed ? [styles.submenuHidden] : [])), item.items.map((subItem) =>
        h.li([], [h.a([
          ...sxAttrs(h, styles.submenuLink, ...(subItem.isActive === true ? [styles.submenuLinkActive] : [])),
          h.Href(subItem.href),
          h.AriaCurrent(subItem.isActive === true ? "page" : "false"),
          h.OnClick(toParentMessage(Message.ClosedMobile())),
        ], [subItem.label])]),
      ))]),
]);

const sidebarBody = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  isCollapsed: boolean,
  isMobile: boolean,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => [
  h.div(sxAttrs(h, styles.sidebarHeader, ...(isMobile ? [styles.mobileHeader] : [])), [
    h.a([
      ...sxAttrs(h, styles.brand),
      h.Href(config.brand.href),
      h.AriaLabel(config.brand.title),
      h.OnClick(config.toParentMessage(Message.ClosedMobile())),
    ], [
      h.span(sxAttrs(h, styles.brandIcon), [Icon.view({ icon: config.brand.icon, size: 16 }, h)]),
      h.span(sxAttrs(h, styles.brandCopy, ...(isCollapsed ? [styles.collapsedCopy] : [])), [
        h.span(sxAttrs(h, styles.brandTitle), [config.brand.title]),
        ...(config.brand.description === undefined
          ? []
          : [h.span(sxAttrs(h, styles.brandDescription), [config.brand.description])]),
      ]),
    ]),
    ...(isMobile
      ? [h.button([
          ...sxAttrs(h, styles.trigger, styles.mobileClose),
          h.Type("button"),
          h.AriaLabel("Close navigation"),
          h.OnClick(config.toParentMessage(Message.ClosedMobile())),
        ], [Icon.view({ icon: X, size: 16 }, h)])]
      : []),
  ]),
  h.nav([...sxAttrs(h, styles.content), h.AriaLabel("Demo navigation")], config.groups.map((group) =>
    h.section([...sxAttrs(h, styles.group), h.DataAttribute("sidebar-group", group.id)], [
      ...(group.label === undefined
        ? []
        : [h.div(sxAttrs(h, styles.groupLabel, ...(isCollapsed ? [styles.collapsedGroupLabel] : [])), [group.label])]),
      h.ul(sxAttrs(h, styles.menu), group.items.map((item) =>
        menuItem(item, isCollapsed, config.toParentMessage, h),
      )),
    ]),
  )),
  ...(config.footer === undefined
    ? []
    : [h.footer(sxAttrs(h, styles.sidebarFooter), [
        h.div(sxAttrs(h, styles.identity), [
          h.span(sxAttrs(h, styles.identityIcon), [Icon.view({ icon: config.footer.icon, size: 15 }, h)]),
          h.span(sxAttrs(h, styles.brandCopy, ...(isCollapsed ? [styles.collapsedCopy] : [])), [
            h.span(sxAttrs(h, styles.brandTitle), [config.footer.title]),
            ...(config.footer.description === undefined
              ? []
              : [h.span(sxAttrs(h, styles.brandDescription), [config.footer.description])]),
          ]),
        ]),
      ])]),
];

export const view = <ParentMessage>(
  config: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const collapsible = config.collapsible ?? "icon";
  const desktopCollapsed = collapsible !== "none" && config.model.isCollapsed;
  const usesOffcanvas = collapsible === "offcanvas";
  return h.div([
    ...sxAttrs(
      h,
      styles.provider,
      ...(desktopCollapsed && !usesOffcanvas ? [styles.providerCollapsed] : []),
      ...(desktopCollapsed && usesOffcanvas ? [styles.providerOffcanvasCollapsed] : []),
    ),
    h.DataAttribute("sidebar-provider", config.model.id),
    h.DataAttribute("state", desktopCollapsed ? "collapsed" : "expanded"),
  ], [
    h.aside([
      ...sxAttrs(h, styles.desktopSidebar, ...(desktopCollapsed && usesOffcanvas ? [styles.desktopOffcanvasClosed] : [])),
      h.Id(`${config.model.id}-desktop`),
      h.AriaLabel(config.ariaLabel ?? "Application navigation"),
      h.DataAttribute("sidebar", "desktop"),
    ], [
      ...sidebarBody(config, desktopCollapsed, false, h),
      ...(collapsible === "none"
        ? []
        : [h.button([
            ...sxAttrs(h, styles.rail),
            h.Type("button"),
            h.AriaLabel(desktopCollapsed ? "Expand navigation" : "Collapse navigation"),
            h.Title(desktopCollapsed ? "Expand navigation" : "Collapse navigation"),
            h.OnClick(config.toParentMessage(Message.ToggledCollapsed())),
          ])]),
    ]),
    h.section(sxAttrs(h, styles.inset, ...(config.variant === "sidebar" ? [styles.insetFlat] : [])), [
      h.div(sxAttrs(h, styles.topbar), [
        h.div(sxAttrs(h, styles.triggerCell), [
          ...(collapsible === "none"
            ? []
            : [
                h.button([
                  ...sxAttrs(h, styles.trigger, styles.desktopTrigger),
                  h.Type("button"),
                  h.AriaLabel(desktopCollapsed ? "Expand navigation" : "Collapse navigation"),
                  h.AriaControls(`${config.model.id}-desktop`),
                  h.AriaExpanded(!desktopCollapsed),
                  h.OnClick(config.toParentMessage(Message.ToggledCollapsed())),
                ], [Icon.view({ icon: PanelLeft, size: 16 }, h)]),
                h.button([
                  ...sxAttrs(h, styles.trigger, styles.mobileTrigger),
                  h.Type("button"),
                  h.AriaLabel("Open navigation"),
                  h.AriaControls(`${config.model.id}-mobile`),
                  h.AriaExpanded(config.model.isMobileOpen),
                  h.OnClick(config.toParentMessage(Message.ToggledMobile())),
                ], [Icon.view({ icon: Menu, size: 17 }, h)]),
              ]),
        ]),
        h.div(sxAttrs(h, styles.headerSlot), [config.header]),
      ]),
      h.div([
        ...sxAttrs(h, styles.main),
        h.DataAttribute("sidebar-main", "true"),
      ], [config.content]),
    ]),
    h.button([
      ...sxAttrs(h, styles.overlay, ...(config.model.isMobileOpen ? [styles.overlayOpen] : [])),
      h.Type("button"),
      h.AriaLabel("Close navigation"),
      h.AriaHidden(!config.model.isMobileOpen),
      h.OnClick(config.toParentMessage(Message.ClosedMobile())),
    ]),
    h.aside([
      ...sxAttrs(h, styles.mobileSidebar, ...(config.model.isMobileOpen ? [styles.mobileSidebarOpen] : [])),
      h.Id(`${config.model.id}-mobile`),
      h.AriaLabel(config.ariaLabel ?? "Application navigation"),
      h.AriaHidden(!config.model.isMobileOpen),
      ...(config.model.isMobileOpen ? [] : [h.Attribute("inert", "")]),
      h.DataAttribute("sidebar", "mobile"),
    ], sidebarBody(config, false, true, h)),
    h.div([...sxAttrs(h, styles.srOnly), h.AriaLive("polite")], [config.model.announcement]),
  ]);
};
