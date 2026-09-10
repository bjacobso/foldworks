import { describe, expect, it } from "vitest";
import { applyEdits, exportText, normalizeText, offsetAt, positionAt } from "./document";
import { init } from "./model";
import { jsonValidator } from "./diagnostics";

describe("code documents", () => {
  it("applies edits against a single base document, including insertion at EOF", () => {
    expect(applyEdits("alpha beta", [
      { from: 0, to: 5, insert: "A" }, { from: 6, to: 10, insert: "B" }, { from: 10, to: 10, insert: "!" },
    ])).toBe("A B!");
  });
  it("rejects overlapping, out-of-range, reversed, and noninteger edits", () => {
    for (const edits of [
      [{ from: 1, to: 4, insert: "" }, { from: 3, to: 5, insert: "" }],
      [{ from: -1, to: 0, insert: "" }], [{ from: 5, to: 7, insert: "" }],
      [{ from: 3, to: 1, insert: "" }], [{ from: 0.5, to: 1, insert: "" }],
      [{ from: 0, to: 0, insert: "\r\n" }],
    ]) expect(() => applyEdits("abcdef", edits)).toThrow();
  });
  it("uses UTF-16 without cutting surrogate pairs and round-trips positions", () => {
    const text = "a😀é\n👩‍💻 end\n";
    expect(() => applyEdits(text, [{ from: 2, to: 3, insert: "" }])).toThrow();
    expect(applyEdits(text, [{ from: 1, to: 3, insert: "🙂" }])).toBe("a🙂é\n👩‍💻 end\n");
    for (const offset of [0, 1, 3, 5, 6, 8, text.length]) expect(offsetAt(text, positionAt(text, offset))).toBe(offset);
    expect(positionAt(text, text.length)).toEqual({ line: 2, character: 0 });
    expect(() => offsetAt(text, { line: 99, character: 0 })).toThrow();
    expect(() => offsetAt(text, { line: 0, character: 2 })).toThrow();
  });
  it("normalizes input and preserves CRLF as an export preference", () => {
    const model = init({ id: "test", text: "a\r\nb\r\n" });
    expect(model.document.text).toBe("a\nb\n");
    expect(exportText(model.document)).toBe("a\r\nb\r\n");
    expect(normalizeText("a\rb")).toBe("a\nb");
  });
  it("validates JSON without evaluating source, and supports EOF errors", async () => {
    const signal = new AbortController().signal;
    const document = init({ id: "test", languageId: "json", text: '{"hello": "😀"}' }).document;
    expect(await jsonValidator.validate(document, signal)).toEqual([]);
    const issues = await jsonValidator.validate({ ...document, text: '{"hello":' }, signal);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error" });
    expect(issues[0]!.from).toBeLessThanOrEqual(9);
    expect(await jsonValidator.validate({ ...document, languageId: "text", text: "not json" }, signal)).toEqual([]);
  });
});
