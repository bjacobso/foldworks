import { Schema as S } from "effect";

export const Author = S.Struct({ id: S.String, name: S.String, avatarUrl: S.optional(S.String) });
export type Author = typeof Author.Type;
export const Comment = S.Struct({
  id: S.String,
  author: Author,
  body: S.String,
  createdAt: S.String,
  editedAt: S.optional(S.String),
  pending: S.optional(S.Boolean),
});
export type Comment = typeof Comment.Type;
export const Thread = <Anchor extends S.Top>(Anchor: Anchor) =>
  S.Struct({
    id: S.String,
    anchor: Anchor,
    status: S.Literals(["open", "resolved"]),
    comments: S.Array(Comment),
  });
export type Thread<Anchor> = Readonly<{
  id: string;
  anchor: Anchor;
  status: "open" | "resolved";
  comments: readonly Comment[];
}>;
export type AnchorState = "current" | "moved" | "outdated";
