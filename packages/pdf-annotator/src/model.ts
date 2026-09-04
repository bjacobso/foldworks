import { Option, Schema as S } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

import { DragAndDrop, FileDrop } from "@foldkit/ui";

export const AnnotationKind = S.Literals([
  "Text",
  "Signature",
  "Date",
  "Checkmark",
  "Highlight",
  "Stamp",
]);
export type AnnotationKind = typeof AnnotationKind.Type;

export const Annotation = S.Struct({
  id: S.String,
  kind: AnnotationKind,
  page: S.Number,
  x: S.Number,
  y: S.Number,
  width: S.Number,
  height: S.Number,
  value: S.String,
});
export type Annotation = typeof Annotation.Type;

export const DocumentState = defineTaggedUnion({
  Empty: {},
  Loading: { name: S.String },
  Failed: { name: S.String, reason: S.String },
  Ready: {
    name: S.String,
    bytesBase64: S.String,
    pageCount: S.Number,
    currentPage: S.Number,
    pageWidth: S.Number,
    pageHeight: S.Number,
    previewDataUrl: S.String,
  },
});
export type DocumentState = typeof DocumentState.Type;

export const MoveState = defineTaggedUnion({
  Idle: {},
  Moving: {
    annotationId: S.String,
    originX: S.Number,
    originY: S.Number,
  },
});
export type MoveState = typeof MoveState.Type;

export const ResizeState = defineTaggedUnion({
  Idle: {},
  Resizing: {
    annotationId: S.String,
    originScreenX: S.Number,
    originScreenY: S.Number,
    originWidth: S.Number,
    originHeight: S.Number,
  },
});
export type ResizeState = typeof ResizeState.Type;

export const ExportStatus = S.Literals(["Idle", "Exporting", "Complete", "Failed"]);
export type ExportStatus = typeof ExportStatus.Type;

export const Model = S.Struct({
  id: S.String,
  sampleUrl: S.Option(S.String),
  document: DocumentState,
  annotations: S.Array(Annotation),
  selectedAnnotationId: S.Option(S.String),
  nextId: S.Number,
  dragAndDrop: DragAndDrop.Model,
  fileDrop: FileDrop.Model,
  moveState: MoveState,
  resizeState: ResizeState,
  lastPointerScreenX: S.Number,
  lastPointerScreenY: S.Number,
  lastPointerClientX: S.Number,
  lastPointerClientY: S.Number,
  isRenderingPage: S.Boolean,
  exportStatus: ExportStatus,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  sampleUrl?: string;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  sampleUrl: Option.fromUndefinedOr(config.sampleUrl),
  document: DocumentState.Empty(),
  annotations: [],
  selectedAnnotationId: Option.none(),
  nextId: 1,
  dragAndDrop: DragAndDrop.init({
    id: `${config.id}-annotations`,
    orientation: "Vertical",
    activationThreshold: 5,
  }),
  fileDrop: FileDrop.init({ id: `${config.id}-file` }),
  moveState: MoveState.Idle(),
  resizeState: ResizeState.Idle(),
  lastPointerScreenX: 0,
  lastPointerScreenY: 0,
  lastPointerClientX: 0,
  lastPointerClientY: 0,
  isRenderingPage: false,
  exportStatus: "Idle",
  announcement: "PDF annotator ready. Upload a PDF or open the sample.",
});
