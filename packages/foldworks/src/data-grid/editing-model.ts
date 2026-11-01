import { Schema as S } from "effect";

export const EditValue = S.Union([S.String, S.Number, S.Boolean, S.Null, S.Undefined]);
export const Edit = S.Struct({
  rowId: S.String,
  columnId: S.String,
  previousValue: EditValue,
  value: EditValue,
});
export type Edit = typeof Edit.Type;
export const CellIssue = S.Struct({ rowId: S.String, columnId: S.String, error: S.String });
export type CellIssue = typeof CellIssue.Type;
export const Draft = S.Struct({ ...Edit.fields, error: S.String });
export type Draft = typeof Draft.Type;
export const ActiveEdit = S.Struct({ ...Draft.fields, input: S.String });
export type ActiveEdit = typeof ActiveEdit.Type;
export const Submission = S.Struct({ batchId: S.String, edits: S.Array(Edit) });
export type Submission = typeof Submission.Type;

export const sameCell = (
  left: Readonly<{ rowId: string; columnId: string }>,
  right: Readonly<{ rowId: string; columnId: string }>,
): boolean => left.rowId === right.rowId && left.columnId === right.columnId;

export const cellId = (gridId: string, rowId: string, columnId: string): string =>
  `grid:${encodeURIComponent(gridId)}:${encodeURIComponent(rowId)}:${encodeURIComponent(columnId)}`;
