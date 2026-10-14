import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { PdfViewer } from "@foldworks/pdf-viewer";
import { PdfTextRegion, PdfTextSelection } from "@foldworks/pdf";
import * as Graph from "@foldworks/diagram/graph";
import { Citation } from "@foldworks/ui";
export const Message = defineMessageUnion({
  Initialize: {},
  GotSample: { bytesBase64: S.String, regions: S.Array(PdfTextRegion) },
  FailedSample: { reason: S.String },
  GotViewerMessage: { message: PdfViewer.Message },
  GotGraphMessage: { message: Graph.Message },
  GotCitationMessage: { message: Citation.Message },
  OpenedQuote: {},
  SelectedRange: { key: S.String },
  SelectedPdfText: { selection: PdfTextSelection },
  ChangedDiffMode: { mode: S.Literals(["inline", "split"]) },
  ShowNeighborhood: {},
});
export type Message = typeof Message.Type;
