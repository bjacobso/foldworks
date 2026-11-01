import { describe, expect, it } from "vitest";

import {
  displayRectToUserSpace,
  displaySize,
  normalizeRotation,
  userSpaceToDisplayRect,
  userSpaceToPageFraction,
  type PdfPageGeometry,
} from "./page-geometry";

const letter = { x: 0, y: 0, width: 612, height: 792 };
// A crop box that trims 36 pt on the left and 72 pt at the bottom of a larger media box.
const offsetCrop = { x: 36, y: 72, width: 540, height: 648 };
const widget = { x: 100, y: 600, width: 200, height: 20 };

const geometry = (rotation: PdfPageGeometry["rotation"], cropBox = letter): PdfPageGeometry => ({
  cropBox,
  rotation,
});

describe("PDF page geometry", () => {
  it("flips y against the crop box for unrotated pages", () => {
    expect(userSpaceToDisplayRect(geometry(0), widget)).toEqual({
      x: 100,
      y: 792 - 600 - 20,
      width: 200,
      height: 20,
    });
  });

  it("subtracts the crop box origin before flipping", () => {
    expect(userSpaceToDisplayRect(geometry(0, offsetCrop), widget)).toEqual({
      x: 64,
      y: 648 - (600 - 72) - 20,
      width: 200,
      height: 20,
    });
  });

  it("turns rectangles with the page for each rotation", () => {
    expect(userSpaceToDisplayRect(geometry(90), widget)).toEqual({
      x: 600,
      y: 100,
      width: 20,
      height: 200,
    });
    expect(userSpaceToDisplayRect(geometry(180), widget)).toEqual({
      x: 312,
      y: 600,
      width: 200,
      height: 20,
    });
    expect(userSpaceToDisplayRect(geometry(270), widget)).toEqual({
      x: 172,
      y: 312,
      width: 20,
      height: 200,
    });
  });

  it("combines rotation with an offset crop box", () => {
    // Relative to the crop origin the widget sits at (64, 528).
    expect(userSpaceToDisplayRect(geometry(90, offsetCrop), widget)).toEqual({
      x: 528,
      y: 64,
      width: 20,
      height: 200,
    });
    expect(userSpaceToDisplayRect(geometry(180, offsetCrop), widget)).toEqual({
      x: 276,
      y: 528,
      width: 200,
      height: 20,
    });
    expect(userSpaceToDisplayRect(geometry(270, offsetCrop), widget)).toEqual({
      x: 100,
      y: 276,
      width: 20,
      height: 200,
    });
  });

  it("round-trips through display space for every rotation and crop", () => {
    for (const cropBox of [letter, offsetCrop]) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const page = geometry(rotation, cropBox);
        expect(displayRectToUserSpace(page, userSpaceToDisplayRect(page, widget))).toEqual(widget);
      }
    }
  });

  it("swaps the displayed size for quarter turns", () => {
    expect(displaySize(geometry(0, offsetCrop))).toEqual({ width: 540, height: 648 });
    expect(displaySize(geometry(90, offsetCrop))).toEqual({ width: 648, height: 540 });
    expect(displaySize(geometry(270, offsetCrop))).toEqual({ width: 648, height: 540 });
  });

  it("expresses overlays as fractions of the displayed page", () => {
    const fraction = userSpaceToPageFraction(geometry(90, offsetCrop), widget);
    expect(fraction.x).toBeCloseTo(528 / 648);
    expect(fraction.y).toBeCloseTo(64 / 540);
    expect(fraction.width).toBeCloseTo(20 / 648);
    expect(fraction.height).toBeCloseTo(200 / 540);
  });

  it("normalizes rectangles authored from the top-right corner", () => {
    expect(
      userSpaceToDisplayRect(geometry(0), { x: 300, y: 620, width: -200, height: -20 }),
    ).toEqual(userSpaceToDisplayRect(geometry(0), widget));
  });

  it("normalizes rotation the way PDF.js does", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(45)).toBe(0);
  });
});
