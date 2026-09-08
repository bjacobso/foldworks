import { Effect, Option } from "effect";
import { Command, Update } from "foldkit";
import { DataGrid } from "@foldworks/data-grid";

import { commitProposal, Proposal } from "./domain";
import { Message } from "./message";
import type { Model } from "./model";

const FocusInspector = Command.define("FocusWorkerInspector", {
  args: {},
  messages: [Message.CompletedFocus],
  execute: () => Effect.promise(() => new Promise<ReturnType<typeof Message.CompletedFocus>>((resolve) => {
    requestAnimationFrame(() => {
      document.getElementById("worker-inspector-heading")?.focus({ preventScroll: true });
      resolve(Message.CompletedFocus());
    });
  })),
});

const Commit = Command.define("CommitWorkerProposal", {
  args: { proposal: Proposal },
  messages: [Message.CompletedApply],
  execute: ({ proposal }) => Effect.promise(async () => {
    try {
      return Message.CompletedApply({ snapshot: Option.some(await commitProposal(proposal)), error: "" });
    } catch (error) {
      return Message.CompletedApply({ snapshot: Option.none(), error: error instanceof Error ? error.message : "The change could not be saved. Try again." });
    }
  }),
});

const foldGrid = Update.foldChild({
  update: DataGrid.update,
  read: (model: Model) => Option.some(model.grid),
  write: (model, grid) => ({ ...model, grid }),
  toParentMessage: (message) => Message.GotGridMessage({ message }),
  // This grid is read-only; workbench proposals use their own application commands.
  foldOutMessage: (_message: DataGrid.OutMessage) => (model: Model) => ({ model }),
});

export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  const worker = model.snapshot.workers.find((item) => item.id === model.selectedId);
  const proposal = Option.getOrUndefined(model.proposal);
  const result = Message.match<Update.Return<Model, Message>>(message, {
    CompletedFocus: () => ({ model }),
    GotGridMessage: ({ message }) => foldGrid(model, message),
    SelectedWorker: ({ id, panel }) => model.applying || proposal !== undefined || !model.snapshot.workers.some((item) => item.id === id)
      ? { model }
      : { model: { ...model, selectedId: id, panel, error: "" } },
    OpenedPanel: ({ panel }) => model.applying || proposal !== undefined || !worker || panel === "Preview"
      ? { model }
      : { model: { ...model, panel, error: "" } },
    ChangedState: ({ value }) => {
      if (model.applying || model.panel !== "Edit" || model.storageError || !worker || (value !== "NY" && value !== "CA" && value !== "TX")) return { model };
      return { model: { ...model, error: "", proposal: value === worker.state ? Option.none() : Option.some({
        workerId: worker.id, basis: model.snapshot.revision, before: worker.state, after: value,
      }) } };
    },
    Previewed: () => !proposal || model.panel !== "Edit" || model.applying
      ? { model }
      : { model: { ...model, panel: "Preview", announcement: "Preview ready. No changes have been applied." } },
    Discarded: () => model.applying ? { model } : { model: {
      ...model, proposal: Option.none(), panel: "Overview", error: "", announcement: "Proposed change discarded. Saved values are unchanged.",
    } },
    Applied: () => !proposal || model.applying || model.storageError || model.panel !== "Preview"
      ? { model }
      : { model: { ...model, applying: true, error: "", announcement: "Applying change…" }, commands: [Commit({ proposal })] },
    CompletedApply: ({ snapshot, error }) => !model.applying ? { model } : Option.match(snapshot, {
      onNone: () => ({ model: { ...model, applying: false, error, announcement: error } }),
      onSome: (snapshot) => ({ model: {
        ...model, snapshot, applying: false, proposal: Option.none(), panel: "History", error: "",
        announcement: "Change applied and saved locally. Worker state, open tasks, and history are updated.",
      } }),
    }),
  });
  return result.model.panel !== model.panel || result.model.selectedId !== model.selectedId
    ? { ...result, commands: [...(result.commands ?? []), FocusInspector({})] }
    : result;
};
