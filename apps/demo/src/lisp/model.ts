import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { Outliner } from "@foldworks/outliner";
import { ValueTree } from "@foldworks/ui";

import { Proposal, Reply } from "./assistant";
import { OUTLINE_ID, sampleOutline } from "./sample";

export const Model = S.Struct({
  outline: Outliner.Model,
  /** Bullets and plain rows, or brackets that make the outline read as source. */
  notation: S.Literals(["Outline", "Lisp"]),
  showSource: S.Boolean,
  /** The program printed as Lisp. Its text is the printed outline unless it is being edited. */
  source: CodeEditor.Model,
  sourceError: S.NullOr(S.String),
  /** The inspected value, as a tree whose branches load when expanded. */
  values: ValueTree.Model,
  /** How many children of each branch of the inspected value have loaded. */
  loaded: S.Record(S.String, S.Number),
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
  source: CodeEditor.init({
    id: domIds.source,
    uri: SOURCE_URI,
    languageId: "lisp",
    tabSize: 2,
    suggestions: "host",
  }),
  sourceError: null,
  values: ValueTree.init({ id: domIds.value }),
  loaded: {},
  prompt: "",
  proposal: null,
  reply: null,
  platform: detectPlatform(),
});

export const SOURCE_URI = "file:///onboarding.lisp";

export const domIds = {
  prompt: "lisp-ide-prompt",
  accept: "lisp-ide-accept",
  source: "lisp-ide-source",
  value: "lisp-ide-value",
};
