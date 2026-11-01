import { describe, expect, it } from "vitest";

import { item } from "./outline";
import { parseOutline, serializeOutline } from "./text";

const ids = () => {
  let counter = 0;
  return () => `n${++counter}`;
};

describe("parseOutline", () => {
  it("reads tab, space, and bullet indentation", () => {
    const parsed = parseOutline("Plan\n\tResearch\n\t\tInterviews\n\tBuild\nShip", ids());
    expect(serializeOutline(parsed)).toBe(
      "- Plan\n  - Research\n    - Interviews\n  - Build\n- Ship",
    );
  });

  it("understands Markdown lists with tasks and uneven spacing", () => {
    const parsed = parseOutline("- [x] Done\n   - [ ] Todo\n\n * Other\n", ids());
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ text: "Done", checked: true });
    expect(parsed[0]?.children.map((node) => node.text)).toEqual(["Todo", "Other"]);
  });

  it("nests one level at a time however deep a line is indented", () => {
    const parsed = parseOutline("a\n\t\t\tb\nc", ids());
    expect(serializeOutline(parsed, { format: "tabs" })).toBe("a\n\tb\nc");
  });
});

describe("serializeOutline", () => {
  it("writes collapsed descendants and task state", () => {
    const outline = [
      item("a", "Parent", [item("b", "Child", [], { checked: true })], { collapsed: true }),
    ];
    expect(serializeOutline(outline)).toBe("- Parent\n  - [x] Child");
    expect(serializeOutline(outline, { format: "tabs" })).toBe("Parent\n\t[x] Child");
  });
});
