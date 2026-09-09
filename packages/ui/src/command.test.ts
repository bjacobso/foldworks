import { describe, expect, it } from "vitest";
import { Scene } from "foldkit/test";
import * as Command from "./stateful/command";

const items: ReadonlyArray<Command.Item> = [
  { value: "calendar", label: "Calendar", keywords: ["schedule"], group: "Tools" },
  { value: "calculator", label: "Calculator", group: "Tools", isDisabled: true },
  { value: "profile", label: "Profile", group: "Account" },
  { value: "billing", label: "Billing", keywords: ["payment"], group: "Account" },
];
const config: Command.ViewInputs = { items, ariaLabel: "Commands" };
const sceneConfig = { update: Command.update, view: Scene.withViewInputs(Command.view, config)() };

describe("stateful command palette", () => {
  it("ranks exact, prefix, and fuzzy matches, including keywords", () => {
    expect(Command.score("Calendar", "calendar")).toBeGreaterThan(Command.score("Calendar", "cal"));
    expect(Command.score("Calendar", "cal")).toBeGreaterThan(Command.score("Calendar", "clndr"));
    expect(Command.getResults(" clndr ", config).map((item) => item.value)).toEqual(["calendar"]);
    expect(Command.getResults("payment", config).map((item) => item.value)).toEqual(["billing"]);
    expect(Command.getResults("no match", config)).toEqual([]);
  });

  it("ranks groups by their best match and supports externally filtered results", () => {
    expect(Command.getResults("x", { ...config, filter: (_query, item) => item.value === "billing" ? 2 : 1 })
      .map((item) => item.value)).toEqual(["billing", "profile", "calendar", "calculator"]);
    expect(Command.getResults("no match", { ...config, shouldFilter: false })).toEqual(items);
  });

  it("navigates past disabled options, keeps input focus, and selects with Enter", () => {
    const input = Scene.role("combobox", { name: "Commands" });
    Scene.scene(sceneConfig,
      Scene.given(Command.init({ id: "command" })),
      Scene.expect(input).toHaveAttr("aria-activedescendant", "command-item-calendar"),
      Scene.keydown(input, "ArrowDown"),
      Scene.expect(input).toHaveAttr("aria-activedescendant", "command-item-profile"),
      Scene.Command.resolve(Command.ScrollActive, Command.Message.CompletedScroll()),
      Scene.keydown(input, "End"),
      Scene.Command.resolve(Command.ScrollActive, Command.Message.CompletedScroll()),
      Scene.keydown(input, "ArrowDown"),
      Scene.Command.resolve(Command.ScrollActive, Command.Message.CompletedScroll()),
      Scene.expect(input).toHaveAttr("aria-activedescendant", "command-item-billing"),
      Scene.keydown(input, "Enter"),
      Scene.expectOutMessage(Command.OutMessage.Selected({ value: "billing" })),
      Scene.keydown(input, "Home"),
      Scene.Command.resolve(Command.ScrollActive, Command.Message.CompletedScroll()),
      Scene.expect(input).toHaveAttr("aria-activedescendant", "command-item-calendar"),
    );
  });

  it("resets the active result on search and emits nothing on Enter with no matches", () => {
    const input = Scene.role("combobox");
    Scene.scene(sceneConfig,
      Scene.given(Command.init({ id: "command" })),
      Scene.type(input, "payment"),
      Scene.expectOutMessage(Command.OutMessage.SearchChanged({ query: "payment" })),
      Scene.expect(input).toHaveAttr("aria-activedescendant", "command-item-billing"),
      Scene.keydown(input, "Enter"),
      Scene.expectOutMessage(Command.OutMessage.Selected({ value: "billing" })),
      Scene.expect(input).toHaveAttr("value", "payment"),
      Scene.type(input, "zzzzz"),
      Scene.expect(Scene.role("status")).toHaveText("No results found."),
      Scene.keydown(input, "Enter"),
      Scene.expectNoOutMessage(),
    );
  });

  it("falls back when asynchronous results remove the active item", () => {
    const selected = Command.update(Command.init({ id: "command" }),
      Command.Message.Activated({ value: "billing", isKeyboard: false })).model;
    expect(Command.activeItem(selected, items.slice(0, 2))?.value).toBe("calendar");
    expect(Command.activeItem(selected, items.filter((item) => item.isDisabled))).toBeUndefined();
  });

  it("supports wraparound navigation when requested", () => {
    Scene.scene(
      { update: Command.update, view: Scene.withViewInputs(Command.view, { ...config, loop: true })() },
      Scene.given(Command.init({ id: "command" })),
      Scene.keydown(Scene.role("combobox"), "ArrowUp"),
      Scene.Command.resolve(Command.ScrollActive, Command.Message.CompletedScroll()),
      Scene.expect(Scene.role("combobox")).toHaveAttr("aria-activedescendant", "command-item-billing"),
    );
  });
});
