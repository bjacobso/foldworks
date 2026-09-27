import * as stylex from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "./catalog.styles";
import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { Breadcrumb, type BreadcrumbConfig } from "./navigation";
import { sxAttrs } from "./sx";
import { colors, sizes, space, typography } from "./tokens.stylex.js";

export type Slot = "root" | "brand" | "title" | "navigation" | "status" | "actions";

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    /** Product or application name. */
    title: string;
    /** Link the title to the application's home. */
    titleHref?: string;
    /** Message dispatched when the title is activated. Renders a button when `titleHref` is omitted. */
    onTitleClick?: Message;
    /** Logo or product mark rendered before the title. */
    leading?: Children;
    /** Location within the application, rendered with `Breadcrumb`. */
    breadcrumb?: BreadcrumbConfig<Message>;
    /** Environment indicator, sync state, or similar status, such as a `Badge`. */
    status?: Children;
    actions?: Children;
    /** Keep the header at the top of its scrolling ancestor. */
    sticky?: boolean;
  }>;

const styles = stylex.create({
  root: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    color: colors.foreground,
    columnGap: space.lg,
    display: "grid",
    fontFamily: typography.fontFamily,
    gridTemplateAreas: {
      default: '"brand end" "navigation navigation"',
      "@media (min-width: 640px)": '"brand navigation end"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) auto",
      "@media (min-width: 640px)": "auto minmax(0, 1fr) auto",
    },
    minHeight: sizes.controlLg,
    paddingBlock: space.sm,
    paddingInline: space.lg,
    rowGap: space.xs,
  },
  withoutNavigation: {
    gridTemplateAreas: '"brand end"',
    gridTemplateColumns: "minmax(0, 1fr) auto",
  },
  sticky: { insetInline: 0, position: "sticky", top: 0, zIndex: 20 },
  brand: { alignItems: "center", display: "flex", gap: space.sm, gridArea: "brand", minWidth: 0 },
  title: {
    color: "inherit",
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    letterSpacing: "-0.015em",
    lineHeight: typography.lineHeightTight,
    margin: 0,
    overflow: "hidden",
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  titleButton: {
    backgroundColor: "transparent",
    border: 0,
    cursor: "pointer",
    font: "inherit",
    padding: 0,
  },
  navigation: {
    borderInlineStartColor: { default: "transparent", "@media (min-width: 640px)": colors.border },
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: { default: 0, "@media (min-width: 640px)": "1px" },
    fontSize: typography.sizeMd,
    gridArea: "navigation",
    minWidth: 0,
    overflow: "hidden",
    paddingInlineStart: { default: 0, "@media (min-width: 640px)": space.lg },
  },
  end: {
    alignItems: "center",
    display: "flex",
    gap: space.md,
    gridArea: "end",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  status: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: space.sm },
  actions: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: space.sm },
});

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const titleAttrs = slotAttrs(
    config.slotProps?.title,
    h,
    styles.title,
    catalogStyles.focusable,
    config.titleHref === undefined && config.onTitleClick !== undefined && styles.titleButton,
  );
  let title: Html;
  if (config.titleHref !== undefined) {
    const attrs = [...titleAttrs, h.Href(config.titleHref)];
    if (config.onTitleClick !== undefined) attrs.push(h.OnClick(config.onTitleClick));
    title = h.a(attrs, [config.title]);
  } else if (config.onTitleClick !== undefined) {
    title = h.button(
      [...titleAttrs, h.Type("button"), h.OnClick(config.onTitleClick)],
      [config.title],
    );
  } else {
    title = h.span(titleAttrs, [config.title]);
  }

  const children: Array<Html | string> = [
    h.div(slotAttrs(config.slotProps?.brand, h, styles.brand), [...(config.leading ?? []), title]),
  ];
  if (config.breadcrumb !== undefined) {
    children.push(
      h.div(slotAttrs(config.slotProps?.navigation, h, styles.navigation), [
        Breadcrumb.view(config.breadcrumb, h),
      ]),
    );
  }
  const end: Array<Html | string> = [];
  if (config.status !== undefined) {
    end.push(h.div(slotAttrs(config.slotProps?.status, h, styles.status), config.status));
  }
  if (config.actions !== undefined) {
    end.push(h.div(slotAttrs(config.slotProps?.actions, h, styles.actions), config.actions));
  }
  if (end.length > 0) children.push(h.div(sxAttrs(h, styles.end), end));

  return h.header(
    rootAttrs(
      config,
      h,
      styles.root,
      config.breadcrumb === undefined && styles.withoutNavigation,
      config.sticky === true && styles.sticky,
    ),
    children,
  );
};
