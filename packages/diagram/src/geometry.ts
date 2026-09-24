export type Point = Readonly<{ x: number; y: number }>;
export type Dimensions = Readonly<{ width: number; height: number }>;
export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type Side = "Top" | "Right" | "Bottom" | "Left";
export type Insets = Readonly<{ top: number; right: number; bottom: number; left: number }>;

export const addPoints = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

export const subtractPoints = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

export const scalePoint = (point: Point, factor: number): Point => ({
  x: point.x * factor,
  y: point.y * factor,
});

export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

export const rectCenter = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const translateRect = (rect: Rect, delta: Point): Rect => ({
  ...rect,
  x: rect.x + delta.x,
  y: rect.y + delta.y,
});

export const rectContains = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const rectContainsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export const unionRects = (rects: ReadonlyArray<Rect>): Rect | undefined => {
  const first = rects[0];
  if (first === undefined) return undefined;
  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;
  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const insets = (value: number | Partial<Insets>): Insets =>
  typeof value === "number"
    ? { top: value, right: value, bottom: value, left: value }
    : {
        top: value.top ?? 0,
        right: value.right ?? 0,
        bottom: value.bottom ?? 0,
        left: value.left ?? 0,
      };

export const expandRect = (rect: Rect, padding: number | Partial<Insets>): Rect => {
  const { top, right, bottom, left } = insets(padding);
  return {
    x: rect.x - left,
    y: rect.y - top,
    width: rect.width + left + right,
    height: rect.height + top + bottom,
  };
};

/** Returns the point where a ray from the rectangle's center toward `toward`
 *  leaves the rectangle. A target at the center returns the center. */
export const boundaryPoint = (rect: Rect, toward: Point): Point => {
  const center = rectCenter(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy),
  );
  return { x: center.x + dx * scale, y: center.y + dy * scale };
};

export const sidePoint = (rect: Rect, side: Side, offset = 0.5): Point => {
  switch (side) {
    case "Top":
      return { x: rect.x + rect.width * offset, y: rect.y };
    case "Right":
      return { x: rect.x + rect.width, y: rect.y + rect.height * offset };
    case "Bottom":
      return { x: rect.x + rect.width * offset, y: rect.y + rect.height };
    case "Left":
      return { x: rect.x, y: rect.y + rect.height * offset };
  }
};

export const sideFacing = (rect: Rect, point: Point): Side => {
  const center = rectCenter(rect);
  const dx = (point.x - center.x) / Math.max(rect.width, 1);
  const dy = (point.y - center.y) / Math.max(rect.height, 1);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "Right" : "Left";
  return dy >= 0 ? "Bottom" : "Top";
};

export const sideNormal = (side: Side): Point => {
  switch (side) {
    case "Top":
      return { x: 0, y: -1 };
    case "Right":
      return { x: 1, y: 0 };
    case "Bottom":
      return { x: 0, y: 1 };
    case "Left":
      return { x: -1, y: 0 };
  }
};

/** Returns the point at `fraction` (0–1) of a polyline's length. */
export const pointAlongPolyline = (
  points: ReadonlyArray<Point>,
  fraction: number,
): Point | undefined => {
  const first = points[0];
  if (first === undefined) return undefined;
  const lengths = points.slice(1).map((point, index) => distance(points[index] ?? point, point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return first;
  let remaining = total * Math.min(1, Math.max(0, fraction));
  for (const [index, length] of lengths.entries()) {
    const start = points[index];
    const end = points[index + 1];
    if (start === undefined || end === undefined) continue;
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length;
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
    }
    remaining -= length;
  }
  return points[points.length - 1];
};

/** Returns the point halfway along a polyline, measured by length. */
export const polylineMidpoint = (points: ReadonlyArray<Point>): Point | undefined =>
  pointAlongPolyline(points, 0.5);

/** Removes duplicate points and interior points that lie on a straight
 *  horizontal or vertical run. */
export const compactPoints = (points: ReadonlyArray<Point>): ReadonlyArray<Point> => {
  const unique = points.filter((point, index) => {
    const previous = points[index - 1];
    return previous === undefined || previous.x !== point.x || previous.y !== point.y;
  });
  return unique.filter((point, index) => {
    const previous = unique[index - 1];
    const next = unique[index + 1];
    return (
      previous === undefined ||
      next === undefined ||
      !(
        (previous.x === point.x && point.x === next.x) ||
        (previous.y === point.y && point.y === next.y)
      )
    );
  });
};

/** Draws a polyline with rounded corners. */
export const pathForPoints = (requestedPoints: ReadonlyArray<Point>, radius = 9): string => {
  const points = compactPoints(requestedPoints);
  const first = points[0];
  if (first === undefined) return "";
  if (points.length === 1) return `M ${first.x} ${first.y}`;

  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    const next = points[index + 1];
    if (point === undefined || previous === undefined) continue;
    if (next === undefined) {
      path += ` L ${point.x} ${point.y}`;
      continue;
    }

    const beforeDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const afterDistance = Math.hypot(next.x - point.x, next.y - point.y);
    const cornerRadius = Math.min(radius, beforeDistance / 2, afterDistance / 2);
    const before = {
      x: point.x + ((previous.x - point.x) / beforeDistance) * cornerRadius,
      y: point.y + ((previous.y - point.y) / beforeDistance) * cornerRadius,
    };
    const after = {
      x: point.x + ((next.x - point.x) / afterDistance) * cornerRadius,
      y: point.y + ((next.y - point.y) / afterDistance) * cornerRadius,
    };
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  }
  return path;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Draws a smooth curve through every point using Catmull-Rom splines. */
export const smoothPathForPoints = (points: ReadonlyArray<Point>): string => {
  const first = points[0];
  if (first === undefined) return "";
  if (points.length < 3) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`)
      .join(" ");
  }
  let path = `M ${round(first.x)} ${round(first.y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) continue;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return path;
};
