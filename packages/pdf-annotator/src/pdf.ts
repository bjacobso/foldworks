/// <reference path="./vite-env.d.ts" />

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { Annotation } from "./model";

export type RenderedPage = Readonly<{
  pageCount: number;
  page: number;
  pageWidth: number;
  pageHeight: number;
  previewDataUrl: string;
}>;

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const renderPdfPage = async (
  bytes: Uint8Array,
  requestedPage: number,
): Promise<RenderedPage> => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  // PDF.js transfers the supplied buffer to its worker. Keep the component's
  // source bytes intact for page changes and export.
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  const document = await loadingTask.promise;
  const pageNumber = Math.min(document.numPages, Math.max(1, requestedPage));
  const page = await document.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const renderWidth = 1440;
  const viewport = page.getViewport({ scale: renderWidth / baseViewport.width });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas rendering is not available.");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const previewDataUrl = canvas.toDataURL("image/png");
  await loadingTask.destroy();
  return {
    pageCount: document.numPages,
    page: pageNumber,
    pageWidth: baseViewport.width,
    pageHeight: baseViewport.height,
    previewDataUrl,
  };
};

const downloadBytes = (bytes: Uint8Array, filename: string): void => {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const fitFontSize = (height: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, height * 0.48));

export const exportAnnotatedPdf = async (
  bytes: Uint8Array,
  annotations: ReadonlyArray<Annotation>,
  sourceName: string,
): Promise<void> => {
  const pdf = await PDFDocument.load(bytes);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const annotation of annotations) {
    const page = pdf.getPage(annotation.page - 1);
    if (page === undefined) continue;
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const x = annotation.x * pageWidth;
    const width = annotation.width * pageWidth;
    const height = annotation.height * pageHeight;
    const y = pageHeight - (annotation.y * pageHeight) - height;

    switch (annotation.kind) {
      case "Highlight":
        page.drawRectangle({ x, y, width, height, color: rgb(1, 0.84, 0.18), opacity: 0.34 });
        break;
      case "Checkmark": {
        const inset = Math.min(width, height) * 0.18;
        page.drawRectangle({
          x,
          y,
          width,
          height,
          borderColor: rgb(0.16, 0.18, 0.22),
          borderWidth: Math.max(1, Math.min(width, height) * 0.035),
        });
        page.drawLine({
          start: { x: x + inset, y: y + height * 0.48 },
          end: { x: x + width * 0.43, y: y + inset },
          color: rgb(0.09, 0.48, 0.35),
          thickness: Math.max(1.5, height * 0.08),
        });
        page.drawLine({
          start: { x: x + width * 0.43, y: y + inset },
          end: { x: x + width - inset, y: y + height - inset },
          color: rgb(0.09, 0.48, 0.35),
          thickness: Math.max(1.5, height * 0.08),
        });
        break;
      }
      case "Stamp": {
        const fontSize = fitFontSize(height, 7, 22);
        page.drawRectangle({
          x,
          y,
          width,
          height,
          borderColor: rgb(0.79, 0.18, 0.18),
          borderWidth: Math.max(1.2, height * 0.06),
          opacity: 0.92,
        });
        page.drawText(annotation.value.toUpperCase(), {
          x: x + 5,
          y: y + Math.max(3, (height - fontSize) / 2),
          size: fontSize,
          font: bold,
          color: rgb(0.79, 0.18, 0.18),
          maxWidth: Math.max(1, width - 10),
        });
        break;
      }
      case "Signature": {
        const fontSize = fitFontSize(height, 9, 28);
        page.drawText(annotation.value, {
          x: x + 2,
          y: y + Math.max(2, (height - fontSize) / 2),
          size: fontSize,
          font: italic,
          color: rgb(0.08, 0.18, 0.38),
          maxWidth: Math.max(1, width - 4),
        });
        break;
      }
      case "Date":
      case "Text": {
        const fontSize = fitFontSize(height, 7, 18);
        page.drawText(annotation.value, {
          x: x + 2,
          y: y + Math.max(2, (height - fontSize) / 2),
          size: fontSize,
          font: regular,
          color: rgb(0.11, 0.12, 0.14),
          maxWidth: Math.max(1, width - 4),
        });
        break;
      }
    }
  }

  const output = await pdf.save();
  const base = sourceName.replace(/\.pdf$/i, "") || "document";
  downloadBytes(output, `${base}-annotated.pdf`);
};
