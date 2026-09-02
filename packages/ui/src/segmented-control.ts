import type { Html, HtmlBuilder } from "foldkit/html";

import { segmentedStyles } from "./styles";
import { sxAttrs } from "./sx";

export const view = <Message, Value extends string>(
  config: Readonly<{
    value: Value;
    options: ReadonlyArray<Readonly<{ value: Value; label: string }>>;
    onChange: (value: Value) => Message;
    ariaLabel: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div([...sxAttrs(h, segmentedStyles.root), h.Role("group"), h.AriaLabel(config.ariaLabel)],
  config.options.map((option) => h.button(
    [
      h.Type("button"),
      ...sxAttrs(h, segmentedStyles.item, option.value === config.value && segmentedStyles.active),
      h.AriaPressed(option.value === config.value ? "true" : "false"),
      h.OnClick(config.onChange(option.value)),
    ],
    [option.label],
  )),
);
