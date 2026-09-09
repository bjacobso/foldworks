import { Option } from "effect";
import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import * as Dialog from "./stateful/dialog";
import * as Tabs from "./stateful/tabs";
import * as Select from "./stateful/select";

const TestTabs = Tabs.create<"overview" | "restricted" | "activity">();
const tabInputs = Tabs.styledViewInputs({
  ariaLabel: "Account views",
  selectedValue: "overview",
  tabs: [
    { value: "overview", label: "Overview", content: ["Overview content"] },
    { value: "restricted", label: "Restricted", content: ["Restricted content"], isDisabled: true },
    { value: "activity", label: "Activity", content: ["Activity content"] },
  ],
}, h);

describe("styled Foldkit tabs", () => {
  it("navigates past disabled tabs and emits the selected value through the real key handler", () => {
    Scene.scene(
      { update: TestTabs.update, view: Scene.withViewInputs(TestTabs.view, tabInputs)() },
      Scene.given(Tabs.init({ id: "account" })),
      Scene.expect(Scene.role("tab", { name: "Restricted" })).toBeDisabled(),
      Scene.expect(Scene.role("tab", { name: "Overview" })).toHaveAttr("aria-controls", "account-panel-0"),
      Scene.keydown(Scene.role("tab", { name: "Overview" }), "ArrowRight"),
      Scene.expectOutMessage(Tabs.OutMessage.Selected({ value: "activity", index: 2 })),
      Scene.Command.resolve(Tabs.FocusTab, Tabs.Message.CompletedFocusTab()),
    );
  });

  it("keeps manual keyboard focus separate from selection until Enter", () => {
    Scene.scene(
      { update: TestTabs.update, view: Scene.withViewInputs(TestTabs.view, tabInputs)() },
      Scene.given(Tabs.init({ id: "account", activationMode: "Manual" })),
      Scene.keydown(Scene.role("tab", { name: "Overview" }), "End"),
      Scene.Command.resolve(Tabs.FocusTab, Tabs.Message.CompletedFocusTab()),
      Scene.expectNoOutMessage(),
      Scene.expect(Scene.role("tab", { name: "Activity" })).toHaveAttr("tabIndex", "0"),
      Scene.expect(Scene.role("tab", { name: "Overview" })).toHaveAttr("aria-selected", "true"),
      Scene.keydown(Scene.role("tab", { name: "Activity" }), "Enter"),
      Scene.expectOutMessage(Tabs.OutMessage.Selected({ value: "activity", index: 2 })),
      Scene.Command.resolve(Tabs.FocusTab, Tabs.Message.CompletedFocusTab()),
    );
  });

  it("uses vertical arrow navigation when configured", () => {
    const inputs = { ...tabInputs, orientation: "Vertical" as const };
    Scene.scene(
      { update: TestTabs.update, view: Scene.withViewInputs(TestTabs.view, inputs)() },
      Scene.given(Tabs.init({ id: "account" })),
      Scene.expect(Scene.role("tablist")).toHaveAttr("aria-orientation", "vertical"),
      Scene.keydown(Scene.role("tab", { name: "Overview" }), "ArrowDown"),
      Scene.expectOutMessage(Tabs.OutMessage.Selected({ value: "activity", index: 2 })),
      Scene.Command.resolve(Tabs.FocusTab, Tabs.Message.CompletedFocusTab()),
    );
  });
});

describe("styled Foldkit dialog", () => {
  it("retains initial focus, description linkage, and the engine's close command", () => {
    const inputs = Dialog.styledViewInputs({
      title: "Edit profile",
      content: ({ initialFocus }, h) => [h.input([...initialFocus, h.AriaLabel("Name")])],
      footer: ({ closeButton }, h) => [h.button(closeButton, ["Cancel"])],
    }, h);
    const model = { ...Dialog.init({ id: "profile" }), isOpen: true };
    Scene.scene(
      { update: Dialog.update, view: Scene.withViewInputs(Dialog.view, inputs)() },
      Scene.given(model),
      Scene.expect(Scene.role("dialog")).toHaveAttr("aria-labelledby", Dialog.titleId(model)),
      Scene.expect(Scene.selector(`[id="${Dialog.descriptionId(model)}"]`)).toExist(),
      Scene.expect(Scene.role("button", { name: "Cancel" })).toHaveAttr("type", "button"),
      Scene.click(Scene.role("button", { name: "Cancel" })),
      Scene.expectOutMessage(Dialog.OutMessage.Closed()),
      Scene.Command.resolve(Dialog.CloseDialog, Dialog.Message.CompletedCloseDialog()),
    );
  });
});

describe("styled Foldkit select", () => {
  const options = [
    { value: "people", label: "People" },
    { value: "operations", label: "Operations", isDisabled: true },
  ] as const;
  const inputs = Select.styledViewInputs({
    options, value: "people", ariaLabel: "Department", name: "department",
  }, h);
  const TestSelect = Select.create<"people" | "operations">();

  it("passes disabled behavior and form values to the listbox engine", () => {
    Scene.scene(
      { update: TestSelect.update, view: Scene.withViewInputs(TestSelect.view, { ...inputs, isDisabled: true })() },
      Scene.given(Select.init({ id: "department" })),
      Scene.expect(Scene.role("button", { name: "Department" })).toHaveAttr("aria-disabled", "true"),
      Scene.expect(Scene.selector('input[name="department"]')).toHaveAttr("value", "people"),
      Scene.expectNoOutMessage(),
      Scene.expect(Scene.role("listbox")).not.toExist(),
    );
    expect(inputs.isItemDisabled?.(options[1], 1)).toBe(true);
    expect(inputs.itemToSearchText?.(options[0], 0)).toBe("People");
    expect(inputs.maybeSelectedValue).toEqual(Option.some("people"));
  });
});
