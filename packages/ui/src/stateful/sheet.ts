import type { HtmlBuilder } from "foldkit/html";
import * as Dialog from "./dialog";
export * from "./dialog";
export const styledViewInputs = <Message>(
  config: Dialog.StyledViewInputs<Message>,
  h: HtmlBuilder<Message>,
) =>
  Dialog.styledViewInputs(
    { ...config, placement: config.placement ?? "right", role: "dialog" },
    h,
  );
