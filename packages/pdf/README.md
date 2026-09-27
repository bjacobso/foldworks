# @foldworks/pdf

PDF building blocks for Foldkit applications. This package contains no toolbar,
annotation schema, or field semantics. Use it to compose a viewer, an annotation
editor, a review surface, or another PDF interface.

| Primitive          | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `readPdfPages`     | Read each page's visible crop box, rotation, and displayed size.            |
| `renderPages`      | Rasterize all or selected pages.                                            |
| `pageSurface`      | Render a page-sized layer with application supplied content and attributes. |
| `overlayPosition`  | Place a PDF user-space rectangle on that layer with CSS percentages.        |
| Geometry functions | Convert between PDF user space and displayed page points.                   |

The PDF.js document APIs and `pageSurface` are intended for browser use.
Geometry functions are pure.

```ts
import { Effect } from "effect";
import { overlayPosition, pageSurface, renderPages } from "@foldworks/pdf";

const firstPage = Effect.gen(function* () {
  const [page] = yield* renderPages(bytes, { scale: 2, pageIndexes: [0] });
  return { page, position: overlayPosition(page, widgetRect) };
});

// Later, in a view, with `page` from the result:
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

## Effects and errors

Every document API is an Effect that fails with a typed `PdfRenderError`
(`{ reason, cause }`). There are no Promise variants, so the APIs compose
directly inside Foldkit Commands.

- `readPdfPages(bytes)` and `renderPages(bytes, options)` open the document
  once, then read or rasterize pages in order.
- `withPdfDocument(bytes, use)` opens a document for your own Effect. It uses
  `Effect.acquireUseRelease`, so the PDF.js worker is released even when `use`
  fails or is interrupted.
- `getPage(document, pageIndex)` loads a zero-based page and fails with a
  `PdfRenderError` for an index that does not exist.
- `rasterizePage(page, scale, imageType)` draws one page and returns a
  `data:` URL with its pixel size.

## Limitations

- **`/UserUnit` is not applied to page sizes.** Page `width`, `height`, and
  `cropBox` are read from the page's view box in user-space units, as if each
  unit were one point. PDF.js does apply `/UserUnit` when it rasterizes, so for
  a page with `/UserUnit` other than 1:
  - overlays and `overlayPosition` still line up, because they are placed as
    fractions of the page;
  - "100%" in a viewer shows the page at its unit count, not its physical size;
  - `renderPages` produces `scale × UserUnit` pixels per unit, so large
    `/UserUnit` values can create very large canvases. Check `pixelWidth` or
    lower `scale` if that matters.

  `/UserUnit` is rare outside large-format drawings.

The ready-made [`@foldworks/pdf-viewer`](../pdf-viewer) and
[`@foldworks/pdf-annotator`](../pdf-annotator) compose these primitives.
