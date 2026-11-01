import { describe, expect, it } from "vitest";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { HighlightedText, innermostRange, snippets } from "./highlighted-text";

const h = inertHtml as unknown as HtmlBuilder<string>;
describe("highlighted text", () => {
  it("chooses the narrowest range deterministically", () => {
    const outer = { key: "outer", from: 0, to: 10 };
    const inner = { key: "inner", from: 2, to: 4 };
    expect(innermostRange([outer, inner])?.key).toBe("inner");
    expect(innermostRange([inner, { ...inner, key: "tie" }])?.key).toBe("inner");
  });
  it("keeps overlapping and fully covered ranges accessible", () => {
    const html = HighlightedText.view(
      {
        text: "abcdef",
        ranges: [
          { key: "a", from: 0, to: 6, onClick: "a" },
          { key: "b", from: 2, to: 4, onClick: "b", tooltip: "Evidence" },
          { key: "c", from: 2, to: 4, onClick: "c" },
        ],
      },
      h,
    )!;
    expect(Scene.findAll(html, '[data-depth="3"]')).toHaveLength(1);
    expect(Scene.findAll(html, '[aria-description="Evidence"]')).toHaveLength(1);
    expect(Scene.findAll(html, '[data-highlight-key="c"]')).toHaveLength(1);
    expect(Scene.findAll(html, '[tabIndex="0"]')).toHaveLength(2);
    expect(Scene.findAll(html, '[tabIndex="-1"]')).toHaveLength(1);
  });
  it("merges context windows and retains source offsets", () => {
    const text = "0123456789abcdefghijklmnop";
    expect(
      snippets(
        text,
        [
          { from: 5, to: 7 },
          { from: 10, to: 12 },
        ],
        2,
      ),
    ).toEqual([
      {
        from: 3,
        to: 14,
        text: text.slice(3, 14),
        leadingEllipsis: true,
        trailingEllipsis: true,
        ranges: [
          { from: 5, to: 7 },
          { from: 10, to: 12 },
        ],
      },
    ]);
    expect(
      snippets(
        text,
        [
          { from: -3, to: 1 },
          { from: 5, to: 5 },
          { from: NaN, to: 3 },
        ],
        0,
      )[0]?.text,
    ).toBe("0");
  });
});
