import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { sxAttrs } from "./sx";

type DialogConfig<Message> = StyledConfig<Message> & Readonly<{
  id: string;
  title: string;
  description?: string;
  children: Children;
  footer?: Children;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => Message;
  initialFocusId?: string;
}>;

const dialogView = <Message>(
  config: DialogConfig<Message>,
  h: HtmlBuilder<Message>,
  kind: "dialog" | "alertdialog" = "dialog",
  placement: "center" | "sheet" | "drawer" = "center",
): Html => h.dialog(
  [
    ...styledAttrs(config, h, styles.dialog),
    h.Id(config.id),
    h.Open(config.isOpen),
    h.Role(kind),
    h.AriaModal(true),
    h.AriaLabelledBy(`${config.id}-title`),
    ...(config.description === undefined ? [] : [h.AriaDescribedBy(`${config.id}-description`)]),
    h.OnCancel(config.onOpenChange(false)),
  ],
  [h.div([
    ...sxAttrs(h, styles.overlay),
    ...(placement === "sheet" ? [h.Style({ justifyContent: "flex-end", padding: "0" })] : []),
    ...(placement === "drawer" ? [h.Style({ alignItems: "flex-end", padding: "0" })] : []),
  ], [
    h.button([
      ...sxAttrs(h, styles.dialogBackdrop),
      h.Type("button"),
      h.AriaLabel(`Close ${config.title}`),
      h.OnClick(config.onOpenChange(false)),
    ]),
    h.section([
      ...sxAttrs(
        h,
        styles.dialogPanel,
        placement === "sheet" && styles.sheetPanel,
        placement === "drawer" && styles.drawerPanel,
      ),
    ], [
      h.header(sxAttrs(h, styles.dialogHeader), [
        h.h2([h.Id(`${config.id}-title`), ...sxAttrs(h, styles.title)], [config.title]),
        ...(config.description === undefined
          ? []
          : [h.p([h.Id(`${config.id}-description`), ...sxAttrs(h, styles.description)], [config.description])]),
      ]),
      ...config.children,
      ...(config.footer === undefined ? [] : [h.footer(sxAttrs(h, styles.dialogFooter), config.footer)]),
    ]),
  ])],
);

/** @deprecated Use Stateful.Dialog for modal focus management and cleanup. */
const dialog = <Message>(config: DialogConfig<Message>, h: HtmlBuilder<Message>): Html =>
  dialogView(config, h);

const alertDialog = <Message>(config: DialogConfig<Message>, h: HtmlBuilder<Message>): Html =>
  dialogView(config, h, "alertdialog");

const sheet = <Message>(config: DialogConfig<Message>, h: HtmlBuilder<Message>): Html =>
  dialogView(config, h, "dialog", "sheet");

const drawer = <Message>(config: DialogConfig<Message>, h: HtmlBuilder<Message>): Html =>
  dialogView(config, h, "dialog", "drawer");

type FloatingConfig<Message> = StyledConfig<Message> & Readonly<{
  id: string;
  trigger: Children;
  content: Children;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => Message;
  ariaLabel?: string;
}>;

const popover = <Message>(
  config: FloatingConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(styledAttrs(config, h), [
  h.button([
    ...sxAttrs(h, styles.toggle, styles.focusable),
    h.Type("button"),
    h.AriaExpanded(config.isOpen),
    h.AriaControls(`${config.id}-content`),
    h.AriaHasPopup("dialog"),
    h.OnClick(config.onOpenChange(!config.isOpen)),
  ], config.trigger),
  ...(config.isOpen
    ? [h.div([
        ...sxAttrs(h, styles.floating),
        h.Id(`${config.id}-content`),
        h.Role("dialog"),
        ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
      ], config.content)]
    : []),
]);

const hoverCard = <Message>(
  config: FloatingConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  [
    ...styledAttrs(config, h),
    h.OnMouseEnter(config.onOpenChange(true)),
    h.OnMouseLeave(config.onOpenChange(false)),
  ],
  [
    h.span([h.Tabindex(0), h.AriaDescribedBy(`${config.id}-content`)], config.trigger),
    ...(config.isOpen
      ? [h.div([...sxAttrs(h, styles.floating), h.Id(`${config.id}-content`), h.Role("tooltip")], config.content)]
      : []),
  ],
);

const tooltip = <Message>(
  config: StyledConfig<Message> & Readonly<{
    id: string;
    trigger: Children;
    label: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.span(
  [
    ...styledAttrs(config, h),
    ...(config.onOpenChange === undefined ? [] : [
      h.OnMouseEnter(config.onOpenChange(true)),
      h.OnMouseLeave(config.onOpenChange(false)),
    ]),
  ],
  [
    h.span([h.Tabindex(0), h.AriaDescribedBy(config.id)], config.trigger),
    ...(config.isOpen === true
      ? [h.span([...sxAttrs(h, styles.tooltip), h.Id(config.id), h.Role("tooltip")], [config.label])]
      : []),
  ],
);

export const AlertDialog = { view: alertDialog } as const;
export const Dialog = { view: dialog } as const;
export const Drawer = { view: drawer } as const;
export const HoverCard = { view: hoverCard } as const;
export const Popover = { view: popover } as const;
export const Sheet = { view: sheet } as const;
export const Tooltip = { view: tooltip } as const;
