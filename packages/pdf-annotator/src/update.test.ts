import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init } from "./model";
import { update } from "./update";

const ready = () => update(
  init({ id: "contract", sampleUrl: "/sample.pdf" }),
  Message.CompletedLoadPdf({
    name: "contract.pdf",
    bytesBase64: "AA==",
    pageCount: 2,
    page: 1,
    pageWidth: 612,
    pageHeight: 792,
    previewDataUrl: "data:image/png;base64,AA==",
    annotations: [],
  }),
).model;

describe("PDF annotator update", () => {
  it("adds, edits, nudges, duplicates, and deletes an annotation", () => {
    const added = update(
      ready(),
      Message.CompletedCanvasDrop({ kind: "text", x: 306, y: 396 }),
    ).model;
    const annotation = added.annotations[0];
    expect(annotation).toBeDefined();
    if (annotation === undefined) return;

    const edited = update(
      added,
      Message.ChangedAnnotationValue({ annotationId: annotation.id, value: "Accepted" }),
    ).model;
    const nudged = update(
      edited,
      Message.NudgedAnnotation({
        annotationId: annotation.id,
        direction: "Right",
        large: true,
      }),
    ).model;
    const duplicated = update(
      nudged,
      Message.DuplicatedAnnotation({ annotationId: annotation.id }),
    ).model;
    const deleted = update(
      duplicated,
      Message.DeletedAnnotation({ annotationId: annotation.id }),
    ).model;

    expect(edited.annotations[0]?.value).toBe("Accepted");
    expect(nudged.annotations[0]?.rect.x).toBeGreaterThan(annotation.rect.x);
    expect(duplicated.annotations).toHaveLength(2);
    expect(deleted.annotations).toHaveLength(1);
    expect(Option.isNone(deleted.selectedAnnotationId)).toBe(true);
  });

  it("resizes from any selected edge using zoom-corrected PDF points", () => {
    const added = update(
      { ...ready(), zoom: 2 },
      Message.CompletedCanvasDrop({ kind: "stamp", x: 244, y: 316 }),
    ).model;
    const annotation = added.annotations[0];
    expect(annotation).toBeDefined();
    if (annotation === undefined) return;

    const started = update(added, Message.StartedResize({
      annotationId: annotation.id,
      handle: "south-east",
      screenX: 100,
      screenY: 100,
    })).model;
    const resized = update(started, Message.MovedResize({
      screenX: 244,
      screenY: 244,
    })).model;

    expect(resized.annotations[0]?.rect.width).toBeCloseTo(annotation.rect.width + 61.2);
    expect(resized.annotations[0]?.rect.height).toBeCloseTo(annotation.rect.height + 61.2, 0);
  });

  it("keeps annotations on their zero-based original pages", () => {
    const firstPage = update(
      ready(),
      Message.CompletedCanvasDrop({ kind: "checkbox", x: 120, y: 120 }),
    ).model;
    const secondPage = update(firstPage, Message.CompletedRenderPage({
      page: 2,
      pageWidth: 612,
      pageHeight: 792,
      previewDataUrl: "data:image/png;base64,AA==",
    })).model;
    const annotated = update(
      secondPage,
      Message.CompletedCanvasDrop({ kind: "highlight", x: 240, y: 240 }),
    ).model;

    expect(annotated.annotations.map((annotation) => annotation.pageIndex)).toEqual([0, 1]);
  });

  it("applies versioned JSON and custom metadata", () => {
    const added = update(
      ready(),
      Message.CompletedCanvasDrop({ kind: "date", x: 200, y: 200 }),
    ).model;
    const annotation = added.annotations[0]!;
    const withMetadata = update(
      added,
      Message.ChangedAnnotationMetadata({ annotationId: annotation.id, key: "owner", value: "employee" }),
    ).model;
    const opened = update(withMetadata, Message.ToggledJsonInspector()).model;
    const parsed = JSON.parse(opened.jsonDraft) as { schemaVersion: number; annotations: Array<{ metadata: { owner: string } }> };
    parsed.annotations[0]!.metadata.owner = "manager";
    const applied = update(
      { ...opened, jsonDraft: JSON.stringify(parsed) },
      Message.AppliedJsonDraft(),
    ).model;

    expect(parsed.schemaVersion).toBe(1);
    expect(applied.annotations[0]?.metadata?.owner).toBe("manager");
    expect(applied.jsonError).toBe("");
  });
});
