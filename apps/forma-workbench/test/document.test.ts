import { describe, expect, it } from "vitest";
import { item } from "foldworks/outliner";
import { identifySyntax, outlineToSource, sourceToOutline } from "@formalang/ts/syntax";

import { fromRows, sameRows, toRows } from "../src/workbench/document.js";
import { lexicalTokens } from "../src/workbench/decorations.js";

const source = "(define total [x]\n  ; doubles\n  (* x 2))\n(total 21)\n";

describe("outline rows", () => {
  it("round-trips through the outliner with the codec's ids", () => {
    const read = sourceToOutline(source);
    const items = fromRows(read.items);
    expect(items.map((node) => [node.id, node.text])).toEqual(
      read.items.map((row) => [row.id, row.text]),
    );
    const printed = outlineToSource(toRows(items), { base: { source, identity: read.identity } });
    expect(printed.source).toBe(source);
    expect(sameRows(toRows(items), read.items)).toBe(true);
  });

  it("keeps the folding of rows that already existed", () => {
    const read = sourceToOutline(source);
    const [definition] = read.items;
    const previous = [item(definition!.id, definition!.text, [item("child")], { collapsed: true })];
    const [kept] = fromRows(read.items, previous);
    expect(kept!.collapsed).toBe(true);
  });
});

describe("tokens", () => {
  it("highlights a row's text from its syntax", () => {
    const text = 'let [tax (* 2 :rate)] "s" ; note';
    const kinds = lexicalTokens(text).map((token) => [
      text.slice(token.from, token.to),
      token.kind,
    ]);
    expect(kinds).toEqual([
      ["[", "paren"],
      ["(", "paren"],
      ["2", "number"],
      [":rate", "keyword"],
      [")", "paren"],
      ["]", "paren"],
      ['"s"', "string"],
      ["; note", "comment"],
    ]);
    expect(identifySyntax(text).errors).toEqual([]);
  });
});
