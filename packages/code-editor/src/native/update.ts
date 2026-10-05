import { Effect, Schema as S } from "effect";
import { Command, type Update } from "foldkit";
import { Completion } from "@foldworks/text-intelligence";
import {
  applyEdits,
  normalizeText,
  validOffset,
  validSelection,
  Selection,
  TextEdit,
} from "../document";
import { jsonDiagnostics, validDiagnostics } from "../diagnostics";
import { Message, Identity, OutMessage, type Action } from "./message";
import { init, type Model } from "./model";
import { historyPlan, record } from "./history";
import {
  difference,
  editingPlan,
  findMatches,
  mapSelection,
  mapTokens,
  wordCompletions,
  type EditingAction,
} from "./operations";
import { documentVersion } from "../contracts";
import { lineStarts, tokenize } from "./tokenize";

export const Request = S.Struct({
  ...Identity,
  revision: S.Number,
  edits: S.Array(TextEdit),
  selection: Selection,
  kind: S.String,
  groupId: S.Number,
  focus: S.Boolean,
  reveal: S.Boolean,
  /** Reveals this offset instead of the selection's head. */
  at: S.optional(S.Number),
});
export type Request = typeof Request.Type;
export type NativeInput = HTMLTextAreaElement & {
  foldkitNative: Model;
  nativeRequest?: (request: Request) => string;
};

const Apply = Command.define("NativeEditorRequest", {
  args: { id: S.String, request: Request },
  messages: [Message.CompletedCommand],
  execute: ({ id, request }) =>
    Effect.sync(() => {
      const input = document.getElementById(id) as NativeInput | null;
      const reason = input?.nativeRequest?.(request) ?? "The editor is not mounted.";
      return Message.CompletedCommand({ lease: request.lease, session: request.session, reason });
    }),
});
const FocusSearch = Command.define("FocusNativeSearch", {
  args: { id: S.String, lease: S.String, session: S.Number },
  messages: [Message.CompletedCommand],
  execute: ({ id, lease, session }) =>
    Effect.promise(
      () =>
        new Promise<Extract<Message, { _tag: "CompletedCommand" }>>((resolve) => {
          requestAnimationFrame(() => {
            const input = document.getElementById(id) as NativeInput | null;
            if (
              input?.foldkitNative.lease === lease &&
              input.foldkitNative.document.session === session
            )
              document.getElementById(`${id}-find`)?.focus();
            resolve(Message.CompletedCommand({ lease, session, reason: "" }));
          });
        }),
    ),
});
type Result = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
const reject = (model: Model, reason: string): Result => ({
  model: { ...model, error: reason },
  outMessage: OutMessage.RejectedOperation({ reason }),
});
const matches = (model: Model, event: { session: number; lease: string }) =>
  event.session === model.document.session && event.lease === model.lease;
const sameVersion = (model: Model, expected: { uri: string; session: number; revision: number }) =>
  expected.uri === model.document.uri &&
  expected.session === model.document.session &&
  expected.revision === model.document.revision;

const request = (model: Model, values: Partial<Request> = {}): Result => ({
  model,
  commands: [
    Apply({
      id: model.id,
      request: {
        lease: model.lease,
        session: model.document.session,
        revision: model.document.revision,
        edits: [],
        selection: model.selection,
        kind: "command",
        groupId: 0,
        focus: true,
        reveal: true,
        ...values,
      },
    }),
  ],
});

const validate = (model: Model): Model => {
  const { uri, revision, session, languageId } = model.document;
  const others = model.diagnostics.filter(
    (batch) => batch.source !== "json" && batch.revision === revision && batch.session === session,
  );
  return {
    ...model,
    diagnostics: [
      ...others,
      {
        uri,
        revision,
        session,
        languageId,
        source: "json",
        diagnostics: jsonDiagnostics(model.document),
      },
    ],
  };
};

