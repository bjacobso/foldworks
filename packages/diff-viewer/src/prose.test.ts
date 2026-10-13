import { describe, expect, it } from "vitest";
import { diffText } from "./prose";
const sources = (parts: ReturnType<typeof diffText>) => [
  parts
    .filter((part) => part.kind !== "addition")
    .map((part) => part.text)
    .join(""),
  parts
    .filter((part) => part.kind !== "removal")
    .map((part) => part.text)
    .join(""),
];
describe("diffText", () => {
  it("isolates changed words and punctuation", () => {
    expect(
      diffText("Employees may bid.", "Employees must bid!").map(({ kind, text }) => [kind, text]),
    ).toEqual([
      ["equal", "Employees "],
      ["removal", "may"],
      ["addition", "must"],
      ["equal", " bid"],
      ["removal", "."],
      ["addition", "!"],
    ]);
  });
  it("reconstructs exact sources including Unicode and whitespace, with valid offsets", () => {
    for (const granularity of ["word", "sentence"] as const)
      for (const old of ["", "α 😀 café.\n", "a a b\t!"])
        for (const next of ["", "α café!\n\n", "b a b\t!"]) {
          const parts = diffText(old, next, { granularity });
          expect(sources(parts)).toEqual([old, next]);
          for (const part of parts) {
            if (part.kind !== "addition")
              expect(old.slice(part.oldFrom, part.oldFrom + part.text.length)).toBe(part.text);
            if (part.kind !== "removal")
              expect(next.slice(part.newFrom, part.newFrom + part.text.length)).toBe(part.text);
          }
        }
  });
  it("falls back within its search budget without losing source text", () => {
    const old = "prefix " + "old ".repeat(2000) + " suffix";
    const next = "prefix " + "new ".repeat(2000) + " suffix";
    expect(sources(diffText(old, next, { maxSearchCells: 10 }))).toEqual([old, next]);
  });
});
