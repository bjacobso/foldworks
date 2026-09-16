import type * as Popover from "@foldkit/ui/popover";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import type { Children, StyledConfig } from "../catalog.shared";
import { sxAttrs } from "../sx";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/popover";

export type StyledViewInputs<Message> = StyledConfig<Message> & Readonly<{
  trigger: Children; content: Children; ariaLabel?: string; isDisabled?: boolean;
  anchor?: Popover.AnchorConfig; focusSelector?: string; showArrow?: boolean;
}>;

export const styledViewInputs = <Message>(config: StyledViewInputs<Message>, h: HtmlBuilder<Message>): Popover.ViewInputs => ({
  anchor: Layer.anchor(config.anchor),
  ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
  ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
  ...(config.focusSelector === undefined ? {} : { focusSelector: config.focusSelector }),
  ...(config.showArrow === true ? { arrowPadding: 8 } : {}),
  toView: ({ button, panel, backdrop, arrow, isVisible }) => h.span([
    ...(config.attributes ?? []), ...sxAttrs(h, styles.layerRoot, config.style),
  ], [
    h.button([...button, ...sxAttrs(h, catalogStyles.toggle, catalogStyles.focusable)], config.trigger),
    ...(isVisible ? [
      h.div([...backdrop, ...sxAttrs(h, styles.layerBackdrop)]),
      h.div([...panel, h.Role("dialog"), h.AriaLabel(config.ariaLabel ?? "Popover"), ...sxAttrs(h, styles.layerPanel, styles.transition)], [
        ...config.content,
        ...(config.showArrow === true ? [h.span([...arrow, ...sxAttrs(h, styles.layerArrow)])] : []),
      ]),
    ] : []),
  ]),
});
