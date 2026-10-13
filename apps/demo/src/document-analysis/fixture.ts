import { Effect } from "effect";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { bytesToBase64, locateQuote, readPdfText } from "@foldworks/pdf";
import type { GraphDocument } from "@foldworks/diagram/graph";

export const quote =
  "Employees with one year of service may bid on schedules during each bid period.";
export const revisedQuote =
  "Employees with six months of service must bid on schedules during each bid period.";
export const graphDocument: GraphDocument = {
  nodes: [
    { id: "agreement", data: { label: "Agreement", tone: "info" } },
    { id: "article", parentId: "agreement", data: { label: "Article 12" } },
    { id: "policy", parentId: "agreement", data: { label: "Schedule bidding", tone: "success" } },
    { id: "rider", data: { label: "2026 rider", tone: "warning" } },
  ],
  edges: [
    {
      id: "source",
      source: { nodeId: "article" },
      target: { nodeId: "policy" },
      data: { label: "Supports" },
    },
    {
      id: "replacement",
      source: { nodeId: "rider" },
      target: { nodeId: "policy" },
      data: { label: "Amends", tone: "warning" },
    },
  ],
  annotations: [],
};

/** A synthetic 12-page agreement. The cited passage crosses pages 1 and 2. */
export const sample = Effect.promise(async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 12; index++) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Synthetic agreement - page ${index + 1}`, { x: 50, y: 738, size: 18, font });
    page.drawText("For demonstration only", {
      x: 50,
      y: 710,
      size: 11,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    if (index === 0) {
      page.drawText("Article 12. Schedule bidding", { x: 50, y: 665, size: 14, font });
      page.drawText("Employees with one year of service may bid on", {
        x: 50,
        y: 60,
        size: 12,
        font,
      });
    } else if (index === 1) {
      page.drawText("schedules during each bid period.", { x: 50, y: 665, size: 12, font });
    } else {
      page.drawText(`Article ${index + 12}. Additional provisions`, {
        x: 50,
        y: 665,
        size: 14,
        font,
      });
      page.drawText("This section is intentionally brief to demonstrate page caching.", {
        x: 50,
        y: 630,
        size: 12,
        font,
      });
    }
  }
  return pdf.save();
}).pipe(
  Effect.flatMap((bytes) =>
    readPdfText(bytes).pipe(
      Effect.map((pages) => {
        // Restrict matching to body text. Headers are unrelated to the cross-page quote.
        const body = pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.rect.y < 700),
        }));
        const location = locateQuote(body, quote);
        if (location._tag !== "Found") throw new Error(`Sample quote location: ${location._tag}`);
        return { bytesBase64: bytesToBase64(bytes), regions: location.regions };
      }),
    ),
  ),
);
