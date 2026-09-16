import type { Html, HtmlBuilder } from "foldkit/html";

import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { segmentedStyles } from "./styles";

export type Slot = "root" | "item";

export type ViewConfig<Message, Value extends string> =
  StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
    value: Value;
    options: ReadonlyArray<Readonly<{ value: Value; label: string }>>;
    onChange: (value: Value) => Message;
    ariaLabel: string;
  }>;

export const view = <Message, Value extends string>(
  config: ViewConfig<Message, Value>,
  h: HtmlBuilder<Message>,
): Html => h.div([...rootAttrs(config, h, segmentedStyles.root), h.Role("group"), h.AriaLabel(config.ariaLabel)],
  config.options.map((option) => h.button(
    [
      h.Type("button"),
      ...slotAttrs(config.slotProps?.item, h,
        segmentedStyles.item, option.value === config.value && segmentedStyles.active),
      h.AriaPressed(option.value === config.value ? "true" : "false"),
      h.OnClick(config.onChange(option.value)),
    ],
    [option.label],
  )),
);
