import type { PdfRect } from "./model";

/** Page rotation, normalized to the four angles PDF viewers display. */
export type PdfPageRotation = 0 | 90 | 180 | 270;

/**
 * Where a page's visible region sits in PDF user space and how it is turned.
 * `cropBox` uses the PDF convention: bottom-left origin, y increasing up.
 */
export type PdfPageGeometry = Readonly<{
  cropBox: PdfRect;
  rotation: PdfPageRotation;
}>;

export type PdfDisplaySize = Readonly<{ width: number; height: number }>;

/** Mirror PDF.js: angles that are not a multiple of 90 display unrotated. */
export const normalizeRotation = (angle: number): PdfPageRotation => {
  const normalized = ((angle % 360) + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
};

/** Accept rectangles authored from any corner, as PDF `/Rect` arrays allow. */
export const normalizeRect = (rect: PdfRect): PdfRect => ({
  x: Math.min(rect.x, rect.x + rect.width),
  y: Math.min(rect.y, rect.y + rect.height),
  width: Math.abs(rect.width),
  height: Math.abs(rect.height),
});

/** Size of the page as displayed, in PDF points, after rotation. */
export const displaySize = (geometry: PdfPageGeometry): PdfDisplaySize =>
  geometry.rotation === 90 || geometry.rotation === 270
    ? { width: geometry.cropBox.height, height: geometry.cropBox.width }
    : { width: geometry.cropBox.width, height: geometry.cropBox.height };

/**
 * Convert a PDF user-space rectangle (bottom-left origin, as stored in widget
 * `/Rect` entries) to displayed page points: top-left origin, y increasing
 * down, measured from the crop box after page rotation.
 */
export const userSpaceToDisplayRect = (geometry: PdfPageGeometry, rect: PdfRect): PdfRect => {
  const crop = geometry.cropBox;
  const raw = normalizeRect(rect);
  const x = raw.x - crop.x;
  const y = raw.y - crop.y;
  switch (geometry.rotation) {
    case 90:
      return { x: y, y: x, width: raw.height, height: raw.width };
    case 180:
      return {
        x: crop.width - x - raw.width,
        y,
        width: raw.width,
        height: raw.height,
      };
    case 270:
      return {
        x: crop.height - y - raw.height,
        y: crop.width - x - raw.width,
        width: raw.height,
        height: raw.width,
      };
    default:
      return {
        x,
        y: crop.height - y - raw.height,
        width: raw.width,
        height: raw.height,
      };
  }
};

/** Inverse of {@link userSpaceToDisplayRect}. */
export const displayRectToUserSpace = (geometry: PdfPageGeometry, rect: PdfRect): PdfRect => {
  const crop = geometry.cropBox;
  switch (geometry.rotation) {
    case 90:
      return {
        x: crop.x + rect.y,
        y: crop.y + rect.x,
        width: rect.height,
        height: rect.width,
      };
    case 180:
      return {
        x: crop.x + crop.width - rect.x - rect.width,
        y: crop.y + rect.y,
        width: rect.width,
        height: rect.height,
      };
    case 270:
      return {
        x: crop.x + crop.width - rect.y - rect.height,
        y: crop.y + crop.height - rect.x - rect.width,
        width: rect.height,
        height: rect.width,
      };
    default:
      return {
        x: crop.x + rect.x,
        y: crop.y + crop.height - rect.y - rect.height,
        width: rect.width,
        height: rect.height,
      };
  }
};

/**
 * Express a user-space rectangle as fractions (0–1) of the displayed page, so
 * it can be positioned with percentages at any zoom or render resolution.
 */
export const userSpaceToPageFraction = (geometry: PdfPageGeometry, rect: PdfRect): PdfRect => {
  const size = displaySize(geometry);
  const display = userSpaceToDisplayRect(geometry, rect);
  return {
    x: size.width === 0 ? 0 : display.x / size.width,
    y: size.height === 0 ? 0 : display.y / size.height,
    width: size.width === 0 ? 0 : display.width / size.width,
    height: size.height === 0 ? 0 : display.height / size.height,
  };
};
