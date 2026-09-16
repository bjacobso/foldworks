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
  it("creates canonical point rectangles inside the page", () => {
    const annotation = defaultAnnotation("one", "signature", 1, 612, 792, 610, 790);

    expect(annotation.pageIndex).toBe(1);
    expect(annotation.rect.x + annotation.rect.width).toBeLessThanOrEqual(612);
    expect(annotation.rect.y + annotation.rect.height).toBeLessThanOrEqual(792);
    expect(annotation.rect.width).toBe(200);
  });

  it("moves and resizes every edge without crossing page bounds", () => {
    const annotation = defaultAnnotation("one", "text", 0, 612, 792, 306, 396);
    const moved = moveAnnotation(
      annotation,
      annotation.rect.x,
      annotation.rect.y,
      -1_000,
      1_000,
      612,
      792,
    );
    const resized = resizeAnnotation(
      moved,
      "north-west",
      moved.rect,
      -1_000,
      -1_000,
      612,
      792,
    );

    expect(moved.rect.x).toBe(0);
    expect(moved.rect.y + moved.rect.height).toBe(792);
    expect(resized.rect.x).toBe(0);
    expect(resized.rect.y).toBe(0);
    expect(resized.rect.width).toBe(moved.rect.width);
    expect(resized.rect.height).toBe(792);
  });

  it("maps page aspect ratio and drag item IDs", () => {
    expect(canvasHeight(612, 792)).toBe(Math.round(CANVAS_WIDTH * 792 / 612));
    expect(annotationKindFromItemId("palette:stamp")).toBe("stamp");
    expect(annotationKindFromItemId("palette:custom")).toBeUndefined();
    expect(annotationIdFromItemId("annotation:annotation-7")).toBe("annotation-7");
  });
});
