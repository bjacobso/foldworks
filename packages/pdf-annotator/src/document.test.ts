import { describe, expect, it } from "vitest";

import {
  makeAnnotationDocument,
  parseAnnotationDocument,
  queryAnnotations,
  serializeAnnotationDocument,
  updateDocumentAnnotation,
  validateAnnotationDocument,
} from "./document";
import type { Annotation } from "./model";

const annotation: Annotation = {
  id: "employee-name",
  kind: "text",
  pageIndex: 0,
  rect: { x: 72, y: 120, width: 200, height: 24 },
  name: "employee_name",
  value: "Alex Morgan",
  metadata: { source: "hris", confidence: 0.98 },
};

describe("annotation document JSON", () => {
  it("round-trips custom kinds, values, and metadata", () => {
    const custom: Annotation = {
      ...annotation,
      id: "custom-1",
      kind: "company:employee-code",
      value: { code: "EMP-7", verified: true },
    };
    const json = serializeAnnotationDocument(makeAnnotationDocument([annotation, custom], { owner: "people" }));
    const parsed = parseAnnotationDocument(json);

    expect(parsed).toEqual(makeAnnotationDocument([annotation, custom], { owner: "people" }));
    expect(queryAnnotations(parsed, { kind: "company:employee-code" })).toEqual([custom]);
  });

  it("rejects unversioned arrays instead of guessing a migration", () => {
    expect(() => parseAnnotationDocument(JSON.stringify([annotation]))).toThrow();
  });

  it("updates immutably and reports duplicate IDs and bad geometry", () => {
    const document = makeAnnotationDocument([annotation]);
    const updated = updateDocumentAnnotation(document, annotation.id, (value) => ({
      ...value,
      metadata: { ...value.metadata, reviewed: true },
    }));
    const invalid = makeAnnotationDocument([
      annotation,
      { ...annotation, rect: { ...annotation.rect, width: -1 } },
    ]);

    expect(document.annotations[0]?.metadata?.reviewed).toBeUndefined();
    expect(updated.annotations[0]?.metadata?.reviewed).toBe(true);
    expect(validateAnnotationDocument(invalid).map(({ code }) => code)).toEqual([
      "duplicate-id",
      "invalid-geometry",
    ]);
  });
});
