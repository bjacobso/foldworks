import { describe, expect, it } from "vitest";
import {
  aria,
  conflicts,
  display,
  resolve,
  shortcut,
  type Binding,
  type KeyEvent,
} from "./index";
const event: KeyEvent = {
  key: "s",
  ctrlKey: true,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  repeat: false,
};
const global: Binding = {
  id: "save",
  label: "Save",
  shortcut: shortcut("S", "Mod"),
};
describe("keyboard command registry", () => {
  it("normalizes combinations and platform-specific labels and ARIA", () => {
    expect(display(global.shortcut, "mac")).toBe("⌘S");
    expect(display(global.shortcut, "other")).toBe("Ctrl+S");
    expect(aria(shortcut("space", "Mod", "Shift", "Shift"), "mac")).toBe(
      "Shift+Meta+Space",
    );
    expect(aria(shortcut("+", "Control"), "other")).toBe("Control+plus");
    expect(
      resolve([global], { ...event, ctrlKey: false, metaKey: true }, "mac")?.id,
    ).toBe("save");
    expect(
      resolve([global], { ...event, ctrlKey: false, metaKey: true }, "other"),
    ).toBeUndefined();
  });
  it("prefers nearest scope, then priority, then declaration order", () => {
    const parent = { ...global, id: "parent", scope: "parent", priority: 100 };
    const child = { ...global, id: "child", scope: "child" };
    expect(
      resolve([global, parent, child], event, "other", ["child", "parent"])?.id,
    ).toBe("child");
    expect(resolve([global, parent], event, "other", ["elsewhere"])?.id).toBe(
      "save",
    );
    expect(
      resolve(
        [global, { ...global, id: "priority", priority: 1 }],
        event,
        "other",
      )?.id,
    ).toBe("priority");
    expect(
      resolve([global, { ...global, id: "second" }], event, "other")?.id,
    ).toBe("save");
    expect(
      conflicts([global, { ...global, id: "second" }, parent], "other"),
    ).toEqual([["save", "second"]]);
  });
  it("suppresses disabled, editable, repeat, composition, and previously handled events", () => {
    expect(
      resolve([{ ...global, isDisabled: true }], event, "other"),
    ).toBeUndefined();
    expect(resolve([global], event, "other", [], true)).toBeUndefined();
    expect(
      resolve([{ ...global, allowEditable: true }], event, "other", [], true)
        ?.id,
    ).toBe("save");
    for (const patch of [
      { repeat: true },
      { isComposing: true },
      { defaultPrevented: true },
      { altKey: true },
    ])
      expect(
        resolve([global], { ...event, ...patch }, "other"),
      ).toBeUndefined();
    expect(
      resolve(
        [{ ...global, repeat: true }],
        { ...event, repeat: true },
        "other",
      )?.id,
    ).toBe("save");
  });
});
