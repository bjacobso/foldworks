import { Option } from "effect";
import { createTable, type CellEditor, type CellValue, type CreateTableConfig } from "./core";
import { sameCell, type CellIssue, type Draft } from "./editing-model";
import { Message } from "./message";

export const parseClipboardText = (text: string): ReadonlyArray<ReadonlyArray<string>> => {
  const rows: Array<Array<string>> = [];
  let row: Array<string> = [];
  let field = "";
  let quoted = false;
  let endedWithRowSeparator = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (quoted) {
        quoted = false;
      } else if (field === "") {
        quoted = true;
      } else {
        field += character;
      }
      endedWithRowSeparator = false;
    } else if (character === "\t" && !quoted) {
      row.push(field);
      field = "";
      endedWithRowSeparator = false;
    } else if ((character === "\n" || character === "\r") && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      endedWithRowSeparator = true;
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
      endedWithRowSeparator = false;
    }
  }

  if (!endedWithRowSeparator || row.length > 0 || field !== "") {
    row.push(field);
    rows.push(row);
  }
  return rows.length === 0 ? [[""]] : rows;
};

const parsePastedInput = <Row>(editor: CellEditor<Row>, input: string, row: Row) => {
  if (editor.kind === "Checkbox") {
    const normalized = input.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return parseInput(editor, "true", row);
    if (["false", "no", "0"].includes(normalized)) return parseInput(editor, "false", row);
    return { input, value: null, error: "Enter true or false." } as const;
  }
  if (editor.kind === "Select") {
    const option = editor.options?.find((option) =>
      option.value === input || option.label === input);
    return parseInput(editor, option?.value ?? input, row);
  }
  return parseInput(editor, input, row);
};

/** Maps a tab-separated clipboard matrix from the focused cell into editable
 * cells. Read-only cells are skipped and input outside the grid is clipped. */
export const pasteMessage = <Row, ParentMessage>(
  config: CreateTableConfig<Row, ParentMessage>,
  text: string,
): Option.Option<Message> => {
  if (
    config.model.editingMode === "Disabled" ||
    Option.isSome(config.model.activeEdit) ||
    Option.isSome(config.model.pendingSubmission)
  ) return Option.none();
  const selected = Option.getOrUndefined(config.model.selectedCell);
  if (selected === undefined) return Option.none();
  const table = createTable(config);
  const startRowIndex = table.rows.findIndex((row) => row.id === selected.rowId);
  const startColumnIndex = table.columns.findIndex((column) =>
    column.definition.id === selected.columnId);
  if (startRowIndex < 0 || startColumnIndex < 0) return Option.none();

  const values = parseClipboardText(text);
  const rowCount = Math.min(values.length, table.rows.length - startRowIndex);
  const columnCount = Math.min(
    values.reduce((maximum, row) => Math.max(maximum, row.length), 0),
    table.columns.length - startColumnIndex,
  );
  const drafts: Array<Draft> = [];
  for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
    const row = table.rows[startRowIndex + rowOffset];
    if (row === undefined) continue;
    const inputRow = values[rowOffset] ?? [];
    for (let columnOffset = 0; columnOffset < inputRow.length && columnOffset < columnCount; columnOffset += 1) {
      const cell = row.cells[startColumnIndex + columnOffset];
      if (cell?.column.editor === undefined) continue;
      const address = { rowId: row.id, columnId: cell.column.id };
      const existing = config.model.drafts.find((draft) => sameCell(draft, address));
      const parsed = parsePastedInput(cell.column.editor, inputRow[columnOffset] ?? "", row.original);
      drafts.push({
        ...address,
        previousValue: existing?.previousValue ?? cell.column.accessor(row.original),
        value: parsed.value,
        error: parsed.error,
      });
    }
  }
  const focusRow = table.rows[startRowIndex + Math.max(0, rowCount - 1)];
  const focusColumn = table.columns[startColumnIndex + Math.max(0, columnCount - 1)];
  return drafts.length === 0 || focusRow === undefined || focusColumn === undefined
    ? Option.none()
    : Option.some(Message.PastedCells({
        drafts,
        anchor: selected,
        focus: { rowId: focusRow.id, columnId: focusColumn.definition.id },
      }));
};

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