const run = (model: Model, action: Action): Result => {
  if (model.composing && !["focus", "findNext", "findPrevious", "goToLine"].includes(action))
    return reject(model, "Finish composing text before running this command.");
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
      return request(model, {
        edits: difference(text, after),
        selection: { anchor: 0, head: 0 },
        kind: "format",
      });
    } catch {
      return reject(model, "Fix the JSON syntax errors before formatting.");
    }
  }
  if (action === "goToLine") {
    const line = Math.max(0, Math.min(model.starts.length - 1, (Number(model.goToLine) || 1) - 1));
    const offset = model.starts[Math.floor(line)]!;
    return request(model, { selection: { anchor: offset, head: offset } });
  }
  if (action === "complete") {
    const list = model.completion;
    const choice = list === null ? undefined : Completion.active(list, text, selection.head);
    if (list === null || !choice) return { model: { ...model, completion: null } };
    const accepted = Completion.accept(list, text, choice);
    return request(
      { ...model, completion: null },
      {
        edits: [{ from: accepted.from, to: accepted.to, insert: accepted.insert }],
        selection: { anchor: accepted.caret, head: accepted.caret },
        kind: "complete",
      },
    );
  }
  if (["findNext", "findPrevious", "replace", "replaceAll"].includes(action)) {
    const found = findMatches(text, model.search.query, model.search.caseSensitive, Infinity);
    if (!found.length) return { model };
    const next =
      action === "findPrevious"
        ? ([...found]
            .reverse()
            .find((match) => match.to < Math.max(selection.anchor, selection.head)) ??
          found.at(-1)!)
        : (found.find((match) => match.from >= Math.max(selection.anchor, selection.head)) ??
          found[0]!);
    if (action === "findNext" || action === "findPrevious")
      return request(model, { selection: { anchor: next.from, head: next.to } });
    const current = found.find(
      (match) =>
        match.from === Math.min(selection.anchor, selection.head) &&
        match.to === Math.max(selection.anchor, selection.head),
    );
    if (action === "replace" && !current)
      return request(model, { selection: { anchor: next.from, head: next.to } });
    const targets = action === "replaceAll" ? found : [current!];
    const edits = targets.map(({ from, to }) => ({
      from,
      to,
      insert: normalizeText(model.search.replacement),
    }));
    const head = edits[0]!.from + edits[0]!.insert.length;
    return request(model, { edits, selection: { anchor: head, head }, kind: action });
  }
  return request(model, {
    ...editingPlan(
      text,
      selection,
      action as EditingAction,
      model.options.tabSize,
      ["yaml", "yml"].includes(model.document.languageId) ? "#" : "//",
    ),
    kind: action,
  });
};

