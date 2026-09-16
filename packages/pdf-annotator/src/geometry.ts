import type {
  Annotation,
  BuiltInAnnotationKind,
  PdfRect,
  ResizeHandle,
} from "./model";

export const CANVAS_WIDTH = 720;

const builtInKinds = [
  "text",
  "signature",
  "date",
  "checkbox",
  "initials",
  "radio",
  "select",
  "highlight",
  "stamp",
] as const satisfies ReadonlyArray<BuiltInAnnotationKind>;

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const canvasHeight = (pageWidth: number, pageHeight: number): number =>
  Math.round(CANVAS_WIDTH * pageHeight / pageWidth);

const annotationDefaults: Readonly<Record<
  BuiltInAnnotationKind,
  Readonly<{ width: number; height: number; value: SizableValue; name: string }>
>> = {
  text: { width: 200, height: 24, value: "", name: "text" },
  signature: { width: 200, height: 50, value: "", name: "signature" },
  date: { width: 120, height: 24, value: "", name: "date" },
  checkbox: { width: 20, height: 20, value: false, name: "checkbox" },
  initials: { width: 80, height: 40, value: "", name: "initials" },
  radio: { width: 20, height: 20, value: "option", name: "radio" },
  select: { width: 160, height: 24, value: "", name: "select" },
  highlight: { width: 200, height: 18, value: "", name: "highlight" },
  stamp: { width: 120, height: 42, value: "APPROVED", name: "stamp" },
};

type SizableValue = string | boolean;

const minimumSize = (kind: string): Readonly<{ width: number; height: number }> => {
  if (kind === "checkbox" || kind === "radio") return { width: 12, height: 12 };
  if (kind === "signature" || kind === "initials") return { width: 40, height: 20 };
  return { width: 28, height: 12 };
};

export const defaultAnnotation = (
  id: string,
  kind: BuiltInAnnotationKind,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  centerX: number,
  centerY: number,
): Annotation => {
  const defaults = annotationDefaults[kind];
  const width = Math.min(pageWidth, defaults.width);
  const height = Math.min(pageHeight, defaults.height);
  return {
    id,
    kind,
    pageIndex,
    rect: {
      x: clamp(centerX - width / 2, 0, pageWidth - width),
      y: clamp(centerY - height / 2, 0, pageHeight - height),
      width,
      height,
    },
    name: `${defaults.name}_${id.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    required: false,
    readOnly: false,
    locked: false,
    value: kind === "date" && typeof Intl !== "undefined"
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date())
      : defaults.value,
    metadata: kind === "select" ? { options: [] } : {},
    pdf: { source: "authored" },
  };
};

export const moveAnnotation = (
  annotation: Annotation,
  originX: number,
  originY: number,
  deltaX: number,
  deltaY: number,
  pageWidth: number,
  pageHeight: number,
): Annotation => ({
  ...annotation,
  rect: {
    ...annotation.rect,
    x: clamp(originX + deltaX, 0, pageWidth - annotation.rect.width),
    y: clamp(originY + deltaY, 0, pageHeight - annotation.rect.height),
  },
});

export const resizeAnnotation = (
  annotation: Annotation,
  handle: ResizeHandle,
  origin: PdfRect,
  deltaX: number,
  deltaY: number,
  pageWidth: number,
  pageHeight: number,
): Annotation => {
  const minimum = minimumSize(annotation.kind);
  const movesWest = handle === "west" || handle === "north-west" || handle === "south-west";
  const movesEast = handle === "east" || handle === "north-east" || handle === "south-east";
  const movesNorth = handle === "north" || handle === "north-west" || handle === "north-east";
  const movesSouth = handle === "south" || handle === "south-west" || handle === "south-east";
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;

  if (movesWest) left = clamp(origin.x + deltaX, 0, right - minimum.width);
  if (movesEast) right = clamp(right + deltaX, left + minimum.width, pageWidth);
  if (movesNorth) top = clamp(origin.y + deltaY, 0, bottom - minimum.height);
  if (movesSouth) bottom = clamp(bottom + deltaY, top + minimum.height, pageHeight);

  return {
    ...annotation,
    rect: { x: left, y: top, width: right - left, height: bottom - top },
  };
};

export const annotationKindFromItemId = (itemId: string): BuiltInAnnotationKind | undefined => {
  if (!itemId.startsWith("palette:")) return undefined;
  const candidate = itemId.slice("palette:".length);
  return builtInKinds.find((kind) => kind === candidate);
};

export const annotationIdFromItemId = (itemId: string): string | undefined =>
  itemId.startsWith("annotation:") ? itemId.slice("annotation:".length) : undefined;
