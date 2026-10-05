import { Schema as S } from "effect";
import { History } from "@foldworks/history";
import { Completion, HoverSource } from "@foldworks/text-intelligence";

import { Items, find, walk, type Items as ItemsValue } from "./outline";

/** The caret inside a row's text, recorded so focus and undo can put it back. */
export const Focus = S.Struct({ id: S.String, start: S.Number, end: S.Number });
export type Focus = typeof Focus.Type;

/** A row selection runs between two visible rows, in either direction. */
export const RowSelection = S.Struct({ anchorId: S.String, headId: S.String });
export type RowSelection = typeof RowSelection.Type;

export const Placement = S.Union([
  S.TaggedStruct("Start", { parentId: S.NullOr(S.String) }),
  S.TaggedStruct("End", { parentId: S.NullOr(S.String) }),
  S.TaggedStruct("After", { siblingId: S.String }),
  S.TaggedStruct("Before", { siblingId: S.String }),
]);

export const DropTarget = S.Struct({
  placement: Placement,
  depth: S.Number,
  afterRowId: S.NullOr(S.String),
});

export const Drag = S.Struct({ ids: S.Array(S.String), target: S.NullOr(DropTarget) });
export type Drag = typeof Drag.Type;

export const Snapshot = S.Struct({ items: Items, focus: S.NullOr(Focus) });
export type Snapshot = typeof Snapshot.Type;

/** The text the pointer rests on, or the caret that asked for information. */
export const HoverTarget = S.Struct({ id: S.String, offset: S.Number, source: HoverSource });
export type HoverTarget = typeof HoverTarget.Type;

/** Suggestions offered for a range of one item's text. */
export const OpenCompletion = S.Struct({ id: S.String, ...Completion.List.fields });
export type OpenCompletion = typeof OpenCompletion.Type;

export const Mode = S.Literals(["Text", "Rows"]);
export type Mode = typeof Mode.Type;

export const Model = S.Struct({
  id: S.String,
  items: Items,
  /** The hoisted item whose children fill the outline, or `null` for the whole document. */
  scopeId: S.NullOr(S.String),
  mode: Mode,
  focus: S.NullOr(Focus),
  selection: S.NullOr(RowSelection),
  drag: S.NullOr(Drag),
  hover: S.NullOr(HoverTarget),
  completion: S.NullOr(OpenCompletion),
  history: History.Schema(Snapshot),
  /** When the last keystroke changed text, for grouping typing into undo steps. */
  typedAt: S.Number,
  nextId: S.Number,
  /** Increments on every document change, for hosts that persist the outline. */
  revision: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  /** Prefixes element ids and generated item ids. Must be unique on the page. */
  id: string;
  items?: ItemsValue;
  scopeId?: string | null;
}>;

export const counterFor = (id: string, items: ItemsValue): number => {
  const prefix = `${id}-`;
  return (
    walk(items).reduce((highest, node) => {
      const suffix = node.id.startsWith(prefix) ? Number(node.id.slice(prefix.length)) : NaN;
      return Number.isSafeInteger(suffix) ? Math.max(highest, suffix) : highest;
    }, 0) + 1
  );
};

export const init = (config: InitConfig): Model => {
  const items = config.items ?? [];
  const scopeId =
    config.scopeId !== undefined && config.scopeId !== null && find(items, config.scopeId)
      ? config.scopeId
      : null;
  return {
    id: config.id,
    items,
    scopeId,
    mode: "Text",
    focus: null,
    selection: null,
    drag: null,
    hover: null,
    completion: null,
    history: History.init<Snapshot>(),
    typedAt: 0,
    nextId: counterFor(config.id, items),
    revision: 0,
    announcement: "",
  };
};

/** Element ids, shared by the view and the browser commands. */
export const domIds = (modelId: string) => ({
  tree: `${modelId}-tree`,
  row: (id: string) => `${modelId}-row-${id}`,
  text: (id: string) => `${modelId}-text-${id}`,
  hover: `${modelId}-hover`,
  completion: `${modelId}-completion`,
  add: `${modelId}-add`,
});
