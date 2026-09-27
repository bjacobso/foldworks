import { Effect, Option } from "effect";
import { Command, Update } from "foldkit";
import { evo } from "foldkit/struct";

import { DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";
import { Person } from "./rows";
import { Schema as S } from "effect";

// This demo owns its rows. A real host would call its persistence service here.
const Save = Command.define("SaveDemoGridEdits", {
  args: DataGrid.Submission.fields,
  messages: [Message.CompletedSave],
  execute: (submission) =>
    Effect.sleep("400 millis").pipe(Effect.as(Message.CompletedSave(submission))),
});

const foldGrid = Update.foldChild({
  update: DataGrid.update,
  read: (model: Model) => Option.some(model.grid),
  write: (model, grid) => evo(model, { grid: () => grid }),
  toParentMessage: (message) => Message.GotGridMessage({ message }),
  foldOutMessage: (submission: DataGrid.OutMessage) => (model: Model) => ({
    model,
    commands: [Save({ batchId: submission.batchId, edits: submission.edits })],
  }),
});

const foldCoverageGrid = Update.foldChild({
  update: DataGrid.update,
  read: (model: Model) => Option.some(model.coverage.grid),
  write: (model, grid) => evo(model, { coverage: (coverage) => ({ ...coverage, grid }) }),
  toParentMessage: (message) => Message.GotCoverageGridMessage({ message }),
  // The coverage matrix is read-only, so it never submits edits.
  foldOutMessage: () => (model: Model) => ({ model }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    GotGridMessage: ({ message: gridMessage }) => foldGrid(model, gridMessage),
    GotCoverageGridMessage: ({ message: gridMessage }) => foldCoverageGrid(model, gridMessage),
    ChangedCoverageSearch: ({ search }) => ({
      model: evo(model, { coverage: (coverage) => ({ ...coverage, search }) }),
    }),
    ToggledCoverageGaps: ({ gapsOnly }) => ({
      model: evo(model, { coverage: (coverage) => ({ ...coverage, gapsOnly }) }),
    }),
    ChangedEditingMode: ({ mode }) =>
      model.grid.drafts.length ||
      Option.isSome(model.grid.activeEdit) ||
      Option.isSome(model.grid.pendingSubmission)
        ? { model }
        : { model: { ...model, grid: { ...model.grid, editingMode: mode } } },
    CompletedSave: ({ batchId, edits }) => {
      if (Option.getOrUndefined(model.grid.pendingSubmission)?.batchId !== batchId)
        return { model };
      const rows = model.rows.map((row) =>
        S.decodeUnknownSync(Person)(
          edits
            .filter((edit) => edit.rowId === row.id)
            .reduce((row, edit) => ({ ...row, [edit.columnId]: edit.value }), row),
        ),
      );
      return foldGrid(
        { ...model, rows },
        DataGrid.Message.CompletedSave({ batchId, accepted: edits, rejected: [] }),
      );
    },
  });
