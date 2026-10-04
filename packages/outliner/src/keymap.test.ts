import { describe, expect, it } from "vitest";

import { resolveKey, type Caret, type KeyInput } from "./keymap";

const key = (value: string, modifiers: Partial<KeyInput> = {}): KeyInput => ({
  key: value,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...modifiers,
});

const caret = (start: number, end = start, length = 10, edges: Partial<Caret> = {}): Caret => ({
  start,
  end,
  length,
  onFirstLine: true,
  onLastLine: true,
  ...edges,
});

const text = (value: Caret) => ({ mode: "Text" as const, caret: value });

describe("resolveKey", () => {
  it("maps structure keys in text", () => {
    expect(resolveKey(key("Enter"), text(caret(3)), "mac")).toBe("Split");
    expect(resolveKey(key("Tab"), text(caret(3)), "mac")).toBe("Indent");
    expect(resolveKey(key("Tab", { shiftKey: true }), text(caret(3)), "mac")).toBe("Outdent");
    expect(
      resolveKey(key("ArrowUp", { metaKey: true, shiftKey: true }), text(caret(3)), "mac"),
    ).toBe("MoveUp");
    expect(
      resolveKey(key("ArrowUp", { metaKey: true, ctrlKey: true }), text(caret(3)), "mac"),
    ).toBe("MoveUp");
    expect(
      resolveKey(key("ArrowDown", { ctrlKey: true, shiftKey: true }), text(caret(3)), "other"),
    ).toBe("MoveDown");
    expect(resolveKey(key("ArrowUp", { metaKey: true }), text(caret(3)), "mac")).toBe("Collapse");
  });

  it("leaves Shift+Return and ordinary typing to the browser", () => {
    expect(resolveKey(key("Enter", { shiftKey: true }), text(caret(3)), "mac")).toBeUndefined();
    expect(resolveKey(key("a"), text(caret(3)), "mac")).toBeUndefined();
    expect(resolveKey(key("Enter", { isComposing: true }), text(caret(3)), "mac")).toBeUndefined();
  });

  it("only leaves the row with arrows at its edges", () => {
    expect(resolveKey(key("ArrowUp"), text(caret(3)), "mac")).toBe("FocusPrevious");
    expect(
      resolveKey(key("ArrowUp"), text(caret(3, 3, 10, { onFirstLine: false })), "mac"),
    ).toBeUndefined();
    expect(
      resolveKey(key("ArrowDown"), text(caret(3, 3, 10, { onLastLine: false })), "mac"),
    ).toBeUndefined();
    expect(resolveKey(key("ArrowLeft"), text(caret(0)), "mac")).toBe("FocusPreviousEnd");
    expect(resolveKey(key("ArrowLeft"), text(caret(1)), "mac")).toBeUndefined();
    expect(resolveKey(key("ArrowRight"), text(caret(10)), "mac")).toBe("FocusNextStart");
  });

  it("merges only from a collapsed caret at the edge", () => {
    expect(resolveKey(key("Backspace"), text(caret(0)), "mac")).toBe("MergePrevious");
    expect(resolveKey(key("Backspace"), text(caret(0, 4)), "mac")).toBeUndefined();
    expect(resolveKey(key("Delete"), text(caret(10)), "mac")).toBe("MergeNext");
  });

  it("extends to whole rows once the text is selected to an edge", () => {
    expect(resolveKey(key("ArrowUp", { shiftKey: true }), text(caret(3)), "mac")).toBeUndefined();
    expect(resolveKey(key("ArrowUp", { shiftKey: true }), text(caret(0, 3)), "mac")).toBe(
      "ExtendUp",
    );
    expect(resolveKey(key("ArrowDown", { shiftKey: true }), text(caret(3, 10)), "mac")).toBe(
      "ExtendDown",
    );
  });

  it("uses Finder-style keys while rows are selected", () => {
    const rows = { mode: "Rows" as const };
    expect(resolveKey(key("ArrowLeft"), rows, "mac")).toBe("CollapseOrParent");
    expect(resolveKey(key("ArrowRight"), rows, "mac")).toBe("ExpandOrChild");
    expect(resolveKey(key("Enter"), rows, "mac")).toBe("Edit");
    expect(resolveKey(key("Backspace"), rows, "mac")).toBe("Delete");
    expect(resolveKey(key("Tab"), rows, "mac")).toBe("Indent");
    expect(resolveKey(key("a", { ctrlKey: true }), rows, "other")).toBe("SelectAll");
  });

  it("matches punctuation by physical key", () => {
    expect(
      resolveKey(
        key("≥", { code: "Period", metaKey: true, shiftKey: true }),
        text(caret(1)),
        "mac",
      ),
    ).toBe("ZoomOut");
    expect(
      resolveKey(key("]", { code: "BracketRight", metaKey: true }), text(caret(1)), "mac"),
    ).toBe("Indent");
  });
});
