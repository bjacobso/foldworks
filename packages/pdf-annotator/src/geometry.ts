import type { Annotation, AnnotationKind } from "./model";

export const CANVAS_WIDTH = 720;
export const MIN_WIDTH = 0.055;
export const MIN_HEIGHT = 0.025;

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const canvasHeight = (pageWidth: number, pageHeight: number): number =>
  Math.round(CANVAS_WIDTH * pageHeight / pageWidth);

export const defaultAnnotation = (
  id: string,
  kind: AnnotationKind,
  page: number,
  x: number,
  y: number,
): Annotation => {
  const defaults: Record<AnnotationKind, Pick<Annotation, "width" | "height" | "value">> = {
    Text: { width: 0.28, height: 0.052, value: "Add text" },
    Signature: { width: 0.30, height: 0.072, value: "Alex Morgan" },
    Date: { width: 0.20, height: 0.048, value: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date()) },
    Checkmark: { width: 0.065, height: 0.05, value: "Checked" },
    Highlight: { width: 0.34, height: 0.035, value: "Highlight" },
    Stamp: { width: 0.19, height: 0.07, value: "APPROVED" },
  };
  const shape = defaults[kind];
  return {
    id,
    kind,
    page,
    x: clamp(x - shape.width / 2, 0, 1 - shape.width),
    y: clamp(y - shape.height / 2, 0, 1 - shape.height),
    ...shape,
  };
};

export const moveAnnotation = (
  annotation: Annotation,
  originX: number,
  originY: number,
  deltaX: number,
  deltaY: number,
): Annotation => ({
  ...annotation,
  x: clamp(originX + deltaX, 0, 1 - annotation.width),
  y: clamp(originY + deltaY, 0, 1 - annotation.height),
});

export const resizeAnnotation = (
  annotation: Annotation,
  width: number,
  height: number,
): Annotation => ({
  ...annotation,
  width: clamp(width, MIN_WIDTH, 1 - annotation.x),
  height: clamp(height, MIN_HEIGHT, 1 - annotation.y),
});

export const annotationKindFromItemId = (itemId: string): AnnotationKind | undefined => {
  if (!itemId.startsWith("palette:")) return undefined;
  const candidate = itemId.slice("palette:".length);
  return (["Text", "Signature", "Date", "Checkmark", "Highlight", "Stamp"] as const)
    .find((kind) => kind === candidate);
};

export const annotationIdFromItemId = (itemId: string): string | undefined =>
  itemId.startsWith("annotation:") ? itemId.slice("annotation:".length) : undefined;
