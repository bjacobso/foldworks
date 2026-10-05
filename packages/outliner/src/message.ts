import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Action } from "./keymap";
import { DropTarget, Mode } from "./model";
import { Items } from "./outline";

export const Message = defineMessageUnion({
  /** A resolved key press. `start`/`end` are the caret; `goalX` is its horizontal position. */
  Pressed: { action: Action, id: S.String, start: S.Number, end: S.Number, goalX: S.Number },
  /** `time` is the event timestamp, used to group typing into undo steps. */
  EditedText: { id: S.String, text: S.String, start: S.Number, end: S.Number, time: S.Number },
  FocusedText: { id: S.String, start: S.Number, end: S.Number },
  PastedText: { id: S.String, mode: Mode, start: S.Number, end: S.Number, text: S.String },
  ToggledCollapsed: { id: S.String, recursive: S.Boolean },
  ToggledChecked: { id: S.String },
  ClickedBullet: { id: S.String },
  SelectedRange: { anchorId: S.String, headId: S.String },
  StartedDrag: { ids: S.Array(S.String) },
  MovedDrag: { target: S.NullOr(DropTarget) },
  Dropped: {},
  CancelledDrag: {},
  /** The pointer rested on a character of an item's text, or left the text. */
  Hovered: { target: S.NullOr(S.Struct({ id: S.String, offset: S.Number })) },
  DismissedHover: {},
  Hoisted: { id: S.NullOr(S.String) },
  ClickedAdd: {},
  SetAllCollapsed: { collapsed: S.Boolean },
  ExpandedToLevel: { level: S.Number },
  ClickedUndo: {},
  ClickedRedo: {},
  /** Replaces the document and clears history, for example after loading a file. */
  Load: { items: Items },
  /**
   * Replaces the document as one undoable step, for edits a host makes on the
   * outline's behalf. Focus stays where it is. Replacements that share a
   * `coalescingKey` undo together.
   */
  Replace: { items: Items, announcement: S.String, coalescingKey: S.optional(S.String) },
  /** Expands, unhoists if needed, and puts the caret at the end of an item. */
  Reveal: { id: S.String },
  CompletedFocus: {},
});
export type Message = typeof Message.Type;
