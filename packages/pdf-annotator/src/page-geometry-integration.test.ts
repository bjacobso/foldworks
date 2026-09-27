import { Effect } from "effect";
import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { userSpaceToDisplayRect } from "@foldworks/pdf";

import { extractPdfAnnotations } from "./pdf";

describe("annotator PDF geometry", () => {
  it("imports an AcroForm widget on a rotated, cropped page", async () => {
    const cropBox = { x: 36, y: 72, width: 540, height: 648 };
    const widget = { x: 100, y: 600, width: 200, height: 20 };
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
    page.setRotation(degrees(270));
    pdf
      .getForm()
      .createTextField("employee_name")
      .addToPage(page, { ...widget, borderWidth: 0 });
    const { annotations } = await Effect.runPromise(extractPdfAnnotations(await pdf.save()));
    expect(annotations[0]?.rect).toEqual(
      userSpaceToDisplayRect({ cropBox, rotation: 270 }, widget),
    );
  });
});
