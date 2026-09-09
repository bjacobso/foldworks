import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "./catalog.styles";
import { fieldStyles } from "./styles";
import { sxAttrs } from "./sx";

export const control = <Message>(
  config: Readonly<{
    value: string;
    options: ReadonlyArray<Readonly<{ value: string; label: string }>>;
    onChange: (value: string) => Message;
    ariaLabel: string;
    isDisabled?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.select(
  [
    ...sxAttrs(h, fieldStyles.control, fieldStyles.selectControl),
    h.Value(config.value),
    h.AriaLabel(config.ariaLabel),
    h.OnChange(config.onChange),
    ...(config.isDisabled === true ? [h.Disabled(true)] : []),
  ],
  config.options.map((option) => h.option(
    [h.Value(option.value), h.Selected(option.value === config.value)],
    [option.label],
  )),
);

/** @deprecated Use Stateful.Select for custom dropdowns, or control for a native select. */
export const view = <Message>(
  config: Readonly<{
    id: string;
    value: string;
    options: ReadonlyArray<Readonly<{ value: string; label: string; isDisabled?: boolean }>>;
    onChange: (value: string) => Message;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => Message;
    ariaLabel: string;
    isDisabled?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const selected = config.options.find((option) => option.value === config.value);
  return h.div([], [
    h.button([
      ...sxAttrs(h, fieldStyles.control, catalogStyles.focusable),
      h.Type("button"),
      h.AriaLabel(config.ariaLabel),
      h.AriaHasPopup("listbox"),
      h.AriaExpanded(config.isOpen),
      h.AriaControls(`${config.id}-listbox`),
      h.Disabled(config.isDisabled === true),
      h.OnClick(config.onOpenChange(!config.isOpen)),
    ], [selected?.label ?? "Select an option"]),
    ...(config.isOpen
      ? [h.div([
          ...sxAttrs(h, catalogStyles.floating, catalogStyles.menu),
          h.Id(`${config.id}-listbox`),
          h.Role("listbox"),
          h.AriaLabel(config.ariaLabel),
        ], config.options.map((option) => h.button([
          ...sxAttrs(h, catalogStyles.menuItem, catalogStyles.focusable),
          h.Type("button"),
          h.Role("option"),
          h.AriaSelected(option.value === config.value),
          h.Disabled(option.isDisabled === true),
          h.OnClick(config.onChange(option.value)),
        ], [option.label])))]
      : []),
  ]);
};
