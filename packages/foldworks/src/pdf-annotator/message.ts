import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { DragAndDrop, FileDrop } from "@foldkit/ui";
import { Annotation, BuiltInAnnotationKind, ResizeHandle } from "./model";

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
    annotations: S.Array(Annotation),
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
  ChangedZoom: { zoom: S.Number },
  CompletedCanvasDrop: { kind: BuiltInAnnotationKind, x: S.Number, y: S.Number },
  SelectedAnnotation: { annotationId: S.String },
  StartedResize: {
    annotationId: S.String,
    handle: ResizeHandle,
    screenX: S.Number,
    screenY: S.Number,
  },
  MovedResize: { screenX: S.Number, screenY: S.Number },
  FinishedResize: {},
  ChangedAnnotationValue: { annotationId: S.String, value: S.String },
  ChangedAnnotationName: { annotationId: S.String, name: S.String },
  ChangedAnnotationFlag: {
    annotationId: S.String,
    property: S.Literals(["required", "readOnly", "locked"]),
    value: S.Boolean,
  },
  ChangedAnnotationGeometry: {
    annotationId: S.String,
    property: S.Literals(["x", "y", "width", "height"]),
    value: S.Number,
  },
  ChangedAnnotationPage: { annotationId: S.String, pageIndex: S.Number },
  AddedAnnotationMetadata: { annotationId: S.String },
  RenamedAnnotationMetadata: { annotationId: S.String, key: S.String, nextKey: S.String },
  ChangedAnnotationMetadata: { annotationId: S.String, key: S.String, value: S.String },
  DeletedAnnotationMetadata: { annotationId: S.String, key: S.String },
  NudgedAnnotation: {
    annotationId: S.String,
    direction: S.Literals(["Up", "Down", "Left", "Right"]),
    large: S.Boolean,
  },
  DuplicatedAnnotation: { annotationId: S.String },
  DeletedAnnotation: { annotationId: S.String },
  ClickedClearAnnotations: {},
  ToggledJsonInspector: {},
  ChangedJsonDraft: { value: S.String },
  AppliedJsonDraft: {},
  ResetJsonDraft: {},
  ClickedDownloadJson: {},
  CompletedJsonDownload: {},
  ClickedDownload: {},
  CompletedExport: { succeeded: S.Boolean, reason: S.String },
});
export type Message = typeof Message.Type;
