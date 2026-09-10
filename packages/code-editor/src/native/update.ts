import { Effect, Schema as S } from "effect";
import { Command, type Update } from "foldkit";
import { applyEdits, normalizeText, validSelection, Selection, TextEdit } from "../document";
import { jsonDiagnostics, validDiagnostics } from "../diagnostics";
import { Message, Identity, OutMessage, type Action } from "./message";
import { init, type Model } from "./model";
import { historyPlan, record } from "./history";
import { completions, difference, editingPlan, findMatches, mapSelection, type EditingAction } from "./operations";
import { lineStarts, tokenize } from "./tokenize";

export const Request = S.Struct({
  ...Identity, revision: S.Number, edits: S.Array(TextEdit), selection: Selection,
  kind: S.String, groupId: S.Number, focus: S.Boolean, reveal: S.Boolean,
});
export type Request = typeof Request.Type;
export type NativeInput = HTMLTextAreaElement & { foldkitNative: Model; nativeRequest?: (request: Request) => string };

const Apply = Command.define("NativeEditorRequest", {
  args: { id: S.String, request: Request }, messages: [Message.CompletedCommand],
  execute: ({ id, request }) => Effect.sync(() => {
    const input = document.getElementById(id) as NativeInput | null;
    const reason = input?.nativeRequest?.(request) ?? "The editor is not mounted.";
    return Message.CompletedCommand({ lease: request.lease, session: request.session, reason });
  }),
});
const FocusSearch = Command.define("FocusNativeSearch", {
  args: { id: S.String, lease: S.String, session: S.Number }, messages: [Message.CompletedCommand],
  execute: ({ id, lease, session }) => Effect.promise(() => new Promise<Extract<Message, { _tag: "CompletedCommand" }>>((resolve) => {
    requestAnimationFrame(() => {
      const input = document.getElementById(id) as NativeInput | null;
      if (input?.foldkitNative.lease === lease && input.foldkitNative.document.session === session) document.getElementById(`${id}-find`)?.focus();
      resolve(Message.CompletedCommand({ lease, session, reason: "" }));
    });
  })),
});
type Result = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
const reject = (model: Model, reason: string): Result => ({ model: { ...model, error: reason }, outMessage: OutMessage.RejectedOperation({ reason }) });
const matches = (model: Model, event: { session: number; lease: string }) => event.session === model.document.session && event.lease === model.lease;

const request = (model: Model, values: Partial<Request> = {}): Result => ({
  model, commands: [Apply({ id: model.id, request: {
    lease: model.lease, session: model.document.session, revision: model.document.revision,
    edits: [], selection: model.selection, kind: "command", groupId: 0, focus: true, reveal: true, ...values,
  } })],
});

const validate = (model: Model): Model => {
  const { uri, revision, session, languageId } = model.document;
  return { ...model, diagnostics: [{ uri, revision, session, languageId, source: "json", diagnostics: jsonDiagnostics(model.document) }] };
};

