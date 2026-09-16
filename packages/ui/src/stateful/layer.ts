import type { AnchorConfig, Placement } from "@foldkit/ui/anchor";
import * as stylex from "@stylexjs/stylex";

import { catalogStyles } from "../catalog.styles";
import { statefulStyles } from "../stateful.styles";

export type { AnchorConfig, Placement } from "@foldkit/ui/anchor";

export const anchor = (config: AnchorConfig = {}): AnchorConfig => ({
  placement: config.placement ?? "bottom-start",
  gap: config.gap ?? 6,
  padding: config.padding ?? 8,
  portal: config.portal ?? true,
  ...(config.offset === undefined ? {} : { offset: config.offset }),
  ...(config.isPlacementLocked === undefined ? {} : { isPlacementLocked: config.isPlacementLocked }),
});

export const classNames = {
  root: stylex.props(statefulStyles.layerRoot).className ?? "",
  panel: stylex.props(statefulStyles.layerPanel, statefulStyles.transition).className ?? "",
  backdrop: stylex.props(statefulStyles.layerBackdrop).className ?? "",
  arrow: stylex.props(statefulStyles.layerArrow).className ?? "",
  trigger: stylex.props(catalogStyles.toggle, catalogStyles.focusable).className ?? "",
} as const;

export const placement = (value: Placement): AnchorConfig => anchor({ placement: value });
