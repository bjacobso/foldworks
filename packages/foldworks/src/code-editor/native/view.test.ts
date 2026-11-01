import { Option } from "effect";
import { inertHtml as h, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";
import { init } from "./model";
import type { Message } from "./message";
import { view } from "./view";

const reference = () =>
  init({ id: "reference", text: "const value = 1;", languageId: "typescript", readOnly: true });
const render = (
  model: ReturnType<typeof reference>,
  options: { meta?: string | null; showToolbar?: boolean } = {},
) =>
  view(
    {
      model,
      label: "Reference",
      toParentMessage: (message) => message,
      ...options,
    },
    h as unknown as HtmlBuilder<Message>,
  );
const text = (html: ReturnType<typeof render>, selector: string) => {
  if (html === null) throw new Error("Expected editor HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return Scene.textContent(node);
};

describe("native editor chrome", () => {
  it("shows useful default metadata and only navigation in read-only mode", () => {
    const html = render(reference());
    expect(text(html, ".native-editor__heading")).toBe("ReferenceTypeScript · Read only");
    expect(text(html, ".native-editor__tools")).toBe("FindLine Go");
    expect(text(html, ".native-editor__status")).not.toContain("Line Go");
  });

  it("lets hosts replace or remove metadata and hide the toolbar", () => {
    expect(
      text(render(reference(), { meta: "YAML · converted from JSON" }), ".native-editor__heading"),
    ).toBe("ReferenceYAML · converted from JSON");
    const hidden = render(reference(), { meta: null, showToolbar: false });
    expect(text(hidden, ".native-editor__heading")).toBe("Reference");
    if (hidden === null) throw new Error("Expected editor HTML");
    expect(Scene.findAll(hidden, ".native-editor__tools")).toHaveLength(0);
    expect(text(hidden, ".native-editor__status")).toContain("Line Go");
  });

  it("omits replacement controls from read-only search", () => {
    const html = render({
      ...reference(),
      search: { open: true, query: "value", replacement: "", caseSensitive: true },
    });
    expect(text(html, ".native-editor__search")).not.toContain("Replace");
    expect(text(html, ".native-editor__search")).toContain("PreviousNext");
    if (html === null) throw new Error("Expected editor HTML");
    expect(Scene.findAll(html, ".native-editor__search input")).toHaveLength(1);
  });
});
