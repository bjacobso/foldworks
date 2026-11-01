import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, it } from "vitest";
import * as Citation from "./citation";
import * as Tooltip from "./stateful/tooltip";
import * as Popover from "./stateful/popover";

const inputs = Citation.styledViewInputs(
  { label: 1, preview: "Employees may bid.", onActivate: undefined as never },
  h,
);
describe("citations", () => {
  it("shows its preview on keyboard focus and preserves escape dismissal", () => {
    Scene.scene(
      { update: Citation.update, view: Scene.withViewInputs(Citation.view, inputs)() },
      Scene.given(Citation.init({ id: "citation-one" })),
      Scene.focus(Scene.role("button", { name: "Open citation 1" })),
      Scene.Mount.resolve(Tooltip.AnchorTooltip, Tooltip.Message.CompletedAnchorTooltip()),
      Scene.expect(Scene.role("tooltip")).toExist(),
      Scene.expect(Scene.role("button", { name: "Open citation 1" })).toHaveAttr(
        "aria-describedby",
        "citation-one-panel",
      ),
      Scene.keydown(Scene.role("button", { name: "Open citation 1" }), "Escape"),
      Scene.Mount.expectEnded(Tooltip.AnchorTooltip),
      Scene.expect(Scene.role("tooltip")).not.toExist(),
    );
  });
  it("keeps source activation separate from opening an interactive preview", () => {
    const inputs = Citation.popoverViewInputs(
      { label: "§12", preview: [h.p([], ["Source excerpt"])], onActivate: undefined as never },
      h,
    );
    Scene.scene(
      { update: Popover.update, view: Scene.withViewInputs(Popover.view, inputs)() },
      Scene.given({ ...Popover.init({ id: "citation-popover" }), isOpen: true }),
      Scene.Mount.resolve(
        Popover.PortalPopoverBackdrop,
        Popover.Message.CompletedPortalPopoverBackdrop(),
      ),
      Scene.Mount.resolve(Popover.AnchorPopover, Popover.Message.CompletedAnchorPopover()),
      Scene.expect(Scene.role("dialog", { name: "Citation §12" })).toExist(),
      Scene.expect(Scene.role("button", { name: "Open source" })).toExist(),
    );
  });
});
