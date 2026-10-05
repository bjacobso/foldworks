import { Schema as S } from "effect";
import { Outliner } from "@foldworks/outliner";

import { Proposal, Reply } from "./assistant";
import { OUTLINE_ID, sampleOutline } from "./sample";

export const Model = S.Struct({
  outline: Outliner.Model,
  /** Bullets and plain rows, or brackets that make the outline read as source. */
  notation: S.Literals(["Outline", "Lisp"]),
  showSource: S.Boolean,
  /** Source text being typed, while it differs from the printed outline. */
  sourceDraft: S.NullOr(S.String),
  sourceError: S.NullOr(S.String),
  prompt: S.String,
  proposal: S.NullOr(Proposal),
  reply: S.NullOr(Reply),
  platform: S.Literals(["mac", "other"]),
});
export type Model = typeof Model.Type;

const detectPlatform = (): Model["platform"] =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "mac"
    : "other";

export const initialModel = (): Model => ({
  outline: Outliner.init({ id: OUTLINE_ID, items: sampleOutline }),
  notation: "Outline",
  showSource: false,
  sourceDraft: null,
  sourceError: null,
  prompt: "",
  proposal: null,
  reply: null,
  platform: detectPlatform(),
});

export const domIds = {
  prompt: "lisp-ide-prompt",
  accept: "lisp-ide-accept",
  source: "lisp-ide-source",
};
