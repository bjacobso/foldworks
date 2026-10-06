import { describe, expect, it } from "vitest";
import { Mentions } from "@foldworks/text-intelligence";
import { block, caret, createRegistry, plainText, text } from "./document";
import { init, Message, reduce } from "./model";
import { importMarkdown, exportMarkdown } from "./markdown";
import type { TextIntelligence } from "./intelligence";
const registry = createRegistry();
const intelligence: TextIntelligence = {
  complete: (node, _document, caret) => {
    const query = Mentions.queryAt(plainText(node), caret);
    return (
      query &&
      Mentions.suggestions(query, plainText(node), {
        entities: [{ id: "stable", name: "maya", kind: "mention", label: "Maya" }],
      })
    );
  },
};
const step = (model: ReturnType<typeof init>, message: Message) =>
  reduce(model, message, registry, intelligence);
const ready = (value = "@mystery, next", offset = 2) => {
  const model = init({
    id: "test",
    document: {
      version: 1,
      blocks: [block("p", "paragraph", [text(value, [{ type: "bold", value: "" }])])],
    },
  });
  return step(
    step(model, Message.Selected({ selection: caret("p", offset) })),
    Message.RequestedCompletion(),
  );
};
describe("generic native editor intelligence", () => {
  it("accepts in one transaction, retaining surrounding marks and caret through undo/redo", () => {
    const model = ready();
    const accepted = step(
      model,
      Message.AcceptedCompletion({ index: 0, expectedRevision: model.revision }),
    );
    expect(plainText(accepted.document.blocks[0]!)).toBe("@maya, next");
    expect(accepted.selection).toEqual(caret("p", 5));
    expect(accepted.document.blocks[0]!.content).toEqual([
      text("@maya, next", [{ type: "bold", value: "" }]),
    ]);
    const undone = step(accepted, Message.Undo());
    expect(undone.document).toEqual(model.document);
    expect(undone.selection).toEqual(model.selection);
    expect(step(undone, Message.Redo()).document).toEqual(accepted.document);
  });
  it("rejects stale acceptance after selection or revision changes", () => {
    const model = ready();
    expect(step(model, Message.AcceptedCompletion({ index: 0, expectedRevision: -1 }))).toBe(model);
    const moved = step(model, Message.Selected({ selection: caret("p", 11) }));
    expect(moved.completion).toBeNull();
    expect(
      step(moved, Message.AcceptedCompletion({ index: 0, expectedRevision: model.revision }))
        .document,
    ).toEqual(model.document);
    const edited = step(
      model,
      Message.Input({
        kind: "text",
        value: "a",
        selection: model.selection,
        time: 100,
        baseRevision: model.revision,
      }),
    );
    expect(
      step(edited, Message.AcceptedCompletion({ index: 0, expectedRevision: model.revision }))
        .document,
    ).toEqual(edited.document);
  });
  it("replaces a selection with a trigger, offers completions and dismisses explicitly", () => {
    let model = ready("Selected text", 0);
    model = step(
      model,
      Message.Input({
        kind: "text",
        value: "@",
        selection: { anchor: { id: "p", offset: 0 }, focus: { id: "p", offset: 13 } },
        time: 10,
        baseRevision: model.revision,
      }),
    );
    expect(plainText(model.document.blocks[0]!)).toBe("@");
    expect(model.completion?.items[0]?.label).toBe("@maya");
    model = step(model, Message.DismissedIntelligence());
    expect(model.completion).toBeNull();
    expect(step(model, Message.Selected({ selection: model.selection })).completion).toBeNull();
  });
  it("keeps read-only content and doesn't offer suggestions for noncollapsed selections", () => {
    let model = ready();
    model = step(model, Message.ToggleEditable());
    expect(model.completion).toBeNull();
    expect(step(model, Message.RequestedCompletion()).completion).toBeNull();
    expect(
      step(model, Message.AcceptedCompletion({ index: 0, expectedRevision: model.revision }))
        .document,
    ).toEqual(model.document);
    const selected = step(
      ready(),
      Message.Selected({
        selection: { anchor: { id: "p", offset: 0 }, focus: { id: "p", offset: 2 } },
      }),
    );
    expect(step(selected, Message.RequestedCompletion()).completion).toBeNull();
  });
});

describe("Markdown literal marker provenance", () => {
  it("keeps escapes, inline formatting and plain-text identity through semantic round trips", () => {
    const source = "**\\@maya** and \\#draft with @maya, #draft and `@code`.\n\n```\n@code\n```\n";
    const imported = importMarkdown(source, registry).value!;
    expect(plainText(imported.blocks[0]!)).toBe("@maya and #draft with @maya, #draft and @code.");
    const literals = imported.blocks[0]!.content.filter((run) =>
      run.marks.some((mark) => mark.type === "literal"),
    );
    expect(literals.map((run) => run.text)).toEqual(["@", "#"]);
    expect(literals[0]?.marks.some((mark) => mark.type === "bold")).toBe(true);
    const exported = exportMarkdown(imported, registry).value!;
    expect(exported).toContain("\\@maya");
    expect(exported).toContain("\\#draft");
    const restored = importMarkdown(exported, registry).value!;
    expect(restored.blocks.map((node) => ({ ...node, id: "" }))).toEqual(
      imported.blocks.map((node) => ({ ...node, id: "" })),
    );
  });
  it("keeps active tags at the beginning of a paragraph and adjacent literal markers", () => {
    for (const source of ["#draft", "\\@\\#draft", "&amp; \\@maya"]) {
      const doc = importMarkdown(source, registry).value!;
      const saved = exportMarkdown(doc, registry).value!;
      expect(importMarkdown(saved, registry).value!.blocks[0]!.content).toEqual(
        doc.blocks[0]!.content,
      );
    }
  });
  it("retains inline code formatting when it supersedes a literal marker", () => {
    let model = init({ id: "literal-code", markdown: "\\@maya" });
    const id = model.document.blocks[0]!.id;
    model = step(
      model,
      Message.Selected({ selection: { anchor: { id, offset: 0 }, focus: { id, offset: 5 } } }),
    );
    model = step(model, Message.Format({ type: "code" }));
    expect(model.document.blocks[0]!.content).toEqual([
      text("@maya", [{ type: "code", value: "" }]),
    ]);
    const saved = exportMarkdown(model.document, registry).value!;
    expect(saved).toContain("`@maya`");
    expect(importMarkdown(saved, registry).value!.blocks[0]!.content).toEqual(
      model.document.blocks[0]!.content,
    );
  });

  it("doesn't inherit literal provenance when typing after an escaped marker", () => {
    const model = init({ id: "literal", markdown: "\\@" });
    const id = model.document.blocks[0]!.id;
    const edited = step(
      model,
      Message.Input({
        kind: "text",
        value: "maya",
        selection: caret(id, 1),
        time: 10,
        baseRevision: model.revision,
      }),
    );
    expect(edited.document.blocks[0]!.content[1]!.marks).toEqual([]);
  });
});
