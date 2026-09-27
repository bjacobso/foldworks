import { Effect, Option } from "effect";
import { PdfViewer } from "@foldworks/pdf-viewer";
import { Command, Update } from "foldkit";

import { generateSamplePdf, sampleName } from "./fixture";
import { Message } from "./message";
import type { Model } from "./model";

type UpdateReturn = Update.Return<Model, Message>;

const GenerateSample = Command.define("GeneratePdfViewerSample", {
  messages: [Message.GotViewerMessage, Message.FailedGenerateSample],
  execute: generateSamplePdf.pipe(
    Effect.map((bytes) =>
      Message.GotViewerMessage({ message: PdfViewer.loadBytes(sampleName, bytes) }),
    ),
    Effect.catch((error) =>
      Effect.succeed(Message.FailedGenerateSample({ reason: error.message })),
    ),
  ),
});

const foldViewer = Update.foldChild({
  update: PdfViewer.update,
  read: (model: Model) => Option.some(model.viewer),
  write: (model, viewer) => ({ ...model, viewer }),
  toParentMessage: (message) => Message.GotViewerMessage({ message }),
});

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    GotViewerMessage: ({ message: childMessage }) => foldViewer(model, childMessage),
    RequestedSample: () => ({
      model: { ...model, selectedKey: Option.none(), generateError: "" },
      commands: [GenerateSample()],
    }),
    FailedGenerateSample: ({ reason }) => ({ model: { ...model, generateError: reason } }),
    // Clicking a box on the page toggles its selection; the list keeps in sync.
    ClickedOverlay: ({ key }) => ({
      model: {
        ...model,
        selectedKey: Option.contains(model.selectedKey, key) ? Option.none() : Option.some(key),
      },
    }),
    // Choosing a field in the list selects it and scrolls the PDF to its widget.
    SelectedField: ({ key }) => {
      const selected = { ...model, selectedKey: Option.some(key), showOverlays: true };
      return foldViewer(selected, PdfViewer.scrollTo(key));
    },
    ChangedStatusFilter: ({ filter }) => ({ model: { ...model, statusFilter: filter } }),
    ToggledOverlays: ({ isVisible }) => ({ model: { ...model, showOverlays: isVisible } }),
  });
