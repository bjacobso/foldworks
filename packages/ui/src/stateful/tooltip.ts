import type * as Tooltip from "@foldkit/ui/tooltip";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "../catalog.shared";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/tooltip";

export type Slot = "root" | "trigger" | "panel";

export type StyledViewInputs<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  trigger: Children; label: string; ariaLabel?: string; isDisabled?: boolean; anchor?: Tooltip.AnchorConfig;
}>;

export const styledViewInputs = <Message>(config: StyledViewInputs<Message>, h: HtmlBuilder<Message>): Tooltip.ViewInputs => ({
  anchor: Layer.anchor({ placement: "top", gap: 6, ...config.anchor }),
  ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
  ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
  toView: ({ trigger, panel, isVisible }) => h.span(rootAttrs(config, h, styles.layerRoot), [
    h.button([...slotAttrs(config.slotProps?.trigger, h,
      catalogStyles.toggle, catalogStyles.focusable), ...trigger], config.trigger),
    ...(isVisible ? [h.span([...slotAttrs(config.slotProps?.panel, h,
      catalogStyles.tooltip, styles.tooltipPanel), ...panel], [config.label])] : []),
  ]),
});
