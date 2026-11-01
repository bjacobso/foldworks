import { Context, Effect, Layer, Option, Schema as S } from "effect";
import { Command, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { defineView } from "foldkit/submodel";
import { CodeEditor } from "@foldworks/code-editor";
import { outlineToSource, type OutlineItem } from "@formalang/ts/syntax";
import type { LanguageHost, SourceDocument } from "@formalang/host/types";
import * as Workbench from "./workbench.js";
import { definitionAtCaret } from "./update.js";
import { setPane } from "./source-update.js";
import { toRows } from "./document.js";
import { AnalyzeProgram, ReleaseAnalysis } from "./commands.js";
import { AbortRun } from "./run-commands.js";
import {
  FormaHost,
  call,
  configureSession,
  openValueSession,
  closeValueSession,
  type FormaHostService,
} from "./host.js";
import type { WorkbenchConfig } from "./config.js";
import { evaluateRepl, replDefinitions } from "./repl.js";

export interface Project {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly entry: string;
  readonly files: readonly SourceDocument[];
  readonly repl?: string;
  readonly config?: Omit<WorkbenchConfig, "sourceId" | "sources">;
}

/** Projects supply their own domain and capabilities, with resource-owned host sessions. */
export class WorkspaceHost extends Context.Service<
  WorkspaceHost,
  ReadonlyMap<string, FormaHostService>
>()("@formalang/workbench/WorkspaceHost") {}

export const layer = (
  host: LanguageHost,
  projects: readonly Project[],
): Layer.Layer<WorkspaceHost> =>
  Layer.effect(
    WorkspaceHost,
    Effect.gen(function* () {
      const services = new Map<string, FormaHostService>();
      for (const project of projects) {
        const context = yield* Layer.build(
          FormaHost.layer(host, { ...project.config, sourceId: project.entry }),
        );
        services.set(project.id, Context.get(context, FormaHost));
      }
      return services;
    }),
  );

const Source = S.Struct({ sourceId: S.String, source: S.String });
const File = S.Struct({ sourceId: S.String, source: S.String, editor: S.NullOr(Workbench.Model) });
const Entry = S.Struct({
  input: S.String,
  output: S.String,
  type: S.optional(S.String),
  ok: S.Boolean,
  sourceId: S.String,
});
const ProjectModel = S.Struct({
  id: S.String,
  title: S.String,
  description: S.String,
  entry: S.String,
  original: S.Array(Source),
  files: S.Array(File),
  active: S.String,
  generation: S.Number,
  version: S.Number,
  replInput: S.String,
  initialRepl: S.String,
  replDeclarations: S.String,
  transcript: S.Array(Entry),
  replBusy: S.Boolean,
  replToken: S.Number,
});
type ProjectModel = typeof ProjectModel.Type;
export const Model = S.Struct({
  id: S.String,
  active: S.String,
  projects: S.Array(ProjectModel),
  newFile: S.String,
  notice: S.NullOr(S.String),
  navigation: S.Array(S.Struct({ project: S.String, sourceId: S.String, offset: S.Number })),
  reveal: S.NullOr(S.Struct({ sourceId: S.String, offset: S.Number, end: S.Number })),
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  OpenProject: { id: S.String },
  OpenFile: { sourceId: S.String },
  OpenLocation: { sourceId: S.String, offset: S.Number, end: S.Number },
  ResetProject: {},
  SetNewFile: { value: S.String },
  AddFile: {},
  SetReplInput: { value: S.String },
  SubmitRepl: {},
  ClearRepl: {},
  Back: {},
  ReplResult: {
    project: S.String,
    generation: S.Number,
    token: S.Number,
    version: S.Number,
    input: S.String,
    sourceId: S.String,
    output: S.String,
    ok: S.Boolean,
    declarations: S.String,
    type: S.optional(S.String),
  },
  Child: {
    project: S.String,
    sourceId: S.String,
    generation: S.Number,
    version: S.Number,
    message: Workbench.Message,
  },
});
export type Message = typeof Message.Type;
type Return = Update.Return<Model, Message, WorkspaceHost>;

export const activeProject = (model: Model): ProjectModel =>
  model.projects.find((project) => project.id === model.active)!;
const activeFile = (project: ProjectModel) =>
  project.files.find((file) => file.sourceId === project.active)!;
const putProject = (model: Model, project: ProjectModel): Model => ({
  ...model,
  projects: model.projects.map((old) => (old.id === project.id ? project : old)),
});

const releaseProject = (project: ProjectModel): Update.Commands<Message, WorkspaceHost> => {
  const sessions = new Set<string>();
  const commands: Update.Commands<Message, WorkspaceHost>[number][] = [];
  for (const file of project.files) {
    const editor = file.editor;
    if (!editor) continue;
    if (editor.run?.status === "pending")
      commands.push(...childCommands(project, file.sourceId, [AbortRun({ run: editor.run })]));
    for (const session of [
      editor.analysis?.valueSession,
      editor.proposal?.analysis.valueSession,
      editor.run?.status === "pending" ? null : editor.run?.sessionId,
    ]) {
      if (session && !sessions.has(session)) {
        sessions.add(session);
        commands.push(
          ...childCommands(project, file.sourceId, [ReleaseAnalysis({ sessionId: session })]),
        );
      }
    }
  }
  return commands;
};

/** Switching contexts cancels permission checkpoints and rejects any in-flight run. */
const cancelRuns = (
  project: ProjectModel,
  invalidateEdits = false,
): { project: ProjectModel; commands: Update.Commands<Message, WorkspaceHost> } => {
  const commands: Update.Commands<Message, WorkspaceHost>[number][] = [];
  return {
    project: {
      ...project,
      files: project.files.map((file) => {
        const editor = file.editor;
        if (!editor) return file;
        const cancelRun = editor.runBusy || editor.run?.status === "pending";
        const cancelEdit = invalidateEdits && (editor.editBusy || editor.proposal !== null);
        if (!cancelRun && !cancelEdit) return file;
        if (editor.run?.status === "pending")
          commands.push(...childCommands(project, file.sourceId, [AbortRun({ run: editor.run })]));
        if (cancelEdit && editor.proposal?.analysis.valueSession)
          commands.push(
            ...childCommands(project, file.sourceId, [
              ReleaseAnalysis({ sessionId: editor.proposal.analysis.valueSession }),
            ]),
          );
        return {
          ...file,
          editor: {
            ...editor,
            ...(cancelRun ? { run: null, runBusy: false, runToken: editor.runToken + 1 } : {}),
            ...(cancelEdit
              ? { proposal: null, editBusy: false, editToken: editor.editToken + 1 }
              : {}),
          },
        };
      }),
    },
    commands,
  };
};

/** Printing is pure serialization; snapshots include edits even before delayed analysis finishes. */
const editorSource = (editor: Workbench.Model): string =>
  editor.sourceDirty
    ? editor.source.document.text
    : editor.document === null
      ? editor.source.document.text
      : outlineToSource(toRows(editor.outline.items) as readonly OutlineItem[], {
          base: editor.document,
        }).source;

const tag = (project: ProjectModel, sourceId: string, message: Workbench.Message): Message =>
  Message.Child({
    project: project.id,
    sourceId,
    generation: project.generation,
    version: project.version,
    message,
  });

/** Each command sees an immutable project snapshot and an isolated static-analysis session. */
const inFile = <A>(
  project: ProjectModel,
  sourceId: string,
  effect: Effect.Effect<A, never, FormaHost>,
  staticAnalysis = true,
) =>
  Effect.gen(function* () {
    const services = yield* WorkspaceHost;
    const service = services.get(project.id)!;
    const config: WorkbenchConfig = {
      ...service.config,
      sourceId,
      sources: project.files.map(({ sourceId, source }) => ({ sourceId, source })),
    };
    if (!staticAnalysis)
      return yield* effect.pipe(Effect.provideService(FormaHost, { ...service, config }));
    const { sessionId } = yield* openValueSession(service);
    return yield* Effect.gen(function* () {
      const sourceDiagnostics = yield* call(() =>
        configureSession(service.host, sessionId, config),
      );
      return yield* effect.pipe(
        Effect.provideService(FormaHost, { ...service, sessionId, config, sourceDiagnostics }),
      );
    }).pipe(Effect.ensuring(closeValueSession(service, sessionId).pipe(Effect.ignore)));
  });

const staticCommands = new Set([
  "AnalyzeFormaProgram",
  "PreviewFormaStructuralEdit",
  "ProposeFormaStructuralEdit",
]);

const childCommands = (
  project: ProjectModel,
  sourceId: string,
  commands: Update.Commands<Workbench.Message, FormaHost> = [],
): Update.Commands<Message, WorkspaceHost> =>
  commands.map((command) =>
    Command.mapMessage(
      Command.mapEffect(command, (effect) =>
        inFile(project, sourceId, effect, staticCommands.has(command.name)).pipe(
          Effect.catch((reason) => Effect.succeed(Workbench.Message.FailedProgram({ reason }))),
        ),
      ),
      (message) => tag(project, sourceId, message),
    ),
  );

const showFile = (model: Model, sourceId: string): Return => {
  let project = activeProject(model);
  const file = project.files.find((file) => file.sourceId === sourceId);
  if (!file) return { model: { ...model, notice: `File not found: ${sourceId}` } };
  let editor = file.editor;
  let commands: Update.Commands<Workbench.Message, FormaHost>;
  if (editor === null) {
    const initialized = Workbench.init({
      id: `${model.id}-${project.id}-${sourceId}`,
      title: sourceId,
      source: file.source,
    });
    editor = initialized.model;
    commands = initialized.commands ?? [];
  } else {
    if (editor.analysis) editor = { ...editor, analysis: { ...editor.analysis, revision: -1 } };
    commands =
      editor.document === null || editor.sourceDirty
        ? []
        : [
            AnalyzeProgram({
              revision: editor.outline.revision,
              rows: toRows(editor.outline.items),
              base: editor.document,
            }),
          ];
  }
  project = {
    ...project,
    active: sourceId,
    files: project.files.map((old) => (old.sourceId === sourceId ? { ...old, editor } : old)),
  };
  return {
    model: putProject({ ...model, notice: null }, project),
    commands: childCommands(project, sourceId, commands),
  };
};

export const init = (config: {
  id: string;
  projects: readonly Project[];
  project?: string;
}): Return => {
  if (config.projects.length === 0) throw new Error("A workspace needs at least one project.");
  const projects: ProjectModel[] = config.projects.map((project) => {
    if (!project.files.some((file) => file.sourceId === project.entry))
      throw new Error(`Missing entry ${project.entry}`);
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      entry: project.entry,
      original: project.files.map((file) => ({ ...file })),
      files: project.files.map((file) => ({ ...file, editor: null })),
      active: project.entry,
      generation: 0,
      version: 0,
      replInput: project.repl ?? "(+ 1 2)",
      initialRepl: project.repl ?? "(+ 1 2)",
      replDeclarations: "",
      transcript: [],
      replBusy: false,
      replToken: 0,
    };
  });
  const active = projects.find((project) => project.id === config.project) ?? projects[0]!;
  return showFile(
    {
      id: config.id,
      active: active.id,
      projects,
      newFile: "",
      notice: null,
      navigation: [],
      reveal: null,
    },
    active.entry,
  );
};

