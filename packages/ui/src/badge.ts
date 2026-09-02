import type { Html, HtmlBuilder } from "foldkit/html";

import { badgeStyles } from "./styles";
import { sxAttrs } from "./sx";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const view = <Message>(
  config: Readonly<{ label: string; tone?: Tone; dot?: boolean }>,
  h: HtmlBuilder<Message>,
): Html => {
  const tone = config.tone ?? "neutral";
  return h.span(
    sxAttrs(h, badgeStyles.base, badgeStyles[tone]),
    [
      ...(config.dot === true
        ? [h.span([...sxAttrs(h, badgeStyles.dot), h.AriaHidden(true)])]
        : []),
      config.label,
    ],
  );
};
