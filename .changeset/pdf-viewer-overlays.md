---
"@foldworks/pdf-annotator": minor
---

Add a read-only `PdfViewer` with page navigation, fit-width and 50–200% zoom,
download, banner and watermark slots, and render skeletons. It also takes
overlays in PDF user space, each with a tone, a status, a selected state, a
click message, and an accessible label. The viewer maps overlays through each
page's crop box and rotation, and `PdfViewer.scrollTo` brings one into view.
Export `renderPages` and `readPdfPages` as Effects, plus pure page-geometry
conversions that the annotator now shares for AcroForm import and export.
