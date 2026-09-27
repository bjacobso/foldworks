import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "./catalog.styles";
import {
  rootAttrs,
  slotAttrs,
  styledAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { denseStyles } from "./dense.styles";
import { sxAttrs } from "./sx";
import { tooltipMarker } from "./tokens.stylex.js";

type DialogConfig<Message> = StyledConfig<Message> &
  Readonly<{
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
): Html =>
  h.dialog(
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
    [
      h.div(
        [
          ...sxAttrs(h, styles.overlay),
          ...(placement === "sheet" ? [h.Style({ justifyContent: "flex-end", padding: "0" })] : []),
          ...(placement === "drawer" ? [h.Style({ alignItems: "flex-end", padding: "0" })] : []),
        ],
        [
          h.button([
            ...sxAttrs(h, styles.dialogBackdrop),
            h.Type("button"),
            h.AriaLabel(`Close ${config.title}`),
            h.OnClick(config.onOpenChange(false)),
          ]),
          h.section(
            [
              ...sxAttrs(
                h,
                styles.dialogPanel,
                placement === "sheet" && styles.sheetPanel,
                placement === "drawer" && styles.drawerPanel,
              ),
            ],
            [
              h.header(sxAttrs(h, styles.dialogHeader), [
                h.h2([h.Id(`${config.id}-title`), ...sxAttrs(h, styles.title)], [config.title]),
                ...(config.description === undefined
                  ? []
                  : [
                      h.p(
                        [h.Id(`${config.id}-description`), ...sxAttrs(h, styles.description)],
                        [config.description],
                      ),
                    ]),
              ]),
              ...config.children,
              ...(config.footer === undefined
                ? []
                : [h.footer(sxAttrs(h, styles.dialogFooter), config.footer)]),
            ],
          ),
        ],
      ),
    ],
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

type FloatingConfig<Message> = StyledConfig<Message> &
  Readonly<{
    id: string;
    trigger: Children;
    content: Children;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => Message;
    ariaLabel?: string;
  }>;

const popover = <Message>(config: FloatingConfig<Message>, h: HtmlBuilder<Message>): Html =>
  h.div(styledAttrs(config, h), [
    h.button(
      [
        ...sxAttrs(h, styles.toggle, styles.focusable),
        h.Type("button"),
        h.AriaExpanded(config.isOpen),
        h.AriaControls(`${config.id}-content`),
        h.AriaHasPopup("dialog"),
        h.OnClick(config.onOpenChange(!config.isOpen)),
      ],
      config.trigger,
    ),
    ...(config.isOpen
      ? [
          h.div(
            [
              ...sxAttrs(h, styles.floating),
              h.Id(`${config.id}-content`),
              h.Role("dialog"),
              ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
            ],
            config.content,
          ),
        ]
      : []),
  ]);

const hoverCard = <Message>(config: FloatingConfig<Message>, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      ...styledAttrs(config, h),
      h.OnMouseEnter(config.onOpenChange(true)),
      h.OnMouseLeave(config.onOpenChange(false)),
    ],
    [
      h.span([h.Tabindex(0), h.AriaDescribedBy(`${config.id}-content`)], config.trigger),
      ...(config.isOpen
        ? [
            h.div(
              [...sxAttrs(h, styles.floating), h.Id(`${config.id}-content`), h.Role("tooltip")],
              config.content,
            ),
          ]
        : []),
    ],
  );

type TooltipContent = Readonly<{
  trigger: Children;
  /** Plain-text description. Line breaks are preserved. */
  label: string;
}>;

/** Parent-owned visibility: the application stores `isOpen` and handles `onOpenChange`. */
export type ControlledTooltipConfig<Message> = StyledConfig<Message> &
  TooltipContent &
  Readonly<{
    mode?: "controlled";
    id: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => Message;
  }>;

export type TooltipPlacement = "top" | "bottom" | "start" | "end";

export type StatelessTooltipSlot = "root" | "trigger" | "panel";

/**
 * CSS-driven visibility for dense content: the panel shows while the root is
 * hovered or contains focus, so the model holds no tooltip state.
 */
export type StatelessTooltipConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, StatelessTooltipSlot> &
  TooltipContent &
  Readonly<{
    mode: "stateless";
    /**
     * Links the trigger to the panel with `aria-describedby`. Without an id the
     * label is exposed through `aria-description` instead.
     */
    id?: string;
    placement?: TooltipPlacement;
    /** Make the default trigger wrapper a tab stop. Defaults to `true`. */
    isFocusable?: boolean;
    /**
     * Render a custom trigger, such as a button, that owns focus. Spread the
     * description attributes onto the focusable element.
     */
    renderTrigger?: (
      attributes: ReadonlyArray<Attribute<Message> | ChildAttribute>,
      children: Children,
      h: HtmlBuilder<Message>,
    ) => Html;
  }>;

export type TooltipConfig<Message> =
  | ControlledTooltipConfig<Message>
  | StatelessTooltipConfig<Message>;

const placementStyles = {
  top: denseStyles.tooltipTop,
  bottom: denseStyles.tooltipBottom,
  start: denseStyles.tooltipStart,
  end: denseStyles.tooltipEnd,
} as const;

const statelessTooltip = <Message>(
  config: StatelessTooltipConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const description: ReadonlyArray<Attribute<Message>> =
    config.id === undefined ? [h.AriaDescription(config.label)] : [h.AriaDescribedBy(config.id)];
  return h.span(rootAttrs(config, h, denseStyles.tooltipRoot, tooltipMarker), [
    config.renderTrigger === undefined
      ? h.span(
          [
            ...slotAttrs(
              config.slotProps?.trigger,
              h,
              denseStyles.tooltipTrigger,
              styles.focusable,
            ),
            ...(config.isFocusable === false ? [] : [h.Tabindex(0)]),
            ...description,
          ],
          config.trigger,
        )
      : config.renderTrigger(
          [
            ...slotAttrs(
              config.slotProps?.trigger,
              h,
              denseStyles.tooltipTrigger,
              styles.focusable,
            ),
            ...description,
          ],
          config.trigger,
          h,
        ),
    h.span(
      [
        ...slotAttrs(
          config.slotProps?.panel,
          h,
          styles.tooltip,
          denseStyles.tooltipPanel,
          placementStyles[config.placement ?? "top"],
        ),
        ...(config.id === undefined ? [h.AriaHidden(true)] : [h.Id(config.id), h.Role("tooltip")]),
      ],
      [config.label],
    ),
  ]);
};

const tooltip = <Message>(config: TooltipConfig<Message>, h: HtmlBuilder<Message>): Html => {
  if (config.mode === "stateless") return statelessTooltip(config, h);
  return h.span(
    [
      ...styledAttrs(config, h),
      ...(config.onOpenChange === undefined
        ? []
        : [h.OnMouseEnter(config.onOpenChange(true)), h.OnMouseLeave(config.onOpenChange(false))]),
    ],
    [
      h.span([h.Tabindex(0), h.AriaDescribedBy(config.id)], config.trigger),
      ...(config.isOpen === true
        ? [
            h.span(
              [...sxAttrs(h, styles.tooltip), h.Id(config.id), h.Role("tooltip")],
              [config.label],
            ),
          ]
        : []),
    ],
  );
};

export const AlertDialog = { view: alertDialog } as const;
export const Dialog = { view: dialog } as const;
export const Drawer = { view: drawer } as const;
export const HoverCard = { view: hoverCard } as const;
export const Popover = { view: popover } as const;
export const Sheet = { view: sheet } as const;
export const Tooltip = { view: tooltip } as const;
