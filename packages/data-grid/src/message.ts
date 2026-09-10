import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { ActiveEdit, CellIssue, Draft, EditValue, Submission } from "./editing-model";
import { CellAddress } from "./model";

export const Message = defineMessageUnion({
  StartedEditing: ActiveEdit.fields,
  ChangedEdit: { input: S.String, value: EditValue, error: S.String },
  CommittedEdit: { issues: S.Array(CellIssue), validatedInput: S.String, validationError: S.String },
  CancelledEdit: {},
  RequestedSave: { issues: S.Array(CellIssue) },
  DiscardedEdits: {},
  CompletedSave: { batchId: S.String, accepted: S.Array(CellAddress), rejected: S.Array(CellIssue) },
  FailedSave: { batchId: S.String, error: S.String },
  CompletedEditFocus: {},
  SelectedCell: { rowId: S.String, columnId: S.String },
  ExtendedSelection: {
    rowId: S.String,
    columnId: S.String,
    anchorRowId: S.String,
    anchorColumnId: S.String,
  },
  PastedCells: {
    drafts: S.Array(Draft),
    anchor: CellAddress,
    focus: CellAddress,
  },
  ToggledSort: { columnId: S.String },
  StartedColumnResize: {
    columnId: S.String,
    screenX: S.Number,
    width: S.Number,
    minimumWidth: S.Number,
    maximumWidth: S.Number,
  },
  MovedColumnResize: { screenX: S.Number },
  FinishedColumnResize: {},
  ResetColumnSize: { columnId: S.String, width: S.Number },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({ SubmittedEdits: Submission.fields });
export type OutMessage = typeof OutMessage.Type;
