import { Effect, Schema as S } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "./index";
import { Operation, documentVersion, type EditorImplementation, type EditorSnapshot } from "./contracts";
import { historyPlan } from "./native/history";
import { applyEdits } from "./document";
import type { Request } from "./native/update";

const adapter: EditorImplementation<CodeEditor.Model, CodeEditor.Message> = CodeEditor.implementation;
const ready = () => {
  const model = adapter.init({ id: "test", uri: "file:///test.ts", text: "const x = 1;", languageId: "typescript" });
  return adapter.update(model, CodeEditor.Message.Mounted({ session: 0, lease: "test-mount" })).model;
};
const send = (model: CodeEditor.Model, operation: Operation) => adapter.update(model, adapter.execute(operation));
const change = (model: CodeEditor.Model, expected = documentVersion(model.document)) => Operation.ApplyEdits({
  expected, edits: [{ from: 10, to: 11, insert: "42" }], selection: { anchor: 12, head: 12 },
});
afterEach(() => vi.unstubAllGlobals());

describe("implementation-independent editor contract", () => {
  it("exposes host snapshots without native history, cache, or mount state", () => {
    const model = ready();
    const snapshot: EditorSnapshot = adapter.snapshot(model);
    expect(snapshot.document.text).toBe("const x = 1;");
    expect(snapshot).not.toHaveProperty("lease");
    expect(snapshot).not.toHaveProperty("lines");
    expect(snapshot).not.toHaveProperty("past");
    expect(S.is(adapter.Model)(model)).toBe(true);
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
  it("applies external edits only on acknowledgement, emits their origin, and records undo", () => {
    const model = ready();
    const result = send(model, change(model));
    expect(result.model.document.text).toBe(model.document.text);
    const request = result.commands![0]!.args!.request as Request;
    expect(request).toMatchObject({ lease: "test-mount", session: 0, revision: 0, kind: "external" });
    const acknowledged = adapter.update(model, CodeEditor.Message.Edited({
      lease: request.lease, session: request.session, baseRevision: request.revision,
      edits: request.edits, before: model.selection, selection: request.selection,
      kind: request.kind, groupId: request.groupId, time: 1,
    }));
    expect(acknowledged.outMessage).toMatchObject({ _tag: "ChangedDocument", origin: "external", document: { text: "const x = 42;", revision: 1 } });
    const undo = historyPlan(acknowledged.model, "undo")!;
    expect(applyEdits(acknowledged.model.document.text, undo.edits)).toBe(model.document.text);
  });
  it("rejects wrong URIs, sessions, and revisions without scheduling a mutation", () => {
    const model = ready();
    for (const expected of [
      { ...documentVersion(model.document), uri: "file:///other.ts" },
      { ...documentVersion(model.document), session: 1 },
      { ...documentVersion(model.document), revision: -1 },
    ]) {
      const result = send(model, change(model, expected));
      expect(result.commands).toBeUndefined();
      expect(result.model.document).toBe(model.document);
      expect(result.outMessage?._tag).toBe("RejectedOperation");
    }
  });
  it("rejects invalid ranges, read-only edits, and edits during composition", () => {
    const model = ready();
    for (const result of [
      send(model, Operation.ApplyEdits({ expected: documentVersion(model.document), edits: [{ from: 100, to: 101, insert: "x" }] })),
      send({ ...model, options: { ...model.options, readOnly: true } }, change(model)),
      send({ ...model, composing: true }, change(model)),
    ]) expect(result.outMessage?._tag).toBe("RejectedOperation");
  });
  it("rechecks the live input when executing a command and reports its rejection", async () => {
    const model = ready();
    const nativeRequest = vi.fn(() => "The document changed before the command ran. Try again.");
    vi.stubGlobal("document", { getElementById: vi.fn(() => ({ nativeRequest })) });
    const result = send(model, change(model));
    const completed = await Effect.runPromise(result.commands![0]!.effect);
    expect(nativeRequest).toHaveBeenCalledOnce();
    expect(adapter.update(model, completed).outMessage).toMatchObject({ _tag: "RejectedOperation", reason: "The document changed before the command ran. Try again." });
  });
  it("changes language and replaces documents through the shared operation interface", () => {
    const model = ready();
    const language = send(model, Operation.SetLanguage({ languageId: "text" }));
    expect(language.outMessage).toMatchObject({ _tag: "ChangedDocument", origin: "external", document: { languageId: "text" } });
    const replaced = send(language.model, Operation.ReplaceDocument({ uri: model.document.uri, text: "const x = 2;", languageId: "typescript" })).model;
    expect(replaced.document.revision).toBe(0);
    expect(replaced.document.session).toBe(1);
    expect(send(replaced, change(model)).outMessage?._tag).toBe("RejectedOperation");
  });
  it("supports versioned selection and source-scoped diagnostics", () => {
    const model = ready();
    const selection = { anchor: 10, head: 6 };
    expect(send(model, Operation.Select({ expected: documentVersion(model.document), selection })).commands![0]!.args!.request).toMatchObject({ selection });
    const selected = adapter.update(model, CodeEditor.Message.Selected({ session: 0, lease: model.lease, revision: 0, selection }));
    expect(selected.outMessage).toEqual({ _tag: "ChangedSelection", selection });
    const marked = send(model, Operation.SetDiagnostics({ ...model.document, source: "server", diagnostics: [{ from: 6, to: 7, severity: "warning", message: "Unused" }] })).model;
    expect(marked.diagnostics.find(batch => batch.source === "server")?.diagnostics).toHaveLength(1);
    const stale = send(marked, Operation.SetDiagnostics({ ...model.document, revision: -1, source: "server", diagnostics: [] }));
    expect(stale.model).toBe(marked);
  });
});
