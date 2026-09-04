# @foldworks/pdf-annotator

A Foldkit-native PDF annotation canvas with declarative interaction state.

It supports PDF upload and file drop, multi-page previews, text, typed
signatures, dates, checkmarks, highlights, stamps, pointer dragging, resizing,
keyboard nudging and deletion, and flattened PDF download.

```ts
const model = PdfAnnotator.init({
  id: "agreement",
  sampleUrl: "/agreement.pdf",
})
```

Embed `model` as a submodel, wrap `PdfAnnotator.Message`, fold
`PdfAnnotator.update`, and lift `PdfAnnotator.subscriptions`. Render with
`PdfAnnotator.view` and import `@foldworks/pdf-annotator/styles.css` once.

Annotation rectangles are stored as normalized page coordinates. This keeps
pointer interaction independent of display density and maps directly to PDF
page points during export. Export is intentionally flattened: the original
pages remain unchanged and each annotation is painted into a newly downloaded
PDF.
