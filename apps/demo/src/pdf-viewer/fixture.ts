import {
  displayRectToUserSpace,
  type PdfPageGeometry,
  type PdfRect,
} from "@foldworks/pdf-annotator";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export const sampleName = "synthetic-onboarding-packet.pdf";

export type FieldStatus = "filled" | "blank" | "omitted" | "missing";

export type SampleField = Readonly<{
  key: string;
  label: string;
  pageIndex: number;
  /** PDF user space, bottom-left origin, as a widget's `/Rect` stores it. */
  rect: PdfRect;
  status: FieldStatus;
  value?: string;
}>;

type PageSpec = Readonly<{
  title: string;
  note: string;
  mediaBox: Readonly<{ width: number; height: number }>;
  geometry: PdfPageGeometry;
  fields: ReadonlyArray<Omit<SampleField, "pageIndex" | "rect"> & Readonly<{ box: PdfRect }>>;
}>;

// Field boxes are laid out in displayed page points (top-left origin) for
// readability, then converted to user space the way a real PDF stores them.
const pages: ReadonlyArray<PageSpec> = [
  {
    title: "Section 1. Employee information",
    note: "Letter page, no rotation, crop box at the origin.",
    mediaBox: { width: 612, height: 792 },
    geometry: { cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 0 },
    fields: [
      {
        key: "legal-name",
        label: "Legal name",
        box: { x: 72, y: 150, width: 300, height: 24 },
        status: "filled",
        value: "Alex Morgan",
      },
      {
        key: "preferred-name",
        label: "Preferred name",
        box: { x: 392, y: 150, width: 148, height: 24 },
        status: "blank",
      },
      {
        key: "date-of-birth",
        label: "Date of birth",
        box: { x: 72, y: 214, width: 140, height: 24 },
        status: "filled",
        value: "04/12/1990",
      },
      {
        key: "ssn",
        label: "Social Security number",
        box: { x: 232, y: 214, width: 160, height: 24 },
        status: "missing",
      },
      {
        key: "email",
        label: "Email address",
        box: { x: 72, y: 278, width: 320, height: 24 },
        status: "filled",
        value: "alex.morgan@example.test",
      },
      {
        key: "phone",
        label: "Telephone",
        box: { x: 412, y: 278, width: 128, height: 24 },
        status: "omitted",
      },
      {
        key: "citizen",
        label: "A citizen of the United States",
        box: { x: 72, y: 346, width: 14, height: 14 },
        status: "filled",
        value: "X",
      },
      {
        key: "permanent-resident",
        label: "A lawful permanent resident",
        box: { x: 72, y: 372, width: 14, height: 14 },
        status: "blank",
      },
      {
        key: "signature",
        label: "Employee signature",
        box: { x: 72, y: 640, width: 280, height: 36 },
        status: "missing",
      },
      {
        key: "signed-on",
        label: "Today's date",
        box: { x: 372, y: 640, width: 168, height: 36 },
        status: "blank",
      },
    ],
  },
  {
    title: "Section 2. Employer review",
    note: "Crop box offset by (44, 54) inside a 700 × 900 media box.",
    mediaBox: { width: 700, height: 900 },
    geometry: { cropBox: { x: 44, y: 54, width: 612, height: 792 }, rotation: 0 },
    fields: [
      {
        key: "document-title",
        label: "Document title",
        box: { x: 72, y: 150, width: 220, height: 24 },
        status: "filled",
        value: "U.S. Passport",
      },
      {
        key: "issuing-authority",
        label: "Issuing authority",
        box: { x: 312, y: 150, width: 228, height: 24 },
        status: "filled",
        value: "U.S. Department of State",
      },
      {
        key: "document-number",
        label: "Document number",
        box: { x: 72, y: 214, width: 220, height: 24 },
        status: "missing",
      },
      {
        key: "expiration",
        label: "Expiration date",
        box: { x: 312, y: 214, width: 140, height: 24 },
        status: "blank",
      },
      {
        key: "list-b",
        label: "List B document",
        box: { x: 72, y: 278, width: 220, height: 24 },
        status: "omitted",
      },
      {
        key: "list-c",
        label: "List C document",
        box: { x: 312, y: 278, width: 228, height: 24 },
        status: "omitted",
      },
      {
        key: "first-day",
        label: "First day of employment",
        box: { x: 72, y: 360, width: 160, height: 24 },
        status: "filled",
        value: "10/05/2026",
      },
    ],
  },
  {
    title: "Supplement B. Reverification",
    note: "Page rotated with /Rotate 90; overlays turn with it.",
    mediaBox: { width: 612, height: 792 },
    geometry: { cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 90 },
    fields: [
      {
        key: "new-name",
        label: "New name",
        box: { x: 72, y: 150, width: 300, height: 24 },
        status: "blank",
      },
      {
        key: "rehire-date",
        label: "Date of rehire",
        box: { x: 392, y: 150, width: 140, height: 24 },
        status: "filled",
        value: "01/15/2027",
      },
      {
        key: "reverify-document",
        label: "Reverification document",
        box: { x: 552, y: 150, width: 168, height: 24 },
        status: "missing",
      },
      {
        key: "reviewer-signature",
        label: "Reviewer signature",
        box: { x: 72, y: 460, width: 300, height: 36 },
        status: "missing",
      },
    ],
  },
];

