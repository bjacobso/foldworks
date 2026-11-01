import { Effect, Option } from "effect";
import { Command, Update } from "foldkit";
import { PdfViewer } from "foldworks/pdf-viewer";
import * as Graph from "foldworks/diagram/graph";
import { Citation } from "foldworks/ui";
import { graphDocument, sample } from "./fixture";
import { Message } from "./message";
import type { Model } from "./model";

type UpdateReturn = Update.Return<Model, Message>;
const GenerateSample = Command.define("GenerateDocumentAnalysisSample", {
  messages: [Message.GotSample, Message.FailedSample],
  execute: sample.pipe(
    Effect.map(Message.GotSample),
    Effect.catchCause((cause) => Effect.succeed(Message.FailedSample({ reason: String(cause) }))),
  ),
});
const viewer = Update.foldChild({
  update: PdfViewer.update,
  read: (model: Model) => Option.some(model.viewer),
  write: (model, viewer) => ({ ...model, viewer }),
  toParentMessage: (message) => Message.GotViewerMessage({ message }),
});
const graph = Update.foldChild({
  update: (model: Graph.Model, message: Graph.Message) =>
    Graph.update(model, message, graphDocument),
  read: (model: Model) => Option.some(model.graph),
  write: (model, graph) => ({ ...model, graph }),
  toParentMessage: (message) => Message.GotGraphMessage({ message }),
  foldOutMessage:
    (outMessage) =>
    (model): UpdateReturn => ({
      model: {
        ...model,
        announcement:
          outMessage._tag === "ClearedSelection"
            ? "Cleared selection"
            : `${outMessage._tag}: ${outMessage.id}`,
      },
    }),
});
const citation = Update.foldChild({
  update: Citation.update,
  read: (model: Model) => Option.some(model.citation),
  write: (model, citation) => ({ ...model, citation }),
  toParentMessage: (message) => Message.GotCitationMessage({ message }),
  foldOutMessage:
    () =>
    (model): UpdateReturn => ({ model }),
});
export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    Initialize: () =>
      model.viewer.document._tag === "Empty" ? { model, commands: [GenerateSample()] } : { model },
    GotSample: ({ bytesBase64, regions }) => {
      const opened = viewer(
        { ...model, regions },
        PdfViewer.Message.RequestedLoadBytes({ name: "synthetic-agreement.pdf", bytesBase64 }),
      );
      const fitted = graph(opened.model, Graph.Message.RequestedFit());
      return {
        model: fitted.model,
        commands: [...(opened.commands ?? []), ...(fitted.commands ?? [])],
      };
    },
    FailedSample: ({ reason }) => ({ model: { ...model, error: reason } }),
    GotViewerMessage: ({ message }) => viewer(model, message),
    GotGraphMessage: ({ message }) => graph(model, message),
    GotCitationMessage: ({ message }) => citation(model, message),
    OpenedQuote: () => viewer({ ...model, selectedKey: "quote" }, PdfViewer.scrollTo("quote")),
    SelectedRange: ({ key }) => ({
      model: { ...model, selectedKey: key, announcement: `Selected ${key}` },
    }),
    SelectedPdfText: ({ selection }) => ({
      model: {
        ...model,
        selectedText: selection.text,
        announcement: `Selected text on ${selection.regions.length} page(s).`,
      },
    }),
    ChangedDiffMode: ({ mode }) => ({ model: { ...model, diffMode: mode } }),
    ShowNeighborhood: () =>
      graph(model, Graph.Message.ChangedNeighborhood({ id: Option.some("article"), hops: 0 })),
  });
