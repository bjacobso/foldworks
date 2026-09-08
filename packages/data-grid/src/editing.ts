import { Option } from "effect";
import type { CellEditor, CellValue, CreateTableConfig } from "./core";
import { sameCell, type CellIssue, type Draft } from "./editing-model";
import { Message } from "./message";

export const parseInput = <Row>(editor: CellEditor<Row>, input: string, row: Row) => {
  const value = editor.kind === "Number" ? Number(input)
    : editor.kind === "Checkbox" ? input === "true" : input;
  const error = editor.kind === "Number" && (input.trim() === "" || !Number.isFinite(value))
    ? "Enter a finite number."
    : validateValue(editor, value, row);
  return { input, value: typeof value === "number" && !Number.isFinite(value) ? null : value, error };
};

const validateValue = <Row>(editor: CellEditor<Row>, value: CellValue, row: Row): string => {
  if (editor.kind === "Number" && (typeof value !== "number" || !Number.isFinite(value))) return "Enter a finite number.";
  if (editor.kind === "Checkbox" && typeof value !== "boolean") return "Choose a boolean value.";
  if (editor.kind === "Select" && !editor.options?.some((option) => option.value === value)) return "Choose an available option.";
  return editor.validate?.(value, row) ?? "";
};

/** Checks drafts against the latest complete source rows, without mutating them. */
export const editIssues = <Row, ParentMessage>(
  config: CreateTableConfig<Row, ParentMessage>,
  drafts: ReadonlyArray<Draft> = config.model.drafts,
): ReadonlyArray<CellIssue> => drafts.flatMap((draft) => {
  const row = config.rows.find((row) => config.getRowId(row) === draft.rowId);
  const column = config.columns.find((column) => column.id === draft.columnId);
  const error = sourceIssue(config, draft) || (row !== undefined && column?.editor !== undefined ? validateValue(column.editor, draft.value, row) : "");
  return error ? [{ rowId: draft.rowId, columnId: draft.columnId, error }] : [];
});

const sourceIssue = <Row, ParentMessage>(config: CreateTableConfig<Row, ParentMessage>, draft: Draft): string => {
  const row = config.rows.find((row) => config.getRowId(row) === draft.rowId);
  const column = config.columns.find((column) => column.id === draft.columnId);
  return row === undefined || column === undefined
    ? "This row or column is no longer available. Discard and reload."
    : !Object.is(column.accessor(row), draft.previousValue)
      ? "The saved value changed. Discard your draft before editing again."
      : column.editor === undefined
        ? "This column is no longer editable."
        : "";
};

/** Active input validation travels with ChangedEdit, so a queued Enter cannot
 * reapply a validation error captured by the previous render. */
export const commitMessage = <Row, ParentMessage>(config: CreateTableConfig<Row, ParentMessage>): Message => {
  const active = Option.getOrUndefined(config.model.activeEdit);
  const otherIssues = editIssues(config, config.model.drafts.filter((draft) => active === undefined || !sameCell(draft, active)));
  const error = active === undefined ? "" : sourceIssue(config, active);
  const row = active === undefined ? undefined : config.rows.find((row) => config.getRowId(row) === active.rowId);
  const editor = config.columns.find((column) => column.id === active?.columnId)?.editor;
  return Message.CommittedEdit({
    issues: [...otherIssues, ...(active !== undefined && error ? [{ rowId: active.rowId, columnId: active.columnId, error }] : [])],
    validatedInput: active?.input ?? "",
    validationError: active !== undefined && row !== undefined && editor !== undefined ? parseInput(editor, active.input, row).error : "",
  });
};

/** Use for custom save controls and headless integrations, with current rows/columns. */
export const saveMessage = <Row, ParentMessage>(config: CreateTableConfig<Row, ParentMessage>): Message =>
  Message.RequestedSave({ issues: editIssues(config) });
