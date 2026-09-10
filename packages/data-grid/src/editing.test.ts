import { Option, Schema as S } from "effect";
import { describe, expect, it } from "vitest";
import { createTable, defineColumns } from "./core";
import {
  commitMessage,
  editIssues,
  parseClipboardText,
  parseInput,
  pasteMessage,
  saveMessage,
} from "./editing";
import { Message } from "./message";
import { init, Model } from "./model";
import { update } from "./update";

const rows = [{ id: "a", name: "Alice", score: 10 }, { id: "b", name: "Bob", score: 20 }];
const columns = defineColumns<typeof rows[number]>()([
  { id: "name", header: "Name", accessor: (row) => row.name, editor: { kind: "Text" } },
  { id: "score", header: "Score", accessor: (row) => row.score, editor: { kind: "Number", validate: (value) => Number(value) < 0 ? "Must be positive" : undefined } },
]);
const model = (mode: "Batch" | "Immediate" = "Batch") => init({ id: "test", columns, editing: { mode } });
const config = (model: Model, source = rows) => ({ model, rows: source, columns, getRowId: (row: typeof rows[number]) => row.id });
const start = (model: Model, rowId = "a", value = "Amy") => update(model, Message.StartedEditing({ rowId, columnId: "name", previousValue: rows.find((row) => row.id === rowId)!.name, input: value, value, error: "" })).model;
const commit = (model: Model) => update(model, commitMessage(config(model)));
const stage = (model: Model, rowId = "a", value = "Amy") => commit(start(model, rowId, value)).model;
const save = (model: Model) => update(model, saveMessage(config(model)));

