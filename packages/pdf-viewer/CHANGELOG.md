# @foldworks/pdf-viewer

## 0.1.1

### Patch Changes

- Updated dependencies [0d75dc8]
- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
  - @foldworks/ui@0.3.0

## 0.1.0

### Minor Changes

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
