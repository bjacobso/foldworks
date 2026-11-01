# foldworks/pdf-viewer

A read-only Foldkit PDF viewer composed from `foldworks/pdf` page surfaces,
rendering, and geometry. It needs the optional `pdfjs-dist` peer:
`pnpm add pdfjs-dist`.

`PdfViewer` renders pages near the viewport and adds page navigation,
zoom (fit width, or 50–200%), download, and skeletons while pages render. It
has no editing UI.

```ts
import { PdfViewer, type PdfOverlay } from "foldworks/pdf-viewer";

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
`foldworks/pdf-viewer/styles.css` once.

## Passage highlights and selection

```ts
PdfViewer.view(
  {
    model: model.viewer,
    toParentMessage: (message) => Message.GotViewerMessage({ message }),
    highlights: [
      {
        key: "evidence",
        label: "Schedule bidding evidence",
        regions: location.regions, // from locateQuote, native selection, or OCR
        tone: "warning",
        isSelected: model.selectedId === "evidence",
        onClick: Message.SelectedEvidence({ id: "evidence" }),
      },
    ],
    selectableText: true,
    onSelectText: (selection) => Message.SelectedPdfText({ selection }),
  },
  h,
);
```

`PdfHighlight` accepts several rectangles per page and several pages per
passage. Its first rectangle is the single accessible toggle button; the other
rectangles paint the same selection and dispatch the same activation message.
Keys must be unique across highlights and single-rectangle overlays, and each
page should appear once in `regions`. `scrollTo(key)` finds the first rectangle.
Existing boxed `PdfOverlay` inputs keep their behavior.

`selectableText` mounts PDF.js' transparent native text layer, including font
metrics and rotation. On pointer release or keyboard selection, `onSelectText`
receives `{ text, regions: [{ pageIndex, rects }] }` with user-space rectangles.
Selections must start and end in this viewer's text layers. Selection is not
persisted by the viewer. Without a callback, the same data travels through
`Message.SelectedText` for the host to intercept. Scanned pages need OCR from
the host and have no selectable text. Highlights can intercept pointer presses;
selection can begin outside them, or the host can temporarily hide highlights.

See the [document-analysis demo](https://foldworks.dev/document-analysis) for a
cross-page passage, linked transcript, and a 12-page bounded-cache example.

## Known behavior

- **Memory:** at most `maxCachedPages` page images (default 8, minimum 1) are
  retained as PNG `data:` URLs. A mounted viewer opens one shared PDF.js document
  for sequential rendering and releases it on document replacement or unmount.
  Page geometry is inspected separately before rendering. Pages within one
  viewport height of the scroller are prioritized by distance to its center.
  Offscreen cache entries are evicted first, using least-recently-used order;
  evicted pages render again when revisited. Text layers are released with their
  page images. All page placeholders and geometry remain mounted, so this bounds
  raster/text-layer memory, not the number of page wrappers or the source bytes.
  A very small cache may leave some visible pages pending; set it large enough
  for your viewport. Rendering requires the view to be mounted.
- **Fit width** scales the widest page to the viewer, so all pages share one
  scale. In mixed-orientation documents, portrait pages are narrower than the
  viewer. Fit width is capped at 200% and may go below 50% in narrow viewers.
- **Overlays** also render over pages that are still loading, so `scrollTo`
  works before rendering finishes.
- **`/UserUnit`** is not applied to page sizes. Overlays still line up, but
  100% is not the physical size for such pages. See the
  [`foldworks/pdf` limitations](../pdf/README.md#limitations).
