# @foldworks/pdf

PDF building blocks for Foldkit applications. This package contains no toolbar,
annotation schema, or field semantics. Use it to compose a viewer, an annotation
editor, a review surface, or another PDF interface.

| Primitive          | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `readPdfPages`     | Read each page's visible crop box, rotation, and displayed size.            |
| `renderPages`      | Rasterize all or selected pages as an Effect.                               |
| `pageSurface`      | Render a page-sized layer with application supplied content and attributes. |
| `overlayPosition`  | Place a PDF user-space rectangle on that layer with CSS percentages.        |
| Geometry functions | Convert between PDF user space and displayed page points.                   |

The PDF.js document APIs and `pageSurface` are intended for browser use.
Geometry functions are pure.

```ts
import { overlayPosition, pageSurface, renderPages } from "@foldworks/pdf";

const [page] = yield * renderPages(bytes, { scale: 2, pageIndexes: [0] });
const position = overlayPosition(page, widgetRect);

pageSurface(
  {
    key: "page-0",
    pageIndex: page.pageIndex,
    width: page.width,
    height: page.height,
    displayWidth: 612,
    label: "Page 1",
    content: [imageView, overlayView],
  },
  h,
);
```

`PdfRect` is a shape only; the calling API defines its coordinate space. For
`overlayPosition`, `widgetRect` is in PDF user space (bottom-left origin), as
stored in a widget `/Rect`. `pageSurface` uses displayed page dimensions after
crop and rotation. `userSpaceToDisplayRect` and `displayRectToUserSpace` convert
between that user space and top-left displayed page points. They account for
offset crop boxes and quarter-turn rotations.

The ready-made [`@foldworks/pdf-viewer`](../pdf-viewer) and
[`@foldworks/pdf-annotator`](../pdf-annotator) compose these primitives.
