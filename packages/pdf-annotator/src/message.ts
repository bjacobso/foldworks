import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { DragAndDrop, FileDrop } from "@foldkit/ui";
import { AnnotationKind } from "./model";

export const Message = defineMessageUnion({
  GotDragMessage: { message: DragAndDrop.Message },
  GotFileDropMessage: { message: FileDrop.Message },
  ClickedLoadSample: {},
  CompletedLoadPdf: {
    name: S.String,
    bytesBase64: S.String,
    pageCount: S.Number,
    page: S.Number,
    pageWidth: S.Number,
    pageHeight: S.Number,
    previewDataUrl: S.String,
  },
  FailedLoadPdf: { name: S.String, reason: S.String },
  RequestedPage: { page: S.Number },
  CompletedRenderPage: {
    page: S.Number,
    pageWidth: S.Number,
    pageHeight: S.Number,
    previewDataUrl: S.String,
  },
  FailedRenderPage: { reason: S.String },
  CompletedCanvasDrop: { kind: AnnotationKind, x: S.Number, y: S.Number },
  SelectedAnnotation: { annotationId: S.String },
  StartedResize: {
    annotationId: S.String,
    screenX: S.Number,
    screenY: S.Number,
  },
  MovedResize: { screenX: S.Number, screenY: S.Number },
  FinishedResize: {},
  ChangedAnnotationValue: { annotationId: S.String, value: S.String },
  NudgedAnnotation: {
    annotationId: S.String,
    direction: S.Literals(["Up", "Down", "Left", "Right"]),
    large: S.Boolean,
  },
  DeletedAnnotation: { annotationId: S.String },
  ClickedClearAnnotations: {},
  ClickedDownload: {},
  CompletedExport: { succeeded: S.Boolean, reason: S.String },
});
export type Message = typeof Message.Type;
