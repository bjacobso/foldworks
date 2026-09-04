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
  }),
).model;

describe("PDF annotator update", () => {
  it("adds, edits, nudges, and deletes an annotation", () => {
    const added = update(
      ready(),
      Message.CompletedCanvasDrop({ kind: "Text", x: 0.5, y: 0.5 }),
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
    const deleted = update(
      nudged,
      Message.DeletedAnnotation({ annotationId: annotation.id }),
    ).model;

    expect(edited.annotations[0]?.value).toBe("Accepted");
    expect(nudged.annotations[0]?.x).toBeGreaterThan(annotation.x);
    expect(deleted.annotations).toEqual([]);
    expect(Option.isNone(deleted.selectedAnnotationId)).toBe(true);
  });

  it("resizes the selected annotation using normalized page geometry", () => {
    const added = update(
      ready(),
      Message.CompletedCanvasDrop({ kind: "Stamp", x: 0.4, y: 0.4 }),
    ).model;
    const annotation = added.annotations[0];
    expect(annotation).toBeDefined();
    if (annotation === undefined) return;

    const started = update(added, Message.StartedResize({
      annotationId: annotation.id,
      screenX: 100,
      screenY: 100,
    })).model;
    const resized = update(started, Message.MovedResize({
      screenX: 172,
      screenY: 172,
    })).model;

    expect(resized.annotations[0]?.width).toBeCloseTo(annotation.width + 0.1);
    expect(resized.annotations[0]?.height).toBeGreaterThan(annotation.height);
  });

  it("keeps annotations on their original pages", () => {
    const firstPage = update(
      ready(),
      Message.CompletedCanvasDrop({ kind: "Checkmark", x: 0.2, y: 0.2 }),
    ).model;
    const secondPage = update(firstPage, Message.CompletedRenderPage({
      page: 2,
      pageWidth: 612,
      pageHeight: 792,
      previewDataUrl: "data:image/png;base64,AA==",
    })).model;
    const annotated = update(
      secondPage,
      Message.CompletedCanvasDrop({ kind: "Highlight", x: 0.4, y: 0.4 }),
    ).model;

    expect(annotated.annotations.map((annotation) => annotation.page)).toEqual([1, 2]);
  });
});
