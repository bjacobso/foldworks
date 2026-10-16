import { expect, it } from "vitest";
import { applySuggestions, type Suggestion } from "./suggestions";
const suggestion = (
  startLine: number,
  endLine: number,
  expected: string,
  replacement: string,
): Suggestion => ({ path: "f", startLine, endLine, expected, replacement });
it("applies a batch bottom-up with multiline replacements and deletions", () => {
  expect(
    applySuggestions("a\nb\nc\nd\n", [
      suggestion(1, 1, "a", "A\nextra"),
      suggestion(3, 4, "c\nd", ""),
    ]),
  ).toEqual({ status: "applied", text: "A\nextra\nb\n" });
  expect(applySuggestions("a\r\nb", [suggestion(2, 2, "b", "B")])).toEqual({
    status: "applied",
    text: "a\nB",
  });
  expect(applySuggestions("a\n", [suggestion(1, 1, "a", "")])).toEqual({
    status: "applied",
    text: "",
  });
});
it("rejects stale, overlapping, invalid and mixed-file batches atomically", () => {
  expect(applySuggestions("a\nb\n", [suggestion(1, 1, "old", "A")])).toMatchObject({
    status: "rejected",
    reason: "stale",
    stale: [{ expected: "old" }],
  });
  expect(
    applySuggestions("a\nb\n", [suggestion(1, 2, "a\nb", "A"), suggestion(2, 2, "b", "B")]),
  ).toMatchObject({ status: "rejected", reason: "overlap" });
  expect(applySuggestions("a", [suggestion(0, 1, "a", "A")])).toMatchObject({ reason: "stale" });
  expect(
    applySuggestions("a", [
      suggestion(1, 1, "a", "A"),
      { ...suggestion(1, 1, "a", "A"), path: "g" },
    ]),
  ).toMatchObject({ reason: "mixed-paths" });
  expect(applySuggestions("a\r\n", [])).toEqual({ status: "applied", text: "a\r\n" });
});

it("distinguishes replacing a line with a blank line from deleting it", () => {
  expect(applySuggestions("a\nb\n", [suggestion(1, 1, "a", "\n")])).toEqual({
    status: "applied",
    text: "\nb\n",
  });
});
