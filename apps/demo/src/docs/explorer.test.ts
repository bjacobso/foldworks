import { describe, expect, it } from "vitest";
import { explorers, exploreReducer } from "./explorer";

describe("reducer explorer", () => {
  it("enumerates all sidebar states and includes no-op events", () => {
    const sidebar = explorers.find((item) => item.id === "sidebar")!;
    expect(sidebar.states).toHaveLength(4);
    expect(sidebar.transitions).toHaveLength(12);
    expect(
      sidebar.replay(["ToggledCollapsed", "ToggledMobile", "ClosedMobile"]).model,
    ).toMatchObject({
      isCollapsed: true,
      isMobileOpen: false,
      announcement: "Navigation closed.",
    });
    expect(sidebar.replay(["ClosedMobile"]).trace[0]).toMatchObject({
      from: sidebar.initial,
      to: sidebar.initial,
    });
    for (const state of sidebar.states) {
      expect(
        sidebar.transitions
          .filter((transition) => transition.from === state)
          .map((transition) => transition.event),
      ).toEqual(sidebar.events);
    }
  });

  it("uses actual validation and reports commands and outgoing messages without executing them", () => {
    const editable = explorers.find((item) => item.id === "editable-text")!;
    const invalid = editable.replay(["Started", 'Changed("")', "Committed"]);
    expect(invalid.state).toBe("Editing · error");
    expect(invalid.model).toMatchObject({ mode: "edit", draft: "", error: "A value is required." });
    const valid = editable.replay(["Started", "Committed"]);
    expect(valid.state).toBe("Viewing");
    expect(valid.trace[0]?.commands).toBe(1);
    expect(JSON.parse(valid.trace[1]!.outMessage)).toEqual({
      _tag: "Committed",
      value: "Foldworks",
    });
    expect(editable.replay([]).state).toBe(editable.initial);
  });

  it("rejects an unbounded projection instead of generating endlessly", () => {
    expect(() =>
      exploreReducer({
        id: "unbounded",
        title: "Counter",
        description: "",
        init: () => 0,
        project: String,
        events: [{ label: "Add", message: 1 }],
        update: (model, message) => ({ model: model + message }),
      }),
    ).toThrow("projection must have at most 32 states");
  });
});
