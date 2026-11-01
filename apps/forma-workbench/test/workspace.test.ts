import { Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TsLanguageHost } from "@formalang/host/ts-host";
import { CodeEditor } from "foldworks/code-editor";
import { Outliner } from "foldworks/outliner";
import * as Workspace from "../src/workbench/workspace.js";
import * as Workbench from "../src/workbench/workbench.js";
import { completeAt, viewOf, sourceDiagnostics } from "../src/workbench/adapter.js";
import { capabilities, posted } from "./support/program.js";

const projects: readonly Workspace.Project[] = [
  {
    id: "modules",
    title: "Modules",
    description: "Test project",
    entry: "main.forma",
    files: [
      {
        sourceId: "main.forma",
        source: '(import "./barrel.forma" [double]) (define answer (double 21)) answer',
      },
      { sourceId: "barrel.forma", source: '(export-from "./math.forma" [double])' },
      {
        sourceId: "math.forma",
        source: "(export double) (define hidden 99) (define double [x] (+ x x))",
      },
    ],
    repl: "answer",
  },
];

beforeEach(() => vi.stubGlobal("document", { getElementById: () => null }));
afterEach(() => vi.unstubAllGlobals());

const exercise = (
  task: (driver: {
    get: () => Workspace.Model;
    send: (message: Workspace.Message) => Effect.Effect<void, never, Workspace.WorkspaceHost>;
    child: (message: Workbench.Message) => Effect.Effect<void, never, Workspace.WorkspaceHost>;
  }) => Effect.Effect<void, never, Workspace.WorkspaceHost>,
  examples = projects,
) => {
  const host = new TsLanguageHost();
  const opened = vi.spyOn(host, "openSession");
  const closed = vi.spyOn(host, "closeSession");
  return Effect.runPromise(
    Effect.gen(function* () {
      const initial = Workspace.init({ id: "test", projects: examples });
      let model = initial.model;
      const accept = (
        result: ReturnType<typeof Workspace.update>,
      ): Effect.Effect<void, never, Workspace.WorkspaceHost> =>
        Effect.gen(function* () {
          model = result.model;
          for (const command of result.commands ?? []) {
            const message = yield* command.effect;
            yield* accept(Workspace.update(model, message));
          }
        });
      const send = (message: Workspace.Message) => accept(Workspace.update(model, message));
      const child = (message: Workbench.Message) => {
        const project = Workspace.activeProject(model);
        return send(
          Workspace.Message.Child({
            project: project.id,
            sourceId: project.active,
            generation: project.generation,
            version: project.version,
            message,
          }),
        );
      };
      yield* accept(initial);
      yield* task({ get: () => model, send, child });
    }).pipe(Effect.provide(Workspace.layer(host, examples))),
  ).then(() => {
    expect(new Set(closed.mock.calls.map(([request]) => request.sessionId)).size).toBe(
      opened.mock.calls.length,
    );
  });
};

const editorOf = (model: Workspace.Model) => {
  const project = Workspace.activeProject(model);
  return project.files.find((file) => file.sourceId === project.active)!.editor!;
};

test("module authoring has live values, lexical completions, and navigation through a barrel", async () => {
  await exercise(({ get, send, child }) =>
    Effect.gen(function* () {
      const analysis = editorOf(get()).analysis!;
      expect(analysis.diagnostics).toEqual([]);
      expect(
        Object.values(analysis.values).some(
          (value) => value.value?.kind === "int" && value.value.value === 42,
        ),
      ).toBe(true);
      expect(completeAt(analysis, "", 0).items.map((item) => item.label)).not.toContain("hidden");
      const definition = analysis.definitions.find(
        (definition) => definition.name === "double" && definition.sourceId === "math.forma",
      )!;
      yield* child(Workbench.Message.GoToDefinition({ key: definition.key }));
      expect(Workspace.activeProject(get()).active).toBe("math.forma");
      expect(editorOf(get()).pane).toBe("source");
      expect(editorOf(get()).source.document.text).toContain("define double");
      yield* send(Workspace.Message.Back());
      expect(Workspace.activeProject(get()).active).toBe("main.forma");
    }),
  );
});

