import { describe, expect, it } from "vitest";

import {
  CANVAS_WIDTH,
  annotationIdFromItemId,
  annotationKindFromItemId,
  canvasHeight,
  defaultAnnotation,
  moveAnnotation,
  resizeAnnotation,
} from "./geometry";

describe("PDF annotation geometry", () => {
  it("keeps default annotations inside the page", () => {
    const annotation = defaultAnnotation("one", "Signature", 2, 0.99, 0.99);

    expect(annotation.page).toBe(2);
    expect(annotation.x + annotation.width).toBeLessThanOrEqual(1);
    expect(annotation.y + annotation.height).toBeLessThanOrEqual(1);
  });

  it("moves and resizes without crossing page bounds", () => {
    const annotation = defaultAnnotation("one", "Text", 1, 0.5, 0.5);
    const moved = moveAnnotation(annotation, annotation.x, annotation.y, -2, 2);
    const resized = resizeAnnotation(moved, 4, 4);

    expect(moved.x).toBe(0);
    expect(moved.y + moved.height).toBe(1);
    expect(resized.width).toBe(1);
    expect(resized.height).toBeCloseTo(moved.height);
  });

  it("maps page aspect ratio and drag item ids", () => {
    expect(canvasHeight(612, 792)).toBe(Math.round(CANVAS_WIDTH * 792 / 612));
    expect(annotationKindFromItemId("palette:Stamp")).toBe("Stamp");
    expect(annotationKindFromItemId("palette:Unknown")).toBeUndefined();
    expect(annotationIdFromItemId("annotation:annotation-7")).toBe("annotation-7");
  });
});
