import * as Toast from "@foldkit/ui/toast";
import * as stylex from "@stylexjs/stylex";
import { Schema as S } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { primitiveStyles } from "../primitive.styles";
import { sxAttrs } from "../sx";
import { statefulStyles } from "../stateful.styles";

export { Position, Variant, WaitBeforeDismissal } from "@foldkit/ui/toast";

export const Payload = S.Struct({ title: S.String, description: S.optional(S.String) });
export type Payload = typeof Payload.Type;

type Engine = ReturnType<typeof Toast.make<Payload, Payload>>;
const Engine: Engine = Toast.make(Payload);
export const Entry = Engine.Entry;
export const Model = Engine.Model;
export type Model = typeof Model.Type;
export const Message = Engine.Message;
export type Message = typeof Message.Type;
export const OutMessage = Engine.OutMessage;
export type OutMessage = typeof OutMessage.Type;
export const init = Engine.init;
export const update = Engine.update;
export const show = Engine.show;
export const dismiss = Engine.dismiss;
export const dismissAll = Engine.dismissAll;
export const view: typeof Engine.view = Engine.view;

const positionStyle = (position: Toast.Position) => ({
  TopLeft: statefulStyles.toastTopLeft,
  TopCenter: statefulStyles.toastTopCenter,
  TopRight: statefulStyles.toastTopRight,
  BottomLeft: statefulStyles.toastBottomLeft,
  BottomCenter: statefulStyles.toastBottomCenter,
  BottomRight: statefulStyles.toastBottomRight,
})[position];

const variantStyle = (variant: Toast.Variant) => ({
  Info: primitiveStyles.toastInfo, Success: primitiveStyles.toastSuccess,
  Warning: primitiveStyles.toastWarning, Error: primitiveStyles.toastError,
})[variant];

export type StyledViewInputs = Readonly<{ position?: Toast.Position; ariaLabel?: string }>;

export const styledViewInputs = <ParentMessage>(
  config: StyledViewInputs = {}, h: HtmlBuilder<ParentMessage>,
) => {
  const position = config.position ?? "BottomRight";
  return {
    position,
    ...(config.ariaLabel === undefined ? {} : { ariaLabel: config.ariaLabel }),
    containerClassName: stylex.props(primitiveStyles.toastViewport, positionStyle(position)).className ?? "",
    entryClassName: "",
    entryToView: (entry: typeof Entry.Type, handlers: Toast.EntryHandlers) => h.div([
      ...sxAttrs(h, primitiveStyles.toast, variantStyle(entry.variant),
        entry.animation.transitionState === "EnterStart" || entry.animation.transitionState === "LeaveAnimating"
          ? primitiveStyles.toastClosed : undefined),
      h.DataAttribute("toast-id", entry.id),
    ], [
      h.div(sxAttrs(h, primitiveStyles.toastTitle), [entry.payload.title]),
      ...(entry.payload.description === undefined ? [] : [h.p(sxAttrs(h, primitiveStyles.toastDescription), [entry.payload.description])]),
      h.button([...handlers.dismiss, ...sxAttrs(h, primitiveStyles.toastDismiss), h.Type("button"),
        h.AriaLabel(`Dismiss ${entry.payload.title}`)], ["Dismiss"]),
    ]),
  };
};