const Evaluate = Command.define("EvaluateFormaRepl", {
  args: { project: ProjectModel, sourceId: S.String, context: S.String, input: S.String },
  messages: [Message.ReplResult],
  execute: ({ project, sourceId, context, input }) =>
    inFile(
      project,
      sourceId,
      evaluateRepl(context, project.replDeclarations, input).pipe(
        Effect.catch((reason) => Effect.succeed({ ok: false, output: reason, declarations: "" })),
      ),
      false,
    ).pipe(
      Effect.catch((reason) => Effect.succeed({ ok: false, output: reason, declarations: "" })),
      Effect.map((result) =>
        Message.ReplResult({
          ...result,
          project: project.id,
          generation: project.generation,
          token: project.replToken,
          version: project.version,
          sourceId,
          input,
        }),
      ),
    ),
});

const reveal = (model: Model): Return => {
  const target = model.reveal;
  const project = activeProject(model);
  const editor = activeFile(project).editor;
  if (!target || !editor?.document || target.sourceId !== project.active) return { model };
  if (editor.pane !== "source") {
    const opened = setPane(editor, "source");
    const next = {
      ...project,
      files: project.files.map((file) =>
        file.sourceId === project.active ? { ...file, editor: opened.model } : file,
      ),
    };
    return {
      model: putProject(model, next),
      commands: childCommands(next, project.active, opened.commands),
    };
  }
  // Native editor requests need its mount lease; the Mounted message resumes navigation.
  if (editor.source.status !== "Ready") return { model };
  const opened = setPane(editor, "source");
  // One native request selects, focuses, and scrolls together, without competing caret updates.
  const selected = Workbench.update(
    opened.model,
    Workbench.Message.GotSourceMessage({
      message: CodeEditor.Message.Reveal({
        selection: {
          anchor: Math.min(target.offset, opened.model.source.document.text.length),
          head: Math.min(target.end, opened.model.source.document.text.length),
        },
      }),
    }),
  );
  const next = {
    ...project,
    files: project.files.map((file) =>
      file.sourceId === project.active ? { ...file, editor: selected.model } : file,
    ),
  };
  return {
    model: putProject({ ...model, reveal: null }, next),
    commands: childCommands(next, project.active, [
      ...(opened.commands ?? []),
      ...(selected.commands ?? []),
    ]),
  };
};