export const sampleFields: ReadonlyArray<SampleField> = pages.flatMap((page, pageIndex) =>
  page.fields.map(({ box, ...field }) => ({
    ...field,
    pageIndex,
    rect: displayRectToUserSpace(page.geometry, box),
  })),
);

const ink = rgb(0.13, 0.14, 0.17);
const muted = rgb(0.42, 0.44, 0.49);
const rule = rgb(0.7, 0.72, 0.76);

/** Draw upright text at a displayed-page point, whatever the page rotation. */
const text = (
  page: PDFPage,
  geometry: PdfPageGeometry,
  value: string,
  x: number,
  baseline: number,
  size: number,
  font: PDFFont,
  color = ink,
) => {
  const anchor = displayRectToUserSpace(geometry, { x, y: baseline, width: 0, height: 0 });
  page.drawText(value, {
    x: anchor.x,
    y: anchor.y,
    size,
    font,
    color,
    rotate: degrees(geometry.rotation),
  });
};

/** Build the demo document. Values are synthetic; no real person is described. */
export const generateSamplePdf = async (): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Synthetic onboarding packet");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const spec of pages) {
    const page = pdf.addPage([spec.mediaBox.width, spec.mediaBox.height]);
    const { geometry } = spec;
    const crop = geometry.cropBox;
    page.setCropBox(crop.x, crop.y, crop.width, crop.height);
    page.setRotation(degrees(geometry.rotation));
    if (crop.x > 0 || crop.y > 0) {
      // Content outside the crop box never appears in the viewer.
      page.drawText("Outside the crop box", {
        x: 4,
        y: 12,
        size: 10,
        font: bold,
        color: rgb(0.8, 0.1, 0.1),
      });
    }

    text(page, geometry, spec.title, 72, 84, 18, bold);
    text(page, geometry, spec.note, 72, 106, 10, regular, muted);
    for (const field of spec.fields) {
      const rect = displayRectToUserSpace(geometry, field.box);
      page.drawRectangle({ ...rect, borderColor: rule, borderWidth: 0.75 });
      const isCheckbox = field.box.width <= 16;
      text(
        page,
        geometry,
        field.label,
        isCheckbox ? field.box.x + field.box.width + 8 : field.box.x,
        isCheckbox ? field.box.y + 11 : field.box.y - 6,
        isCheckbox ? 10 : 8,
        regular,
        isCheckbox ? ink : muted,
      );
      if (field.value !== undefined) {
        text(
          page,
          geometry,
          field.value,
          field.box.x + (isCheckbox ? 3 : 6),
          field.box.y + field.box.height / 2 + 4,
          11,
          isCheckbox ? bold : regular,
        );
      }
    }
    const displayHeight = geometry.rotation === 90 ? crop.width : crop.height;
    text(
      page,
      geometry,
      "Synthetic data generated by the Foldworks demo.",
      72,
      displayHeight - 40,
      8,
      regular,
      muted,
    );
  }
  return pdf.save();
};
