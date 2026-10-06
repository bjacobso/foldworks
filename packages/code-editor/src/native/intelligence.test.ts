import { Option } from "effect";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";
import { Completion } from "@foldworks/text-intelligence";
import { Operation, documentVersion } from "../contracts";
import { init, type Model } from "./model";
import { Message } from "./message";
import { update } from "./update";
import { difference } from "./operations";
import type { Request } from "./update";
import { view } from "./view";

const ready = (text: string, options: Parameters<typeof init>[0] = { id: "ed" }) =>
  update(init({ ...options, id: "ed", text }), Message.Mounted({ session: 0, lease: "test" }))
    .model;
const execute = (model: Model, operation: Operation) =>
  update(model, Message.Execute({ operation }));
const typed = (model: Model, text: string, caret = text.length) =>
  update(
    model,
    Message.Edited({
      session: 0,
      lease: "test",
      baseRevision: model.document.revision,
      edits: difference(model.document.text, text),
      before: model.selection,
      selection: { anchor: caret, head: caret },
      kind: "insertText",
      time: 0,
      groupId: 0,
    }),
  ).model;
const select = (model: Model, head: number) =>
  update(
    model,
    Message.Selected({
      session: 0,
      lease: "test",
      revision: model.document.revision,
      selection: { anchor: head, head },
    }),
  ).model;

