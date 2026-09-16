import type * as Tooltip from "@foldkit/ui/tooltip";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles } from "../catalog.styles";
import type { Children, StyledConfig } from "../catalog.shared";
import { sxAttrs } from "../sx";
import { statefulStyles as styles } from "../stateful.styles";
import * as Layer from "./layer";

export * from "@foldkit/ui/tooltip";

export type StyledViewInputs<Message> = StyledConfig<Message> & Readonly<{
  trigger: Children; label: string; ariaLabel?: string; isDisabled?: boolean; anchor?: Tooltip.AnchorConfig;
}>;

export const styledViewInputs = <Message>(config: StyledViewInputs<Message>, h: HtmlBuilder<Message>): Tooltip.ViewInputs => ({
  anchor: Layer.anchor({ placement: "top", gap: 6, ...config.anchor }),
  ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
  ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
  toView: ({ trigger, panel, isVisible }) => h.span([
    ...(config.attributes ?? []), ...sxAttrs(h, styles.layerRoot, config.style),
  ], [
    h.button([...trigger, ...sxAttrs(h, catalogStyles.toggle, catalogStyles.focusable)], config.trigger),
    ...(isVisible ? [h.span([...panel, ...sxAttrs(h, catalogStyles.tooltip, styles.tooltipPanel)], [config.label])] : []),
  ]),
});
