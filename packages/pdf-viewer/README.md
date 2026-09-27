# @foldworks/pdf-viewer

A read-only Foldkit PDF viewer composed from `@foldworks/pdf` page surfaces,
rendering, and geometry.

`PdfViewer` renders every page of a PDF to an image and adds page navigation,
zoom (fit width, or 50–200%), download, and skeletons while pages render. It
has no editing UI.

```ts
import { PdfViewer, type PdfOverlay } from "@foldworks/pdf-viewer";

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
`@foldworks/pdf-viewer/styles.css` once.

## Known behavior

- **Memory:** rendered pages are kept in the model as PNG `data:` URLs, and
  pages render one at a time, each from a fresh PDF.js session. This suits forms
  and short documents; very long documents hold every page image in memory.
- **Fit width** scales the widest page to the viewer, so all pages share one
  scale. In mixed-orientation documents, portrait pages are narrower than the
  viewer. Fit width is capped at 200% and may go below 50% in narrow viewers.
- **Overlays** also render over pages that are still loading, so `scrollTo`
  works before rendering finishes.
- **`/UserUnit`** is not applied to page sizes. Overlays still line up, but
  100% is not the physical size for such pages. See the
  [`@foldworks/pdf` limitations](../pdf/README.md#limitations).
