import { describe, expect, it } from "vitest";
import { applyEdits } from "../document";
import { editingPlan } from "./operations";
import { tokenize } from "./tokenize";

describe("YAML editing", () => {
  it("colors keys, scalars, comments and quoted hashes", () => {
    const text = 'name: "a # b" # comment\nenabled: true\nretries: 3\nurl: https://example.com/#anchor';
    const lines = tokenize(text, "yaml");
    const tokens = lines.flatMap((line) => line.tokens.map((token) => [line.text.slice(token.from, token.to), token.kind]));
    expect(tokens).toContainEqual(["name", "property"]);
    expect(tokens).toContainEqual(['"a # b"', "string"]);
    expect(tokens).toContainEqual(["# comment", "comment"]);
    expect(tokens).toContainEqual(["true", "keyword"]);
    expect(tokens).toContainEqual(["3", "number"]);
    expect(tokens).toContainEqual(["https://example.com/#anchor", "string"]);
    for (const line of lines) expect(line.tokens.map((token) => line.text.slice(token.from, token.to)).join("")).toBe(line.text);
  });
  it("carries block scalar state and reuses cached lines only after state converges", () => {
    const text = 'nested:\n  description: |\n    # This is text\n    enabled: false\n  retries: 3\nname: Demo';
    const before = tokenize(text, "yaml");
    expect(before[2]!.tokens[0]!.kind).toBe("string");
    expect(before[3]!.tokens[0]!.kind).toBe("string");
    expect(before[4]!.tokens.some((token) => token.kind === "property")).toBe(true);
    const after = tokenize(text.replace("description: |", "description:"), "yaml", before);
    expect(after[2]!.tokens.some((token) => token.kind === "comment")).toBe(true);
    expect(after[5]).toBe(before[5]);
  });
  it("carries quoted strings and handles escaped single quotes", () => {
    const lines = tokenize("name: 'It''s a\n  multiline # string'\nflag: true", "yaml");
    expect(lines[0]!.outgoing).toBe("yaml-single");
    expect(lines[1]!.tokens[0]!.kind).toBe("string");
    expect(lines[1]!.outgoing).toBe("code");
    expect(lines[2]!.tokens.some((token) => token.kind === "keyword")).toBe(true);
  });
  it("toggles YAML comments with the hash prefix", () => {
    const text = '  enabled: true\n  retries: 3';
    const commented = editingPlan(text, { anchor: 0, head: text.length }, "comment", 2, "#");
    const after = applyEdits(text, commented.edits);
    expect(after).toBe('  # enabled: true\n  # retries: 3');
    expect(applyEdits(after, editingPlan(after, commented.selection, "comment", 2, "#").edits)).toBe(text);
  });
});
