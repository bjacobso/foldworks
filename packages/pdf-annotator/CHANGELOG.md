# @foldworks/pdf-annotator

## 0.2.1

### Patch Changes

- Updated dependencies [0d75dc8]
- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
  - @foldworks/ui@0.3.0

## 0.2.0

### Minor Changes

- cfeffc6: Add versioned annotation-document JSON APIs, canonical PDF-point geometry,
  existing AcroForm inspection, interactive AcroForm serialization, open custom
  kinds and metadata, eight-handle resizing, duplication, lock/read-only and
  required properties, JSON editing and download, and zoom-aware editing from
  25% to 400%.
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

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
- Updated dependencies [6e05824]
- Updated dependencies [c7b54c5]
- Updated dependencies [ff6f731]
- Updated dependencies [4db505c]
- Updated dependencies [61cf008]
- Updated dependencies [e071f6a]
- Updated dependencies [473c187]
- Updated dependencies [3227682]
- Updated dependencies [05759a5]
- Updated dependencies [69b5b21]
- Updated dependencies [e768f17]
- Updated dependencies [dc0dbd8]
- Updated dependencies [dc0dbd8]
- Updated dependencies [a974220]
- Updated dependencies [140b35f]
- Updated dependencies [c049320]
- Updated dependencies [398d432]
- Updated dependencies [de1cbea]
- Updated dependencies [05217a5]
- Updated dependencies [c42f7c0]
- Updated dependencies [7c9ef65]
- Updated dependencies [1a632ef]
- Updated dependencies [15f9d0a]
- Updated dependencies [1015b7a]
  - @foldworks/ui@0.2.0
  - @foldworks/pdf@0.1.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.

### Patch Changes

- Updated dependencies
  - @foldworks/ui@0.1.0