const run = (model: Model, action: Action): Result => {
  if (model.composing && !["focus", "findNext", "findPrevious", "goToLine"].includes(action)) return reject(model, "Finish composing text before running this command.");
  const text = model.document.text;
  const selection = model.selection;
  if (action === "undo" || action === "redo") {
    const plan = historyPlan(model, action);
    return plan ? request(model, { ...plan, kind: action }) : { model };
  }
  if (action === "focus") return request(model, { reveal: false });
  if (action === "format") {
    try {
      const after = JSON.stringify(JSON.parse(text), null, model.options.tabSize);
      return request(model, { edits: difference(text, after), selection: { anchor: 0, head: 0 }, kind: "format" });
    } catch { return reject(model, "Fix the JSON syntax errors before formatting."); }
  }
  if (action === "goToLine") {
    const line = Math.max(0, Math.min(model.starts.length - 1, (Number(model.goToLine) || 1) - 1));
    const offset = model.starts[Math.floor(line)]!;
    return request(model, { selection: { anchor: offset, head: offset } });
  }
  if (action === "complete") {
    const choices = completions(text, selection);
    const choice = choices.items[model.completion.index];
    if (!choice) return { model: { ...model, completion: { open: false, index: 0 } } };
    return request({ ...model, completion: { open: false, index: 0 } }, {
      edits: [{ from: choices.from, to: selection.head, insert: choice }],
      selection: { anchor: choices.from + choice.length, head: choices.from + choice.length }, kind: "complete",
    });
  }
  if (["findNext", "findPrevious", "replace", "replaceAll"].includes(action)) {
    const found = findMatches(text, model.search.query, model.search.caseSensitive, Infinity);
    if (!found.length) return { model };
    const next = action === "findPrevious" ? [...found].reverse().find((match) => match.to < Math.max(selection.anchor, selection.head)) ?? found.at(-1)!
      : found.find((match) => match.from >= Math.max(selection.anchor, selection.head)) ?? found[0]!;
    if (action === "findNext" || action === "findPrevious") return request(model, { selection: { anchor: next.from, head: next.to } });
    const current = found.find((match) => match.from === Math.min(selection.anchor, selection.head) && match.to === Math.max(selection.anchor, selection.head));
    if (action === "replace" && !current) return request(model, { selection: { anchor: next.from, head: next.to } });
    const targets = action === "replaceAll" ? found : [current!];
    const edits = targets.map(({ from, to }) => ({ from, to, insert: normalizeText(model.search.replacement) }));
    const head = edits[0]!.from + edits[0]!.insert.length;
    return request(model, { edits, selection: { anchor: head, head }, kind: action });
  }
  return request(model, { ...editingPlan(text, selection, action as EditingAction, model.options.tabSize, ["yaml", "yml"].includes(model.document.languageId) ? "#" : "//"), kind: action });
};

