import { Schema as S } from "effect";

export const Suggestion = S.Struct({
  name: S.String,
  kind: S.String,
  type: S.optional(S.String),
  doc: S.optional(S.String),
});
export const Slot = S.Struct({
  key: S.String,
  label: S.String,
  text: S.String,
  caret: S.Number,
  /** Keyword options belong in their form header; child forms get their own row. */
  inline: S.Boolean,
  doc: S.optional(S.String),
});
