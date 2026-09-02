import type { Html, HtmlBuilder } from "foldkit/html";

import { layoutStyles } from "./styles";
import { sxAttrs } from "./sx";

export type Gap = "xs" | "sm" | "md" | "lg";

const gapStyle = (gap: Gap) => {
  switch (gap) {
    case "xs": return layoutStyles.gapXs;
    case "sm": return layoutStyles.gapSm;
    case "md": return layoutStyles.gapMd;
    case "lg": return layoutStyles.gapLg;
  }
};

export const stack = <Message>(
  config: Readonly<{ children: ReadonlyArray<Html | string>; gap?: Gap }>,
  h: HtmlBuilder<Message>,
): Html => h.div(sxAttrs(h, layoutStyles.stack, gapStyle(config.gap ?? "md")), config.children);

export const row = <Message>(
  config: Readonly<{
    children: ReadonlyArray<Html | string>;
    gap?: Gap;
    align?: "center" | "start";
    justify?: "start" | "between";
    wrap?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.div(
  sxAttrs(
    h,
    layoutStyles.row,
    gapStyle(config.gap ?? "md"),
    config.align === "start" && layoutStyles.start,
    config.justify === "between" && layoutStyles.between,
    config.wrap === true && layoutStyles.wrap,
  ),
  config.children,
);