test("the REPL uses edited modules, replaces scratch definitions, and clears its environment", async () => {
  await exercise(({ get, send, child }) =>
    Effect.gen(function* () {
      yield* send(Workspace.Message.SubmitRepl());
      expect(Workspace.activeProject(get()).transcript.at(-1)).toMatchObject({
        output: "42",
        type: "Float",
      });
      yield* send(Workspace.Message.OpenFile({ sourceId: "math.forma" }));
      const row = editorOf(get()).analysis!.rows.find((row) =>
        row.text.startsWith("define double"),
      )!;
      yield* child(
        Workbench.Message.GotOutlinerMessage({
          message: Outliner.Message.EditedText({
            id: row.id,
            text: "define double [x] (* x 3)",
            start: 5,
            end: 5,
            time: 1,
          }),
        }),
      );
      yield* send(Workspace.Message.OpenFile({ sourceId: "main.forma" }));
      yield* send(Workspace.Message.SubmitRepl());
      expect(Workspace.activeProject(get()).transcript.at(-1)?.output).toBe("63");
      for (const input of ["(define scratch 1)", "(define scratch 2)", "(+ scratch answer)"]) {
        yield* send(Workspace.Message.SetReplInput({ value: input }));
        yield* send(Workspace.Message.SubmitRepl());
      }
      expect(Workspace.activeProject(get()).transcript.at(-1)).toMatchObject({
        ok: true,
        output: "65",
      });
      yield* send(Workspace.Message.ClearRepl());
      yield* send(Workspace.Message.SetReplInput({ value: "scratch" }));
      yield* send(Workspace.Message.SubmitRepl());
      expect(Workspace.activeProject(get()).transcript.at(-1)?.ok).toBe(false);
      yield* send(Workspace.Message.SetReplInput({ value: '(if true 1 "bad")' }));
      yield* send(Workspace.Message.SubmitRepl());
      expect(Workspace.activeProject(get()).transcript.at(-1)?.ok).toBe(false);
    }),
  );
});

test("malformed module drafts survive file switches and dependency diagnostics stay in their source file", async () => {
  await exercise(({ get, send, child }) =>
    Effect.gen(function* () {
      yield* send(Workspace.Message.OpenFile({ sourceId: "math.forma" }));
      yield* child(Workbench.Message.SetPane({ pane: "source" }));
      const editor = editorOf(get());
      const malformed = editor.source.document.text + "(";
      yield* child(
        Workbench.Message.GotSourceMessage({
          message: CodeEditor.Message.Edited({
            session: editor.source.document.session,
            lease: editor.source.lease,
            baseRevision: editor.source.document.revision,
            edits: [{ from: 0, to: editor.source.document.text.length, insert: malformed }],
            before: editor.source.selection,
            selection: { anchor: malformed.length, head: malformed.length },
            kind: "input",
            time: 1,
            groupId: 1,
          }),
        }),
      );
      expect(editorOf(get()).sourceDirty).toBe(true);
      yield* send(Workspace.Message.OpenFile({ sourceId: "main.forma" }));
      const analysis = editorOf(get()).analysis!;
      expect(analysis.diagnostics.some((diagnostic) => diagnostic.sourceId === "math.forma")).toBe(
        true,
      );
      expect(sourceDiagnostics(analysis)).toEqual([]);
      expect(
        viewOf(analysis).unplaced.some((diagnostic) =>
          diagnostic.message.startsWith("math.forma:"),
        ),
      ).toBe(true);
      yield* send(Workspace.Message.OpenFile({ sourceId: "math.forma" }));
      expect(editorOf(get()).source.document.text).toBe(malformed);
      yield* send(Workspace.Message.ResetProject());
      expect(Workspace.activeProject(get()).active).toBe("main.forma");
      expect(editorOf(get()).analysis!.diagnostics).toEqual([]);
    }),
  );
});

test("REPL replay never performs a host capability", async () => {
  posted.length = 0;
  await exercise(
    ({ get, send }) =>
      Effect.gen(function* () {
        yield* send(Workspace.Message.SetReplInput({ value: '(Chat.post "#team" "hello")' }));
        yield* send(Workspace.Message.SubmitRepl());
        expect(Workspace.activeProject(get()).transcript.at(-1)).toMatchObject({
          ok: false,
          output: expect.stringContaining("Use Run"),
        });
        expect(posted).toEqual([]);
      }),
    [
      {
        id: "capabilities",
        title: "Capabilities",
        description: "",
        entry: "main.forma",
        files: [{ sourceId: "main.forma", source: "(+ 1 2)" }],
        config: { capabilities },
      },
    ],
  );
});
