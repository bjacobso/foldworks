# @foldworks/pdf

## 0.2.0

### Minor Changes

- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.
- 4aba469: Add generic document-analysis building blocks: positioned PDF text and explicit quote location, multi-region passage highlights, selectable PDF text and bounded viewport rendering, overlap-safe highlighted text and context snippets, read-only graph exploration, word/sentence prose diffs, citation previews, and per-cell grid tones.

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
