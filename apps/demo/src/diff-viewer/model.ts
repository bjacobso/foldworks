import { Schema as S } from "effect";

import { reviewFiles } from "./fixture";

export const ReviewComment = S.Struct({
  id: S.String,
  path: S.String,
  side: S.Literals(["old", "new"]),
  line: S.Number,
  author: S.String,
  body: S.String,
  resolved: S.Boolean,
});
export type ReviewComment = typeof ReviewComment.Type;

export const Model = S.Struct({
  activePath: S.String,
  mode: S.Literals(["Unified", "Split"]),
  viewedPaths: S.Array(S.String),
  selectionPath: S.String,
  selectionSide: S.Literals(["old", "new"]),
  selectionLine: S.Number,
  draft: S.String,
  comments: S.Array(ReviewComment),
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  activePath: reviewFiles[0]?.path ?? "",
  mode: "Split",
  viewedPaths: [reviewFiles[1]?.path ?? ""].filter(Boolean),
  selectionPath: "",
  selectionSide: "new",
  selectionLine: 0,
  draft: "",
  comments: [
    {
      id: "comment-1",
      path: reviewFiles[0]?.path ?? "",
      side: "new",
      line: 24,
      author: "Maya Chen",
      body: "Should this emit only after the API call succeeds? Otherwise retries could double-count published reviews.",
      resolved: false,
    },
    {
      id: "comment-2",
      path: reviewFiles[2]?.path ?? "",
      side: "new",
      line: 82,
      author: "Noah Williams",
      body: "Nice—scoping the patch at the Git boundary will keep large reviews responsive.",
      resolved: true,
    },
  ],
  announcement: "Code review ready. Five files changed.",
};