export const update = (model: Model, message: Message): Result =>
  Message.match<Result>(message, {
    Mounted: ({ lease, session }) => ({
      model:
        session === model.document.session
          ? validate({ ...model, lease, status: "Ready", composing: false, error: "" })
          : model,
    }),
    FailedMount: ({ reason }) => ({ model: { ...model, status: "Failed", error: reason } }),
    Edited: (event) => {
      if (!matches(model, event)) return { model };
      if (event.baseRevision !== model.document.revision)
        return reject(
          model,
          "An edit arrived for an old revision. Reload the sample to resynchronize.",
        );
      try {
        const text = applyEdits(model.document.text, event.edits);
        if (!validSelection(text, event.selection))
          return reject(model, "Invalid editor selection.");
        let history: Pick<Model, "past" | "future" | "nextHistoryId">;
        if (event.kind === "undo" || event.kind === "redo") {
          const group = (event.kind === "undo" ? model.past : model.future).at(-1);
          if (!group || group.id !== event.groupId)
            return reject(model, "The history changed before the command was applied.");
          history =
            event.kind === "undo"
              ? {
                  past: model.past.slice(0, -1),
                  future: [...model.future, group],
                  nextHistoryId: model.nextHistoryId,
                }
              : {
                  past: [...model.past, group],
                  future: model.future.slice(0, -1),
                  nextHistoryId: model.nextHistoryId,
                };
        } else
          history = record(
            model,
            event.edits,
            event.before,
            event.selection,
            event.kind,
            event.time,
          );
        const document = { ...model.document, text, revision: model.document.revision + 1 };
        const lines = tokenize(text, document.languageId, model.lines);
        // Typing narrows open suggestions; anything else, such as undo, puts them away.
        const typing = event.kind !== "undo" && event.kind !== "redo" && event.kind !== "complete";
        const tracked =
          model.completion === null || !typing
            ? undefined
            : Completion.track(model.completion, model.document.text, text, event.selection.head);
        const completion =
          tracked !== undefined && Completion.visible(tracked, text, event.selection.head).length
            ? tracked
            : null;
        return {
          model: validate({
            ...model,
            ...history,
            document,
            lines,
            starts: lineStarts(lines),
            selection: event.selection,
            diagnostics: [],
            error: "",
            completion,
            hover: null,
            tokens: mapTokens(model.tokens, event.edits),
          }),
          outMessage: OutMessage.ChangedDocument({
            document,
            origin:
              event.kind === "undo" || event.kind === "redo" || event.kind === "external"
                ? event.kind
                : "input",
          }),
        };
      } catch (error) {
        return reject(model, String(error));
      }
    },
    Selected: (event) => {
      if (
        !matches(model, event) ||
        event.revision !== model.document.revision ||
        !validSelection(model.document.text, event.selection)
      )
        return { model };
      const completion =
        model.completion !== null &&
        Completion.contains(model.completion, event.selection.head) &&
        event.selection.anchor === event.selection.head
          ? model.completion
          : null;
      const hover = model.hover?.source === "Keyboard" ? null : model.hover;
      return {
        model: { ...model, selection: event.selection, completion, hover },
        outMessage: OutMessage.ChangedSelection({ selection: event.selection }),
      };
    },
    Scrolled: (event) => ({
      model: matches(model, event)
        ? { ...model, viewport: { top: event.top, left: event.left, height: event.height } }
        : model,
    }),
    Composition: (event) => ({
      model: matches(model, event)
        ? { ...model, composing: event.active, completion: null }
        : model,
    }),
    Run: ({ action }) => run(model, action),
    Execute: ({ operation }) => {
      switch (operation._tag) {
        case "Focus":
          return run(model, "focus");
        case "Undo":
          return run(model, "undo");
        case "Redo":
          return run(model, "redo");
        case "ApplyEdits": {
          if (
            operation.expected.uri !== model.document.uri ||
            operation.expected.session !== model.document.session ||
            operation.expected.revision !== model.document.revision
          )
            return reject(
              model,
              "The document changed. Recompute the edits against the current revision.",
            );
          if (model.options.readOnly) return reject(model, "The editor is read only.");
          if (model.composing) return reject(model, "Finish composing text before applying edits.");
          try {
            const text = applyEdits(model.document.text, operation.edits);
            const selection = operation.selection ?? mapSelection(model.selection, operation.edits);
            if (!validSelection(text, selection)) return reject(model, "Invalid editor selection.");
            // A host's edit leaves focus and scrolling where the user has them.
            return request(model, {
              edits: operation.edits,
              selection,
              kind: "external",
              focus: false,
              reveal: false,
            });
          } catch (error) {
            return reject(model, String(error));
          }
        }
        case "ShowCompletions": {
          const { text } = model.document;
          const caret = model.selection.head;
          if (
            !sameVersion(model, operation.expected) ||
            !validOffset(text, operation.from) ||
            !validOffset(text, operation.to) ||
            operation.from > operation.to ||
            caret < operation.from ||
            caret > operation.to
          )
            return { model };
          const list = Completion.open(operation.from, operation.to, operation.items);
          return {
            model: {
              ...model,
              completion: Completion.visible(list, text, caret).length ? list : null,
            },
          };
        }
        case "SetSemanticTokens": {
          const { uri, session, revision, text } = { ...model.document };
          if (
            operation.uri !== uri ||
            operation.session !== session ||
            operation.revision !== revision
          )
            return { model };
          if (
            !operation.tokens.every(
              (token) =>
                validOffset(text, token.from) &&
                validOffset(text, token.to) &&
                token.from <= token.to,
            )
          )
            return reject(model, "Invalid semantic token range.");
          return {
            model: { ...model, tokens: [...operation.tokens].sort((a, b) => a.from - b.from) },
          };
        }
        case "Reveal":
          if (!sameVersion(model, operation.expected))
            return reject(model, "The document changed. Reveal against the current revision.");
          return request(model, {
            kind: "reveal",
            focus: false,
            at: Math.max(0, Math.min(operation.range.from, model.document.text.length)),
          });
        case "Select":
          if (
            operation.expected.uri !== model.document.uri ||
            operation.expected.session !== model.document.session ||
            operation.expected.revision !== model.document.revision
          )
            return reject(model, "The document changed. Select against the current revision.");
          if (!validSelection(model.document.text, operation.selection))
            return reject(model, "Invalid editor selection.");
          return request(model, { selection: operation.selection });
        default:
          return update(model, operation);
      }
    },
    CompletedCommand: (event) =>
      matches(model, event) && event.reason ? reject(model, event.reason) : { model },
    ReplaceDocument: ({ text, uri, languageId }) => {
      const fresh = init({ id: model.id, text, uri, languageId, ...model.options });
      const next = {
        ...fresh,
        document: { ...fresh.document, session: model.document.session + 1 },
      };
      return {
        model: next,
        outMessage: OutMessage.ChangedDocument({ document: next.document, origin: "external" }),
      };
    },
    SetOptions: ({ _tag: _, ...options }) => ({
      model: {
        ...model,
        options: {
          ...options,
          tabSize: Math.max(1, Math.min(8, Math.round(options.tabSize) || 2)),
        },
      },
    }),
    SetLanguage: ({ languageId }) => {
      const lines = tokenize(model.document.text, languageId);
      const document = { ...model.document, languageId };
      return {
        model: validate({
          ...model,
          document,
          lines,
          starts: lineStarts(lines),
          diagnostics: [],
          tokens: [],
        }),
        outMessage: OutMessage.ChangedDocument({ document, origin: "external" }),
      };
    },
    SetDiagnostics: (batch) => {
      const document = model.document;
      if (
        batch.uri !== document.uri ||
        batch.session !== document.session ||
        batch.revision !== document.revision ||
        batch.languageId !== document.languageId
      )
        return { model };
      if (!validDiagnostics(document.text, batch.diagnostics))
        return reject(model, "Invalid diagnostic range.");
      const { uri, session, revision, languageId, source, diagnostics } = batch;
      return {
        model: {
          ...model,
          diagnostics: [
            ...model.diagnostics.filter((item) => item.source !== source),
            { uri, session, revision, languageId, source, diagnostics },
          ],
        },
      };
    },
    OpenSearch: ({ open }) => ({
      model: { ...model, search: { ...model.search, open } },
      commands: open
        ? [FocusSearch({ id: model.id, lease: model.lease, session: model.document.session })]
        : [],
    }),
    SearchQuery: ({ query }) => ({ model: { ...model, search: { ...model.search, query } } }),
    SearchReplacement: ({ replacement }) => ({
      model: { ...model, search: { ...model.search, replacement } },
    }),
    ToggleCase: () => ({
      model: { ...model, search: { ...model.search, caseSensitive: !model.search.caseSensitive } },
    }),
    OpenCompletion: ({ open }) => {
      if (!open) return { model: { ...model, completion: null } };
      const offset = model.selection.head;
      const words =
        (model.options.suggestions ?? "words") === "words"
          ? wordCompletions(model.document.text, offset)
          : null;
      return {
        ...request({ ...model, completion: words ?? model.completion }, { reveal: false }),
        outMessage: OutMessage.RequestedCompletion({
          version: documentVersion(model.document),
          offset,
        }),
      };
    },
    MoveCompletion: ({ delta }) => {
      if (model.completion === null) return { model };
      const count = Completion.visible(
        model.completion,
        model.document.text,
        model.selection.head,
      ).length;
      return { model: { ...model, completion: Completion.move(model.completion, delta, count) } };
    },
    ChooseCompletion: ({ index }) =>
      model.completion === null
        ? { model }
        : run({ ...model, completion: { ...model.completion, index } }, "complete"),
    Hovered: (event) => {
      if (!matches(model, event) || event.revision !== model.document.revision) return { model };
      if (event.offset === null && model.hover?.source === "Keyboard") return { model };
      const hover =
        event.offset === null || !validOffset(model.document.text, event.offset)
          ? null
          : { offset: event.offset, source: event.source };
      return {
        model: { ...model, hover },
        outMessage: OutMessage.Hovered({
          version: documentVersion(model.document),
          offset: hover?.offset ?? null,
          source: event.source,
        }),
      };
    },
    DismissedHover: () => ({ model: model.hover === null ? model : { ...model, hover: null } }),
    GoToLine: ({ value }) => ({ model: { ...model, goToLine: value } }),
    Reveal: ({ selection }) => request(model, { selection }),
  });