describe("data grid editing", () => {
  it("parses quoted TSV fields, CRLF rows, and trailing row separators", () => {
    expect(parseClipboardText('"A\tvalue"\t"a ""quote"""\r\nnext\t2\r\n')).toEqual([
      ["A\tvalue", 'a "quote"'],
      ["next", "2"],
    ]);
    expect(parseClipboardText("\t")).toEqual([["", ""]]);
  });

  it("stages a pasted matrix, validates cells, and selects its bounds", () => {
    const selected = update(
      model(),
      Message.SelectedCell({ rowId: "a", columnId: "name" }),
    ).model;
    const message = Option.getOrThrow(
      pasteMessage(config(selected), "Ann\t31\nBill\tnot-a-number"),
    );
    const result = update(selected, message);
    const pasted = result.model;

    expect(pasted.drafts.map(({ rowId, columnId, value, error }) => ({
      rowId,
      columnId,
      value,
      error,
    }))).toEqual([
      { rowId: "a", columnId: "name", value: "Ann", error: "" },
      { rowId: "a", columnId: "score", value: 31, error: "" },
      { rowId: "b", columnId: "name", value: "Bill", error: "" },
      { rowId: "b", columnId: "score", value: null, error: "Enter a finite number." },
    ]);
    expect(Option.getOrUndefined(pasted.selectionAnchor)).toEqual({
      rowId: "a",
      columnId: "name",
    });
    expect(Option.getOrUndefined(pasted.selectedCell)).toEqual({
      rowId: "b",
      columnId: "score",
    });
    expect(result.commands).toHaveLength(1);
  });

  it("submits a valid pasted matrix together in immediate mode", () => {
    const selected = update(
      model("Immediate"),
      Message.SelectedCell({ rowId: "a", columnId: "name" }),
    ).model;
    const pasted = update(
      selected,
      Option.getOrThrow(pasteMessage(config(selected), "Ann\t31\nBill\t21")),
    );

    expect(pasted.outMessage?.edits).toHaveLength(4);
    expect(Option.isSome(pasted.model.pendingSubmission)).toBe(true);
  });

  it("preserves original values across paste replacements and removes reversions", () => {
    const drafted = stage(model(), "a", "Amy");
    const selected = update(
      drafted,
      Message.SelectedCell({ rowId: "a", columnId: "name" }),
    ).model;
    const replaced = update(
      selected,
      Option.getOrThrow(pasteMessage(config(selected), "Ann")),
    ).model;
    const reverted = update(
      replaced,
      Option.getOrThrow(pasteMessage(config(replaced), "Alice")),
    ).model;

    expect(replaced.drafts[0]?.previousValue).toBe("Alice");
    expect(replaced.drafts[0]?.value).toBe("Ann");
    expect(reverted.drafts).toEqual([]);
  });

  it("maps select labels and common checkbox values while pasting", () => {
    const typedRows = [{ id: "a", status: "Active", enabled: false }];
    const typedColumns = defineColumns<typeof typedRows[number]>()([
      {
        id: "status",
        header: "Status",
        accessor: (row) => row.status,
        editor: {
          kind: "Select",
          options: [{ value: "leave", label: "On leave" }],
        },
      },
      {
        id: "enabled",
        header: "Enabled",
        accessor: (row) => row.enabled,
        editor: { kind: "Checkbox" },
      },
    ]);
    const selected = update(
      init({ id: "typed", columns: typedColumns, editing: { mode: "Batch" } }),
      Message.SelectedCell({ rowId: "a", columnId: "status" }),
    ).model;
    const typedConfig = {
      model: selected,
      rows: typedRows,
      columns: typedColumns,
      getRowId: (row: typeof typedRows[number]) => row.id,
    };
    const pasted = update(
      selected,
      Option.getOrThrow(pasteMessage(typedConfig, "On leave\tyes")),
    ).model;

    expect(pasted.drafts.map((draft) => draft.value)).toEqual(["leave", true]);
  });

  it("skips read-only columns and clips pasted input to the grid bounds", () => {
    const mixedColumns = defineColumns<typeof rows[number]>()([
      { id: "name", header: "Name", accessor: (row) => row.name, editor: { kind: "Text" } },
      { id: "score", header: "Score", accessor: (row) => row.score },
    ]);
    const selected = update(
      init({ id: "mixed", columns: mixedColumns, editing: { mode: "Batch" } }),
      Message.SelectedCell({ rowId: "a", columnId: "name" }),
    ).model;
    const mixedConfig = {
      model: selected,
      rows,
      columns: mixedColumns,
      getRowId: (row: typeof rows[number]) => row.id,
    };
    const pasted = update(
      selected,
      Option.getOrThrow(pasteMessage(mixedConfig, "Ann\t99\nBill\t21\nIgnored\t0")),
    ).model;

    expect(pasted.drafts.map(({ rowId, columnId, value }) => ({
      rowId,
      columnId,
      value,
    }))).toEqual([
      { rowId: "a", columnId: "name", value: "Ann" },
      { rowId: "b", columnId: "name", value: "Bill" },
    ]);
    expect(Option.getOrUndefined(pasted.selectedCell)).toEqual({
      rowId: "b",
      columnId: "score",
    });
  });

  it("stages edits without touching source rows and collapses repeated changes", () => {
    const first = commit(start(model()));
    expect(first.outMessage).toBeUndefined();
    const second = stage(first.model, "a", "Ann");
    expect(second.drafts).toEqual([{ rowId: "a", columnId: "name", previousValue: "Alice", value: "Ann", error: "" }]);
    expect(rows[0]!.name).toBe("Alice");
    expect(stage(second, "a", "Alice").drafts).toEqual([]);
  });

  it("emits all batch edits once and locks edits/discard/duplicate submissions until completion", () => {
    const result = save(stage(stage(model()), "b", "Bill"));
    expect(result.outMessage?._tag).toBe("SubmittedEdits");
    expect(result.outMessage?.edits).toHaveLength(2);
    expect(result.outMessage?.edits[0]).not.toHaveProperty("error");
    expect(save(result.model).outMessage).toBeUndefined();
    expect(start(result.model)).toBe(result.model);
    expect(update(result.model, Message.DiscardedEdits()).model).toBe(result.model);
    expect(S.decodeUnknownSync(Model)(result.model)).toEqual(result.model);
  });

  it("immediate mode submits one cell, even when another edit previously failed", () => {
    const first = commit(start(model("Immediate")));
    expect(first.outMessage?.edits).toHaveLength(1);
    const failed = update(first.model, Message.FailedSave({ batchId: first.outMessage!.batchId, error: "Offline" })).model;
    const second = commit(start(failed, "b", "Bill"));
    expect(second.outMessage?.edits.map((edit) => edit.rowId)).toEqual(["b"]);
    const done = update(second.model, Message.CompletedSave({ batchId: second.outMessage!.batchId, accepted: [{ rowId: "b", columnId: "name" }], rejected: [] })).model;
    expect(done.drafts.map((edit) => edit.rowId)).toEqual(["a"]);
  });

  it("keeps failed edits for retry and ignores stale responses", () => {
    const first = save(stage(model()));
    const failed = update(first.model, Message.FailedSave({ batchId: first.outMessage!.batchId, error: "Offline" })).model;
    expect(failed.drafts).toHaveLength(1);
    expect(failed.saveError).toBe("Offline");
    const retry = save(failed);
    expect(retry.outMessage!.batchId).not.toBe(first.outMessage!.batchId);
    expect(update(retry.model, Message.CompletedSave({ batchId: first.outMessage!.batchId, accepted: first.outMessage!.edits, rejected: [] })).model).toBe(retry.model);
    const done = update(retry.model, Message.CompletedSave({ batchId: retry.outMessage!.batchId, accepted: retry.outMessage!.edits, rejected: [] })).model;
    expect(done.drafts).toEqual([]);
    expect(Option.isNone(done.pendingSubmission)).toBe(true);
  });

  it("retains rejected or missing results, and allows retrying server errors", () => {
    const result = save(stage(stage(model()), "b", "Bill"));
    const partial = update(result.model, Message.CompletedSave({ batchId: result.outMessage!.batchId, accepted: [{ rowId: "a", columnId: "name" }], rejected: [{ rowId: "b", columnId: "name", error: "Permission denied" }] })).model;
    expect(partial.drafts).toHaveLength(1);
    expect(partial.drafts[0]!.error).toBe("Permission denied");
    const retry = save(partial);
    expect(retry.outMessage?.edits).toHaveLength(1);
    const missing = update(retry.model, Message.CompletedSave({ batchId: retry.outMessage!.batchId, accepted: [], rejected: [] })).model;
    expect(missing.drafts[0]!.error).toContain("No save result");
  });

  it("checks source values and missing records before saving; unrelated source changes are allowed", () => {
    const draft = stage(model());
    expect(editIssues(config(draft, [{ ...rows[0]!, score: 99 }, rows[1]!]))).toEqual([]);
    const changed = config(draft, [{ ...rows[0]!, name: "Changed elsewhere" }, rows[1]!]);
    expect(editIssues(changed)[0]!.error).toContain("saved value changed");
    expect(update(draft, saveMessage(changed)).outMessage).toBeUndefined();
    expect(editIssues(config(draft, []))[0]!.error).toContain("no longer available");
    expect(update(draft, Message.DiscardedEdits()).model.drafts).toEqual([]);
  });

  it("blocks invalid editor input, supports correction, and cancels without losing an earlier draft", () => {
    let active = start(stage(model()), "a", "Invalid");
    active = update(active, Message.ChangedEdit({ input: "", value: "", error: "Required" })).model;
    expect(commit(active).model.activeEdit).toEqual(active.activeEdit);
    const cancelled = update(active, Message.CancelledEdit()).model;
    expect(cancelled.drafts[0]!.value).toBe("Amy");
    expect(Option.isNone(cancelled.activeEdit)).toBe(true);
    expect(update(active, Message.SelectedCell({ rowId: "b", columnId: "name" })).model.selectedCell).toEqual(active.selectedCell);
    active = update(active, Message.ChangedEdit({ input: "Valid", value: "Valid", error: "" })).model;
    expect(commit(active).model.drafts[0]!.value).toBe("Valid");
  });

  it("parses numeric, select, and checkbox editors with validation", () => {
    expect(parseInput({ kind: "Number" }, "", {}).error).toContain("finite number");
    expect(parseInput({ kind: "Number" }, "Infinity", {}).value).toBeNull();
    expect(parseInput({ kind: "Number" }, "42", {}).value).toBe(42);
    expect(parseInput({ kind: "Select", options: [{ value: "a", label: "A" }] }, "b", {}).error).toContain("available option");
    expect(parseInput({ kind: "Checkbox" }, "false", {}).value).toBe(false);
    expect(parseInput({ kind: "Number", validate: () => "Too large" }, "42", {}).error).toBe("Too large");
  });

  it("commits corrected input even when Enter was captured by the prior render", () => {
    const invalid = update(start(model()), Message.ChangedEdit({ input: "", value: "", error: "Required" })).model;
    const enter = commitMessage(config(invalid));
    const corrected = update(invalid, Message.ChangedEdit({ input: "Amy", value: "Amy", error: "" })).model;
    expect(update(corrected, enter).model.drafts[0]!.value).toBe("Amy");
  });

  it("renders draft values but sorts on source values", () => {
    const drafted = stage(model(), "a", "Zelda");
    const sorted = update(drafted, Message.ToggledSort({ columnId: "name" })).model;
    const table = createTable(config(sorted));
    expect(table.rows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(table.rows[0]!.cells[0]!.value).toBe("Zelda");
    expect(table.rows[0]!.original.name).toBe("Alice");
  });

  it("preserves null originals when re-editing and keeps editing opt-in", () => {
    const initial = { ...model(), drafts: [{ rowId: "a", columnId: "name", previousValue: null, value: "Draft", error: "" }] };
    expect(Option.getOrThrow(start(initial).activeEdit).previousValue).toBeNull();
    const disabled = init({ id: "read-only", columns });
    expect(start(disabled)).toBe(disabled);
  });
});
