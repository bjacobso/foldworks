---
"@foldworks/pdf": minor
"@foldworks/pdf-annotator": minor
---

Make the PDF APIs Effect-based end to end. `withPdfDocument` and
`rasterizePage` in `@foldworks/pdf` now return Effects that fail with
`PdfRenderError`. `withPdfDocument` releases the PDF.js worker on failure or
interruption. The new `getPage` helper loads a zero-based page.

**Breaking:** `extractPdfAnnotations` and `serializePdf` in
`@foldworks/pdf-annotator` now return Effects that fail with the new
`PdfDocumentError`. They no longer return Promises. Run them inside an Effect
program, or call `Effect.runPromise(...)` at the edge.
