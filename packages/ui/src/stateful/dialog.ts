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
export type Title = string | Children;
export type Size = "sm" | "md";
export type Slot =
  | "root"
  | "backdrop"
  | "layout"
  | "panel"
  | "header"
  | "title"
  | "description"
  | "headerActions"
  | "content"
  | "footer";

export type StyledViewInputs<Message> = StyledConfig<Message> & WithSlotProps<Message, Slot> & Readonly<{
  title: Title;
  description?: string;
  headerActions?: (attributes: ContentAttributes, h: HtmlBuilder<Message>) => Children;
  content: (attributes: ContentAttributes, h: HtmlBuilder<Message>) => Children;
  footer?: (attributes: ContentAttributes, h: HtmlBuilder<Message>) => Children;
  size?: Size;
  dividers?: boolean;
}>;

const titleContent = (title: Title): Children => typeof title === "string" ? [title] : title;

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
          h.DataAttribute("size", config.size ?? "default"),
          ...slotAttrs(config.slotProps?.panel, h, styles.dialogPanel, statefulStyles.panel, statefulStyles.transition,
            config.size === "sm" && statefulStyles.dialogSm,
            config.size === "md" && statefulStyles.dialogMd),
        ], [
          h.header(slotAttrs(config.slotProps?.header, h, styles.dialogHeader), [
            h.div(slotAttrs(undefined, h, statefulStyles.dialogHeading), [
              h.h2([...title, ...slotAttrs(config.slotProps?.title, h, styles.title)], titleContent(config.title)),
              ...(config.headerActions === undefined ? [] : [h.div(
                slotAttrs(config.slotProps?.headerActions, h, statefulStyles.dialogHeaderActions),
                config.headerActions({ closeButton, initialFocus }, h),
              )]),
            ]),
            h.p([...description, ...slotAttrs(config.slotProps?.description, h, styles.description), h.Hidden(config.description === undefined)],
              config.description === undefined ? [] : [config.description]),
          ]),
          h.div([
            ...slotAttrs(config.slotProps?.content, h, config.dividers === true && statefulStyles.dialogDividedContent),
            h.DataAttribute("dividers", config.dividers === true ? "true" : "false"),
          ],
            config.content({ closeButton, initialFocus }, h)),
          ...(config.footer === undefined ? [] : [h.footer(slotAttrs(config.slotProps?.footer, h, styles.dialogFooter),
            config.footer({ closeButton, initialFocus }, h))]),
        ]),
      ]),
    ] : []),
});
