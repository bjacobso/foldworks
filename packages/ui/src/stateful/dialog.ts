import type * as Dialog from "@foldkit/ui/dialog";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "../catalog.styles";
import {
  rootAttrs,
  slotAttrs,
  type Children,
  type StyledConfig,
  type WithSlotProps,
} from "../catalog.shared";
import { statefulStyles } from "../stateful.styles";

export * from "@foldkit/ui/dialog";

export type ContentAttributes = Pick<Dialog.RenderInfo, "closeButton" | "initialFocus">;
export type Slot =
  | "root"
  | "backdrop"
  | "layout"
  | "panel"
  | "header"
  | "title"
  | "description"
  | "footer";

export type StyledViewInputs<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  title: string;
  description?: string;
  content: (attributes: ContentAttributes, h: HtmlBuilder<Message>) => Children;
  footer?: (attributes: ContentAttributes, h: HtmlBuilder<Message>) => Children;
}>;

/** Keep every lifecycle attribute on its intended element, including unmount cleanup. */
export const styledViewInputs = <Message>(
  config: StyledViewInputs<Message>,
  h: HtmlBuilder<Message>,
): Dialog.ViewInputs => ({
  toView: ({ dialog, backdrop, panel, title, description, closeButton, initialFocus, isVisible }) =>
    h.dialog([
      ...rootAttrs(config, h),
      ...dialog,
      h.AriaModal(true),
    ], isVisible ? [
      h.div([...backdrop, ...slotAttrs(config.slotProps?.backdrop, h, statefulStyles.backdrop, statefulStyles.transition)]),
      h.div(slotAttrs(config.slotProps?.layout, h, statefulStyles.dialogLayout), [
        h.section([
          ...panel,
          ...slotAttrs(config.slotProps?.panel, h, styles.dialogPanel, statefulStyles.panel, statefulStyles.transition),
        ], [
          h.header(slotAttrs(config.slotProps?.header, h, styles.dialogHeader), [
            h.h2([...title, ...slotAttrs(config.slotProps?.title, h, styles.title)], [config.title]),
            // Foldkit always references this description id; keep the target even when empty.
            h.p([...description, ...slotAttrs(config.slotProps?.description, h, styles.description), h.Hidden(config.description === undefined)],
              config.description === undefined ? [] : [config.description]),
          ]),
          ...config.content({ closeButton, initialFocus }, h),
          ...(config.footer === undefined ? [] : [h.footer(slotAttrs(config.slotProps?.footer, h, styles.dialogFooter),
            config.footer({ closeButton, initialFocus }, h))]),
        ]),
      ]),
    ] : []),
});
