import { describe, expect, it } from "vitest";

import { highlight } from "./index";

describe("highlight", () => {
  it("returns one token list per line that reassembles the source", () => {
    const code = 'const total = 42; // sum\n{"name": "I-9"}';
    const lines = highlight(code, "typescript");

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.map((token) => token.text).join("")).join("\n")).toBe(code);
    expect(lines[0]).toContainEqual({ text: "const", kind: "keyword" });
    expect(lines[0]).toContainEqual({ text: "42", kind: "number" });
    expect(lines[0]).toContainEqual({ text: "// sum", kind: "comment" });
  });

  it("carries multi-line state and falls back to plain text", () => {
    expect(highlight("/* a\nb */ x", "javascript")[1]?.[0]).toEqual({
      text: "b */",
      kind: "comment",
    });
    expect(highlight("{{ applicant.name }}", "liquid")).toEqual([
      [{ text: "{{ applicant.name }}", kind: "plain" }],
    ]);
  });
});
