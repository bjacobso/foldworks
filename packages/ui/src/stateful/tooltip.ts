import type * as Tooltip from "@foldkit/ui/tooltip";
import type { Html, HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "../catalog.shared";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/tooltip";

export type Slot = "root" | "trigger" | "panel";

export type StyledViewInputs<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  trigger: Children;
  label: string | Children;
  ariaLabel?: string;
  isDisabled?: boolean;
  anchor?: Tooltip.AnchorConfig;
  /** Replace the default button while retaining every tooltip behavior attribute. */
  renderTrigger?: (attributes: Tooltip.RenderInfo["trigger"], children: Children, h: HtmlBuilder<Message>) => Html;
}>;

export const styledViewInputs = <Message>(config: StyledViewInputs<Message>, h: HtmlBuilder<Message>): Tooltip.ViewInputs => ({
  anchor: Layer.anchor({ placement: "top", gap: 6, ...config.anchor }),
  ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
  ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
  toView: ({ trigger, panel, isVisible }) => h.span(rootAttrs(config, h, styles.layerRoot), [
    ...(config.renderTrigger === undefined
      ? [h.button([...trigger, ...slotAttrs(config.slotProps?.trigger, h,
          catalogStyles.toggle, catalogStyles.focusable)], config.trigger)]
      : [config.renderTrigger(trigger, config.trigger, h)]),
    ...(isVisible ? [h.span([...panel, ...slotAttrs(config.slotProps?.panel, h,
      catalogStyles.tooltip, styles.tooltipPanel)], typeof config.label === "string" ? [config.label] : config.label)] : []),
  ]),
});
