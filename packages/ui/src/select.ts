import type { Html, HtmlBuilder } from "foldkit/html";

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
