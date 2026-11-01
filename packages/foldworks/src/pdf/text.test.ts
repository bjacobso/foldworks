import { describe, expect, it } from "vitest";
import { locateQuote, pdfTextItems, type PdfPageText } from "./text";
const box = { x: 10, y: 20, width: 50, height: 10 };
const pages: readonly PdfPageText[] = [
  { pageIndex: 0, items: [{ text: "An ofﬁce em-", hasEOL: true, rect: box }] },
  { pageIndex: 1, items: [{ text: "ployee may  bid.", hasEOL: false, rect: box }] },
];
describe("PDF text", () => {
  it("maps a rotated baseline and font ascent to user-space bounds", () => {
    const item = { str: "abc", dir: "ltr", width: 30, height: 10, fontName: "f", hasEOL: false };
    expect(
      pdfTextItems({ items: [{ ...item, transform: [10, 0, 0, 10, 20, 40] }], styles: {} })[0]
        ?.rect,
    ).toEqual({ x: 20, y: 38, width: 30, height: 10 });
    expect(
      pdfTextItems({ items: [{ ...item, transform: [0, 10, -10, 0, 20, 40] }], styles: {} })[0]
        ?.rect,
    ).toEqual({ x: 12, y: 40, width: 10, height: 30 });
  });
  it("matches whitespace, ligatures and explicit line-end hyphenation across pages", () => {
    expect(locateQuote(pages, "office employee may bid")).toEqual({
      _tag: "Found",
      regions: [
        { pageIndex: 0, rects: [box] },
        { pageIndex: 1, rects: [box] },
      ],
    });
    expect(locateQuote(pages, "may not bid")).toEqual({ _tag: "NotFound" });
    expect(locateQuote(pages, " \n ")).toEqual({ _tag: "EmptyQuote" });
  });
  it("does not join quotes across omitted or scanned pages", () => {
    expect(locateQuote([pages[0]!, { ...pages[1]!, pageIndex: 2 }], "office employee")._tag).toBe(
      "NotFound",
    );
    expect(
      locateQuote(
        [pages[0]!, { pageIndex: 1, items: [] }, { ...pages[1]!, pageIndex: 2 }],
        "office employee",
      )._tag,
    ).toBe("NotFound");
  });
  it("requires an occurrence for repeated quotes and preserves ordinary hyphens", () => {
    const repeated = [
      { pageIndex: 0, items: [{ text: "full-time full-time", hasEOL: false, rect: box }] },
    ];
    expect(locateQuote(repeated, "full-time")).toEqual({ _tag: "Ambiguous", occurrences: 2 });
    expect(locateQuote(repeated, "full-time", { occurrence: 1 })._tag).toBe("Found");
    expect(locateQuote(repeated, "full-time", { occurrence: -1 })._tag).toBe("NotFound");
    expect(locateQuote(repeated, "fulltime")._tag).toBe("NotFound");
  });
});
