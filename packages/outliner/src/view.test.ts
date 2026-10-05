import { Option } from "effect";
import { inertHtml, type Html, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import type { Message } from "./message";
import { init, type Model } from "./model";
import { item } from "./outline";
import { view, type ViewInputs } from "./view";

const h = inertHtml as unknown as HtmlBuilder<Message>;

const model = (overrides: Partial<Model> = {}): Model => ({
  ...init({ id: "o", items: [item("a", "total 21"), item("b", "plain")] }),
  ...overrides,
});

const render = (state: Model, inputs: ViewInputs = {}) => {
  const html = view(state, inputs, h);
  if (html === null) throw new Error("Expected outline HTML");
  return html;
};

const text = (html: NonNullable<Html>, selector: string) => {
  const node = Option.getOrUndefined(Scene.find(html, selector));
  return node === undefined ? undefined : Scene.textContent(node);
};

describe("view", () => {
  it("underlines row diagnostics in the painted text", () => {
    const html = render(model(), {
      decorations: {
        a: {
          spans: [{ text: "total", kind: "function" }, { text: " 21" }],
          diagnostics: [{ from: 3, to: 7, severity: "error", message: "Nope" }],
        },
      },
    });
    const pieces = Scene.findAll(html, '[data-outline-mirror="a"] .fw-outliner__span');
    expect(pieces.map((piece) => Scene.textContent(piece))).toEqual(["tot", "al", " 2", "1"]);
    expect(Scene.findAll(html, '[data-outline-mirror="a"] .fw-text-diagnostic')).toHaveLength(2);
    // Rows without decorations keep their plain, hidden mirror.
    expect(text(html, '[data-outline-mirror="b"]')).toBe("plain​");
  });

  it("shows hover content for the hovered range, with problems first", () => {
    const hovered = model({ hover: { id: "a", offset: 1, source: "Pointer" } });
    const inputs: ViewInputs = {
      decorations: {
        a: { diagnostics: [{ from: 0, to: 5, severity: "warning", message: "Slow" }] },
      },
      hover: ({ id, offset, text: value }) =>
        id === "a" && offset < 5
          ? { from: 0, to: 5, content: h.p([], [`About ${value.slice(0, 5)}`]) }
          : null,
    };
    const html = render(hovered, inputs);
    expect(text(html, "#o-hover")).toBe("Warning SlowAbout total");
    expect(text(html, '[data-outline-mirror="a"] .fw-text-hovered')).toBe("total");
    const textarea = Option.getOrUndefined(Scene.find(html, "#o-text-a"));
    expect(textarea === undefined ? undefined : Scene.attr(textarea, "aria-describedby")).toEqual(
      Option.some("o-hover"),
    );
    expect(
      text(render(model({ hover: { id: "a", offset: 6, source: "Pointer" } }), inputs), "#o-hover"),
    ).toBeUndefined();
  });
});
