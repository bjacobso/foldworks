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
        selectionLine: 0,
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
        selectionLine: line,
        draft: "",
        announcement: `Selected ${side} line ${line} in ${path}.`,
      },
    }),
    ChangedDraft: ({ value }) => ({ model: { ...model, draft: value } }),
    SubmittedComment: () => {
      const body = model.draft.trim();
      if (body === "" || model.selectionPath === "" || model.selectionLine < 1) return { model };
      return {
        model: {
          ...model,
          comments: [...model.comments, {
            id: `comment-${model.comments.length + 1}`,
            path: model.selectionPath,
            side: model.selectionSide,
            line: model.selectionLine,
            author: "You",
            body,
            resolved: false,
          }],
          selectionPath: "",
          selectionLine: 0,
          draft: "",
          announcement: "Review comment added.",
        },
      };
    },
    CancelledComment: () => ({
      model: { ...model, selectionPath: "", selectionLine: 0, draft: "", announcement: "Comment cancelled." },
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
