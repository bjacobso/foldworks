import * as Dom from "foldkit/dom";
import { diffFile, DiffViewer } from "../diff-viewer";
import { Suggestion } from "./suggestions";
import { Effect, Option, Schema as S } from "effect";
import { Command, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { AnchorState, Comment, Thread } from "./data";

export const Model = S.Struct({
  id: S.String,
  composerKey: S.String,
  editingCommentId: S.String,
  drafts: S.Record(S.String, S.String),
  suggestionDrafts: S.Record(S.String, S.String),
  suggestionKeys: S.Array(S.String),
  expandedResolved: S.Array(S.String),
  activeThreadId: S.String,
  filter: S.Literals(["all", "open", "resolved", "outdated"]),
  returnFocusId: S.String,
  announcement: S.String,
});
export type Model = typeof Model.Type;
const SuggestionAnchor = S.Struct({
  path: S.String,
  startLine: S.Number,
  endLine: S.Number,
  expected: S.String,
});
export const Message = defineMessageUnion({
  OpenedComposer: { draftKey: S.String, returnFocusId: S.String },
  ChangedSuggestion: { draftKey: S.String, value: S.String },
  ToggledSuggestion: { draftKey: S.String, value: S.String, enabled: S.Boolean },
  ChangedDraft: { draftKey: S.String, value: S.String },
  StartedEdit: { commentId: S.String, body: S.String, draftKey: S.String, returnFocusId: S.String },
  Submitted: {
    draftKey: S.String,
    kind: S.Literals(["create", "reply", "edit"]),
    targetId: S.String,
    suggestionAnchor: S.optional(SuggestionAnchor),
  },
  Committed: { draftKey: S.String, body: S.String, suggestion: S.optional(Suggestion) },
  Cancelled: {},
  CompletedFocus: {},
  RequestedDelete: { threadId: S.String, commentId: S.String },
  RequestedResolve: { threadId: S.String },
  RequestedReopen: { threadId: S.String },
  ToggledExpanded: { threadId: S.String },
  ChangedFilter: { filter: S.Literals(["all", "open", "resolved", "outdated"]) },
  ActivatedThread: { threadId: S.String },
  RevealedThread: { threadId: S.String },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  RequestedCreateThread: {
    draftKey: S.String,
    anchorKey: S.String,
    body: S.String,
    suggestion: S.optional(Suggestion),
  },
  RequestedReply: {
    draftKey: S.String,
    threadId: S.String,
    body: S.String,
    suggestion: S.optional(Suggestion),
  },
  RequestedEdit: { draftKey: S.String, commentId: S.String, body: S.String },
  RequestedDelete: { threadId: S.String, commentId: S.String },
  RequestedResolve: { threadId: S.String },
  RequestedReopen: { threadId: S.String },
  RequestedActivate: { threadId: S.String },
});
export type OutMessage = typeof OutMessage.Type;
export const init = ({ id }: Readonly<{ id: string }>): Model => ({
  id,
  composerKey: "",
  editingCommentId: "",
  drafts: {},
  suggestionDrafts: {},
  suggestionKeys: [],
  expandedResolved: [],
  activeThreadId: "",
  filter: "all",
  returnFocusId: "",
  announcement: "",
});
const Focus = Command.define("FocusReviewTarget", {
  args: { id: S.String },
  messages: [Message.CompletedFocus],
  execute: ({ id }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(Effect.ignore, Effect.as(Message.CompletedFocus())),
});
// Encode ids once at render time and once in the selector; callers pass raw ids.
export const composerId = (model: Model, key: string): string =>
  encodeURIComponent(`${model.id}-draft-${key}`);
const focus = (id: string) => (id ? [Focus({ id })] : []);
export const update = (
  model: Model,
  message: Message,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> =>
  Message.match(message, {
    OpenedComposer: ({ draftKey, returnFocusId }) => ({
      model: { ...model, composerKey: draftKey, editingCommentId: "", returnFocusId },
      commands: focus(composerId(model, draftKey)),
    }),
    ChangedSuggestion: ({ draftKey, value }) => ({
      model: { ...model, suggestionDrafts: { ...model.suggestionDrafts, [draftKey]: value } },
    }),
    ToggledSuggestion: ({ draftKey, value, enabled }) => ({
      model: {
        ...model,
        suggestionKeys: enabled
          ? [...new Set([...model.suggestionKeys, draftKey])]
          : model.suggestionKeys.filter((k) => k !== draftKey),
        suggestionDrafts: {
          ...model.suggestionDrafts,
          [draftKey]: model.suggestionDrafts[draftKey] ?? value,
        },
      },
    }),
    ChangedDraft: ({ draftKey, value }) => ({
      model: { ...model, drafts: { ...model.drafts, [draftKey]: value } },
    }),
    StartedEdit: ({ commentId, body, draftKey, returnFocusId }) => ({
      model: {
        ...model,
        composerKey: draftKey,
        editingCommentId: commentId,
        returnFocusId,
        drafts: { ...model.drafts, [draftKey]: model.drafts[draftKey] ?? body },
      },
      commands: focus(composerId(model, draftKey)),
    }),
    Submitted: ({ draftKey, kind, targetId, suggestionAnchor }) => {
      const body = model.drafts[draftKey] ?? "";
      const currentSuggestion =
        suggestionAnchor && model.suggestionKeys.includes(draftKey)
          ? { ...suggestionAnchor, replacement: model.suggestionDrafts[draftKey] ?? "" }
          : undefined;
      if (!body.trim()) return { model };
      return {
        model,
        outMessage:
          kind === "create"
            ? OutMessage.RequestedCreateThread({
                draftKey,
                anchorKey: targetId,
                body,
                ...(currentSuggestion ? { suggestion: currentSuggestion } : {}),
              })
            : kind === "reply"
              ? OutMessage.RequestedReply({
                  draftKey,
                  threadId: targetId,
                  body,
                  ...(currentSuggestion ? { suggestion: currentSuggestion } : {}),
                })
              : OutMessage.RequestedEdit({ draftKey, commentId: targetId, body }),
      };
    },
    Committed: ({ draftKey, body, suggestion }) => {
      // An acknowledgement for an older save must not erase newer typing.
      if (
        model.drafts[draftKey] !== body ||
        model.suggestionKeys.includes(draftKey) !== (suggestion !== undefined) ||
        (model.suggestionKeys.includes(draftKey) &&
          model.suggestionDrafts[draftKey] !== suggestion?.replacement)
      )
        return { model };
      const drafts = { ...model.drafts };
      delete drafts[draftKey];
      const suggestionDrafts = { ...model.suggestionDrafts };
      delete suggestionDrafts[draftKey];
      const closed = model.composerKey === draftKey;
      return {
        model: {
          ...model,
          drafts,
          suggestionDrafts,
          suggestionKeys: model.suggestionKeys.filter((k) => k !== draftKey),
          composerKey: closed ? "" : model.composerKey,
          editingCommentId: closed ? "" : model.editingCommentId,
          announcement: "Comment saved.",
        },
        commands: closed ? focus(model.returnFocusId) : [],
      };
    },
    Cancelled: () => ({
      model: {
        ...model,
        composerKey: "",
        editingCommentId: "",
        announcement: "Composer closed. Draft retained.",
      },
      commands: focus(model.returnFocusId),
    }),
    CompletedFocus: () => ({ model }),
    RequestedDelete: (args) => ({ model, outMessage: OutMessage.RequestedDelete(args) }),
    RequestedResolve: (args) => ({
      model: { ...model, announcement: "Resolution requested." },
      outMessage: OutMessage.RequestedResolve(args),
    }),
    RequestedReopen: (args) => ({
      model: { ...model, announcement: "Reopen requested." },
      outMessage: OutMessage.RequestedReopen(args),
    }),
    ToggledExpanded: ({ threadId }) => ({
      model: {
        ...model,
        expandedResolved: model.expandedResolved.includes(threadId)
          ? model.expandedResolved.filter((id) => id !== threadId)
          : [...model.expandedResolved, threadId],
      },
    }),
    ChangedFilter: ({ filter }) => ({ model: { ...model, filter, activeThreadId: "" } }),
    ActivatedThread: ({ threadId }) => ({ model: { ...model, activeThreadId: threadId } }),
    RevealedThread: (args) => ({
      model,
      outMessage: OutMessage.RequestedActivate({ threadId: args.threadId }),
    }),
  });

type Base<Message> = Readonly<{ model: Model; toMessage: (message: MessageType) => Message }>;
type MessageType = Message;
export type ComposerConfig<Message> = Base<Message> &
  Readonly<{
    draftKey: string;
    targetId: string;
    kind: "create" | "reply" | "edit";
    label?: string;
    suggestionAnchor?: Omit<Suggestion, "replacement">;
  }>;
export const composerView = <ParentMessage>(
  config: ComposerConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model, draftKey, toMessage } = config;
  const submit = () =>
    toMessage(
      Message.Submitted({
        draftKey,
        targetId: config.targetId,
        kind: config.kind,
        ...(config.suggestionAnchor ? { suggestionAnchor: config.suggestionAnchor } : {}),
      }),
    );
  return h.form(
    [h.Class("fk-review__composer"), h.OnSubmit(submit())],
    [
      h.label([h.For(composerId(model, draftKey))], [config.label ?? "Review comment"]),
      h.textarea([
        h.Id(composerId(model, draftKey)),
        h.AriaLabel(config.label ?? "Review comment"),
        h.Value(model.drafts[draftKey] ?? ""),
        h.OnInput((value) => toMessage(Message.ChangedDraft({ draftKey, value }))),
        h.OnKeyDownPreventDefault((key, modifiers) =>
          key === "Escape"
            ? Option.some(toMessage(Message.Cancelled()))
            : key === "Enter" && (modifiers.metaKey || modifiers.ctrlKey)
              ? Option.some(submit())
              : Option.none(),
        ),
      ]),
      ...(config.suggestionAnchor
        ? [
            h.button(
              [
                h.Type("button"),
                h.AriaPressed(String(model.suggestionKeys.includes(draftKey))),
                h.OnClick(
                  toMessage(
                    Message.ToggledSuggestion({
                      draftKey,
                      enabled: !model.suggestionKeys.includes(draftKey),
                      value: config.suggestionAnchor.expected,
                    }),
                  ),
                ),
              ],
              [model.suggestionKeys.includes(draftKey) ? "Remove suggestion" : "Add suggestion"],
            ),
            ...(model.suggestionKeys.includes(draftKey)
              ? [
                  h.textarea([
                    h.AriaLabel("Suggested replacement"),
                    h.Value(model.suggestionDrafts[draftKey] ?? ""),
                    h.OnInput((value) => toMessage(Message.ChangedSuggestion({ draftKey, value }))),
                    h.OnKeyDownPreventDefault((key, modifiers) =>
                      key === "Escape"
                        ? Option.some(toMessage(Message.Cancelled()))
                        : key === "Enter" && (modifiers.metaKey || modifiers.ctrlKey)
                          ? Option.some(submit())
                          : Option.none(),
                    ),
                  ]),
                ]
              : []),
          ]
        : []),
      h.button(
        [h.Type("submit"), h.Disabled(!(model.drafts[draftKey] ?? "").trim())],
        [config.kind === "edit" ? "Save edit" : "Add comment"],
      ),
      h.button([h.Type("button"), h.OnClick(toMessage(Message.Cancelled()))], ["Cancel"]),
    ],
  );
};
export type ThreadConfig<Anchor, Message> = Base<Message> &
  Readonly<{
    thread: Thread<Anchor>;
    readOnly?: boolean;
    anchorState?: AnchorState;
    label?: string;
    onApplySuggestion?: (suggestion: Suggestion, threadId: string) => Message;
    renderBody?: (comment: Comment) => Html;
    canEdit?: (comment: Comment) => boolean;
    canDelete?: (comment: Comment) => boolean;
  }>;
export const threadView = <Anchor, ParentMessage>(
  config: ThreadConfig<Anchor, ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { thread, model, toMessage } = config;
  const action = (label: string, message: MessageType, id?: string) =>
    h.button([h.Type("button"), ...(id ? [h.Id(id)] : []), h.OnClick(toMessage(message))], [label]);
  const collapsed = thread.status === "resolved" && !model.expandedResolved.includes(thread.id);
  const replyKey = `reply:${thread.id}`;
  return h.article(
    [
      h.Class("fk-review__thread"),
      h.DataAttribute("thread-id", thread.id),
      h.DataAttribute("anchor-state", config.anchorState ?? "current"),
      h.AriaLabel(config.label ?? "Review thread"),
    ],
    [
      h.header(
        [],
        [
          h.strong([], [config.label ?? "Discussion"]),
          h.span([], [` · ${thread.status} · ${config.anchorState ?? "current"}`]),
          ...(thread.status === "resolved"
            ? [
                action(
                  collapsed ? "Show resolved thread" : "Hide resolved thread",
                  Message.ToggledExpanded({ threadId: thread.id }),
                ),
              ]
            : []),
        ],
      ),
      ...(!collapsed
        ? [
            ...thread.comments.map((comment) =>
              h.div(
                [h.Class("fk-review__comment")],
                [
                  h.strong([], [comment.author.name]),
                  h.time([h.Datetime(comment.createdAt)], [comment.createdAt]),
                  ...(comment.pending ? [h.span([], ["Pending"])] : []),
                  model.editingCommentId === comment.id &&
                  model.composerKey === `edit:${comment.id}`
                    ? composerView(
                        {
                          ...config,
                          draftKey: `edit:${comment.id}`,
                          targetId: comment.id,
                          kind: "edit",
                          label: "Edit comment",
                        },
                        h,
                      )
                    : (config.renderBody?.(comment) ??
                      h.p([h.Class("fk-review__body")], [comment.body])),
                  ...(comment.suggestion
                    ? [
                        DiffViewer.view(
                          {
                            file: diffFile({
                              path: comment.suggestion.path,
                              oldText: comment.suggestion.expected + "\n",
                              newText: comment.suggestion.replacement
                                ? comment.suggestion.replacement.replace(/\n$/, "") + "\n"
                                : "",
                            }),
                          },
                          h,
                        ),
                        ...(!config.readOnly && config.onApplySuggestion
                          ? [
                              h.button(
                                [
                                  h.Type("button"),
                                  h.OnClick(
                                    config.onApplySuggestion(comment.suggestion, thread.id),
                                  ),
                                ],
                                ["Apply suggestion"],
                              ),
                            ]
                          : []),
                      ]
                    : []),
                  ...(!config.readOnly && config.canEdit?.(comment)
                    ? [
                        action(
                          "Edit",
                          Message.StartedEdit({
                            commentId: comment.id,
                            body: comment.body,
                            draftKey: `edit:${comment.id}`,
                            returnFocusId: `${model.id}-edit-${comment.id}`,
                          }),
                          `${model.id}-edit-${comment.id}`,
                        ),
                      ]
                    : []),
                  ...(!config.readOnly && config.canDelete?.(comment)
                    ? [
                        action(
                          "Delete",
                          Message.RequestedDelete({ threadId: thread.id, commentId: comment.id }),
                        ),
                      ]
                    : []),
                ],
              ),
            ),
            ...(config.readOnly
              ? []
              : [
                  model.composerKey === replyKey
                    ? composerView(
                        {
                          ...config,
                          draftKey: replyKey,
                          targetId: thread.id,
                          kind: "reply",
                          label: "Reply",
                        },
                        h,
                      )
                    : action(
                        "Reply",
                        Message.OpenedComposer({
                          draftKey: replyKey,
                          returnFocusId: `${model.id}-reply-${thread.id}`,
                        }),
                        `${model.id}-reply-${thread.id}`,
                      ),
                  action(
                    thread.status === "open" ? "Resolve thread" : "Reopen thread",
                    thread.status === "open"
                      ? Message.RequestedResolve({ threadId: thread.id })
                      : Message.RequestedReopen({ threadId: thread.id }),
                  ),
                ]),
          ]
        : []),
      h.div(
        [h.Role("status"), h.AriaLive("polite"), h.Class("fk-review__sr")],
        [model.announcement],
      ),
    ],
  );
};
export type ListConfig<Anchor, Message> = Base<Message> &
  Readonly<{
    threads: readonly Thread<Anchor>[];
    groupBy: (thread: Thread<Anchor>) => string;
    anchorState?: (thread: Thread<Anchor>) => AnchorState;
  }>;
export const listView = <Anchor, ParentMessage>(
  config: ListConfig<Anchor, ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { model, toMessage } = config;
  const entries = config.threads.filter(
    (t) =>
      model.filter === "all" ||
      (model.filter === "outdated"
        ? config.anchorState?.(t) === "outdated"
        : t.status === model.filter),
  );
  const active = entries.find((t) => t.id === model.activeThreadId) ?? entries[0];
  const id = (threadId: string) => encodeURIComponent(`${model.id}-list-${threadId}`);
  return h.section(
    [h.Class("fk-review__list")],
    [
      h.div(
        [h.Role("group"), h.AriaLabel("Thread filter")],
        (["all", "open", "resolved", "outdated"] as const).map((filter) =>
          h.button(
            [
              h.Type("button"),
              h.AriaPressed(String(model.filter === filter)),
              h.OnClick(toMessage(Message.ChangedFilter({ filter }))),
            ],
            [filter],
          ),
        ),
      ),
      h.div(
        [
          h.Role("listbox"),
          h.AriaLabel("Review threads"),
          h.Tabindex(0),
          ...(active ? [h.AriaActiveDescendant(id(active.id))] : []),
          h.OnKeyDownPreventDefault((key) => {
            if (key === "Enter" && active)
              return Option.some(toMessage(Message.RevealedThread({ threadId: active.id })));
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key) || !entries.length)
              return Option.none();
            const index = entries.findIndex((t) => t.id === active?.id);
            const next =
              entries[
                key === "Home"
                  ? 0
                  : key === "End"
                    ? entries.length - 1
                    : Math.max(
                        0,
                        Math.min(entries.length - 1, index + (key === "ArrowDown" ? 1 : -1)),
                      )
              ]!;
            return Option.some(toMessage(Message.ActivatedThread({ threadId: next.id })));
          }),
        ],
        [...new Set(entries.map(config.groupBy))].map((group) =>
          h.div(
            [h.Role("group"), h.AriaLabel(group)],
            [
              h.h4([], [group]),
              ...entries
                .filter((t) => config.groupBy(t) === group)
                .map((t) =>
                  h.div(
                    [
                      h.Id(id(t.id)),
                      h.Role("option"),
                      h.AriaSelected(t.id === active?.id),
                      h.OnClick(toMessage(Message.RevealedThread({ threadId: t.id }))),
                    ],
                    [
                      `${t.comments[0]?.author.name ?? "Thread"}: ${t.comments[0]?.body ?? ""} · ${t.status} · ${config.anchorState?.(t) ?? "current"}`,
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
      ...(entries.length ? [] : [h.p([], ["No matching threads."])]),
    ],
  );
};