export const update = (model: Model, message: Message): Return => {
  const project = activeProject(model);
  return Message.match<Return>(message, {
    OpenProject: ({ id }) => {
      const target = model.projects.find((project) => project.id === id);
      if (!target || target.id === project.id) return { model };
      const canceled = cancelRuns(project);
      const opened = showFile(
        { ...putProject(model, canceled.project), active: id, reveal: null },
        target.active,
      );
      return { ...opened, commands: [...canceled.commands, ...(opened.commands ?? [])] };
    },
    OpenFile: ({ sourceId }) => {
      if (sourceId === project.active) return { model };
      const canceled = cancelRuns(project);
      const opened = showFile({ ...putProject(model, canceled.project), reveal: null }, sourceId);
      return { ...opened, commands: [...canceled.commands, ...(opened.commands ?? [])] };
    },
    OpenLocation: ({ sourceId, offset, end }) => {
      const origin = activeFile(project).editor;
      const from =
        origin?.pane === "source"
          ? origin.source.selection.head
          : (origin?.analysis?.rows.find((row) => row.id === origin.outline.focus?.id)?.start ?? 0);
      const canceled = cancelRuns(project);
      const opened = showFile(
        {
          ...putProject(model, canceled.project),
          navigation: [
            ...model.navigation,
            { project: project.id, sourceId: project.active, offset: from },
          ],
          reveal: { sourceId, offset, end },
        },
        sourceId,
      );
      const revealed = reveal(opened.model);
      return {
        ...revealed,
        commands: [...canceled.commands, ...(opened.commands ?? []), ...(revealed.commands ?? [])],
      };
    },
    SetNewFile: ({ value }) => ({ model: { ...model, newFile: value } }),
    AddFile: () => {
      const name = model.newFile.trim();
      if (
        !/^(?:[\w-]+\/)*[\w-]+\.(?:forma|lisp)$/.test(name) ||
        project.files.some((file) => file.sourceId === name)
      )
        return {
          model: {
            ...model,
            notice: "Use a unique relative .forma or .lisp path, such as lib/helpers.forma.",
          },
        };
      const canceled = cancelRuns(project, true);
      const opened = showFile(
        putProject(
          { ...model, newFile: "" },
          {
            ...canceled.project,
            version: project.version + 1,
            files: [
              ...canceled.project.files,
              { sourceId: name, source: "; New module\n", editor: null },
            ],
          },
        ),
        name,
      );
      return { ...opened, commands: [...canceled.commands, ...(opened.commands ?? [])] };
    },
    ResetProject: () => {
      const opened = showFile(
        putProject(
          {
            ...model,
            reveal: null,
            navigation: model.navigation.filter((entry) => entry.project !== project.id),
          },
          {
            ...project,
            generation: project.generation + 1,
            version: project.version + 1,
            files: project.original.map((file) => ({ ...file, editor: null })),
            active: project.entry,
            replInput: project.initialRepl,
            transcript: [],
            replDeclarations: "",
            replBusy: false,
            replToken: project.replToken + 1,
          },
        ),
        project.entry,
      );
      return { ...opened, commands: [...releaseProject(project), ...(opened.commands ?? [])] };
    },
    SetReplInput: ({ value }) => ({ model: putProject(model, { ...project, replInput: value }) }),
    ClearRepl: () => ({
      model: putProject(model, {
        ...project,
        transcript: [],
        replDeclarations: "",
        replBusy: false,
        replToken: project.replToken + 1,
      }),
    }),
    SubmitRepl: () => {
      const editor = activeFile(project).editor;
      if (
        project.replBusy ||
        !project.replInput.trim() ||
        !editor?.analysis ||
        editor.sourceDirty ||
        editor.analysis.revision !== editor.outline.revision
      )
        return { model };
      const next = { ...project, replBusy: true, replToken: project.replToken + 1 };
      return {
        model: putProject(model, next),
        commands: [
          Evaluate({
            project: next,
            sourceId: project.active,
            context: replDefinitions(editorSource(editor), editor.analysis),
            input: project.replInput,
          }),
        ],
      };
    },
    ReplResult: ({
      project: id,
      generation,
      token,
      version,
      sourceId,
      input,
      output,
      type,
      ok,
      declarations,
    }) => {
      const owner = model.projects.find((project) => project.id === id);
      if (!owner || owner.generation !== generation || owner.replToken !== token) return { model };
      return {
        model: putProject(model, {
          ...owner,
          replBusy: false,
          transcript: [
            ...owner.transcript,
            {
              input,
              ...(type ? { type } : {}),
              output:
                version === owner.version
                  ? output
                  : `${output}\n(Files changed while this entry ran.)`,
              ok,
              sourceId,
            },
          ],
          replDeclarations: ok && version === owner.version ? declarations : owner.replDeclarations,
        }),
      };
    },
    Back: () => {
      const target = model.navigation.at(-1);
      if (!target) return { model };
      const canceled = cancelRuns(project);
      const opened = showFile(
        {
          ...putProject(model, canceled.project),
          active: target.project,
          navigation: model.navigation.slice(0, -1),
          reveal: { sourceId: target.sourceId, offset: target.offset, end: target.offset },
        },
        target.sourceId,
      );
      const revealed = reveal(opened.model);
      return {
        ...revealed,
        commands: [...canceled.commands, ...(opened.commands ?? []), ...(revealed.commands ?? [])],
      };
    },
    Child: ({ project: id, sourceId, generation, version, message: event }) => {
      let owner = model.projects.find((project) => project.id === id);
      const file = owner?.files.find((file) => file.sourceId === sourceId);
      if (
        !owner ||
        generation !== owner.generation ||
        !file?.editor ||
        (["Analyzed", "PreparedEdit", "AssistantReply", "Ran", "FailedAnalysis"].includes(
          event._tag,
        ) &&
          version !== owner.version)
      ) {
        if (event._tag === "Ran" && owner)
          return {
            model,
            commands: childCommands(owner, sourceId, [AbortRun({ run: event.outcome })]),
          };
        const session =
          event._tag === "Analyzed"
            ? event.analysis.valueSession
            : event._tag === "PreparedEdit"
              ? event.proposal.analysis.valueSession
              : null;
        return {
          model,
          commands:
            session && owner
              ? childCommands(owner, sourceId, [ReleaseAnalysis({ sessionId: session })])
              : [],
        };
      }
      const editor = file.editor;
      const key =
        event._tag === "DefinitionAtCaret"
          ? definitionAtCaret(editor)
          : event._tag === "GoToDefinition"
            ? event.key
            : undefined;
      if (key) {
        const definition = editor.analysis?.definitions.find(
          (definition) => definition.key === key,
        );
        if (
          definition &&
          definition.start !== undefined &&
          owner.files.some((file) => file.sourceId === definition.sourceId)
        ) {
          const offset =
            editor.pane === "source"
              ? editor.source.selection.head
              : (editor.analysis?.rows.find((row) => row.id === editor.outline.focus?.id)?.start ??
                0);
          const canceled = cancelRuns(owner);
          const opened = showFile(
            {
              ...putProject(model, canceled.project),
              active: owner.id,
              navigation: [...model.navigation, { project: owner.id, sourceId, offset }],
              reveal: {
                sourceId: definition.sourceId,
                offset: definition.start,
                end: definition.end ?? definition.start,
              },
            },
            definition.sourceId,
          );
          const revealed = reveal(opened.model);
          return {
            ...revealed,
            commands: [
              ...canceled.commands,
              ...(opened.commands ?? []),
              ...(revealed.commands ?? []),
            ],
          };
        }
      }
      const child = Workbench.update(editor, event);
      const source = editorSource(child.model);
      const changed = source !== file.source;
      owner = {
        ...owner,
        version: owner.version + (changed ? 1 : 0),
        files: owner.files.map((file) =>
          file.sourceId === sourceId ? { ...file, source, editor: child.model } : file,
        ),
      };
      const canceled = changed ? cancelRuns(owner, true) : { project: owner, commands: [] };
      owner = canceled.project;
      const updated = putProject(model, owner);
      const revealed = reveal(updated);
      return {
        ...revealed,
        commands: [
          ...childCommands(owner, sourceId, child.commands),
          ...canceled.commands,
          ...(revealed.commands ?? []),
        ],
      };
    },
  });
};

