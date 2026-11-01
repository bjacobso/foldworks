import * as Animation from "@foldkit/ui/animation";
import * as stylex from "@stylexjs/stylex";
import type { Html } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { animationStyles } from "../animation.styles";

export {
  init,
  Model,
  Message,
  OutMessage,
  TransitionState,
  WaitForPaint,
  WaitForAnimationSettled,
  defaultLeaveCommand,
} from "@foldkit/ui/animation";

/** Completes the standard CSS leave phase; hosts may use Headless.Animation
 * directly when they need to coordinate custom leave work. */
export const update = (model: Animation.Model, message: Animation.Message) => {
  const result = Animation.update(model, message);
  if (result.outMessage?._tag !== "StartedLeaveAnimating") return result;
  return {
    ...result,
    outMessage: undefined,
    commands: [...(result.commands ?? []), Animation.defaultLeaveCommand(result.model)],
  };
};

export type Effect = "fade" | "collapse" | "slideUp" | "slideDown" | "slideLeft" | "slideRight";
export type ViewInputs = Readonly<{
  content: Html;
  effect?: Effect;
  className?: string;
}>;

const effectClasses: Record<Effect, string> = {
  fade: stylex.props(animationStyles.fade).className ?? "",
  collapse: stylex.props(animationStyles.collapse).className ?? "",
  slideUp: stylex.props(animationStyles.fade, animationStyles.slideUp).className ?? "",
  slideDown: stylex.props(animationStyles.fade, animationStyles.slideDown).className ?? "",
  slideLeft: stylex.props(animationStyles.fade, animationStyles.slideLeft).className ?? "",
  slideRight: stylex.props(animationStyles.fade, animationStyles.slideRight).className ?? "",
};

/** A styled presence view backed by Foldkit's animation lifecycle. Collapse
 * keeps its content mounted so intrinsic height can animate without measuring. */
export const view = defineView<Animation.Model, Animation.Message, ViewInputs>(
  (model, inputs, h) => {
    const effect = inputs.effect ?? "fade";
    const phase = model.transitionState;
    const leaving = phase === "LeaveStart" || phase === "LeaveAnimating";
    const visible = model.isShowing || leaving;
    if (!visible && effect !== "collapse") return h.empty;

    const closed = !visible || phase === "EnterStart" || phase === "LeaveAnimating";
    const transitioning = phase !== "Idle";
    const className = [effectClasses[effect], inputs.className].filter(Boolean).join(" ");
    return h.keyed("div")(
      model.id,
      [
        h.Id(model.id),
        ...(className ? [h.Class(className)] : []),
        ...(closed ? [h.DataAttribute("closed", "")] : []),
        ...(phase === "EnterStart" || phase === "EnterAnimating"
          ? [h.DataAttribute("enter", "")]
          : []),
        ...(leaving ? [h.DataAttribute("leave", "")] : []),
        ...(transitioning ? [h.DataAttribute("transition", "")] : []),
        ...(effect === "collapse" && !model.isShowing ? [h.Inert(true), h.AriaHidden(true)] : []),
      ],
      effect === "collapse"
        ? [h.div([h.Style({ minHeight: "0px", overflow: "hidden" })], [inputs.content])]
        : [inputs.content],
    );
  },
);
