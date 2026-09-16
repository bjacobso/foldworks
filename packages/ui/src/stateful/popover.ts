import type * as Popover from "@foldkit/ui/popover";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import { rootAttrs, slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "../catalog.shared";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/popover";

export type Slot = "root" | "trigger" | "backdrop" | "panel" | "arrow";

export type StyledViewInputs<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  trigger: Children; content: Children; ariaLabel?: string; isDisabled?: boolean;
  anchor?: Popover.AnchorConfig; focusSelector?: string; showArrow?: boolean;
}>;

export const styledViewInputs = <Message>(config: StyledViewInputs<Message>, h: HtmlBuilder<Message>): Popover.ViewInputs => ({
  anchor: Layer.anchor(config.anchor),
  ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
  ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
  ...(config.focusSelector === undefined ? {} : { focusSelector: config.focusSelector }),
  ...(config.showArrow === true ? { arrowPadding: 8 } : {}),
  toView: ({ button, panel, backdrop, arrow, isVisible }) => h.span(rootAttrs(config, h, styles.layerRoot), [
    h.button([...button, ...slotAttrs(config.slotProps?.trigger, h,
      catalogStyles.toggle, catalogStyles.focusable)], config.trigger),
    ...(isVisible ? [
      h.div([...backdrop, ...slotAttrs(config.slotProps?.backdrop, h, styles.layerBackdrop)]),
      h.div([...panel, h.Role("dialog"), h.AriaLabel(config.ariaLabel ?? "Popover"),
        ...slotAttrs(config.slotProps?.panel, h, styles.layerPanel, styles.transition)], [
        ...config.content,
        ...(config.showArrow === true
          ? [h.span([...arrow, ...slotAttrs(config.slotProps?.arrow, h, styles.layerArrow)])]
          : []),
      ]),
    ] : []),
  ]),
});