describe("host text intelligence", () => {
  it("accepts semantic tokens for the current revision and carries them through edits", () => {
    const model = ready("one total tax");
    const stale = execute(
      model,
      Operation.SetSemanticTokens({
        ...documentVersion(model.document),
        revision: 9,
        tokens: [{ from: 4, to: 9, kind: "function" }],
      }),
    );
    expect(stale.model.tokens).toEqual([]);
    const painted = execute(
      model,
      Operation.SetSemanticTokens({
        ...documentVersion(model.document),
        tokens: [
          { from: 10, to: 13, kind: "variable" },
          { from: 4, to: 9, kind: "function" },
        ],
      }),
    ).model;
    expect(painted.tokens.map((token) => token.kind)).toEqual(["function", "variable"]);
    // Typing before a token shifts it; typing at or in a token drops it until the next batch.
    expect(typed(painted, "one1 total tax", 4).tokens).toEqual([
      { from: 5, to: 10, kind: "function" },
      { from: 11, to: 14, kind: "variable" },
    ]);
    expect(typed(painted, "one totals tax", 10).tokens).toEqual([
      { from: 11, to: 14, kind: "variable" },
    ]);
  });

  it("asks the host for suggestions and narrows its offer as the user types", () => {
    const model = select(ready("(tot", { id: "ed", suggestions: "host" }), 4);
    const asked = update(model, Message.OpenCompletion({ open: true }));
    expect(asked.model.completion).toBeNull();
    expect(asked.outMessage).toEqual({
      _tag: "RequestedCompletion",
      version: documentVersion(model.document),
      offset: 4,
    });
    const items = [{ label: "total", detail: "fn" }, { label: "totem" }, { label: "tax" }];
    expect(
      execute(
        model,
        Operation.ShowCompletions({
          expected: { ...documentVersion(model.document), revision: 3 },
          from: 1,
          to: 4,
          items,
        }),
      ).model.completion,
    ).toBeNull();
    const offered = execute(
      model,
      Operation.ShowCompletions({
        expected: documentVersion(model.document),
        from: 1,
        to: 4,
        items,
      }),
    ).model;
    expect(offered.completion).toEqual({ from: 1, to: 4, items, index: 0 });
    const narrowed = typed(offered, "(tota");
    expect(narrowed.completion).toEqual({ from: 1, to: 5, items, index: 0 });
    const accepted = update(narrowed, Message.Run({ action: "complete" }));
    const request = accepted.commands![0]!.args!.request as Request;
    expect(request.edits).toEqual([{ from: 1, to: 5, insert: "total" }]);
    expect(request.selection).toEqual({ anchor: 6, head: 6 });
    expect(select(offered, 0).completion).toBeNull();
  });

  it("still suggests document words by default", () => {
    const model = select(ready("customWidget = 1;\ncust"), 22);
    const opened = update(model, Message.OpenCompletion({ open: true })).model;
    expect(
      Completion.visible(opened.completion!, opened.document.text, 22).map((item) => item.label),
    ).toEqual(["customWidget"]);
  });

  it("reports hover requests and keeps keyboard hovers until the caret moves", () => {
    const model = ready("total tax");
    const pointed = update(
      model,
      Message.Hovered({ session: 0, lease: "test", revision: 0, offset: 2, source: "Pointer" }),
    );
    expect(pointed.model.hover).toEqual({ offset: 2, source: "Pointer" });
    expect(pointed.outMessage).toEqual({
      _tag: "Hovered",
      version: documentVersion(model.document),
      offset: 2,
      source: "Pointer",
    });
    const asked = update(
      model,
      Message.Hovered({ session: 0, lease: "test", revision: 0, offset: 7, source: "Keyboard" }),
    ).model;
    expect(
      update(
        asked,
        Message.Hovered({
          session: 0,
          lease: "test",
          revision: 0,
          offset: null,
          source: "Pointer",
        }),
      ).model.hover,
    ).toEqual({ offset: 7, source: "Keyboard" });
    expect(select(asked, 3).hover).toBeNull();
  });

  it("reveals a range without moving focus or the selection", () => {
    const model = ready("a\nb\nc");
    const result = execute(
      model,
      Operation.Reveal({ expected: documentVersion(model.document), range: { from: 4, to: 5 } }),
    );
    const request = result.commands![0]!.args!.request as Request;
    expect(request).toMatchObject({
      kind: "reveal",
      focus: false,
      at: 4,
      edits: [],
      selection: model.selection,
    });
  });

  it("paints host tokens and highlights, and shows hover content with problems first", () => {
    const tokens = execute(
      ready("total tax"),
      Operation.SetSemanticTokens({
        uri: "inmemory://foldworks/ed",
        session: 0,
        revision: 0,
        tokens: [{ from: 0, to: 5, kind: "function" }],
      }),
    ).model;
    const hovered = update(
      tokens,
      Message.Hovered({ session: 0, lease: "test", revision: 0, offset: 7, source: "Pointer" }),
    ).model;
    const h = inertHtml as unknown as HtmlBuilder<Message>;
    const html = view(
      {
        model: hovered,
        label: "Source",
        toParentMessage: (message) => message,
        highlights: [{ from: 0, to: 9, kind: "focus" }],
        hover: ({ offset }) =>
          offset >= 6 ? { from: 6, to: 9, content: h.p([], ["A local"]) } : null,
      },
      h,
    );
    if (html === null) throw new Error("Expected editor HTML");
    const kinds = Scene.findAll(html, ".native-token--semantic").map((node) =>
      Option.getOrUndefined(Scene.attr(node, "data-kind")),
    );
    expect(kinds).toEqual(["function"]);
    expect(Scene.findAll(html, ".native-editor__line--highlighted")).toHaveLength(1);
    expect(Scene.textContent(Option.getOrThrow(Scene.find(html, "#ed-hover")))).toBe("A local");
    expect(Scene.textContent(Option.getOrThrow(Scene.find(html, ".fw-text-hovered")))).toBe("tax");
  });

  it("keeps a host's diagnostics when the editor mounts, and leaves focus alone for host edits", () => {
    const fresh = init({ id: "ed", text: "x" });
    const reported = update(
      fresh,
      Message.Execute({
        operation: Operation.SetDiagnostics({
          uri: fresh.document.uri,
          session: 0,
          revision: 0,
          languageId: "text",
          source: "language-service",
          diagnostics: [{ from: 0, to: 1, severity: "error", message: "Nope" }],
        }),
      }),
    ).model;
    const mounted = update(reported, Message.Mounted({ session: 0, lease: "test" })).model;
    expect(mounted.diagnostics.map((batch) => batch.source)).toEqual(["language-service", "json"]);
    const edited = execute(
      mounted,
      Operation.ApplyEdits({
        expected: documentVersion(mounted.document),
        edits: [{ from: 1, to: 1, insert: "y" }],
      }),
    );
    expect(edited.commands![0]!.args!.request as Request).toMatchObject({
      focus: false,
      reveal: false,
    });
  });
});
