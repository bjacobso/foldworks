import * as Menu from "@foldkit/ui/menu";
import * as stylex from "@stylexjs/stylex";
import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import type { Children } from "../catalog.shared";
import { sxAttrs } from "../sx";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/menu";

export type Item<Value extends string> = Readonly<{
  value: Value; label: string; media?: Children; shortcut?: string; group?: string;
  isDisabled?: boolean; isDestructive?: boolean;
}>;
export type StyledViewInputs<Value extends string> = Readonly<{
  items: ReadonlyArray<Item<Value>>; trigger: Children; ariaLabel?: string;
  isDisabled?: boolean; anchor?: Menu.AnchorConfig;
}>;
export type Bundle<Value extends string = string> = Menu.Bundle<Value>;

export const create = <Value extends string = string>(): Bundle<Value> => Menu.create<Value>();

export const styledViewInputs = <Message, Value extends string>(
  config: StyledViewInputs<Value>, h: HtmlBuilder<Message>,
): Menu.ViewInputs<Value> => {
  const byValue = new Map(config.items.map((item) => [item.value, item]));
  return {
    items: config.items.map((item) => item.value),
    buttonContent: h.span(sxAttrs(h, styles.selectButton), config.trigger),
    buttonClassName: Layer.classNames.trigger,
    itemsClassName: stylex.props(styles.layerPanel, styles.transition, styles.menuContent, catalogStyles.menu).className ?? "",
    backdropClassName: Layer.classNames.backdrop,
    className: Layer.classNames.root,
    groupClassName: stylex.props(styles.menuGroup).className ?? "",
    separatorClassName: stylex.props(styles.menuSeparator).className ?? "",
    anchor: Layer.anchor(config.anchor),
    ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
    ...(config.isDisabled === undefined ? {} : { isButtonDisabled: config.isDisabled }),
    isItemDisabled: (value) => byValue.get(value)?.isDisabled === true,
    itemToSearchText: (value) => byValue.get(value)?.label ?? value,
    itemGroupKey: (value) => byValue.get(value)?.group ?? "",
    groupToHeading: (group) => group === "" ? undefined : {
      content: h.span([], [group]), className: stylex.props(catalogStyles.menuLabel).className ?? "",
    },
    itemToConfig: (value, context) => {
      const item = byValue.get(value);
      const content: Html = h.span(sxAttrs(h, styles.selectButton), [
        ...(item?.media ?? []), item?.label ?? value,
        ...(item?.shortcut === undefined ? [] : [h.span(sxAttrs(h, styles.menuShortcut), [item.shortcut])]),
      ]);
      return {
        content,
        className: stylex.props(catalogStyles.menuItem, styles.selectItem,
          context.isActive && styles.activeItem, context.isDisabled && styles.disabled,
          item?.isDestructive === true && styles.destructiveItem).className ?? "",
      };
    },
  };
};
