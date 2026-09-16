import type { Update } from "foldkit";

import { Message } from "./message";
import type { Model } from "./model";

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
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
    ChangedMode: ({ mode }) => ({ model: { ...model, mode, announcement: `${mode} diff selected.` } }),
    SelectedLine: ({ path, side, line }) => ({
      model: {
        ...model,
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
    EndedSelection: () => !model.selectionDragging
      ? ({ model })
      : ({ model: { ...model, selectionDragging: false } }),
    ChangedDraft: ({ value }) => ({ model: { ...model, draft: value } }),
    SubmittedComment: () => {
      const body = model.draft.trim();
      if (body === "" || model.selectionPath === "" || model.selectionStartLine < 1) return { model };
      const startLine = Math.min(model.selectionStartLine, model.selectionEndLine);
      const endLine = Math.max(model.selectionStartLine, model.selectionEndLine);
      return {
        model: {
          ...model,
          comments: [...model.comments, {
            id: `comment-${model.comments.length + 1}`,
            path: model.selectionPath,
            side: model.selectionSide,
            startLine,
            endLine,
            author: "You",
            body,
            resolved: false,
          }],
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
        comments: model.comments.map((comment) => comment.id === id ? { ...comment, resolved: !comment.resolved } : comment),
        announcement: "Review thread updated.",
      },
    }),
  });
