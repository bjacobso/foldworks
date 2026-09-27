import type { Html, HtmlBuilder } from "foldkit/html";

import { hasAdornments, optionAdornments, type AdornedOption } from "./adornments";
import { catalogStyles } from "./catalog.styles";
import { rootAttrs, slotAttrs, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import { segmentedStyles } from "./styles";

export type Slot = "root" | "item" | "count" | "badge" | "attention";

export type Option<Value extends string> = AdornedOption &
  Readonly<{
    value: Value;
    label: string;
    isDisabled?: boolean;
  }>;

export type ViewConfig<Message, Value extends string> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    value: Value;
    options: ReadonlyArray<Option<Value>>;
    onChange: (value: Value) => Message;
    ariaLabel: string;
  }>;

export const view = <Message, Value extends string>(
  config: ViewConfig<Message, Value>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      ...rootAttrs<Message>(config, h, segmentedStyles.root),
      h.Role("group"),
      h.AriaLabel(config.ariaLabel),
    ],
    config.options.map((option) =>
      h.button(
        [
          h.Type("button"),
          ...slotAttrs<Message>(
            config.slotProps?.item,
            h,
            segmentedStyles.item,
            hasAdornments(option) && catalogStyles.withAdornments,
            option.value === config.value && segmentedStyles.active,
            option.needsAttention === true && segmentedStyles.attention,
            option.isDisabled === true && segmentedStyles.disabled,
          ),
          h.AriaPressed(option.value === config.value ? "true" : "false"),
          ...(option.needsAttention === true ? [h.DataAttribute("attention", "true")] : []),
          ...(option.isDisabled === true
            ? [h.Disabled(true)]
            : [h.OnClick(config.onChange(option.value))]),
        ],
        [option.label, ...optionAdornments<Message>(option, config.slotProps, h)],
      ),
    ),
  );
