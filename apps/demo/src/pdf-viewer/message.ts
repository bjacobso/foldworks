import { Schema as S } from "effect";
import { PdfViewer } from "@foldworks/pdf-viewer";
import { defineMessageUnion } from "foldkit/message";

import { StatusFilter } from "./model";

export const Message = defineMessageUnion({
  GotViewerMessage: { message: PdfViewer.Message },
  RequestedSample: {},
  FailedGenerateSample: { reason: S.String },
  ClickedOverlay: { key: S.String },
  SelectedField: { key: S.String },
  ChangedStatusFilter: { filter: StatusFilter },
  ToggledOverlays: { isVisible: S.Boolean },
});
export type Message = typeof Message.Type;