export const update = (model: Model, message: Message): Result => Message.match<Result>(message, {
  Mounted: ({ lease, session }) => ({ model: session === model.document.session ? validate({ ...model, lease, status: "Ready", composing: false, error: "" }) : model }),
  FailedMount: ({ reason }) => ({ model: { ...model, status: "Failed", error: reason } }),
  Edited: (event) => {
    if (!matches(model, event)) return { model };
    if (event.baseRevision !== model.document.revision) return reject(model, "An edit arrived for an old revision. Reload the sample to resynchronize.");
    try {
      const text = applyEdits(model.document.text, event.edits);
      if (!validSelection(text, event.selection)) return reject(model, "Invalid editor selection.");
      let history: Pick<Model, "past" | "future" | "nextHistoryId">;
      if (event.kind === "undo" || event.kind === "redo") {
        const group = (event.kind === "undo" ? model.past : model.future).at(-1);
        if (!group || group.id !== event.groupId) return reject(model, "The history changed before the command was applied.");
        history = event.kind === "undo" ? { past: model.past.slice(0, -1), future: [...model.future, group], nextHistoryId: model.nextHistoryId }
          : { past: [...model.past, group], future: model.future.slice(0, -1), nextHistoryId: model.nextHistoryId };
      } else history = record(model, event.edits, event.before, event.selection, event.kind, event.time);
      const document = { ...model.document, text, revision: model.document.revision + 1 };
      const lines = tokenize(text, document.languageId, model.lines);
      return { model: validate({ ...model, ...history, document, lines, starts: lineStarts(lines), selection: event.selection, diagnostics: [], error: "", completion: { ...model.completion, index: 0 } }), outMessage: OutMessage.ChangedDocument({ document, origin: event.kind === "undo" || event.kind === "redo" || event.kind === "external" ? event.kind : "input" }) };
    } catch (error) { return reject(model, String(error)); }
  },
  Selected: (event) => {
    if (!matches(model, event) || event.revision !== model.document.revision || !validSelection(model.document.text, event.selection)) return { model };
    return { model: { ...model, selection: event.selection }, outMessage: OutMessage.ChangedSelection({ selection: event.selection }) };
  },
  Scrolled: (event) => ({ model: matches(model, event) ? { ...model, viewport: { top: event.top, left: event.left, height: event.height } } : model }),
  Composition: (event) => ({ model: matches(model, event) ? { ...model, composing: event.active, completion: { open: false, index: 0 } } : model }),
  Run: ({ action }) => run(model, action),
  Execute: ({ operation }) => {
    switch (operation._tag) {
      case "Focus": return run(model, "focus");
      case "Undo": return run(model, "undo");
      case "Redo": return run(model, "redo");
      case "ApplyEdits": {
        if (operation.expected.uri !== model.document.uri || operation.expected.session !== model.document.session || operation.expected.revision !== model.document.revision) return reject(model, "The document changed. Recompute the edits against the current revision.");
        if (model.options.readOnly) return reject(model, "The editor is read only.");
        if (model.composing) return reject(model, "Finish composing text before applying edits.");
        try {
          const text = applyEdits(model.document.text, operation.edits);
          const selection = operation.selection ?? mapSelection(model.selection, operation.edits);
          if (!validSelection(text, selection)) return reject(model, "Invalid editor selection.");
          return request(model, { edits: operation.edits, selection, kind: "external" });
        } catch (error) { return reject(model, String(error)); }
      }
      case "Select":
        if (operation.expected.uri !== model.document.uri || operation.expected.session !== model.document.session || operation.expected.revision !== model.document.revision) return reject(model, "The document changed. Select against the current revision.");
        if (!validSelection(model.document.text, operation.selection)) return reject(model, "Invalid editor selection.");
        return request(model, { selection: operation.selection });
      default: return update(model, operation);
    }
  },
  CompletedCommand: (event) => matches(model, event) && event.reason ? reject(model, event.reason) : { model },
  ReplaceDocument: ({ text, uri, languageId }) => {
    const fresh = init({ id: model.id, text, uri, languageId, ...model.options });
    const next = { ...fresh, document: { ...fresh.document, session: model.document.session + 1 } };
    return { model: next, outMessage: OutMessage.ChangedDocument({ document: next.document, origin: "external" }) };
  },
  SetOptions: ({ _tag: _, ...options }) => ({ model: { ...model, options: { ...options, tabSize: Math.max(1, Math.min(8, Math.round(options.tabSize) || 2)) } } }),
  SetLanguage: ({ languageId }) => {
    const lines = tokenize(model.document.text, languageId);
    const document = { ...model.document, languageId };
    return { model: validate({ ...model, document, lines, starts: lineStarts(lines), diagnostics: [] }), outMessage: OutMessage.ChangedDocument({ document, origin: "external" }) };
  },
  SetDiagnostics: (batch) => {
    const document = model.document;
    if (batch.uri !== document.uri || batch.session !== document.session || batch.revision !== document.revision || batch.languageId !== document.languageId) return { model };
    if (!validDiagnostics(document.text, batch.diagnostics)) return reject(model, "Invalid diagnostic range.");
    const { uri, session, revision, languageId, source, diagnostics } = batch;
    return { model: { ...model, diagnostics: [...model.diagnostics.filter((item) => item.source !== source), { uri, session, revision, languageId, source, diagnostics }] } };
  },
  OpenSearch: ({ open }) => ({ model: { ...model, search: { ...model.search, open } },
    commands: open ? [FocusSearch({ id: model.id, lease: model.lease, session: model.document.session })] : [],
  }),
  SearchQuery: ({ query }) => ({ model: { ...model, search: { ...model.search, query } } }),
  SearchReplacement: ({ replacement }) => ({ model: { ...model, search: { ...model.search, replacement } } }),
  ToggleCase: () => ({ model: { ...model, search: { ...model.search, caseSensitive: !model.search.caseSensitive } } }),
  OpenCompletion: ({ open }) => {
    const next = { ...model, completion: { open, index: 0 } };
    return open ? request(next, { reveal: false }) : { model: next };
  },
  MoveCompletion: ({ delta }) => {
    const count = completions(model.document.text, model.selection).items.length;
    return { model: { ...model, completion: { open: true, index: count ? (model.completion.index + delta + count) % count : 0 } } };
  },
  ChooseCompletion: ({ index }) => run({ ...model, completion: { open: true, index } }, "complete"),
  GoToLine: ({ value }) => ({ model: { ...model, goToLine: value } }),
  Reveal: ({ selection }) => request(model, { selection }),
});
