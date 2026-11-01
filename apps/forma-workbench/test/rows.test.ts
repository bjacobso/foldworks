import { describe, expect, it } from "vitest";
import { sourceToOutline } from "@formalang/ts/syntax";

import { nodeAt, rangeInRow, rowContaining, rowLayouts } from "../src/workbench/rows.js";

const source = `; Pricing
(define tax-rate 0.08)
(define total [revenue]
  ; Revenue plus tax.
  (let [tax (* revenue tax-rate)]
    (+ revenue tax)))
(total 100)
\`(if ~test
   nil)`;

const read = () => {
  const outline = sourceToOutline(source);
  return { outline, layouts: rowLayouts(outline.items, outline.identity) };
};

const span = (text: string, from = 0) => {
  const start = source.indexOf(text, from);
  return { start, end: start + text.length };
};

describe("row layouts", () => {
  it("pairs every row's text with its source nodes", () => {
    const { outline, layouts } = read();
    const texts = [...layouts.values()].map((layout) => layout.text);
    expect(texts).toEqual([
      "; Pricing",
      "define tax-rate 0.08",
      "define total [revenue]",
      "; Revenue plus tax.",
      "let [tax (* revenue tax-rate)]",
      "+ revenue tax",
      "total 100",
      "` if ~test",
      "nil",
    ]);
    const letRow = [...layouts.values()].find((layout) => layout.text.startsWith("let"))!;
    // `let`, the vector, `tax`, the call, `*`, `revenue`, `tax-rate`.
    expect(letRow.nodes.map((node) => letRow.text.slice(node.from, node.to))).toEqual([
      "let",
      "[tax (* revenue tax-rate)]",
      "tax",
      "(* revenue tax-rate)",
      "*",
      "revenue",
      "tax-rate",
    ]);
    for (const node of letRow.nodes) {
      expect(source.slice(node.start, node.end)).toBe(letRow.text.slice(node.from, node.to));
    }
    expect(outline.items).toHaveLength(5);
  });

  it("reads past a reader-macro prefix", () => {
    const { layouts } = read();
    const quoted = [...layouts.values()].find((layout) => layout.text.startsWith("`"))!;
    expect(quoted.nodes.map((node) => quoted.text.slice(node.from, node.to))).toEqual([
      "if",
      "~test",
      "test",
    ]);
  });

  it("finds the node under an offset", () => {
    const { layouts } = read();
    const letRow = [...layouts.values()].find((layout) => layout.text.startsWith("let"))!;
    const at = letRow.text.indexOf("tax-rate") + 2;
    expect(nodeAt(letRow, at)?.kind).toBe("Symbol");
    expect(source.slice(nodeAt(letRow, at)!.start, nodeAt(letRow, at)!.end)).toBe("tax-rate");
    expect(nodeAt(letRow, letRow.text.length, true)?.kind).toBe("Vector");
  });

  it("places source spans in the innermost row", () => {
    const { layouts } = read();
    const call = span("(+ revenue tax)");
    expect(rowContaining(layouts, call.start, call.end)?.text).toBe("+ revenue tax");
    const symbol = span("tax-rate)]");
    const row = rowContaining(layouts, symbol.start, symbol.start + 8)!;
    expect(row.text).toBe("let [tax (* revenue tax-rate)]");
    expect(rangeInRow(row, symbol.start, symbol.start + 8)).toEqual({
      from: row.text.indexOf("tax-rate"),
      to: row.text.indexOf("tax-rate") + 8,
    });
    // The whole form of a row with children covers the row's text.
    const whole = span("(let [tax");
    expect(rangeInRow(row, whole.start, span("tax)))").end - 2)).toEqual({
      from: 0,
      to: row.text.length,
    });
  });
});
