import { describe, expect, it } from "vitest";

import { accept, active, matching, move, open, track, visible, wordBefore } from "./completion";
import type { CompletionItem } from "./vocabulary";

const items: ReadonlyArray<CompletionItem> = [
  { label: "total" },
  { label: "tax-rate", detail: "number" },
  { label: "subtotal" },
  { label: "Tally", filterText: "count" },
];

describe("completion lists", () => {
  it("matches prefixes before substrings, case-insensitively, by filter text", () => {
    expect(matching(items, "TO").map((item) => item.label)).toEqual(["total", "subtotal"]);
    expect(matching(items, "coun").map((item) => item.label)).toEqual(["Tally"]);
    expect(matching(items, "")).toBe(items);
  });

  it("narrows by the text typed since the range opened", () => {
    const list = open(4, 5, items);
    expect(visible(list, "sum t", 5).map((item) => item.label)).toEqual([
      "total",
      "tax-rate",
      "subtotal",
      "Tally",
    ]);
    expect(visible(list, "sum t", 3)).toEqual([]);
    // A suggestion that matches what is typed exactly adds nothing.
    expect(visible(open(0, 5, items), "total", 5).map((item) => item.label)).toEqual(["subtotal"]);
  });

  it("follows typing at the end of its range and closes when an edit lands before it", () => {
    const list = open(4, 5, items);
    const typed = track(list, "sum t", "sum to", 6);
    expect(typed).toEqual({ ...list, to: 6 });
    expect(visible(typed!, "sum to", 6).map((item) => item.label)).toEqual(["total", "subtotal"]);
    expect(track(list, "sum t", "sums t", 6)).toBeUndefined();
    expect(track(typed!, "sum to", "sum t", 5)).toEqual({ ...list, to: 5 });
    expect(track(list, "sum t", "sum ", 4)).toEqual({ ...list, to: 4 });
    // Typing a character that repeats the next one still lands in the range.
    expect(track(open(0, 2, items), "bal", "ball", 3)).toEqual({ ...open(0, 2, items), to: 3 });
  });

  it("wraps the active item and accepts it over the range", () => {
    const list = open(4, 6, items);
    expect(move(list, -1, 2).index).toBe(1);
    expect(move(move(list, 1, 2), 1, 2).index).toBe(0);
    expect(active(move(list, 1, 2), "sum to x", 6)?.label).toBe("subtotal");
    expect(accept(list, "sum to x", { label: "total", insert: "total " })).toEqual({
      text: "sum total  x",
      caret: 10,
      from: 4,
      to: 6,
      insert: "total ",
    });
  });

  it("finds the word before an offset", () => {
    expect(wordBefore("(+ tax-ra", 9)).toEqual({ from: 3, word: "tax-ra" });
    expect(wordBefore("hello @ad", 9, /@[\p{L}]*$/u)).toEqual({ from: 6, word: "@ad" });
    expect(wordBefore("a ", 2)).toEqual({ from: 2, word: "" });
  });
});
