import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as Animation from "./stateful/animation";

const inputs = {
  content: h.input([h.AriaLabel("Follow-up answer")]),
  effect: "collapse" as const,
};

describe("styled animation", () => {
  it("keeps a collapsed field mounted and inert while hidden", () => {
    Scene.scene(
      { update: Animation.update, view: Scene.withViewInputs(Animation.view, inputs)() },
      Scene.given(Animation.init({ id: "follow-up" })),
      Scene.expect(Scene.selector("#follow-up")).toHaveAttr("data-closed", ""),
      Scene.expect(Scene.selector("#follow-up")).toHaveAttr("aria-hidden", "true"),
      Scene.expect(Scene.selector("#follow-up input")).toExist(),
    );
  });

  it("renders enter and leave phases on the same element", () => {
    const model = Animation.init({ id: "follow-up", isShowing: true });
    Scene.scene(
      { update: Animation.update, view: Scene.withViewInputs(Animation.view, inputs)() },
      Scene.given({ ...model, transitionState: "EnterStart" as const }),
      Scene.expect(Scene.selector("#follow-up")).toHaveAttr("data-enter", ""),
      Scene.expect(Scene.selector("#follow-up")).toHaveAttr("data-closed", ""),
    );
    Scene.scene(
      { update: Animation.update, view: Scene.withViewInputs(Animation.view, inputs)() },
      Scene.given({ ...model, isShowing: false, transitionState: "LeaveAnimating" as const }),
      Scene.expect(Scene.selector("#follow-up")).toHaveAttr("data-leave", ""),
      Scene.expect(Scene.selector("#follow-up")).toHaveAttr("aria-hidden", "true"),
    );
  });

  it("keeps a fading element mounted during exit", () => {
    Scene.scene(
      {
        update: Animation.update,
        view: Scene.withViewInputs(Animation.view, {
          content: h.span([], ["Done"]),
          effect: "fade",
        })(),
      },
      Scene.given({
        ...Animation.init({ id: "flash" }),
        transitionState: "LeaveAnimating" as const,
      }),
      Scene.expect(Scene.selector("#flash")).toHaveAttr("data-leave", ""),
    );
  });

  it("starts the standard leave command after the paint boundary", () => {
    const hidden = Animation.update(
      Animation.init({ id: "follow-up", isShowing: true }),
      Animation.Message.Hid(),
    );
    expect(hidden.model.transitionState).toBe("LeaveStart");
    const leaving = Animation.update(hidden.model, Animation.Message.CompletedWaitForPaint());
    expect(leaving.model.transitionState).toBe("LeaveAnimating");
    expect(leaving.outMessage).toBeUndefined();
    expect(leaving.commands).toHaveLength(1);
  });
});
