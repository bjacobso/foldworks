import { describe, expect, it } from "vitest";
import {
  block,
  caret,
  createRegistry,
  find,
  leaves,
  normalizeRuns,
  plainText,
  text,
  validateDocument,
  type Document,
} from "./document";
import { allocator, deleteText, replaceRange, split } from "./editing";
import { exportMarkdown, importMarkdown } from "./markdown";
import { init, Message, reduce } from "./model";

const registry = createRegistry([
  {
    name: "project",
    label: "Project",
    kind: "atom",
    defaults: { label: "Launch" },
  },
]);
const document = (...values: string[]): Document => ({
  version: 1,
  blocks: values.map((value, index) =>
    block(`p${index}`, "paragraph", [text(value)]),
  ),
});
const semantic = (doc: Document): unknown =>
  JSON.parse(JSON.stringify(doc), (key, value) =>
    key === "id" ? undefined : value,
  );

describe("native document transactions", () => {
  it("keeps untouched subtrees shared with the undo snapshot", () => {
    const doc = document("Alpha", "Beta");
    const container = block("quote", "blockquote", [], {}, [block("nested")]);
    const original = { ...doc, blocks: [...doc.blocks, container] };
    const edited = replaceRange(
      original,
      caret("p0", 5),
      "!",
      [],
      registry,
      allocator(original, "new"),
    );
    expect(plainText(original.blocks[0]!)).toBe("Alpha");
    expect(plainText(edited.document.blocks[0]!)).toBe("Alpha!");
    expect(edited.document.blocks[1]).toBe(original.blocks[1]);
    expect(edited.document.blocks[2]).toBe(container);
  });
  it("replaces a backwards range across blocks and maps the caret", () => {
    const doc = document("Alpha", "Middle", "Omega");
    const edited = replaceRange(
      doc,
      { anchor: { id: "p2", offset: 3 }, focus: { id: "p0", offset: 2 } },
      "!",
      [],
      registry,
      allocator(doc, "new"),
    );
    expect(edited.document.blocks.map(plainText)).toEqual(["Al!ga"]);
    expect(edited.selection).toEqual(caret("p0", 3));
    expect(validateDocument(edited.document, registry)).toBeUndefined();
  });
  it("splits marks without losing content and joins text again", () => {
    const doc: Document = {
      version: 1,
      blocks: [
        block("p", "paragraph", [text("Hello", [{ type: "bold", value: "" }])]),
      ],
    };
    const edited = split(doc, caret("p", 2), registry, allocator(doc, "new"));
    expect(edited.document.blocks.map(plainText)).toEqual(["He", "llo"]);
    const joined = deleteText(
      edited.document,
      edited.selection,
      true,
      registry,
      allocator(edited.document, "join"),
    );
    expect(semantic(joined.document)).toEqual(semantic(doc));
  });
  it("deletes complete graphemes", () => {
    for (const grapheme of ["👨‍👩‍👧‍👦", "e\u0301", "🇺🇸", "😀"]) {
      const doc = document(`A${grapheme}Z`);
      const edited = deleteText(
        doc,
        caret("p0", 1 + grapheme.length),
        true,
        registry,
        allocator(doc, "new"),
      );
      expect(plainText(edited.document.blocks[0]!)).toBe("AZ");
      expect(edited.selection).toEqual(caret("p0", 1));
    }
  });
  it("groups typing but keeps block moves separately undoable", () => {
    let model = init(
      { id: "test", document: document("", "Second") },
      registry,
    );
    for (const [index, value] of [..."Hello"].entries())
      model = reduce(
        model,
        Message.Input({
          baseRevision: model.revision,
          kind: "text",
          value,
          selection: model.selection,
          time: 100 + index * 10,
        }),
        registry,
      );
    expect(model.past).toHaveLength(1);
    model = reduce(
      model,
      Message.Move({ id: "p0", direction: "down" }),
      registry,
    );
    expect(model.document.blocks.map(plainText)).toEqual(["Second", "Hello"]);
    model = reduce(model, Message.Undo(), registry);
    expect(model.document.blocks.map(plainText)).toEqual(["Hello", "Second"]);
    model = reduce(model, Message.Undo(), registry);
    expect(model.document.blocks.map(plainText)).toEqual(["", "Second"]);
    model = reduce(model, Message.Redo(), registry);
    expect(model.selection).toEqual(caret("p0", 5));
  });
  it("regenerates all duplicate IDs and never deletes the last editing position", () => {
    let model = init(
      { id: "test", markdown: "> Quote\n\nParagraph" },
      registry,
    );
    model = reduce(
      model,
      Message.Duplicate({ id: model.document.blocks[0]!.id }),
      registry,
    );
    expect(validateDocument(model.document, registry)).toBeUndefined();
    while (model.document.blocks.length > 1)
      model = reduce(
        model,
        Message.DeleteBlock({ id: model.document.blocks[0]!.id }),
        registry,
      );
    model = reduce(
      model,
      Message.DeleteBlock({ id: model.document.blocks[0]!.id }),
      registry,
    );
    expect(model.document.blocks).toHaveLength(1);
    expect(model.document.blocks[0]!.type).toBe("paragraph");
  });
  it("rejects stale source, imports, and loads without changing content", () => {
    let model = init({ id: "test", document: document("Original") }, registry);
    model = reduce(model, Message.ToggleSource(), registry);
    model = reduce(model, Message.Insert({ type: "paragraph" }), registry);
    const saved = model.document;
    for (const message of [
      Message.ApplySource(),
      Message.Imported({ value: "Overwritten", expectedRevision: 0 }),
      Message.Load({ document: document("Overwritten"), expectedRevision: 0 }),
    ]) {
      const result = reduce(model, message, registry);
      expect(result.document).toEqual(saved);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });
  it("preserves invariants over deterministic mixed edit sequences", () => {
    let model = init({ id: "sequence" }, registry);
    let seed = 17;
    for (let index = 0; index < 250; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const value = seed % 7;
      const message =
        value < 3
          ? Message.Input({
              baseRevision: model.revision,
              kind: "text",
              value: String.fromCharCode(97 + value),
              selection: model.selection,
              time: index * 1100,
            })
          : value === 3
            ? Message.Input({
                baseRevision: model.revision,
                kind: "split",
                value: "",
                selection: model.selection,
                time: index * 1100,
              })
            : value === 4
              ? Message.Input({
                  baseRevision: model.revision,
                  kind: "backward",
                  value: "",
                  selection: model.selection,
                  time: index * 1100,
                })
              : value === 5
                ? Message.Undo()
                : Message.Redo();
      model = reduce(model, message, registry);
      expect(validateDocument(model.document, registry)).toBeUndefined();
      expect(find(model.document, model.selection.anchor.id)).toBeDefined();
      for (const node of leaves(model.document))
        expect(normalizeRuns(normalizeRuns(node.content))).toEqual(
          normalizeRuns(node.content),
        );
    }
  });
});

describe("Markdown fidelity", () => {
  it("round trips supported rich text, nested lists, tasks, code, callouts, and custom atoms", () => {
    const source =
      '# Title\n\nA **bold** and *italic* [link](https://example.com).\n\n- One\n  - Nested\n\n- [x] Done\n- [ ] Next\n\n> Quote\n\n```ts\nconst x = 1\n```\n\n:::foldworks-callout{version="1" tone="info"}\nA **note**.\n:::\n\n::foldworks-project{version="1" label="Launch"}\n';
    const parsed = importMarkdown(source, registry);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.value).toBeDefined();
    const exported = exportMarkdown(parsed.value!, registry);
    expect(exported.diagnostics).toEqual([]);
    expect(semantic(importMarkdown(exported.value!, registry).value!)).toEqual(
      semantic(parsed.value!),
    );
  });
  it("reports portable export losses and requires an explicit fallback", () => {
    const parsed = importMarkdown(
      ':::foldworks-callout{version="1" tone="info"}\nNote\n:::',
      registry,
    ).value!;
    expect(exportMarkdown(parsed, registry, "portable").value).toBeUndefined();
    const fallback = exportMarkdown(parsed, registry, "portable", true);
    expect(fallback.value).toContain("> Note");
    expect(fallback.diagnostics).toHaveLength(1);
  });
  it("rejects unknown directives, raw HTML, images, unsafe links, and tables without data loss", () => {
    for (const source of [
      '::foldworks-unknown{version="1"}',
      "<script>alert(1)</script>",
      "![image](https://example.com/a.png)",
      "[bad](javascript:alert)",
      "| a | b |\n|---|---|\n| 1 | 2 |",
    ]) {
      const result = importMarkdown(source, registry);
      expect(result.value).toBeUndefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });
  it("rejects duplicate block definitions", () => {
    expect(() =>
      createRegistry([{ name: "paragraph", label: "Oops", kind: "text" }]),
    ).toThrow(/duplicate/);
  });
  it("round trips empty callouts and custom text content", () => {
    const custom = createRegistry([
      { name: "summary", label: "Summary", kind: "text" },
    ]);
    for (const source of [
      ':::foldworks-callout{version="1" tone="info"}\n:::',
      ':::foldworks-summary{version="1"}\nA **summary**\n:::',
    ]) {
      const imported = importMarkdown(source, custom);
      expect(imported.diagnostics).toEqual([]);
      const exported = exportMarkdown(imported.value!, custom);
      expect(semantic(importMarkdown(exported.value!, custom).value!)).toEqual(
        semantic(imported.value!),
      );
    }
  });
  it("preserves combinations of inline code and emphasis", () => {
    const imported = importMarkdown(
      "*`code`* and **`bold code`**",
      registry,
    ).value!;
    const exported = exportMarkdown(imported, registry);
    expect(semantic(importMarkdown(exported.value!, registry).value!)).toEqual(
      semantic(imported),
    );
  });
  it("keeps an editing position for atom-only documents", () => {
    const model = init({ id: "rule", markdown: "---" }, registry);
    expect(model.document.blocks.map((node) => node.type)).toEqual([
      "rule",
      "paragraph",
    ]);
    expect(find(model.document, model.selection.anchor.id)?.type).toBe(
      "paragraph",
    );
  });
});
