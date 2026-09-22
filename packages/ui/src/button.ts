import * as Keyboard from "@foldworks/keyboard";
import type { LucideIconData } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Button } from "@foldkit/ui";

import * as Icon from "./icon";
import {
  rootAttrs,
  slotAttrs,
  type StyledConfig,
  type WithSlotProps,
} from "./catalog.shared";
import { buttonStyles } from "./styles";

export type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type Size = "xs" | "sm" | "md" | "lg" | "icon";

export type Slot = "root" | "startIcon" | "label" | "endIcon";
export type Element = "button" | "label";

export type ViewConfig<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  label?: string;
  command?: Readonly<{ definition: Keyboard.Binding; platform: Keyboard.Platform; toMessage: (id: string) => Message }>;
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
    case "primary": return buttonStyles.primary;
    case "secondary": return buttonStyles.secondary;
    case "outline": return buttonStyles.outline;
    case "ghost": return buttonStyles.ghost;
    case "danger": return buttonStyles.danger;
  }
};

const sizeStyle = (size: Size) => {
  switch (size) {
    case "xs": return buttonStyles.xs;
    case "sm": return buttonStyles.sm;
    case "md": return buttonStyles.md;
    case "lg": return buttonStyles.lg;
    case "icon": return buttonStyles.icon;
  }
};

const iconSize = (size: Size): number =>
  size === "xs" ? 12 : size === "sm" ? 14 : 16;

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  if (config.command) {
    const { definition, platform, toMessage } = config.command;
    const { command: _command, ...rest } = config;
    return view({
      ...rest,
      label: definition.label,
      isDisabled: definition.isDisabled ?? false,
      onClick: toMessage(definition.id),
      attributes: [
        ...(config.attributes ?? []),
        h.AriaKeyshortcuts(Keyboard.aria(definition.shortcut, platform)),
        h.Title(`${definition.label} (${Keyboard.display(definition.shortcut, platform)})`),
      ],
    }, h);
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
            config.isFullWidth === true && buttonStyles.fullWidth,
            config.isDisabled === true && buttonStyles.disabled,
          ),
          ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
        ];
        const children = [
          ...(config.icon === undefined
            ? []
            : [h.span(slotAttrs(config.slotProps?.startIcon, h), [
                Icon.view({ icon: config.icon, size: iconSize(size) }, h),
              ])]),
          ...(config.label === undefined
            ? []
            : [h.span(slotAttrs(config.slotProps?.label, h), [config.label])]),
          ...(config.trailingIcon === undefined
            ? []
            : [h.span(slotAttrs(config.slotProps?.endIcon, h), [
                Icon.view({ icon: config.trailingIcon, size: iconSize(size) }, h),
              ])]),
          ...(config.children ?? []),
        ];
        return config.as === "label" ? h.label(attributes, children) : h.button(attributes, children);
      },
    },
    h,
  );
};
