import { Update } from "foldkit";
import { Option } from "effect";
import { ReviewThreads, applySuggestions } from "@foldworks/review";
import { lineGutterId } from "@foldworks/diff-viewer";

import { Message } from "./message";
import type { Model } from "./model";

const foldThreads = Update.foldChild({
  update: ReviewThreads.update,
  read: (model: Model) => Option.some(model.reviewUi),
  write: (model, reviewUi) => ({ ...model, reviewUi }),
  toParentMessage: (message) => Message.GotReviewThreadsMessage({ message }),
  foldOutMessage:
    (out) =>
    (model: Model): Update.Return<Model, Message> => {
      if (out._tag === "RequestedActivate") {
        const comment = model.comments.find((c) => c.id === out.threadId);
        return comment ? { model: { ...model, activePath: comment.path } } : { model };
      }
      if (out._tag === "RequestedResolve" || out._tag === "RequestedReopen")
        return {
          model: {
            ...model,
            comments: model.comments.map((c) =>
              c.id === out.threadId || c.threadId === out.threadId
                ? { ...c, resolved: out._tag === "RequestedResolve" }
                : c,
            ),
          },
        };
      if (out._tag === "RequestedDelete")
        return {
          model: { ...model, comments: model.comments.filter((c) => c.id !== out.commentId) },
        };
      const acknowledge = (next: Model) =>
        foldThreads(
          next,
          ReviewThreads.Message.Committed({ draftKey: out.draftKey, body: out.body }),
        );
      if (out._tag === "RequestedEdit")
        return acknowledge({
          ...model,
          comments: model.comments.map((c) =>
            c.id === out.commentId ? { ...c, body: out.body } : c,
          ),
        });
      if (out._tag === "RequestedReply") {
        const parent = model.comments.find((c) => c.id === out.threadId);
        return parent
          ? acknowledge({
              ...model,
              comments: [
                ...model.comments,
                {
                  ...parent,
                  id: `comment-${model.comments.length + 1}`,
                  threadId: parent.id,
                  author: "You",
                  pending: true,
                  body: out.body,
                },
              ],
            })
          : { model };
      }
      return acknowledge(update({ ...model, draft: out.body }, Message.SubmittedComment()).model);
    },
});

const updateCore = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotReviewThreadsMessage: ({ message }) => foldThreads(model, message),
    AppliedSuggestion: ({ threadId }) => {
      const suggestion = model.comments.find((c) => c.id === threadId)?.suggestion;
      if (!suggestion) return { model };
      const result = applySuggestions(model.workingText, [suggestion]);
      return result.status === "applied"
        ? {
            model: {
              ...model,
              workingText: result.text,
              comments: model.comments.map((c) =>
                c.id === threadId ? { ...c, resolved: true } : c,
              ),
              announcement: "Suggestion applied locally.",
            },
          }
        : { model: { ...model, announcement: `Suggestion rejected: ${result.reason}.` } };
    },
    ChangedReviewSummary: ({ summary }) => ({ model: { ...model, reviewSummary: summary } }),
    ChoseVerdict: ({ verdict }) => ({ model: { ...model, verdict } }),
    SubmittedReview: () => ({
      model: {
        ...model,
        submittedVerdict: model.verdict,
        comments: model.comments.map((c) => ({ ...c, pending: false })),
        announcement: "Local review submitted.",
      },
    }),
    ExpandedContext: ({ beforeHunkId }) => ({
      model: { ...model, expandedHunks: [...model.expandedHunks, beforeHunkId] },
    }),
    SelectedFile: ({ path }) => ({
      model: {
        ...model,
        activePath: path,
        selectionPath: "",
        selectionStartLine: 0,
        selectionEndLine: 0,
        selectionDragging: false,
        draft: "",
        announcement: `Opened ${path}.`,
      },
    }),
    ChangedMode: ({ mode }) => ({
      model: { ...model, mode, announcement: `${mode} diff selected.` },
    }),
    SelectedLine: ({ path, side, line }) => ({
      model: {
        ...model,
        reviewUi: {
          ...model.reviewUi,
          composerKey: "new",
          returnFocusId: lineGutterId({ path, side, line }),
        },
        selectionPath: path,
        selectionSide: side,
        selectionStartLine: line,
        selectionEndLine: line,
        selectionDragging: false,
        draft: "",
        announcement: `Selected ${side} line ${line} in ${path}.`,
      },
    }),
    StartedSelection: ({ path, side, line }) => ({
      model: {
        ...model,
        reviewUi: {
          ...model.reviewUi,
          composerKey: "new",
          returnFocusId: lineGutterId({ path, side, line }),
        },
        selectionPath: path,
        selectionSide: side,
        selectionStartLine: line,
        selectionEndLine: line,
        selectionDragging: true,
        draft: "",
        announcement: `Started selection at ${side} line ${line}.`,
      },
    }),
    ExtendedSelection: ({ path, side, line, method }) => {
      const sameAnchor = model.selectionPath === path && model.selectionSide === side;
      if (!sameAnchor || (method === "Pointer" && !model.selectionDragging)) return { model };
      const start = Math.min(model.selectionStartLine, line);
      const end = Math.max(model.selectionStartLine, line);
      return {
        model: {
          ...model,
          selectionEndLine: line,
          announcement: `Selected ${side} lines ${start} through ${end}.`,
        },
      };
    },
    EndedSelection: () =>
      !model.selectionDragging ? { model } : { model: { ...model, selectionDragging: false } },
    ChangedDraft: ({ value }) => ({ model: { ...model, draft: value } }),
    SubmittedComment: () => {
      const body = model.draft.trim();
      if (body === "" || model.selectionPath === "" || model.selectionStartLine < 1)
        return { model };
      const startLine = Math.min(model.selectionStartLine, model.selectionEndLine);
      const endLine = Math.max(model.selectionStartLine, model.selectionEndLine);
      return {
        model: {
          ...model,
          comments: [
            ...model.comments,
            {
              id: `comment-${model.comments.length + 1}`,
              path: model.selectionPath,
              side: model.selectionSide,
              startLine,
              endLine,
              author: "You",
              pending: true,
              body,
              resolved: false,
            },
          ],
          selectionPath: "",
          selectionStartLine: 0,
          selectionEndLine: 0,
          selectionDragging: false,
          draft: "",
          announcement: "Review comment added.",
        },
      };
    },
    CancelledComment: () => ({
      model: {
        ...model,
        selectionPath: "",
        selectionStartLine: 0,
        selectionEndLine: 0,
        selectionDragging: false,
        draft: "",
        announcement: "Comment cancelled.",
      },
    }),
    ToggledViewed: ({ path, viewed }) => ({
      model: {
        ...model,
        viewedPaths: viewed
          ? [...new Set([...model.viewedPaths, path])]
          : model.viewedPaths.filter((item) => item !== path),
        announcement: `${path} marked ${viewed ? "viewed" : "unviewed"}.`,
      },
    }),
    ToggledResolved: ({ id }) => ({
      model: {
        ...model,
        comments: model.comments.map((comment) =>
          comment.id === id ? { ...comment, resolved: !comment.resolved } : comment,
        ),
        announcement: "Review thread updated.",
      },
    }),
  });

export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  const result = updateCore(model, message);
  if (
    message._tag === "SelectedLine" ||
    (message._tag === "EndedSelection" && model.selectionDragging)
  ) {
    return foldThreads(
      result.model,
      ReviewThreads.Message.OpenedComposer({
        draftKey: "new",
        returnFocusId: result.model.reviewUi.returnFocusId,
      }),
    );
  }
  return result;
};
