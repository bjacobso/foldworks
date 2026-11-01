import type { HtmlBuilder } from "foldkit/html";
import { citationStyles } from "./citation.styles";
import { slotAttrs, type Children, type StyledConfig, type WithSlotProps } from "./catalog.shared";
import * as Tooltip from "./stateful/tooltip";
import * as Popover from "./stateful/popover";

/** Citation previews use the existing tooltip model, messages, and reducer. */
export { Model, Message, OutMessage, init, update, view } from "./stateful/tooltip";
export type Slot = Tooltip.Slot;
export type ViewConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Slot> &
  Readonly<{
    label: string | number;
    preview: string | Children;
    ariaLabel?: string;
    variant?: "superscript" | "chip";
    onActivate: Message;
    anchor?: Tooltip.AnchorConfig;
  }>;

/** Pass these inputs to `h.submodel({ view: Citation.view, ... })`. */
export const styledViewInputs = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Tooltip.ViewInputs =>
  Tooltip.styledViewInputs(
    {
      ...config,
      trigger: [String(config.label)],
      label: config.preview,
      ariaLabel: config.ariaLabel ?? `Open citation ${config.label}`,
      renderTrigger: (attributes, children) =>
        h.button(
          [
            ...attributes,
            h.Type("button"),
            h.DataAttribute("citation", String(config.label)),
            h.OnClick(config.onActivate),
            ...slotAttrs(
              config.slotProps?.trigger,
              h,
              citationStyles.marker,
              config.variant === "chip" ? citationStyles.chip : citationStyles.superscript,
            ),
          ],
          children,
        ),
    },
    h,
  );

export type PopoverConfig<Message> = StyledConfig<Message> &
  WithSlotProps<Message, Popover.Slot> &
  Readonly<{
    label: string | number;
    preview: Children;
    ariaLabel?: string;
    variant?: "superscript" | "chip";
    onActivate: Message;
    activateLabel?: string;
    anchor?: Popover.AnchorConfig;
  }>;

/** Interactive preview: use Stateful.Popover's model/view; activation is a separate source button. */
export const popoverViewInputs = <Message>(
  config: PopoverConfig<Message>,
  h: HtmlBuilder<Message>,
): Popover.ViewInputs =>
  Popover.styledViewInputs(
    {
      ...config,
      trigger: [String(config.label)],
      ariaLabel: config.ariaLabel ?? `Citation ${config.label}`,
      slotProps: {
        ...config.slotProps,
        trigger: {
          ...config.slotProps?.trigger,
          attributes: [
            ...(config.slotProps?.trigger?.attributes ?? []),
            h.DataAttribute("citation", String(config.label)),
            ...slotAttrs(
              undefined,
              h,
              citationStyles.marker,
              config.variant === "chip" ? citationStyles.chip : citationStyles.superscript,
            ),
          ],
        },
      },
      content: [
        ...config.preview,
        h.button(
          [
            h.Type("button"),
            h.OnClick(config.onActivate),
            ...slotAttrs(undefined, h, citationStyles.marker),
          ],
          [config.activateLabel ?? "Open source"],
        ),
      ],
    },
    h,
  );
