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

  it("shows suggestions narrowed by what was typed and points the text at the active one", () => {
    const html = render(
      model({
        focus: { id: "a", start: 3, end: 3 },
        completion: {
          id: "a",
          from: 0,
          to: 3,
          items: [{ label: "total" }, { label: "tax" }, { label: "totem", detail: "pole" }],
          index: 1,
        },
      }),
    );
    expect(Scene.findAll(html, '[role="option"]').map((node) => Scene.textContent(node))).toEqual([
      "total",
      "totempole",
    ]);
    const textarea = Option.getOrUndefined(Scene.find(html, "#o-text-a"));
    if (textarea === undefined) throw new Error("Expected the item text");
    expect(Scene.attr(textarea, "aria-activedescendant")).toEqual(
      Option.some("o-completion-option-1"),
    );
    expect(Scene.attr(textarea, "aria-autocomplete")).toEqual(Option.some("list"));
  });

  it("places placeholders among and after children, under leaves, but not under folded items", () => {
    const state = init({
      id: "o",
      items: [
        item("a", "Alpha", [item("a1", "One"), item("a2", "Two")]),
        item("b", "Beta"),
        item("c", "Gamma", [item("c1", "Hidden")], { collapsed: true }),
      ],
    });
    const html = render(state, {
      placeholders: (parentId) =>
        parentId === "a"
          ? [
              { key: "first", label: "first step", index: 0 },
              { key: "more", label: "add step", text: "step " },
            ]
          : parentId === null || parentId === "b" || parentId === "c"
            ? [{ key: "more", label: `add to ${parentId ?? "top"}` }]
            : [],
    });
    const rows = Scene.findAll(html, '[role="treeitem"]').map((node) =>
      Option.getOrElse(Scene.attr(node, "aria-label"), () => ""),
    );
    expect(rows).toEqual([
      "Alpha",
      "Add first step",
      "One",
      "Two",
      "Add add step",
      "Beta",
      "Add add to b",
      "Gamma",
      "Add add to top",
    ]);
    const more = Option.getOrUndefined(
      Scene.find(html, '[data-parent="a"][data-outline-placeholder="more"]'),
    );
    if (more === undefined) throw new Error("Expected the placeholder");
    expect(Scene.attr(more, "data-index")).toEqual(Option.some("2"));
    expect(Scene.attr(more, "data-text")).toEqual(Option.some("step "));
  });

  it("shows a host's view under folded items only", () => {
    const state = init({
      id: "o",
      items: [
        item("open", "Open", [item("o1", "Child")]),
        item("shut", "Shut", [item("s1", "Hidden")], { collapsed: true }),
        item("leaf", "Leaf"),
      ],
    });
    const html = render(state, {
      foldedView: (row) => ({
        label: `${row.text} summary`,
        content: h.p([], [`${row.id} has children`]),
      }),
    });
    const views = Scene.findAll(html, "[data-outline-view]");
    expect(views.map((node) => Option.getOrUndefined(Scene.attr(node, "aria-label")))).toEqual([
      "Shut summary",
    ]);
    expect(Scene.textContent(views[0]!)).toBe("shut has children");
  });
});
