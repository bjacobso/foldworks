import { Option, Schema as S } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

import { DragAndDrop, FileDrop } from "@foldkit/ui";

/** Kinds supplied by the default palette. Custom JSON-only kinds are also valid. */
export const BuiltInAnnotationKind = S.Literals([
  "text",
  "signature",
  "date",
  "checkbox",
  "initials",
  "radio",
  "select",
  "highlight",
  "stamp",
]);
export type BuiltInAnnotationKind = typeof BuiltInAnnotationKind.Type;

/** Annotation kinds are intentionally open so hosts can round-trip custom tools. */
export const AnnotationKind = S.String;
export type AnnotationKind = typeof AnnotationKind.Type;

export const PdfRect = S.Struct({
  x: S.Number,
  y: S.Number,
  width: S.Number,
  height: S.Number,
});
export type PdfRect = typeof PdfRect.Type;

export const PdfBinding = S.Struct({
  fieldType: S.optionalKey(S.Literals(["text", "checkbox", "radio", "choice", "signature"])),
  logicalFieldId: S.optionalKey(S.String),
  widgetId: S.optionalKey(S.String),
  optionValue: S.optionalKey(S.String),
  flags: S.optionalKey(S.Number),
  source: S.optionalKey(S.Literals(["imported", "authored"])),
});
export type PdfBinding = typeof PdfBinding.Type;

/**
 * Portable annotation data. Geometry is expressed in PDF points from the
 * displayed page's top-left and never depends on canvas zoom or pixel density.
 */
export const Annotation = S.Struct({
  id: S.String,
  kind: AnnotationKind,
  pageIndex: S.Number,
  rect: PdfRect,
  name: S.optionalKey(S.String),
  required: S.optionalKey(S.Boolean),
  readOnly: S.optionalKey(S.Boolean),
  locked: S.optionalKey(S.Boolean),
  value: S.optionalKey(S.Json),
  metadata: S.optionalKey(S.JsonObject),
  pdf: S.optionalKey(PdfBinding),
});
export type Annotation = typeof Annotation.Type;

export const AnnotationDocument = S.Struct({
  schemaVersion: S.Literal(1),
  documentId: S.optionalKey(S.String),
  documentFingerprint: S.optionalKey(S.String),
  annotations: S.Array(Annotation),
  metadata: S.optionalKey(S.JsonObject),
});
export type AnnotationDocument = typeof AnnotationDocument.Type;

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

export const ResizeHandle = S.Literals([
  "north-west",
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
]);
export type ResizeHandle = typeof ResizeHandle.Type;

export const ResizeState = defineTaggedUnion({
  Idle: {},
  Resizing: {
    annotationId: S.String,
    handle: ResizeHandle,
    originScreenX: S.Number,
    originScreenY: S.Number,
    originX: S.Number,
    originY: S.Number,
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
  useInitialAnnotationsOnLoad: S.Boolean,
  documentMetadata: S.JsonObject,
  deletedPdfFieldNames: S.Array(S.String),
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
  zoom: S.Number,
  exportStatus: ExportStatus,
  isJsonInspectorOpen: S.Boolean,
  jsonDraft: S.String,
  jsonError: S.String,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  sampleUrl?: string;
  annotations?: ReadonlyArray<Annotation>;
  metadata?: S.JsonObject;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  sampleUrl: Option.fromUndefinedOr(config.sampleUrl),
  document: DocumentState.Empty(),
  annotations: [...(config.annotations ?? [])],
  useInitialAnnotationsOnLoad: config.annotations !== undefined,
  documentMetadata: config.metadata ?? {},
  deletedPdfFieldNames: [],
  selectedAnnotationId: Option.none(),
  nextId: (config.annotations?.length ?? 0) + 1,
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
  zoom: 1,
  exportStatus: "Idle",
  isJsonInspectorOpen: false,
  jsonDraft: "",
  jsonError: "",
  announcement: "PDF annotator ready. Upload a PDF or open the sample.",
});
