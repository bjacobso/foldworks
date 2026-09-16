import * as Combobox from "@foldkit/ui/combobox";
import * as stylex from "@stylexjs/stylex";
import { Check, ChevronsUpDown } from "@lucide/icons";
import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import * as Icon from "../icon";
import { fieldStyles } from "../styles";
import { sxAttrs } from "../sx";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/combobox";

export type OptionItem<Value extends string> = Readonly<{
  value: Value; label: string; keywords?: ReadonlyArray<string>; group?: string; isDisabled?: boolean;
}>;

type Common<Value extends string> = Readonly<{
  options: ReadonlyArray<OptionItem<Value>>; query?: string; placeholder?: string;
  ariaLabel: string; isDisabled?: boolean; isReadOnly?: boolean; isInvalid?: boolean;
  name?: string; openOnFocus?: boolean; shouldFilter?: boolean; anchor?: Layer.AnchorConfig;
}>;
export type StyledViewInputs<Value extends string> = Common<Value> & Readonly<{ value?: Value }>;
export type MultiStyledViewInputs<Value extends string> = Common<Value> & Readonly<{ values: ReadonlyArray<Value> }>;
export type Bundle<Value extends string = string> = Combobox.Bundle<Value>;

export const score = (option: OptionItem<string>, query: string): number => {
  const search = query.trim().toLocaleLowerCase();
  if (search === "") return 1;
  const values = [option.label, ...(option.keywords ?? [])].map((value) => value.toLocaleLowerCase());
  if (values.some((value) => value === search)) return 4;
  if (values.some((value) => value.startsWith(search))) return 3;
  if (values.some((value) => value.split(/\s+/).some((word) => word.startsWith(search)))) return 2;
  return values.some((value) => value.includes(search)) ? 1 : 0;
};

export const filterOptions = <Value extends string>(
  options: ReadonlyArray<OptionItem<Value>>, query: string,
): ReadonlyArray<OptionItem<Value>> => options.map((option, index) => ({ option, index, rank: score(option, query) }))
  .filter(({ rank }) => rank > 0).sort((a, b) => b.rank - a.rank || a.index - b.index).map(({ option }) => option);

const commonInputs = <Message, Value extends string>(config: Common<Value>, h: HtmlBuilder<Message>) => {
  const options = config.shouldFilter === false ? config.options : filterOptions(config.options, config.query ?? "");
  const byValue = new Map(config.options.map((option) => [option.value, option]));
  return {
    items: options.map((option) => option.value),
    itemToValue: (value: Value) => value,
    itemToDisplayText: (value: Value) => byValue.get(value)?.label ?? value,
    isItemDisabled: (value: Value) => byValue.get(value)?.isDisabled === true,
    restingInputValue: "",
    inputPlaceholder: config.placeholder ?? "Search…",
    inputClassName: stylex.props(fieldStyles.control, catalogStyles.focusable, styles.comboboxInput,
      config.isInvalid === true && fieldStyles.invalid).className ?? "",
    inputWrapperClassName: stylex.props(styles.comboboxInputWrapper).className ?? "",
    buttonContent: Icon.view({ icon: ChevronsUpDown, size: 14 }, h),
    buttonClassName: stylex.props(styles.comboboxButton, catalogStyles.focusable).className ?? "",
    itemsClassName: stylex.props(styles.layerPanel, styles.transition, styles.comboboxContent).className ?? "",
    itemsScrollClassName: stylex.props(styles.comboboxScroll).className ?? "",
    backdropClassName: Layer.classNames.backdrop,
    className: stylex.props(styles.comboboxRoot).className ?? "",
    groupClassName: stylex.props(styles.menuGroup).className ?? "",
    separatorClassName: stylex.props(styles.menuSeparator).className ?? "",
    groupToHeading: (group: string) => group === "" ? undefined : {
      content: h.span([], [group]), className: stylex.props(catalogStyles.menuLabel).className ?? "",
    },
    itemGroupKey: (value: Value) => byValue.get(value)?.group ?? "",
    itemToConfig: (value: Value, context: Readonly<{ isActive: boolean; isDisabled: boolean; isReadOnly: boolean; isSelected: boolean }>) => ({
      className: stylex.props(catalogStyles.menuItem, styles.selectItem,
        context.isActive && styles.activeItem, context.isSelected && styles.selectedItem,
        context.isDisabled && styles.disabled).className ?? "",
      content: h.span(sxAttrs(h, styles.selectButton), [
        byValue.get(value)?.label ?? value,
        ...(context.isSelected ? [Icon.view({ icon: Check, size: 14 }, h)] : []),
      ]),
    }),
    anchor: Layer.anchor(config.anchor), ariaLabel: config.ariaLabel,
    ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
    ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
    ...(config.isInvalid === undefined ? {} : { isInvalid: config.isInvalid }),
    ...(config.name === undefined ? {} : { formName: config.name }),
    ...(config.openOnFocus === undefined ? {} : { openOnFocus: config.openOnFocus }),
  };
};

export const create = <Value extends string = string>(): Bundle<Value> => Combobox.create<Value>();

export const styledViewInputs = <Message, Value extends string>(
  config: StyledViewInputs<Value>, h: HtmlBuilder<Message>,
): Combobox.ViewInputs<Value> => {
  const common = commonInputs(config, h);
  const selected = config.options.find((option) => option.value === config.value);
  return {
    ...common,
    restingInputValue: selected?.label ?? "",
    maybeSelectedValue: config.value === undefined ? Option.none() : Option.some(config.value),
  };
};

const multiStyledViewInputs = <Message, Value extends string>(
  config: MultiStyledViewInputs<Value>, h: HtmlBuilder<Message>,
): Combobox.Multi.ViewInputs<Value> => ({ ...commonInputs(config, h), selectedValues: config.values });

export const Multi = {
  Model: Combobox.Multi.Model,
  init: Combobox.Multi.init,
  create: <Value extends string = string>() => Combobox.Multi.create<Value>(),
  styledViewInputs: multiStyledViewInputs,
} as const;
