import type { LucideIconData } from "@lucide/icons";
import type * as stylex from "@stylexjs/stylex";
import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

import { Button } from "@foldkit/ui";

import * as Icon from "./icon";
import { buttonStyles } from "./styles";
import { sxAttrs } from "./sx";

export type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type Size = "sm" | "md" | "icon";

export type ViewConfig<Message> = Readonly<{
  label?: string;
  icon?: LucideIconData;
  trailingIcon?: LucideIconData;
  onClick?: Message;
  variant?: Variant;
  size?: Size;
  isDisabled?: boolean;
  isFullWidth?: boolean;
  ariaLabel?: string;
  attributes?: ReadonlyArray<Attribute<Message>>;
  style?: stylex.StyleXStyles;
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
    case "sm": return buttonStyles.sm;
    case "md": return buttonStyles.md;
    case "icon": return buttonStyles.icon;
  }
};

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const variant = config.variant ?? "primary";
  const size = config.size ?? "md";
  return Button.view(
    {
      ...(config.onClick === undefined ? {} : { onClick: config.onClick }),
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      toView: ({ button }) => h.button(
        [
          ...button,
          ...(config.attributes ?? []),
          ...sxAttrs(
            h,
            buttonStyles.base,
            variantStyle(variant),
            sizeStyle(size),
            config.style,
            config.isFullWidth === true && buttonStyles.fullWidth,
            config.isDisabled === true && buttonStyles.disabled,
          ),
          ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
        ],
        [
          ...(config.icon === undefined
            ? []
            : [Icon.view({ icon: config.icon, size: 16 }, h)]),
          ...(config.label === undefined ? [] : [config.label]),
          ...(config.trailingIcon === undefined
            ? []
            : [Icon.view({ icon: config.trailingIcon, size: 16 }, h)]),
        ],
      ),
    },
    h,
  );
};
