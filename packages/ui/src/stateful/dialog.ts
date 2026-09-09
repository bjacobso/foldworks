import type * as Dialog from "@foldkit/ui/dialog";
import type { HtmlBuilder } from "foldkit/html";

import { catalogStyles as styles } from "../catalog.styles";
import type { Children, StyledConfig } from "../catalog.shared";
import { sxAttrs } from "../sx";
import { statefulStyles } from "../stateful.styles";

export * from "@foldkit/ui/dialog";

export type ContentAttributes = Pick<Dialog.RenderInfo, "closeButton" | "initialFocus">;
export type StyledViewInputs<Message> = StyledConfig<Message> & Readonly<{
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
      ...(config.attributes ?? []),
      ...dialog,
      h.AriaModal(true),
    ], isVisible ? [
      h.div([...backdrop, ...sxAttrs(h, statefulStyles.backdrop, statefulStyles.transition)]),
      h.div(sxAttrs(h, statefulStyles.dialogLayout), [
        h.section([
          ...panel,
          ...sxAttrs(h, styles.dialogPanel, statefulStyles.panel, statefulStyles.transition, config.style),
        ], [
          h.header(sxAttrs(h, styles.dialogHeader), [
            h.h2([...title, ...sxAttrs(h, styles.title)], [config.title]),
            // Foldkit always references this description id; keep the target even when empty.
            h.p([...description, ...sxAttrs(h, styles.description), h.Hidden(config.description === undefined)],
              config.description === undefined ? [] : [config.description]),
          ]),
          ...config.content({ closeButton, initialFocus }, h),
          ...(config.footer === undefined ? [] : [h.footer(sxAttrs(h, styles.dialogFooter),
            config.footer({ closeButton, initialFocus }, h))]),
        ]),
      ]),
    ] : []),
});
