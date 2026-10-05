import { Option } from "effect";
import { inertHtml as h, type Html, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { CompletionPopup, HoverPopup, optionId } from "./popup";

type Message = Readonly<{ chose: number }>;
const builder = h as unknown as HtmlBuilder<Message>;

const find = (html: NonNullable<Html>, selector: string) => {
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};

describe("popups", () => {
  it("renders completion options with the active one selected and the query emphasized", () => {
    const html = CompletionPopup.view(
      {
        id: "names",
        items: [{ label: "invoice-total", detail: "fn", kind: "function" }, { label: "in" }],
        index: 1,
        query: "in",
        anchor: { selector: "#text", offset: 3 },
        onChoose: (index) => ({ chose: index }),
      },
      builder,
    );
    if (html === null) throw new Error("Expected popup HTML");
    expect(Scene.findAll(html, '[role="option"]')).toHaveLength(2);
    expect(Scene.textContent(find(html, `#${optionId("names", 0)}`))).toBe("invoice-totalfn");
    expect(Scene.textContent(find(html, "mark"))).toBe("in");
    expect(Scene.findAll(html, '[aria-selected="true"]')).toHaveLength(1);
  });

  it("puts problems before the host's content", () => {
    const html = HoverPopup.view(
      {
        id: "hover",
        anchor: { selector: "#text", offset: 0 },
        diagnostics: [
          { from: 0, to: 2, severity: "warning", message: "Unused" },
          { from: 0, to: 2, severity: "error", message: "Undefined", code: "E1" },
        ],
        content: builder.p([], ["A number"]),
      },
      builder,
    );
    if (html === null) throw new Error("Expected popup HTML");
    expect(Scene.findAll(html, "li").map((node) => Scene.textContent(node))).toEqual([
      "Error Undefined E1",
      "Warning Unused",
    ]);
    expect(Scene.textContent(find(html, ".fw-hover__content"))).toBe("A number");
  });
});
