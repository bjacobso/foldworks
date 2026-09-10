import { Effect, Match as M, Option, Schema as S } from "effect";
import { Command, type Update } from "foldkit";

import { Message, OutMessage } from "./message";
import { ResizeState, type Model, type Sorting } from "./model";
import { cellId, sameCell, type CellIssue, type Draft } from "./editing-model";

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

const Focus = Command.define("FocusDataGridEdit", {
  args: { id: S.String },
  messages: [Message.CompletedEditFocus],
  execute: ({ id }) => Effect.promise(() => new Promise<ReturnType<typeof Message.CompletedEditFocus>>((resolve) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.focus({ preventScroll: true });
      resolve(Message.CompletedEditFocus());
    });
  })),
});

const submit = (model: Model, allIssues: ReadonlyArray<CellIssue>, requested?: ReadonlyArray<Draft>): UpdateReturn => {
  if (model.editingMode === "Disabled" || Option.isSome(model.pendingSubmission) || Option.isSome(model.activeEdit) || !model.drafts.length) return { model };
  const drafts = requested ?? (model.editingMode === "Immediate" ? model.drafts.slice(0, 1) : model.drafts);
  if (!drafts.length) return { model };
  const issues = allIssues.filter((issue) => drafts.some((draft) => sameCell(draft, issue)));
  if (issues.length) return { model: {
    ...model,
    drafts: model.drafts.map((draft) => ({ ...draft, error: issues.find((issue) => sameCell(issue, draft))?.error ?? "" })),
    saveError: "Resolve the highlighted edits before saving.",
  } };
  const submission = {
    batchId: `${model.id}:${model.nextSubmissionId}`,
    edits: drafts.map(({ error: _error, ...edit }) => edit),
  };
  return {
    model: { ...model, pendingSubmission: Option.some(submission), nextSubmissionId: model.nextSubmissionId + 1, saveError: "", drafts: model.drafts.map((draft) => ({ ...draft, error: "" })) },
    outMessage: OutMessage.SubmittedEdits(submission),
  };
};

const nextSorting = (
  sorting: Option.Option<Sorting>,
  columnId: string,
): Option.Option<Sorting> =>
  Option.match(sorting, {
    onNone: () => Option.some({ columnId, direction: "Ascending" as const }),
    onSome: (current) => {
      if (current.columnId !== columnId) {
        return Option.some({ columnId, direction: "Ascending" as const });
      }
      return current.direction === "Ascending"
        ? Option.some({ columnId, direction: "Descending" as const })
        : Option.none();
    },
  });

const writeColumnWidth = (model: Model, columnId: string, width: number): Model => ({
  ...model,
  columnSizes: model.columnSizes.some((size) => size.columnId === columnId)
    ? model.columnSizes.map((size) =>
        size.columnId === columnId ? { ...size, width } : size,
      )
    : [...model.columnSizes, { columnId, width }],
});

