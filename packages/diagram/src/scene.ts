import type { Endpoint } from "./document";
import {
  distance,
  rectCenter,
  rectContains,
  rectContainsRect,
  subtractPoints,
  type Point,
  type Rect,
  type Side,
} from "./geometry";

export type ScenePort = Readonly<{
  id: string;
  nodeId: string;
  side: Side;
  x: number;
  y: number;
  label?: string;
}>;

/** A positioned node in absolute scene coordinates. `contentOrigin` is where
 *  the node's children are placed; child positions are relative to it. */
export type SceneNode = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  parentId?: string;
  isContainer: boolean;
  contentOrigin: Point;
  ports: ReadonlyArray<ScenePort>;
}>;

export type EdgeShape = "Polyline" | "Curve";

export type SceneEdge = Readonly<{
  id: string;
  points: ReadonlyArray<Point>;
  source?: Endpoint;
  target?: Endpoint;
  shape?: EdgeShape;
  labelPosition?: Point;
  isSelfLoop?: boolean;
}>;

export type SceneAnnotation = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  parentId?: string;
  attachedTo: ReadonlyArray<string>;
}>;

/** Layout output: geometry only, keyed by the ids of the semantic document.
 *  Rendering reads the document for content and the scene for placement. */
export type DiagramScene<Edge extends SceneEdge = SceneEdge> = Readonly<{
  bounds: Rect;
  nodes: ReadonlyMap<string, SceneNode>;
  edges: ReadonlyArray<Edge>;
  annotations: ReadonlyArray<SceneAnnotation>;
}>;

/** Any function that turns a document into a scene. Structured workflows,
 *  layered graphs, and freeform canvases are all layout strategies. */
export type LayoutStrategy<Input, Scene extends DiagramScene<SceneEdge> = DiagramScene> = (
  input: Input,
) => Scene;

export type SceneElement =
  | Readonly<{ _tag: "Node"; id: string }>
  | Readonly<{ _tag: "Edge"; id: string }>
  | Readonly<{ _tag: "Annotation"; id: string }>;

/** Nodes ordered for painting: ancestors before descendants, then document
 *  order. */
export const paintOrder = (scene: DiagramScene<SceneEdge>): ReadonlyArray<SceneNode> =>
  [...scene.nodes.values()]
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.depth - b.node.depth || a.index - b.index)
    .map(({ node }) => node);

export type HitTestOptions = Readonly<{
  exclude?: ReadonlySet<string>;
  filter?: (node: SceneNode) => boolean;
}>;

/** Returns the deepest node containing the point. Excluded ids also exclude
 *  their descendants so a dragged container never targets its own children. */
export const nodeAt = (
  scene: DiagramScene<SceneEdge>,
  point: Point,
  options: HitTestOptions = {},
): SceneNode | undefined => {
  const isExcluded = (node: SceneNode): boolean => {
    if (options.exclude === undefined) return false;
    let current: SceneNode | undefined = node;
    const seen = new Set<string>();
    while (current !== undefined && !seen.has(current.id)) {
      if (options.exclude.has(current.id)) return true;
      seen.add(current.id);
      current = current.parentId === undefined ? undefined : scene.nodes.get(current.parentId);
    }
    return false;
  };
  let best: SceneNode | undefined;
  for (const node of paintOrder(scene)) {
    if (!rectContains(node, point) || isExcluded(node)) continue;
    if (options.filter !== undefined && !options.filter(node)) continue;
    if (best === undefined || node.depth >= best.depth) best = node;
  }
  return best;
};

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) return distance(point, start);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
        lengthSquared,
    ),
  );
  return distance(point, {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  });
};

/** Returns the edge whose route passes nearest the point within `tolerance`.
 *  Curves are approximated by their control polyline. */
export const edgeAt = <Edge extends SceneEdge>(
  scene: DiagramScene<Edge>,
  point: Point,
  tolerance = 6,
): Edge | undefined => {
  let best: Readonly<{ edge: Edge; distance: number }> | undefined;
  for (const edge of scene.edges) {
    for (let index = 1; index < edge.points.length; index += 1) {
      const start = edge.points[index - 1];
      const end = edge.points[index];
      if (start === undefined || end === undefined) continue;
      const value = distanceToSegment(point, start, end);
      if (value <= tolerance && (best === undefined || value < best.distance)) {
        best = { edge, distance: value };
      }
    }
  }
  return best?.edge;
};

/** Returns node and annotation ids whose bounds fall entirely inside `rect`,
 *  for marquee selection. */
export const elementsInRect = (
  scene: DiagramScene<SceneEdge>,
  rect: Rect,
): ReadonlyArray<string> => [
  ...[...scene.nodes.values()]
    .filter((node) => rectContainsRect(rect, node))
    .map((node) => node.id),
  ...scene.annotations
    .filter((annotation) => rectContainsRect(rect, annotation))
    .map((annotation) => annotation.id),
];

/** Returns the origin children of `parentId` are positioned against. The
 *  document root uses the scene origin. */
export const contentOrigin = (
  scene: DiagramScene<SceneEdge>,
  parentId: string | undefined,
): Point =>
  parentId === undefined
    ? { x: 0, y: 0 }
    : (scene.nodes.get(parentId)?.contentOrigin ?? { x: 0, y: 0 });

/** Converts an absolute scene point to a position relative to a parent. */
export const toRelative = (
  scene: DiagramScene<SceneEdge>,
  parentId: string | undefined,
  point: Point,
): Point => subtractPoints(point, contentOrigin(scene, parentId));

/** Returns the laid-out position of a node or annotation relative to its
 *  parent, suitable for pinning it where it currently appears. */
export const relativePosition = (scene: DiagramScene<SceneEdge>, id: string): Point | undefined => {
  const node = scene.nodes.get(id);
  if (node !== undefined) return toRelative(scene, node.parentId, node);
  const annotation = scene.annotations.find((candidate) => candidate.id === id);
  return annotation === undefined ? undefined : toRelative(scene, annotation.parentId, annotation);
};

export const elementRect = (scene: DiagramScene<SceneEdge>, id: string): Rect | undefined =>
  scene.nodes.get(id) ?? scene.annotations.find((annotation) => annotation.id === id);

export const elementCenter = (scene: DiagramScene<SceneEdge>, id: string): Point | undefined => {
  const rect = elementRect(scene, id);
  return rect === undefined ? undefined : rectCenter(rect);
};

export const findPort = (
  scene: DiagramScene<SceneEdge>,
  nodeId: string,
  portId: string,
): ScenePort | undefined => scene.nodes.get(nodeId)?.ports.find((port) => port.id === portId);
