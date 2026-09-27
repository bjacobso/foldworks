# @foldworks/pdf-annotator

A Foldkit-native PDF annotation authoring tool with controlled state, portable
JSON, AcroForm inspection and writing, custom annotation metadata, and
zoom-independent PDF geometry. It also ships a read-only `PdfViewer` with
overlay hotspots, and headless page rendering.

## UI integration

```ts
const model = PdfAnnotator.init({
  id: "agreement",
  sampleUrl: "/agreement.pdf",
});
```

Embed `model` as a submodel, wrap `PdfAnnotator.Message`, fold
`PdfAnnotator.update`, and lift `PdfAnnotator.subscriptions`. Render with
`PdfAnnotator.view` and import `@foldworks/pdf-annotator/styles.css` once.

The default UI can:

- inspect existing AcroForm text, checkbox, radio, choice, and signature
  widgets;
- create Text, Signature, Date, Checkbox, Initials, Radio, Select, Highlight,
  and Stamp annotations by dragging a palette tool onto a page;
- select, move, resize from eight handles, nudge, duplicate, lock, and delete;
- edit field names, values, required/read-only state, page and rectangle data;
- add, rename, edit, and delete custom metadata attributes;
- zoom from 25% to 400% without changing stored annotation geometry;
- inspect, replace, validate, reset, and download the complete annotation JSON;
- save field-like annotations as interactive AcroForm widgets and markup kinds
  as flattened page content.

## Read-only viewer

`PdfViewer` renders every page of a PDF to an image and adds page navigation,
zoom (fit width, or 50–200%), download, and skeletons while pages render. It
has no editing UI.

```ts
import { PdfViewer, type PdfOverlay } from "@foldworks/pdf-annotator";

const model = { viewer: PdfViewer.init({ id: "journey-pdf" }) };

// Load bytes you already hold (for example, a freshly filled form), or a URL.
foldViewer(model, PdfViewer.loadBytes("i-9.pdf", filledBytes));
foldViewer(model, PdfViewer.loadUrl("/forms/i-9.pdf"));
```

Embed the model as a submodel, wrap `PdfViewer.Message`, and fold
`PdfViewer.update` (for example with `Update.foldChild`). No subscriptions are
needed. Render it with a config object so overlays can send your own messages:

```ts
const overlays: ReadonlyArray<PdfOverlay<Message>> = widgets.map((widget) => ({
  key: widget.id,
  pageIndex: widget.pageIndex,
  rect: widget.rect, // PDF user space: bottom-left origin, as in /Rect
  label: `${widget.label}: ${widget.status}`,
  tone: widget.status === "missing" ? "danger" : "success",
  status: widget.status, // exposed as data-status for custom styling
  isSelected: widget.id === model.selectedWidgetId,
  onClick: Message.ClickedWidget({ id: widget.id }),
}));

PdfViewer.view(
  {
    model: model.viewer,
    toParentMessage: (message) => Message.GotViewerMessage({ message }),
    overlays,
    banner: Alert.view({ title: "Synthetic preview" }, h),
    watermark: "Synthetic",
  },
  h,
);
```

Overlay rectangles use PDF user space, exactly as a widget's `/Rect` stores
them. The viewer maps them through each page's crop box and `/Rotate`, so
offset crop boxes and rotated pages need no application code. Tones are
`neutral`, `info`, `success`, `warning`, `danger`, and `muted` (dashed, no
fill). Overlays with `onClick` render as toggle buttons with `aria-pressed`;
the rest are labelled images. The viewer does not decide what a status means.

To bring an overlay into view (for example, when a form field is selected in
another pane), fold `PdfViewer.scrollTo(key)`. `PdfViewer.goToPage(index)`
scrolls to a zero-based page.

Other view options: `actions` (extra toolbar controls), `label`,
`showToolbar`, `showDownload`, `emptyTitle`, and `emptyDescription`. The viewer
fills its container and scrolls internally, so give it a sized parent. Import
`@foldworks/pdf-annotator/styles.css` once; it styles both components.

### Rendering and geometry without the UI

```ts
import {
  readPdfPages,
  renderPages,
  userSpaceToDisplayRect,
  userSpaceToPageFraction,
} from "@foldworks/pdf-annotator";

// Effect<ReadonlyArray<RenderedPdfPage>, PdfRenderError>
const pages = yield * renderPages(bytes, { scale: 2 });
// pages[0].imageUrl, .width/.height (displayed points), .cropBox, .rotation

const box = userSpaceToDisplayRect(pages[0], { x: 100, y: 600, width: 200, height: 20 });
```

`renderPages` needs a browser, because it draws with canvas. `scale` is pixels
per PDF point (default 2), and `pageIndexes` limits which pages are rendered.
`readPdfPages` returns page geometry without rasterizing.
`userSpaceToDisplayRect`, `displayRectToUserSpace`, and
`userSpaceToPageFraction` are pure functions. The annotator uses the same
functions for AcroForm import and export.

## Portable JSON

JSON always uses a versioned document envelope. Unversioned arrays and legacy
normalized-coordinate formats are rejected.

```json
{
  "schemaVersion": 1,
  "annotations": [
    {
      "id": "employee-name",
      "kind": "text",
      "pageIndex": 0,
      "rect": { "x": 72, "y": 120, "width": 200, "height": 24 },
      "name": "employee_name",
      "required": true,
      "value": "Alex Morgan",
      "metadata": {
        "owner": "employee",
        "source": "hris"
      }
    }
  ],
  "metadata": {
    "template": "employee-agreement"
  }
}
```

`kind` is an open string. Unknown and host-defined kinds remain fully
round-trippable in JSON even when they do not have a PDF serializer.
`metadata` accepts any JSON-compatible values.

Rectangles are stored in page-local PDF points after display rotation, with a
top-left origin, x increasing right, and y increasing down. `pageIndex` is
zero-based. Canvas zoom and device-pixel ratio never modify the stored values.

```ts
import {
  makeAnnotationDocument,
  parseAnnotationDocument,
  queryAnnotations,
  serializeAnnotationDocument,
  updateDocumentAnnotation,
  validateAnnotationDocument,
} from "@foldworks/pdf-annotator";

const document = parseAnnotationDocument(json);
const signatures = queryAnnotations(document, { kind: "signature" });
const next = updateDocumentAnnotation(document, "employee-name", (annotation) => ({
  ...annotation,
  metadata: { ...annotation.metadata, reviewed: true },
}));
const issues = validateAnnotationDocument(next, [{ width: 612, height: 792 }]);
const output = serializeAnnotationDocument(next);
```

## Headless PDF APIs

The PDF APIs do not require the default UI:

```ts
import { extractPdfAnnotations, serializePdf } from "@foldworks/pdf-annotator";

const { annotations, warnings: importWarnings } = await extractPdfAnnotations(sourceBytes);

const { bytes, warnings: saveWarnings } = await serializePdf(sourceBytes, annotations, {
  deletedFieldNames: ["obsolete_field"],
});
```

Imported widgets retain logical-field and widget IDs in `annotation.pdf`.
Edits to supported imported fields update them in place. Removing an imported
logical field from the UI records its field name for removal during save.

Highlights and stamps are flattened intentionally. Custom kinds are JSON-only
unless a serializer is added by the host. `pdf-lib` cannot author unsigned
`/Sig` widgets through its public API, so newly authored Signature and Initials
annotations currently save as interactive text fields and return a typed
warning. Existing signature widgets are inspected and preserved; editing a
cryptographically signed PDF may invalidate its signatures.
