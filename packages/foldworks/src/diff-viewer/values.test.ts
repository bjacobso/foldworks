import { expect, it } from "vitest";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { diffValues, ValueDiff, diagnosticsToAnnotations, type JsonValue } from "./values";
it("compares nested paths, root values and object presence", () => {
  expect(
    diffValues({ enabled: false, nested: { remove: null } }, { enabled: true, nested: { add: 1 } }),
  ).toEqual([
    { path: ["enabled"], kind: "changed", before: false, after: true },
    { path: ["nested", "remove"], kind: "removed", before: null },
    { path: ["nested", "add"], kind: "added", after: 1 },
  ]);
  expect(diffValues(null, [1])).toEqual([{ path: [], kind: "changed", before: null, after: [1] }]);
});
it("matches unique array identities, supports host keys, and falls back to indexes", () => {
  expect(
    diffValues(
      [
        { id: "a", v: 1 },
        { id: "b", v: 2 },
      ],
      [
        { id: "b", v: 3 },
        { id: "a", v: 1 },
      ],
    ),
  ).toEqual([{ path: [0, "v"], kind: "changed", before: 2, after: 3 }]);
  expect(
    diffValues([{ name: "a" }, { name: "b" }], [{ name: "b" }, { name: "a" }], {
      key: (v) =>
        typeof v === "object" && v !== null && !Array.isArray(v)
          ? (v as { name: string }).name
          : undefined,
    }),
  ).toEqual([]);
  expect(diffValues([1, 2], [2, 1])).toHaveLength(2);
  expect(diffValues([{ id: "a" }, { id: "a" }], [{ id: "b" }])).toHaveLength(2);
});
it("rejects non-JSON values and cycles", () => {
  const cycle: { [key: string]: JsonValue } = {};
  cycle.self = cycle;
  expect(() => diffValues(cycle, {})).toThrow("cycles");
  expect(() => diffValues(NaN, 0)).toThrow("JSON-like");
});
it("maps UTF-16 offsets, CRLF, exclusive line ends and EOF diagnostics", () => {
  const text = "😀a\r\nb\n";
  const annotation = (from: number, to: number) =>
    diagnosticsToAnnotations("f", text, [{ from, to, severity: "error", message: "Invalid" }])[0]!;
  expect(annotation(0, 5)).toMatchObject({ startLine: 1, endLine: 1, tone: "danger" });
  expect(annotation(2, 6)).toMatchObject({ startLine: 1, endLine: 2 });
  expect(annotation(text.length, text.length)).toMatchObject({ startLine: 2, endLine: 2 });
  expect(
    diagnosticsToAnnotations("f", "", [{ from: 0, to: 0, severity: "hint", message: "Empty" }])[0]!
      .startLine,
  ).toBe(1);
});
it("renders semantic values with semantic insertion and deletion markup", () => {
  const h = inertHtml as unknown as HtmlBuilder<string>;
  const html = ValueDiff.view({ changes: diffValues({ a: 1 }, { a: 2 }) }, h)!;
  expect(Scene.findAll(html, "ins")).toHaveLength(1);
  expect(Scene.findAll(html, "del")).toHaveLength(1);
});
