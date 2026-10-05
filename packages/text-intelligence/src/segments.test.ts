import { describe, expect, it } from "vitest";

import { segments } from "./segments";

describe("segments", () => {
  it("cuts text at every boundary and reports what covers each piece", () => {
    const result = segments("total 21", {
      tokens: [
        { from: 0, to: 5, kind: "function" },
        { from: 6, to: 8, kind: "number" },
      ],
      problems: [{ from: 3, to: 7, severity: "error" as const }],
    });
    expect(
      result.map((piece) => [
        piece.text,
        piece.covering.tokens.map((token) => token.kind).join(),
        piece.covering.problems.length,
      ]),
    ).toEqual([
      ["tot", "function", 0],
      ["al", "function", 1],
      [" ", "", 1],
      ["2", "number", 1],
      ["1", "number", 0],
    ]);
  });

  it("clips ranges to the text and shifts them by an offset", () => {
    const result = segments("line", { marks: [{ from: 8, to: 20 }] }, 10);
    expect(result.map((piece) => [piece.text, piece.covering.marks.length])).toEqual([["line", 1]]);
    expect(segments("", { marks: [] })).toEqual([]);
  });
});
