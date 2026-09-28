# @foldworks/pdf

## 0.1.0

### Minor Changes

- dc0dbd8: Make the PDF APIs Effect-based end to end. `withPdfDocument` and
  `rasterizePage` in `@foldworks/pdf` now return Effects that fail with
  `PdfRenderError`. `withPdfDocument` releases the PDF.js worker on failure or
  interruption. The new `getPage` helper loads a zero-based page.

  **Breaking:** `extractPdfAnnotations` and `serializePdf` in
  `@foldworks/pdf-annotator` now return Effects that fail with the new
  `PdfDocumentError`. They no longer return Promises. Run them inside an Effect
  program, or call `Effect.runPromise(...)` at the edge.

- dc0dbd8: Add composable PDF page rendering, geometry, and surface primitives in
  `@foldworks/pdf`. Both the annotator and the new read-only viewer use them.
  The viewer has page navigation, fit-width and 50–200% zoom,
  download, banner and watermark slots, and render skeletons. It also takes
  overlays in PDF user space, each with a tone, a status, a selected state, a
  click message, and an accessible label. The viewer maps overlays through each
  page's crop box and rotation, and `PdfViewer.scrollTo` brings one into view.
  `renderPages` and `readPdfPages` are Effects; page-geometry conversions are pure
  and shared with AcroForm import and export.
