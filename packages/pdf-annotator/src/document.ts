import { Schema as S } from "effect";

import {
  AnnotationDocument,
  type Annotation as AnnotationValue,
  type AnnotationDocument as AnnotationDocumentValue,
  type PdfRect,
} from "./model";

export type PageSize = Readonly<{ width: number; height: number }>;

export type AnnotationIssue = Readonly<{
  severity: "error" | "warning";
  code: string;
  message: string;
  annotationId?: string;
  path?: string;
}>;

export type AnnotationQuery = Readonly<{
  pageIndex?: number;
  kind?: string;
  name?: string;
  logicalFieldId?: string;
}>;

const decodeDocument = (value: unknown): AnnotationDocumentValue =>
  S.decodeUnknownSync(AnnotationDocument)(value);

/** Parse and validate the versioned v1 annotation document JSON. */
export const parseAnnotationDocument = (
  input: string | unknown,
): AnnotationDocumentValue => {
  const value: unknown = typeof input === "string" ? JSON.parse(input) : input;
  return decodeDocument(value);
};

export const serializeAnnotationDocument = (
  document: AnnotationDocumentValue,
  space = 2,
): string => JSON.stringify(S.encodeSync(AnnotationDocument)(document), null, space);

export const makeAnnotationDocument = (
  annotations: ReadonlyArray<AnnotationValue>,
  metadata: S.JsonObject = {},
): AnnotationDocumentValue => ({ schemaVersion: 1, annotations: [...annotations], metadata });

export const queryAnnotations = (
  document: AnnotationDocumentValue,
  query: AnnotationQuery = {},
): ReadonlyArray<AnnotationValue> => document.annotations.filter((annotation) =>
  (query.pageIndex === undefined || annotation.pageIndex === query.pageIndex) &&
  (query.kind === undefined || annotation.kind === query.kind) &&
  (query.name === undefined || annotation.name === query.name) &&
  (query.logicalFieldId === undefined || annotation.pdf?.logicalFieldId === query.logicalFieldId)
);

export const getAnnotation = (
  document: AnnotationDocumentValue,
  annotationId: string,
): AnnotationValue | undefined => document.annotations.find(({ id }) => id === annotationId);

export const addDocumentAnnotation = (
  document: AnnotationDocumentValue,
  annotation: AnnotationValue,
): AnnotationDocumentValue => {
  if (document.annotations.some(({ id }) => id === annotation.id)) {
    throw new Error(`Annotation ID "${annotation.id}" already exists.`);
  }
  return { ...document, annotations: [...document.annotations, annotation] };
};

export const updateDocumentAnnotation = (
  document: AnnotationDocumentValue,
  annotationId: string,
  update: (annotation: AnnotationValue) => AnnotationValue,
): AnnotationDocumentValue => ({
  ...document,
  annotations: document.annotations.map((annotation) =>
    annotation.id === annotationId ? update(annotation) : annotation
  ),
});

export const deleteDocumentAnnotation = (
  document: AnnotationDocumentValue,
  annotationId: string,
): AnnotationDocumentValue => ({
  ...document,
  annotations: document.annotations.filter(({ id }) => id !== annotationId),
});

export const validateAnnotationDocument = (
  document: AnnotationDocumentValue,
  pageSizes: ReadonlyArray<PageSize> = [],
): ReadonlyArray<AnnotationIssue> => {
  const issues: AnnotationIssue[] = [];
  const ids = new Set<string>();
  for (const annotation of document.annotations) {
    if (ids.has(annotation.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-id",
        message: `Annotation ID "${annotation.id}" is not unique.`,
        annotationId: annotation.id,
        path: "id",
      });
    }
    ids.add(annotation.id);
    if (!Number.isInteger(annotation.pageIndex) || annotation.pageIndex < 0) {
      issues.push({
        severity: "error",
        code: "invalid-page",
        message: "Page index must be a non-negative integer.",
        annotationId: annotation.id,
        path: "pageIndex",
      });
    } else if (pageSizes.length > 0 && annotation.pageIndex >= pageSizes.length) {
      issues.push({
        severity: "error",
        code: "missing-page",
        message: `Page ${annotation.pageIndex + 1} does not exist.`,
        annotationId: annotation.id,
        path: "pageIndex",
      });
    }
    const values = Object.values(annotation.rect);
    if (!values.every(Number.isFinite) || annotation.rect.width <= 0 || annotation.rect.height <= 0) {
      issues.push({
        severity: "error",
        code: "invalid-geometry",
        message: "Annotation geometry must contain finite, positive dimensions.",
        annotationId: annotation.id,
        path: "rect",
      });
      continue;
    }
    const page = pageSizes[annotation.pageIndex];
    if (page !== undefined && (
      annotation.rect.x < 0 || annotation.rect.y < 0 ||
      annotation.rect.x + annotation.rect.width > page.width ||
      annotation.rect.y + annotation.rect.height > page.height
    )) {
      issues.push({
        severity: "error",
        code: "out-of-bounds",
        message: "Annotation bounds must stay inside the page.",
        annotationId: annotation.id,
        path: "rect",
      });
    }
  }
  return issues;
};

export const annotationValueText = (annotation: AnnotationValue): string => {
  const value = annotation.value;
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

export const nextAnnotationId = (
  annotations: ReadonlyArray<AnnotationValue>,
  prefix = "annotation",
): string => {
  const used = new Set(annotations.map(({ id }) => id));
  let index = annotations.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

export const replaceAnnotationRect = (
  annotation: AnnotationValue,
  rect: PdfRect,
): AnnotationValue => ({ ...annotation, rect });
