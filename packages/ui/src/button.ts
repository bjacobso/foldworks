import * as Keyboard from "@foldworks/keyboard";
import type { LucideIconData } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Button } from "@foldkit/ui";

import * as Icon from "./icon";
import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { buttonStyles } from "./styles";

/** `link` looks like inline link text but keeps button semantics and `onClick`. */
export type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type Size = "xs" | "sm" | "md" | "lg" | "icon";

export type Slot = "root" | "startIcon" | "label" | "endIcon";
export type Element = "button" | "label";

export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    label?: string;
    command?: Readonly<{
      definition: Keyboard.Binding;
      platform: Keyboard.Platform;
      toMessage: (id: string) => Message;
    }>;
    icon?: LucideIconData;
    trailingIcon?: LucideIconData;
    onClick?: Message;
    variant?: Variant;
    size?: Size;
    isDisabled?: boolean;
    isFullWidth?: boolean;
    ariaLabel?: string;
    /** Render a label-shaped trigger, for example around a visually hidden file input. */
    as?: Element;
    /** Additional children, such as the input owned by a label-shaped trigger. */
    children?: ReadonlyArray<Html | string>;
  }>;

const variantStyle = (variant: Variant) => {
  switch (variant) {
    case "primary":
      return buttonStyles.primary;
    case "secondary":
      return buttonStyles.secondary;
    case "outline":
      return buttonStyles.outline;
    case "ghost":
      return buttonStyles.ghost;
    case "danger":
      return buttonStyles.danger;
    case "link":
      return buttonStyles.link;
  }
};

const sizeStyle = (size: Size) => {
  switch (size) {
    case "xs":
      return buttonStyles.xs;
    case "sm":
      return buttonStyles.sm;
    case "md":
      return buttonStyles.md;
    case "lg":
      return buttonStyles.lg;
    case "icon":
      return buttonStyles.icon;
  }
};

const iconSize = (size: Size): number => (size === "xs" ? 12 : size === "sm" ? 14 : 16);

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  if (config.command) {
    const { definition, platform, toMessage } = config.command;
    const { command: _command, ...rest } = config;
    return view(
      {
        ...rest,
        label: definition.label,
        isDisabled: definition.isDisabled ?? false,
        onClick: toMessage(definition.id),
        attributes: [
          ...(config.attributes ?? []),
          h.AriaKeyshortcuts(Keyboard.aria(definition.shortcut, platform)),
          h.Title(`${definition.label} (${Keyboard.display(definition.shortcut, platform)})`),
        ],
      },
      h,
    );
  }
  const variant = config.variant ?? "primary";
  const size = config.size ?? "md";
  return Button.view(
    {
      ...(config.onClick === undefined ? {} : { onClick: config.onClick }),
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      toView: ({ button }) => {
        const attributes = [
          ...button,
          ...rootAttrs(
            config,
            h,
            buttonStyles.base,
            variantStyle(variant),
            sizeStyle(size),
            variant === "link" && buttonStyles.linkShape,
            config.isFullWidth === true && buttonStyles.fullWidth,
            config.isDisabled === true && buttonStyles.disabled,
          ),
          ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
        ];
        const children = [
          ...(config.icon === undefined
            ? []
            : [
                h.span(slotAttrs(config.slotProps?.startIcon, h), [
                  Icon.view({ icon: config.icon, size: iconSize(size) }, h),
                ]),
              ]),
          ...(config.label === undefined
            ? []
            : [h.span(slotAttrs(config.slotProps?.label, h), [config.label])]),
          ...(config.trailingIcon === undefined
            ? []
            : [
                h.span(slotAttrs(config.slotProps?.endIcon, h), [
                  Icon.view({ icon: config.trailingIcon, size: iconSize(size) }, h),
                ]),
              ]),
          ...(config.children ?? []),
        ];
        return config.as === "label"
          ? h.label(attributes, children)
          : h.button(attributes, children);
      },
    },
    h,
  );
};

export type IconSize = "xs" | "sm" | "md" | "lg";

export type IconViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, "root" | "startIcon"> &
  Readonly<{
    icon: LucideIconData;
    /** Required accessible name, such as "Previous page" or "Zoom in". */
    label: string;
    onClick?: Message;
    /** Defaults to `ghost`, the usual treatment for toolbar tools. */
    variant?: Exclude<Variant, "link">;
    size?: IconSize;
    isDisabled?: boolean;
  }>;

const iconShape = (size: IconSize) => {
  switch (size) {
    case "xs":
      return buttonStyles.iconXs;
    case "sm":
      return buttonStyles.iconSm;
    case "md":
      return buttonStyles.icon;
    case "lg":
      return buttonStyles.iconLg;
  }
};

/** A square, icon-only button for tools such as ‹ › − +. The label becomes its accessible name. */
export const icon = <Message>(config: IconViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  if (config.label.trim() === "") throw new Error("Button.icon requires a non-empty label.");
  const size = config.size ?? "md";
  return view(
    {
      icon: config.icon,
      ariaLabel: config.label,
      variant: config.variant ?? "ghost",
      size,
      ...(config.onClick === undefined ? {} : { onClick: config.onClick }),
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      ...(config.slotProps?.startIcon === undefined
        ? {}
        : { slotProps: { startIcon: config.slotProps.startIcon } }),
      attributes: [...(config.attributes ?? []), ...(config.slotProps?.root?.attributes ?? [])],
      sx: [iconShape(size), config.sx, config.slotProps?.root?.sx],
    },
    h,
  );
};
