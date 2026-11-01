import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { ValueTree } from "@foldworks/ui";
import { ValueNodeSchema } from "./values.js";
import { Outliner } from "@foldworks/outliner";

import { RunOutcome } from "./run.js";
import { Proposal } from "./edits.js";
import { Analysis } from "./analysis.js";
import { Document, OutlineRow } from "./document.js";

export const Model = S.Struct({
  /** Prefixes element ids and the ids of rows the outliner creates. Unique on the page. */
  id: S.String,
  /** Names the program in the title bar. */
  title: S.String,
  outline: Outliner.Model,
  /** The outline printed as source, once the host has read the program. */
  document: S.NullOr(Document),
  /** The latest analysis. Rows show its facts while their text is the text it analyzed. */
  analysis: S.NullOr(Analysis),
  prompt: S.String,
  assistantReply: S.NullOr(S.String),
  assistantName: S.String,
  run: S.NullOr(RunOutcome),
  runToken: S.Number,
  runBusy: S.Boolean,
  editArgument: S.String,
  editToken: S.Number,
  editBusy: S.Boolean,
  proposal: S.NullOr(Proposal),
  pane: S.Literals(["outline", "source"]),
  source: CodeEditor.Model,
  sourceDirty: S.Boolean,
  sourceError: S.NullOr(S.String),
  documents: S.Array(S.Struct({ rows: S.Array(OutlineRow), document: Document })),
  notation: S.Literals(["Outline", "Brackets"]),
  inspector: S.NullOr(S.String),
  valueTree: ValueTree.Model,
  valueNodes: S.Array(ValueNodeSchema),
  failure: S.NullOr(S.String),
});
export type Model = typeof Model.Type;

export const domIds = (id: string) => ({
  outline: `${id}-outline`,
});
