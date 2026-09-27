import { Data, Effect } from "effect";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { displaySize, normalizeRotation, type PdfPageGeometry } from "./page-geometry";

/** Raised when PDF.js cannot open or rasterize a document. */
export class PdfRenderError extends Data.TaggedError("PdfRenderError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * A page's geometry. `width` and `height` are the displayed size in PDF
 * points (crop box, after rotation). `pageIndex` is zero-based.
 */
export type PdfPageInfo = PdfPageGeometry &
  Readonly<{
    pageIndex: number;
    width: number;
    height: number;
  }>;

export type RenderedPdfPage = PdfPageInfo &
  Readonly<{
    /** A `data:` URL that can be used directly as an `<img>` source. */
    imageUrl: string;
    pixelWidth: number;
    pixelHeight: number;
  }>;

export type RenderPagesOptions = Readonly<{
  /** Pixels per PDF point. Defaults to 2 so pages stay sharp up to 150% zoom on high-density screens. */
  scale?: number;
  /** Zero-based pages to render. Defaults to every page, in order. */
  pageIndexes?: ReadonlyArray<number>;
  imageType?: "image/png" | "image/jpeg" | "image/webp";
}>;

export const DEFAULT_RENDER_SCALE = 2;

const failureReason = (error: unknown): string =>
  error instanceof Error ? error.message : "The PDF could not be rendered.";

const tryPdf = <A>(run: () => PromiseLike<A>): Effect.Effect<A, PdfRenderError> =>
  Effect.tryPromise({
    try: async () => run(),
    catch: (cause) => new PdfRenderError({ reason: failureReason(cause), cause }),
  });

/**
 * Open a document with PDF.js, run `use`, and always release the worker, even
 * when `use` fails or is interrupted.
 */
export const withPdfDocument = <A, E, R>(
  bytes: Uint8Array,
  use: (document: PDFDocumentProxy) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PdfRenderError, R> =>
  Effect.acquireUseRelease(
    tryPdf(async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      // PDF.js transfers the supplied buffer to its worker. Keep the caller's
      // source bytes intact for page changes, extraction, and export.
      return pdfjs.getDocument({ data: bytes.slice() });
    }),
    (loadingTask) => tryPdf(() => loadingTask.promise).pipe(Effect.flatMap(use)),
    (loadingTask) => Effect.promise(() => loadingTask.destroy()),
  );

/** Load a zero-based page, failing with a `PdfRenderError` when it does not exist. */
export const getPage = (
  document: PDFDocumentProxy,
  pageIndex: number,
): Effect.Effect<PDFPageProxy, PdfRenderError> =>
  !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.numPages
    ? Effect.fail(
        new PdfRenderError({
          reason: `Page ${pageIndex + 1} does not exist; the document has ${document.numPages}.`,
        }),
      )
    : tryPdf(() => document.getPage(pageIndex + 1));

export const pageInfo = (page: PDFPageProxy, pageIndex: number): PdfPageInfo => {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;
  const geometry: PdfPageGeometry = {
    cropBox: {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    },
    rotation: normalizeRotation(page.rotate),
  };
  return { ...geometry, ...displaySize(geometry), pageIndex };
};

export type PageRaster = Readonly<{ imageUrl: string; pixelWidth: number; pixelHeight: number }>;

/** Draw one page to a canvas and encode it. Requires a browser (canvas) environment. */
export const rasterizePage = (
  page: PDFPageProxy,
  scale: number,
  imageType: RenderPagesOptions["imageType"] = "image/png",
): Effect.Effect<PageRaster, PdfRenderError> =>
  tryPdf(async () => {
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("Canvas rendering is not available.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return {
      imageUrl: canvas.toDataURL(imageType),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    };
  });

const allPageIndexes = (document: PDFDocumentProxy): ReadonlyArray<number> =>
  Array.from({ length: document.numPages }, (_, index) => index);

/** Read every page's crop box, rotation, and displayed size without rasterizing. */
export const readPdfPages = (
  bytes: Uint8Array,
): Effect.Effect<ReadonlyArray<PdfPageInfo>, PdfRenderError> =>
  withPdfDocument(bytes, (document) =>
    Effect.forEach(allPageIndexes(document), (pageIndex) =>
      getPage(document, pageIndex).pipe(Effect.map((page) => pageInfo(page, pageIndex))),
    ),
  );

/**
 * Rasterize PDF pages to images with PDF.js. Pages render one at a time from a
 * single parsed document. Requires a browser (canvas) environment.
 */
export const renderPages = (
  bytes: Uint8Array,
  options: RenderPagesOptions = {},
): Effect.Effect<ReadonlyArray<RenderedPdfPage>, PdfRenderError> =>
  withPdfDocument(bytes, (document) => {
    const scale =
      options.scale !== undefined && Number.isFinite(options.scale) && options.scale > 0
        ? options.scale
        : DEFAULT_RENDER_SCALE;
    return Effect.forEach(options.pageIndexes ?? allPageIndexes(document), (pageIndex) =>
      Effect.gen(function* () {
        const page = yield* getPage(document, pageIndex);
        const raster = yield* rasterizePage(page, scale, options.imageType);
        return { ...pageInfo(page, pageIndex), ...raster };
      }),
    );
  });
