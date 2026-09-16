import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { Annotation } from "./model";
import { extractPdfAnnotations, serializePdf } from "./pdf";

const blankPdf = async (): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
};

describe("PDF annotation contracts", () => {
  it("serializes supported kinds as interactive AcroForm fields and extracts them", async () => {
    const annotations: Annotation[] = [
      {
        id: "employee-name",
        kind: "text",
        pageIndex: 0,
        rect: { x: 72, y: 100, width: 200, height: 24 },
        name: "employee_name",
        required: true,
        value: "Alex Morgan",
        metadata: { owner: "employee" },
      },
      {
        id: "accepted",
        kind: "checkbox",
        pageIndex: 0,
        rect: { x: 72, y: 150, width: 20, height: 20 },
        name: "accepted_terms",
        value: true,
      },
      {
        id: "department",
        kind: "select",
        pageIndex: 0,
        rect: { x: 72, y: 190, width: 160, height: 24 },
        name: "department",
        value: "Engineering",
        metadata: { options: ["Engineering", "Operations"] },
      },
      {
        id: "start-date",
        kind: "date",
        pageIndex: 0,
        rect: { x: 300, y: 100, width: 120, height: 24 },
        name: "start_date",
        value: "Sep 16, 2026",
        metadata: { format: "MMM d, yyyy" },
      },
    ];

    const serialized = await serializePdf(await blankPdf(), annotations);
    const reopened = await PDFDocument.load(serialized.bytes);
    const fields = reopened.getForm().getFields();
    const extracted = await extractPdfAnnotations(serialized.bytes);

    expect(fields.map((field) => field.getName())).toEqual([
      "employee_name",
      "accepted_terms",
      "department",
      "start_date",
    ]);
    expect(extracted.annotations.map(({ kind }) => kind)).toEqual(["text", "checkbox", "select", "date"]);
    expect(extracted.annotations.map(({ id }) => id)).toEqual([
      "employee-name",
      "accepted",
      "department",
      "start-date",
    ]);
    expect(extracted.annotations[0]?.rect).toEqual({ x: 72, y: 100, width: 200, height: 24 });
    expect(extracted.annotations[0]?.required).toBe(true);
    expect(extracted.annotations[1]?.value).toBe(true);
    expect(extracted.annotations[0]?.metadata?.owner).toBe("employee");
    expect(extracted.annotations[3]?.metadata?.format).toBe("MMM d, yyyy");
    expect(serialized.warnings).toEqual([]);
  });

  it("removes deleted imported logical fields", async () => {
    const source = await serializePdf(await blankPdf(), [{
      id: "remove-me",
      kind: "text",
      pageIndex: 0,
      rect: { x: 50, y: 50, width: 100, height: 20 },
      name: "remove_me",
      value: "Gone",
    }]);
    const removed = await serializePdf(source.bytes, [], { deletedFieldNames: ["remove_me"] });
    const reopened = await PDFDocument.load(removed.bytes);

    expect(reopened.getForm().getFields()).toEqual([]);
  });

  it("round-trips displayed geometry on rotated and cropped pages", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    page.setCropBox(36, 72, 540, 648);
    page.setRotation(degrees(90));
    const annotation: Annotation = {
      id: "rotated-field",
      kind: "text",
      pageIndex: 0,
      // A 90-degree page displays as 648 × 540 points.
      rect: { x: 100, y: 80, width: 180, height: 24 },
      name: "rotated_field",
      value: "Rotation safe",
    };

    const serialized = await serializePdf(await pdf.save(), [annotation]);
    const extracted = await extractPdfAnnotations(serialized.bytes);

    expect(extracted.annotations[0]?.rect).toEqual(annotation.rect);
  });
});
