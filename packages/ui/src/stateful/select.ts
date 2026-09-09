import * as Listbox from "@foldkit/ui/listbox";
import * as stylex from "@stylexjs/stylex";
import { Check, ChevronDown } from "@lucide/icons";
import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import * as Icon from "../icon";
import { fieldStyles } from "../styles";
import { sxAttrs } from "../sx";
import { statefulStyles as styles } from "../stateful.styles";

export * from "@foldkit/ui/listbox";

export type SelectOption<Value extends string> = Readonly<{
  value: Value;
  label: string;
  isDisabled?: boolean;
}>;

export type Bundle<Value extends string = string> = Listbox.Bundle<SelectOption<Value>, Value>;
export type ViewInputs<Value extends string = string> = Listbox.ViewInputs<SelectOption<Value>, Value>;

export type StyledViewInputs<Value extends string> = Readonly<{
  options: ReadonlyArray<SelectOption<Value>>;
  value?: Value;
  placeholder?: string;
  ariaLabel: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  name?: string;
  form?: string;
  anchor?: Listbox.AnchorConfig;
}>;

/** Create once per value type; the listbox owns focus/open state, the parent owns selection. */
export const create = <Value extends string = string>(): Bundle<Value> => Listbox.create<SelectOption<Value>, Value>();

export const styledViewInputs = <Message, Value extends string>(
  config: StyledViewInputs<Value>,
  h: HtmlBuilder<Message>,
): ViewInputs<Value> => {
  const selected = config.options.find((option) => option.value === config.value);
  return {
    items: config.options,
    maybeSelectedValue: config.value === undefined ? Option.none() : Option.some(config.value),
    itemToValue: (item) => item.value,
    itemToSearchText: (item) => item.label,
    isItemDisabled: (item) => item.isDisabled === true,
    ariaLabel: config.ariaLabel,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
    ...(config.isInvalid === undefined ? {} : { isInvalid: config.isInvalid }),
    ...(config.name === undefined ? {} : { name: config.name }),
    ...(config.form === undefined ? {} : { form: config.form }),
    anchor: config.anchor ?? { placement: "bottom-start", gap: 4, padding: 8 },
    buttonContent: h.span(sxAttrs(h, styles.selectButton), [
      selected?.label ?? config.placeholder ?? "Select an option",
      Icon.view({ icon: ChevronDown, size: 14 }, h),
    ]),
    buttonClassName: stylex.props(fieldStyles.control, styles.selectButton,
      config.isInvalid === true && fieldStyles.invalid).className ?? "",
    itemsClassName: stylex.props(catalogStyles.floating, catalogStyles.menu,
      styles.selectContent, styles.transition).className ?? "",
    backdropClassName: stylex.props(styles.selectBackdrop).className ?? "",
    className: stylex.props(styles.selectRoot).className ?? "",
    itemToConfig: (item, context) => ({
      // The engine accepts a class for each option. These recipes are static, with no inline values.
      className: stylex.props(catalogStyles.menuItem, styles.selectItem,
        context.isActive && styles.activeItem, context.isSelected && styles.selectedItem,
        context.isDisabled && styles.disabled).className ?? "",
      content: h.span(sxAttrs(h, styles.selectButton), [
        item.label,
        ...(context.isSelected ? [Icon.view({ icon: Check, size: 14 }, h)] : []),
      ]),
    }),
  };
};
