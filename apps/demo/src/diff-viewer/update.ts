import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import * as Dom from "foldkit/dom";
import { CodeEditor } from "foldworks/code-editor";
import { ReviewThreads, ChangedFiles, applySuggestions, type Comment } from "foldworks/review";
import { lineGutterId, normalizeSelection } from "foldworks/diff-viewer";
import { Message } from "./message";
import { freshModel, type Model, type Anchor } from "./model";
import { author, reviewer, editorFor, storageKey } from "./fixture";
import { fileDiff, changedFiles, revisionKey, checks, canMerge, mappedThread } from "./domain";

const Persist = Command.define("PersistLocalChangeRequest", {
  args: { snapshot: S.String },
  messages: [Message.Persisted],
  execute: ({ snapshot }) =>
    Effect.sync(() => {
      try {
        localStorage.setItem(storageKey, snapshot);
        return Message.Persisted({ error: "" });
      } catch {
        return Message.Persisted({
          error: "Browser storage failed. Your changes remain in this session.",
        });
      }
    }),
});
const Reveal = Command.define("RevealReviewAnchor", {
  args: { id: S.String },
  messages: [Message.CompletedReveal],
  execute: ({ id }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(
      Effect.andThen(Dom.scrollIntoView(`#${CSS.escape(id)}`, { block: "center" })),
      Effect.ignore,
      Effect.as(Message.CompletedReveal()),
    ),
});
const actor = (model: Model) => (model.actor === "author" ? author : reviewer);
const event = (model: Model, title: string, kind: string, context = ""): Model => ({
  ...model,
  activity: [
    ...model.activity,
    {
      id: `event-${model.activity.length + 1}`,
      title,
      kind,
      actor: actor(model).name,
      timestamp: new Date().toISOString(),
      context,
      changes: [],
    },
  ],
  announcement: title,
});
const selectFile = (model: Model, path: string): Model => {
  const file = model.files.find((f) => f.path === path);
  return !file
    ? model
    : {
        ...model,
        activePath: path,
        selection: null,
        dragging: false,
        editor: {
          ...editorFor(path).update(
            model.editor,
            CodeEditor.execute(
              CodeEditor.Operation.ReplaceDocument({
                uri: path,
                text: file.text,
                languageId: "json",
              }),
            ),
          ).model,
          options: {
            ...model.editor.options,
            theme: model.dark ? "dark" : "light",
            readOnly: model.actor !== "author" || model.status === "merged",
          },
        },
      };
};
const foldEditor = (parent: Model, message: CodeEditor.Message) =>
  Update.foldChild({
    update: editorFor(parent.activePath).update,
    read: (model: Model) => Option.some(model.editor),
    write: (model, editor) => ({ ...model, editor }),
    toParentMessage: (message) => Message.GotEditorMessage({ message }),
    foldOutMessage:
      (out) =>
      (model: Model): Update.Return<Model, Message> => {
        if (out._tag !== "ChangedDocument") return { model };
        if (model.actor !== "author" || model.status === "merged")
          return { model: selectFile(model, model.activePath) };
        return {
          model: {
            ...model,
            files: model.files.map((f) =>
              f.path === model.activePath ? { ...f, text: out.document.text } : f,
            ),
            viewedPaths: model.viewedPaths.filter((p) => p !== model.activePath),
            expandedGaps: [],
            announcement: "Working configuration updated. Local checks recalculated.",
          },
        };
      },
  })(parent, message);
const foldFiles = (parent: Model, message: ChangedFiles.Message) =>
  Update.foldChild({
    update: (model: ChangedFiles.Model, message: ChangedFiles.Message) =>
      ChangedFiles.update(model, message, { files: changedFiles(parent) }),
    read: (model: Model) => Option.some(model.filesUi),
    write: (model, filesUi) => ({ ...model, filesUi }),
    toParentMessage: (message) => Message.GotFilesMessage({ message }),
    foldOutMessage:
      (out) =>
      (model: Model): Update.Return<Model, Message> =>
        out._tag === "SelectedFile"
          ? { model: selectFile(model, out.path) }
          : {
              model: {
                ...model,
                viewedPaths: out.viewed
                  ? [...new Set([...model.viewedPaths, out.path])]
                  : model.viewedPaths.filter((p) => p !== out.path),
              },
            },
  })(parent, message);
const foldThreads = Update.foldChild({
  update: ReviewThreads.update,
  read: (model: Model) => Option.some(model.reviewUi),
  write: (model, reviewUi) => ({ ...model, reviewUi }),
  toParentMessage: (message) => Message.GotThreadsMessage({ message }),
  foldOutMessage:
    (out) =>
    (model: Model): Update.Return<Model, Message> => {
      if (out._tag === "RequestedActivate") {
        const thread = model.threads.find((t) => t.id === out.threadId);
        if (!thread) return { model };
        const mapping = mappedThread(model, thread);
        const next = selectFile(model, thread.anchor.path);
        return {
          model: {
            ...next,
            semantic: false,
            reviewUi: { ...next.reviewUi, activeThreadId: thread.id },
          },
          commands: [
            Reveal({
              id:
                mapping.state === "outdated" ||
                !fileDiff(model.files.find((f) => f.path === thread.anchor.path)!).hunks.length
                  ? `review-thread-${thread.id}`
                  : lineGutterId({
                      path: mapping.range.path,
                      side: mapping.range.side,
                      line: mapping.range.endLine,
                    }),
            }),
          ],
        };
      }
      if (model.status !== "open") return { model };
      if (out._tag === "RequestedResolve" || out._tag === "RequestedReopen")
        return {
          model: event(
            {
              ...model,
              threads: model.threads.map((t) =>
                t.id === out.threadId
                  ? { ...t, status: out._tag === "RequestedResolve" ? "resolved" : "open" }
                  : t,
              ),
            },
            out._tag === "RequestedResolve" ? "Thread resolved" : "Thread reopened",
            "comment",
          ),
        };
      if (out._tag === "RequestedDelete")
        return {
          model: {
            ...model,
            threads: model.threads
              .map((t) =>
                t.id === out.threadId
                  ? {
                      ...t,
                      comments: t.comments.filter(
                        (c) => c.id !== out.commentId || c.author.id !== model.actor,
                      ),
                    }
                  : t,
              )
              .filter((t) => t.comments.length),
          },
        };
      const acknowledge = (next: Model) =>
        foldThreads(
          next,
          ReviewThreads.Message.Committed({
            draftKey: out.draftKey,
            body: out.body,
            ...("suggestion" in out && out.suggestion ? { suggestion: out.suggestion } : {}),
          }),
        );
      if (out._tag === "RequestedEdit") {
        const own = model.threads.some((t) =>
          t.comments.some((c) => c.id === out.commentId && c.author.id === model.actor),
        );
        if (!own) return { model };
        return acknowledge({
          ...model,
          threads: model.threads.map((t) => ({
            ...t,
            comments: t.comments.map((c) =>
              c.id === out.commentId
                ? { ...c, body: out.body, editedAt: new Date().toISOString() }
                : c,
            ),
          })),
        });
      }
      const comment: Comment = {
        id: `comment-${model.nextId}`,
        author: actor(model),
        body: out.body,
        createdAt: new Date().toISOString(),
        pending: model.actor === "reviewer",
        ...(out.suggestion ? { suggestion: out.suggestion } : {}),
      };
      if (out._tag === "RequestedReply") {
        if (!model.threads.some((t) => t.id === out.threadId)) return { model };
        return acknowledge(
          event(
            {
              ...model,
              nextId: model.nextId + 1,
              threads: model.threads.map((t) =>
                t.id === out.threadId ? { ...t, comments: [...t.comments, comment] } : t,
              ),
            },
            "Reply saved locally",
            "comment",
          ),
        );
      }
      const anchor = model.draftAnchors[out.anchorKey];
      if (!anchor || !comment.body.trim()) return { model };
      if (
        comment.suggestion &&
        (anchor.side !== "new" ||
          comment.suggestion.path !== anchor.path ||
          comment.suggestion.startLine !== anchor.startLine ||
          comment.suggestion.endLine !== anchor.endLine)
      )
        return { model };
      return acknowledge(
        event(
          {
            ...model,
            nextId: model.nextId + 1,
            selection: null,
            dragging: false,
            threads: [
              ...model.threads,
              { id: `thread-${model.nextId}`, anchor, status: "open", comments: [comment] },
            ],
          },
          comment.pending ? "Pending comment saved locally" : "Comment saved locally",
          "comment",
        ),
      );
    },
});
const openComposer = (model: Model): Update.Return<Model, Message> => {
  if (!model.selection || model.status !== "open") return { model };
  const range = normalizeSelection(model.selection),
    file = model.files.find((f) => f.path === range.path);
  if (!file) return { model };
  const text = range.side === "old" ? file.baseText : file.text;
  const key = `new:${range.path}:${range.side}:${range.startLine}:${range.endLine}:${text}`;
  const anchor: Anchor = { ...range, revisionText: text, originalText: text };
  return foldThreads(
    { ...model, draftAnchors: { ...model.draftAnchors, [key]: anchor } },
    ReviewThreads.Message.OpenedComposer({
      draftKey: key,
      returnFocusId: lineGutterId({
        path: range.path,
        side: range.side,
        line: model.selection.endLine,
      }),
    }),
  );
};
const core = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    GotEditorMessage: ({ message }) => foldEditor(model, message),
    GotThreadsMessage: ({ message }) =>
      foldThreads(
        message._tag === "Cancelled" ? { ...model, selection: null, dragging: false } : model,
        message,
      ),
    GotFilesMessage: ({ message }) => foldFiles(model, message),
    SelectedFile: ({ path }) => ({ model: selectFile(model, path) }),
    ChangedMode: ({ mode }) => ({ model: { ...model, mode } }),
    ToggledSemantic: () => ({ model: { ...model, semantic: !model.semantic } }),
    ToggledDark: () => ({
      model: {
        ...model,
        dark: !model.dark,
        editor: {
          ...model.editor,
          options: { ...model.editor.options, theme: model.dark ? "light" : "dark" },
        },
      },
    }),
    SwitchedActor: ({ actor }) => ({
      model: selectFile(
        { ...model, actor, selection: null, reviewUi: { ...model.reviewUi, composerKey: "" } },
        model.activePath,
      ),
    }),
    SelectedLine: ({ path, side, line }) =>
      openComposer({
        ...model,
        selection: { path, side, startLine: line, endLine: line },
        dragging: false,
      }),
    StartedSelection: ({ path, side, line }) => ({
      model: {
        ...model,
        selection: { path, side, startLine: line, endLine: line },
        dragging: true,
      },
    }),
    ExtendedSelection: ({ path, side, line, method }) => {
      if (
        !model.selection ||
        model.selection.path !== path ||
        model.selection.side !== side ||
        (method === "Pointer" && !model.dragging)
      )
        return { model };
      const next = { ...model, selection: { ...model.selection, endLine: line } };
      return method === "Keyboard" ? openComposer(next) : { model: next };
    },
    EndedSelection: () =>
      model.dragging ? openComposer({ ...model, dragging: false }) : { model },
    CancelledSelection: () =>
      foldThreads(
        { ...model, selection: null, dragging: false },
        ReviewThreads.Message.Cancelled(),
      ),
    ExpandedGap: ({ id }) => ({ model: { ...model, expandedGaps: [...model.expandedGaps, id] } }),
    ChangedViewed: ({ path, viewed }) => ({
      model: {
        ...model,
        viewedPaths: viewed
          ? [...new Set([...model.viewedPaths, path])]
          : model.viewedPaths.filter((p) => p !== path),
      },
    }),
    OpenedRequest: () =>
      model.actor !== "author" ||
      model.status !== "draft" ||
      !changedFiles(model).length ||
      checks(model)[0]!.status !== "passed"
        ? { model }
        : {
            model: event(
              { ...model, status: "open" },
              "Change request opened",
              "status",
              "Local configuration proposal, stored in this browser.",
            ),
          },
    AppliedSuggestion: ({ suggestion, threadId }) => {
      if (model.actor !== "author" || model.status !== "open") return { model };
      const thread = model.threads.find((t) => t.id === threadId),
        file = model.files.find((f) => f.path === suggestion.path);
      if (
        !thread ||
        !file ||
        !thread.comments.some(
          (c) =>
            !c.pending &&
            c.suggestion &&
            JSON.stringify(c.suggestion) === JSON.stringify(suggestion),
        )
      )
        return { model };
      const result = applySuggestions(file.text, [suggestion]);
      if (result.status !== "applied")
        return {
          model: {
            ...model,
            announcement: `Suggestion rejected: ${result.reason}. Draft and threads retained.`,
          },
        };
      const replacementLines =
        suggestion.replacement === ""
          ? 0
          : suggestion.replacement.replace(/\n$/, "").split("\n").length;
      const next = event(
        {
          ...model,
          files: model.files.map((f) => (f.path === file.path ? { ...f, text: result.text } : f)),
          threads: model.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  status: "resolved",
                  anchor: {
                    ...t.anchor,
                    side: "new",
                    revisionText: result.text,
                    startLine: suggestion.startLine,
                    endLine: suggestion.startLine + Math.max(1, replacementLines) - 1,
                  },
                }
              : t,
          ),
          viewedPaths: model.viewedPaths.filter((p) => p !== file.path),
          expandedGaps: [],
        },
        "Suggestion applied locally",
        "suggestion",
        "Host committed replacement text and resolved its thread.",
      );
      return { model: selectFile(next, file.path) };
    },
    ChangedSummary: ({ value }) => ({ model: { ...model, summary: value } }),
    ChangedVerdict: ({ verdict }) => ({ model: { ...model, verdict } }),
    SubmittedReview: () =>
      model.actor !== "reviewer" || model.status !== "open"
        ? { model }
        : {
            model: event(
              {
                ...model,
                reviews: [
                  ...model.reviews,
                  { verdict: model.verdict, summary: model.summary, revision: revisionKey(model) },
                ],
                threads: model.threads.map((t) => ({
                  ...t,
                  comments: t.comments.map((c) =>
                    c.author.id === model.actor ? { ...c, pending: false } : c,
                  ),
                })),
                summary: "",
              },
              `Review submitted: ${model.verdict}`,
              "review",
              model.summary,
            ),
          },
    ReranChecks: () => ({
      model: event(
        model,
        "Local checks recalculated",
        "check",
        checks(model)
          .map((c) => `${c.name}: ${c.status}`)
          .join("; "),
      ),
    }),
    Merged: () =>
      !canMerge(model)
        ? { model: { ...model, announcement: "Merge requirements are not met." } }
        : {
            model: event(
              {
                ...model,
                status: "merged",
                files: model.files.map((f) => ({ ...f, baseText: f.text })),
                editor: { ...model.editor, options: { ...model.editor.options, readOnly: true } },
              },
              "Configuration merged locally",
              "status",
              "Saved configuration now contains the reviewed text. No external repository is connected.",
            ),
          },
    Reset: () => ({ model: freshModel() }),
    Persisted: ({ error }) => ({ model: { ...model, storageError: error } }),
    CompletedReveal: () => ({ model }),
  });
export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  const result = core(model, message);
  return message._tag === "Persisted" || message._tag === "CompletedReveal"
    ? result
    : {
        ...result,
        commands: [...(result.commands ?? []), Persist({ snapshot: JSON.stringify(result.model) })],
      };
};