export const view = defineView<Model, Message>((model, h) => {
  const project = activeProject(model);
  const editor = activeFile(project).editor;
  return h.div(
    [h.Class("workspace")],
    [
      h.header(
        [h.Class("workspace__bar")],
        [
          h.label(
            [],
            [
              "Example project ",
              h.select(
                [
                  h.AriaLabel("Example project"),
                  h.Value(project.id),
                  h.OnChange((id) => Message.OpenProject({ id })),
                ],
                model.projects.map((project) => h.option([h.Value(project.id)], [project.title])),
              ),
            ],
          ),
          h.button([h.Type("button"), h.OnClick(Message.ResetProject())], ["Reset example"]),
          h.p([], [project.description]),
        ],
      ),
      h.div(
        [h.Class("workspace__body")],
        [
          h.aside(
            [h.Class("workspace__files"), h.AriaLabel("Project files")],
            [
              h.strong([], ["Files"]),
              ...project.files.map((file) =>
                h.button(
                  [
                    h.Type("button"),
                    h.AriaPressed(String(file.sourceId === project.active)),
                    h.OnClick(Message.OpenFile({ sourceId: file.sourceId })),
                  ],
                  [file.sourceId],
                ),
              ),
              h.input([
                h.AriaLabel("New file path"),
                h.Placeholder("lib/helpers.forma"),
                h.Value(model.newFile),
                h.OnInput((value) => Message.SetNewFile({ value })),
              ]),
              h.button([h.Type("button"), h.OnClick(Message.AddFile())], ["Add file"]),
              h.button(
                [
                  h.Type("button"),
                  h.Disabled(model.navigation.length === 0),
                  h.OnClick(Message.Back()),
                ],
                ["← Back"],
              ),
              h.p([], ["Import named exports or use a namespace. F12 jumps to a definition."]),
              ...(editor?.analysis?.diagnostics ?? [])
                .filter(
                  (diagnostic) => diagnostic.sourceId && diagnostic.sourceId !== project.active,
                )
                .map((diagnostic) =>
                  h.button(
                    [
                      h.Type("button"),
                      h.Class("workspace__diagnostic"),
                      h.OnClick(
                        Message.OpenLocation({
                          sourceId: diagnostic.sourceId!,
                          offset: diagnostic.start,
                          end: diagnostic.end,
                        }),
                      ),
                    ],
                    [`${diagnostic.sourceId}: ${diagnostic.message}`],
                  ),
                ),
              ...(model.notice ? [h.p([h.Role("alert")], [model.notice])] : []),
            ],
          ),
          h.main(
            [h.Class("workspace__authoring")],
            editor
              ? [
                  h.submodel({
                    slotId: editor.id,
                    view: Workbench.view,
                    model: editor,
                    toParentMessage: (message) => tag(project, project.active, message),
                  }),
                ]
              : [],
          ),
          h.aside(
            [h.Class("workspace__repl"), h.AriaLabel("REPL")],
            [
              h.header(
                [],
                [
                  h.strong([], ["REPL"]),
                  h.button([h.Type("button"), h.OnClick(Message.ClearRepl())], ["Clear"]),
                ],
              ),
              h.p(
                [],
                [
                  `In ${project.active}. Pure definitions are replayed against current files; Run approves capabilities.`,
                ],
              ),
              h.div(
                [h.Class("workspace__transcript"), h.Role("log"), h.AriaLabel("REPL history")],
                project.transcript.map((entry) =>
                  h.div(
                    [h.Class(entry.ok ? "repl-entry" : "repl-entry repl-entry--error")],
                    [
                      h.small([], [entry.sourceId]),
                      h.pre([], [`› ${entry.input}`]),
                      h.pre([], [entry.output]),
                      ...(entry.type ? [h.small([], [`Type: ${entry.type}`])] : []),
                    ],
                  ),
                ),
              ),
              h.textarea([
                h.AriaLabel("REPL input"),
                h.Value(project.replInput),
                h.Rows(5),
                h.OnInput((value) => Message.SetReplInput({ value })),
                h.OnKeyDownPreventDefault((key, modifiers) =>
                  key === "Enter" && (modifiers.ctrlKey || modifiers.metaKey)
                    ? Option.some(Message.SubmitRepl())
                    : Option.none(),
                ),
              ]),
              h.button(
                [
                  h.Type("button"),
                  h.Disabled(
                    project.replBusy ||
                      !editor?.analysis ||
                      editor.sourceDirty ||
                      editor.analysis.revision !== editor.outline.revision,
                  ),
                  h.OnClick(Message.SubmitRepl()),
                ],
                [project.replBusy ? "Evaluating…" : "Evaluate"],
              ),
              h.small([], ["Ctrl / ⌘ + Enter · Definitions stay in the REPL until Clear."]),
            ],
          ),
        ],
      ),
    ],
  );
});
