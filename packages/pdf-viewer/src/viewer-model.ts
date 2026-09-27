import { Schema as S } from "effect";
import { defineTaggedUnion } from "foldkit/schema";
import { DEFAULT_RENDER_SCALE, PdfRect } from "@foldworks/pdf";

export const PdfPageRotation = S.Literals([0, 90, 180, 270]);
export type PdfPageRotation = typeof PdfPageRotation.Type;

export const PageImage = defineTaggedUnion({
  Pending: {},
  Rendered: { url: S.String },
  Failed: { reason: S.String },
});
export type PageImage = typeof PageImage.Type;

/** A page's geometry plus its raster. `width`/`height` are displayed PDF points. */
export const ViewerPage = S.Struct({
  pageIndex: S.Number,
  width: S.Number,
  height: S.Number,
  cropBox: PdfRect,
  rotation: PdfPageRotation,
  image: PageImage,
});
export type ViewerPage = typeof ViewerPage.Type;

export const PageInfo = S.Struct({
  pageIndex: S.Number,
  width: S.Number,
  height: S.Number,
  cropBox: PdfRect,
  rotation: PdfPageRotation,
});
export type PageInfo = typeof PageInfo.Type;

export const ViewerDocument = defineTaggedUnion({
  Empty: {},
  Loading: { name: S.String },
  Failed: { name: S.String, reason: S.String },
  Ready: {
    name: S.String,
    bytesBase64: S.String,
    pages: S.Array(ViewerPage),
  },
});
export type ViewerDocument = typeof ViewerDocument.Type;

export const Zoom = defineTaggedUnion({
  FitWidth: {},
  Percent: { percent: S.Number },
});
export type Zoom = typeof Zoom.Type;

export const Model = S.Struct({
  id: S.String,
  document: ViewerDocument,
  /** Increments on every load so late results from an earlier document are ignored. */
  revision: S.Number,
  renderScale: S.Number,
  zoom: Zoom,
  viewportWidth: S.Number,
  currentPageIndex: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  /** `"fit-width"` (default) or a percentage between 50 and 200. */
  zoom?: "fit-width" | number;
  /** Pixels per PDF point used when rasterizing pages. Defaults to 2. */
  renderScale?: number;
}>;

export const MIN_ZOOM_PERCENT = 50;
export const MAX_ZOOM_PERCENT = 200;
export const ZOOM_STEPS: ReadonlyArray<number> = [50, 75, 100, 125, 150, 175, 200];
/** CSS pixels per PDF point at 100%, matching PDF.js and print size. */
export const CSS_PIXELS_PER_POINT = 96 / 72;
/** Horizontal breathing room around pages inside the scroller, in CSS pixels. */
export const PAGE_GUTTER = 24;

export const clampZoomPercent = (percent: number): number =>
  Number.isFinite(percent)
    ? Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, Math.round(percent)))
    : 100;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  document: ViewerDocument.Empty(),
  revision: 0,
  renderScale:
    config.renderScale !== undefined &&
    Number.isFinite(config.renderScale) &&
    config.renderScale > 0
      ? config.renderScale
      : DEFAULT_RENDER_SCALE,
  zoom:
    config.zoom === undefined || config.zoom === "fit-width"
      ? Zoom.FitWidth()
      : Zoom.Percent({ percent: clampZoomPercent(config.zoom) }),
  viewportWidth: 0,
  currentPageIndex: 0,
  announcement: "",
});

export const pagesOf = (model: Model): ReadonlyArray<ViewerPage> =>
  model.document._tag === "Ready" ? model.document.pages : [];

/**
 * The zoom actually applied, as a percentage. Fit width scales the widest page
 * to the measured scroller, up to 200%; before the first measurement it falls
 * back to 100%. Narrow scrollers may fit below the 50% manual minimum.
 */
export const effectiveZoomPercent = (model: Model): number => {
  if (model.zoom._tag === "Percent") return model.zoom.percent;
  const widest = Math.max(0, ...pagesOf(model).map((page) => page.width));
  const available = model.viewportWidth - PAGE_GUTTER * 2;
  if (widest === 0 || available <= 0) return 100;
  return Math.min(MAX_ZOOM_PERCENT, (available / (widest * CSS_PIXELS_PER_POINT)) * 100);
};

/** Rendered page width in CSS pixels at the current zoom. */
export const pageDisplayWidth = (model: Model, page: Pick<ViewerPage, "width">): number =>
  (page.width * CSS_PIXELS_PER_POINT * effectiveZoomPercent(model)) / 100;

export const nextZoomStep = (percent: number, direction: "in" | "out"): number => {
  const current = Math.round(percent);
  const step =
    direction === "in"
      ? ZOOM_STEPS.find((candidate) => candidate > current)
      : [...ZOOM_STEPS].reverse().find((candidate) => candidate < current);
  return step ?? (direction === "in" ? MAX_ZOOM_PERCENT : MIN_ZOOM_PERCENT);
};

/** Next page still waiting for a raster, starting at `fromIndex` and wrapping. */
export const nextPendingPageIndex = (
  pages: ReadonlyArray<ViewerPage>,
  fromIndex: number,
): number | undefined => {
  for (let offset = 0; offset < pages.length; offset += 1) {
    const page = pages[(fromIndex + offset) % pages.length];
    if (page?.image._tag === "Pending") return page.pageIndex;
  }
  return undefined;
};
