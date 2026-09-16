import { X } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Icon from "./icon";
import { styledAttrs, type Children, type StyledConfig } from "./catalog.shared";
import { primitiveStyles as styles } from "./primitive.styles";
import { sxAttrs } from "./sx";

export type Tone = "neutral" | "success" | "danger";

export type ViewConfig<Message> = StyledConfig<Message> & Readonly<{
  label: string;
  media?: Children;
  tone?: Tone;
  isSelected?: boolean;
  isDisabled?: boolean;
  onSelect?: Message;
  onRemove?: Message;
  removeLabel?: string;
}>;

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const label = config.onSelect === undefined
    ? h.span([], [config.label])
    : h.button([
        ...sxAttrs(h, styles.tagButton), h.Type("button"), h.AriaPressed(String(config.isSelected === true)),
        h.Disabled(config.isDisabled === true), h.OnClick(config.onSelect),
      ], [config.label]);
  return h.span(styledAttrs(config, h, styles.tag,
    config.isSelected === true && styles.tagSelected,
    config.tone === "success" && styles.tagSuccess,
    config.tone === "danger" && styles.tagDanger), [
    ...(config.media ?? []), label,
    ...(config.onRemove === undefined ? [] : [h.button([
      ...sxAttrs(h, styles.tagRemove), h.Type("button"), h.Disabled(config.isDisabled === true),
      h.AriaLabel(config.removeLabel ?? `Remove ${config.label}`), h.OnClick(config.onRemove),
    ], [Icon.view({ icon: X, size: 12 }, h)])]),
  ]);
};

export const Tag = { view } as const;