const mergeDrafts = (current: ReadonlyArray<Draft>, incoming: ReadonlyArray<Draft>): ReadonlyArray<Draft> =>
  incoming.reduce<ReadonlyArray<Draft>>((drafts, draft) => {
    const remaining = drafts.filter((item) => !sameCell(item, draft));
    return Object.is(draft.previousValue, draft.value) ? remaining : [...remaining, draft];
  }, current);

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    CompletedEditFocus: () => ({ model }),
    StartedEditing: (edit) => {
      if (model.editingMode === "Disabled" || Option.isSome(model.pendingSubmission) || Option.isSome(model.activeEdit)) return { model };
      const draft = model.drafts.find((draft) => sameCell(draft, edit));
      return {
        model: {
          ...model,
          selectedCell: Option.some({ rowId: edit.rowId, columnId: edit.columnId }),
          selectionAnchor: Option.some({ rowId: edit.rowId, columnId: edit.columnId }),
          activeEdit: Option.some({ ...edit, previousValue: draft === undefined ? edit.previousValue : draft.previousValue }),
          saveError: "",
        },
        commands: [Focus({ id: `${cellId(model.id, edit.rowId, edit.columnId)}:editor` })],
      };
    },
    ChangedEdit: ({ input, value, error }) => ({ model: {
      ...model,
      activeEdit: Option.map(model.activeEdit, (edit) => ({ ...edit, input, value, error })),
    } }),
    CancelledEdit: () => {
      const edit = Option.getOrUndefined(model.activeEdit);
      return edit === undefined ? { model } : {
        model: { ...model, activeEdit: Option.none() },
        commands: [Focus({ id: cellId(model.id, edit.rowId, edit.columnId) })],
      };
    },
    CommittedEdit: ({ issues, validatedInput, validationError }) => {
      const edit = Option.getOrUndefined(model.activeEdit);
      if (edit === undefined || Option.isSome(model.pendingSubmission)) return { model };
      const error = edit.error || (validatedInput === edit.input ? validationError : "") || issues.find((issue) => sameCell(issue, edit))?.error;
      if (error) return { model: { ...model, activeEdit: Option.some({ ...edit, error }) } };
      const remaining = model.drafts.filter((draft) => !sameCell(draft, edit));
      const draft = { rowId: edit.rowId, columnId: edit.columnId, previousValue: edit.previousValue, value: edit.value, error: "" };
      const next = { ...model, activeEdit: Option.none(), saveError: "", drafts: Object.is(edit.previousValue, edit.value) ? remaining : [...remaining, draft] };
      const result = model.editingMode === "Immediate" ? submit(next, issues, next.drafts.filter((draft) => sameCell(draft, edit))) : { model: next };
      return { ...result, commands: [Focus({ id: cellId(model.id, edit.rowId, edit.columnId) })] };
    },
    RequestedSave: ({ issues }) => submit(model, issues),
    DiscardedEdits: () => Option.isSome(model.pendingSubmission) ? { model } : { model: { ...model, drafts: [], activeEdit: Option.none(), saveError: "" } },
    FailedSave: ({ batchId, error }) => Option.getOrUndefined(model.pendingSubmission)?.batchId !== batchId ? { model } : {
      model: { ...model, pendingSubmission: Option.none(), saveError: error || "The changes could not be saved. Try again." },
    },
    CompletedSave: ({ batchId, accepted, rejected }) => {
      const pending = Option.getOrUndefined(model.pendingSubmission);
      if (pending?.batchId !== batchId) return { model };
      const drafts = model.drafts.flatMap((draft) => {
        if (!pending.edits.some((edit) => sameCell(edit, draft))) return [draft];
        const rejection = rejected.find((issue) => sameCell(issue, draft));
        if (rejection) return [{ ...draft, error: rejection.error || "This edit was rejected." }];
        return accepted.some((cell) => sameCell(cell, draft)) ? [] : [{ ...draft, error: "No save result was returned for this edit. Try again." }];
      });
      return { model: { ...model, drafts, pendingSubmission: Option.none(), saveError: drafts.length ? "Some changes were not saved. Review or retry them." : "" } };
    },
    SelectedCell: ({ rowId, columnId }) => Option.isSome(model.activeEdit) && !sameCell(model.activeEdit.value, { rowId, columnId })
      ? { model }
      : {
          model: {
            ...model,
            selectedCell: Option.some({ rowId, columnId }),
            selectionAnchor: Option.some({ rowId, columnId }),
          },
        },
    ExtendedSelection: ({ rowId, columnId, anchorRowId, anchorColumnId }) => Option.isSome(model.activeEdit)
      ? { model }
      : {
          model: {
            ...model,
            selectedCell: Option.some({ rowId, columnId }),
            selectionAnchor: Option.orElse(model.selectionAnchor, () =>
              Option.orElse(model.selectedCell, () => Option.some({
                rowId: anchorRowId,
                columnId: anchorColumnId,
              }))),
          },
        },
    PastedCells: ({ drafts: pasted, anchor, focus }) => {
      if (
        model.editingMode === "Disabled" ||
        Option.isSome(model.activeEdit) ||
        Option.isSome(model.pendingSubmission)
      ) return { model };
      const drafts = mergeDrafts(model.drafts, pasted);
      const next = {
        ...model,
        drafts,
        selectedCell: Option.some(focus),
        selectionAnchor: Option.some(anchor),
        saveError: "",
      };
      const commands = [Focus({ id: cellId(model.id, focus.rowId, focus.columnId) })];
      if (model.editingMode === "Batch") return { model: next, commands };
      const requested = drafts.filter((draft) => pasted.some((item) => sameCell(item, draft)));
      const issues = requested.flatMap((draft) => draft.error
        ? [{ rowId: draft.rowId, columnId: draft.columnId, error: draft.error }]
        : []);
      return { ...submit(next, issues, requested), commands };
    },
    MeasuredViewport: ({ scrollTop, height }) => {
      const viewport = {
        scrollTop: Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0,
        height: Number.isFinite(height) ? Math.max(0, height) : 0,
      };
      return model.viewport.scrollTop === viewport.scrollTop &&
          model.viewport.height === viewport.height
        ? { model }
        : { model: { ...model, viewport } };
    },
    ToggledSort: ({ columnId }) => ({
      model: { ...model, sorting: nextSorting(model.sorting, columnId) },
    }),
    StartedColumnResize: ({
      columnId,
      screenX,
      width,
      minimumWidth,
      maximumWidth,
    }) => ({
      model: {
        ...model,
        resizeState: ResizeState.Resizing({
          columnId,
          originX: screenX,
          originWidth: width,
          minimumWidth,
          maximumWidth,
        }),
      },
    }),
    MovedColumnResize: ({ screenX }) =>
      M.value(model.resizeState).pipe(
        M.withReturnType<UpdateReturn>(),
        M.tag("Resizing", (resize) => ({
          model: writeColumnWidth(
            model,
            resize.columnId,
            Math.min(
              resize.maximumWidth,
              Math.max(
                resize.minimumWidth,
                resize.originWidth + screenX - resize.originX,
              ),
            ),
          ),
        })),
        M.orElse(() => ({ model })),
      ),
    FinishedColumnResize: () => ({
      model: { ...model, resizeState: ResizeState.Idle() },
    }),
    ResetColumnSize: ({ columnId, width }) => ({
      model: writeColumnWidth(model, columnId, width),
    }),
  });
