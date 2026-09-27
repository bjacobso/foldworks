---
"@foldworks/pdf": minor
"@foldworks/pdf-viewer": minor
"@foldworks/pdf-annotator": minor
---

Add composable PDF page rendering, geometry, and surface primitives in
`@foldworks/pdf`. Both the annotator and the new read-only viewer use them.
The viewer has page navigation, fit-width and 50–200% zoom,
download, banner and watermark slots, and render skeletons. It also takes
overlays in PDF user space, each with a tone, a status, a selected state, a
click message, and an accessible label. The viewer maps overlays through each
page's crop box and rotation, and `PdfViewer.scrollTo` brings one into view.
`renderPages` and `readPdfPages` are Effects; page-geometry conversions are pure
and shared with AcroForm import and export.
