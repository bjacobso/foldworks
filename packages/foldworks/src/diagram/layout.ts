import {
  childrenOf,
  type Annotation,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  type Endpoint,
} from "./document";
import {
  addPoints,
  boundaryPoint,
  insets,
  pointAlongPolyline,
  polylineMidpoint,
  rectCenter,
  sideFacing,
  sidePoint,
  unionRects,
  type Dimensions,
  type Insets,
  type Point,
  type Rect,
  type Side,
} from "./geometry";
import type { DiagramScene, SceneAnnotation, SceneEdge, SceneNode, ScenePort } from "./scene";

export type EdgeRouting = "Straight" | "Curved" | "Orthogonal";
export type LayeredDirection = "Down" | "Right";

export type SceneLayoutConfig<NodeData, AnnotationData> = Readonly<{
  /** Intrinsic size of a leaf, and the minimum size of a container. */
  nodeSize: (node: DiagramNode<NodeData>) => Dimensions;
  annotationSize?: (annotation: Annotation<AnnotationData>) => Dimensions;
  /** Whether a node lays out its children inside itself. Defaults to nodes
   *  that currently have children. Return true for empty containers that
   *  should still accept drops. */
  isContainer?: (node: DiagramNode<NodeData>, hasChildren: boolean) => boolean;
  /** Space between a container's border and its children; `top` includes any
   *  header. */
  containerPadding?: number | Partial<Insets>;
  defaultPortSide?: Side;
  edgeRouting?: EdgeRouting;
  /** Separation between parallel edges and self-loop size. */
  edgeSpacing?: number;
}>;

type Measured = Readonly<{ size: Dimensions; position: Point }>;

/** Chooses relative positions for one container's direct children. Pinned
 *  children already carry positions; placers only need to fill the rest. */
export type ChildPlacer<NodeData, AnnotationData> = (
  input: Readonly<{
    parentId: string | undefined;
    nodes: ReadonlyArray<Readonly<{ node: DiagramNode<NodeData>; size: Dimensions }>>;
    annotations: ReadonlyArray<
      Readonly<{ annotation: Annotation<AnnotationData>; size: Dimensions }>
    >;
    /** Edges between siblings after lifting nested endpoints to the sibling
     *  that contains them. */
    edges: ReadonlyArray<Readonly<{ id: string; source: string; target: string }>>;
  }>,
) => ReadonlyMap<string, Point>;

const DEFAULT_PADDING: Insets = { top: 40, right: 24, bottom: 24, left: 24 };

/** Lifts an edge endpoint to the child of `parentId` that contains it. */
const liftToChild = (
  byId: ReadonlyMap<string, Readonly<{ id: string; parentId?: string }>>,
  nodeId: string,
  parentId: string | undefined,
): string | undefined => {
  let current = byId.get(nodeId);
  const seen = new Set<string>();
  while (current !== undefined && !seen.has(current.id)) {
    if (current.parentId === parentId) return current.id;
    seen.add(current.id);
    current = current.parentId === undefined ? undefined : byId.get(current.parentId);
  }
  return undefined;
};

const portSide = (port: Readonly<{ side?: Side }>, fallback: Side): Side => port.side ?? fallback;

const scenePorts = (
  node: DiagramNode<unknown>,
  rect: Rect,
  fallback: Side,
): ReadonlyArray<ScenePort> => {
  const ports = node.ports ?? [];
  const bySide = new Map<Side, number>();
  for (const port of ports) {
    const side = portSide(port, fallback);
    bySide.set(side, (bySide.get(side) ?? 0) + 1);
  }
  const seen = new Map<Side, number>();
  return ports.map((port) => {
    const side = portSide(port, fallback);
    const index = seen.get(side) ?? 0;
    seen.set(side, index + 1);
    const point = sidePoint(rect, side, (index + 1) / ((bySide.get(side) ?? 1) + 1));
    return {
      id: port.id,
      nodeId: node.id,
      side,
      x: point.x,
      y: point.y,
      ...(port.label === undefined ? {} : { label: port.label }),
    };
  });
};

const endpointAnchor = (
  nodes: ReadonlyMap<string, SceneNode>,
  endpoint: Endpoint,
): Readonly<{ rect: Rect; port?: ScenePort }> | undefined => {
  const node = nodes.get(endpoint.nodeId);
  if (node === undefined) return undefined;
  const port =
    endpoint.portId === undefined
      ? undefined
      : node.ports.find((candidate) => candidate.id === endpoint.portId);
  return port === undefined ? { rect: node } : { rect: node, port };
};

const selfLoop = (rect: Rect, index: number, spacing: number): ReadonlyArray<Point> => {
  const size = spacing + index * spacing * 0.6;
  const right = rect.x + rect.width;
  return [
    { x: right - size * 0.9, y: rect.y },
    { x: right - size * 0.2, y: rect.y - size },
    { x: right + size, y: rect.y + size * 0.2 },
    { x: right, y: rect.y + size * 0.9 },
  ];
};

/** Routes edges between laid-out nodes. Self-loops curl off the top-right
 *  corner, and parallel or opposing edges between the same pair fan out so
 *  cyclic graphs stay legible. */
export const routeEdges = <EdgeData>(
  nodes: ReadonlyMap<string, SceneNode>,
  edges: ReadonlyArray<DiagramEdge<EdgeData>>,
  options: Readonly<{ routing?: EdgeRouting; spacing?: number }> = {},
): ReadonlyArray<SceneEdge> => {
  const routing = options.routing ?? "Curved";
  const spacing = options.spacing ?? 28;
  const groups = new Map<string, string[]>();
  for (const edge of edges) {
    const [first, second] = [edge.source.nodeId, edge.target.nodeId].sort();
    const key = `${first}\u0000${second}`;
    groups.set(key, [...(groups.get(key) ?? []), edge.id]);
  }

  return edges.flatMap((edge): ReadonlyArray<SceneEdge> => {
    const source = endpointAnchor(nodes, edge.source);
    const target = endpointAnchor(nodes, edge.target);
    if (source === undefined || target === undefined) return [];
    const [first, second] = [edge.source.nodeId, edge.target.nodeId].sort();
    const group = groups.get(`${first}\u0000${second}`) ?? [edge.id];
    const index = group.indexOf(edge.id);
    const base = { id: edge.id, source: edge.source, target: edge.target };

    if (edge.source.nodeId === edge.target.nodeId && source.port === undefined) {
      const points = selfLoop(source.rect, index, spacing);
      return [
        {
          ...base,
          points,
          shape: "Curve",
          isSelfLoop: true,
          labelPosition: {
            x: source.rect.x + source.rect.width + spacing * (0.9 + index * 0.6),
            y: source.rect.y - spacing * (0.5 + index * 0.4),
          },
        },
      ];
    }

    const sourceCenter = source.port ?? rectCenter(source.rect);
    const targetCenter = target.port ?? rectCenter(target.rect);
    const bend = (index - (group.length - 1) / 2) * spacing;

    if (routing === "Orthogonal") {
      const sourceSide = source.port?.side ?? sideFacing(source.rect, targetCenter);
      const targetSide = target.port?.side ?? sideFacing(target.rect, sourceCenter);
      const offset = 0.5 + (group.length > 1 ? bend / Math.max(spacing * 6, 1) : 0);
      const start = source.port ?? sidePoint(source.rect, sourceSide, offset);
      const end = target.port ?? sidePoint(target.rect, targetSide, offset);
      const horizontal = sourceSide === "Left" || sourceSide === "Right";
      const points = horizontal
        ? [
            start,
            { x: (start.x + end.x) / 2, y: start.y },
            { x: (start.x + end.x) / 2, y: end.y },
            end,
          ]
        : [
            start,
            { x: start.x, y: (start.y + end.y) / 2 },
            { x: end.x, y: (start.y + end.y) / 2 },
            end,
          ];
      const labelPosition = polylineMidpoint(points);
      return [
        {
          ...base,
          points,
          shape: "Polyline",
          ...(labelPosition === undefined ? {} : { labelPosition }),
        },
      ];
    }

    // A consistent normal (from the lexically first node to the second) makes
    // A→B and B→A bend to opposite sides.
    const forward = edge.source.nodeId === first;
    const from = forward ? sourceCenter : targetCenter;
    const to = forward ? targetCenter : sourceCenter;
    const length = Math.max(Math.hypot(to.x - from.x, to.y - from.y), 1);
    const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
    const curve = routing === "Curved" && group.length > 1 ? bend : 0;
    const middle = {
      x: (sourceCenter.x + targetCenter.x) / 2 + normal.x * curve,
      y: (sourceCenter.y + targetCenter.y) / 2 + normal.y * curve,
    };
    const start = source.port ?? boundaryPoint(source.rect, curve === 0 ? targetCenter : middle);
    const end = target.port ?? boundaryPoint(target.rect, curve === 0 ? sourceCenter : middle);
    const points =
      curve === 0
        ? [start, end]
        : [
            start,
            {
              x: (start.x + end.x) / 2 + normal.x * curve,
              y: (start.y + end.y) / 2 + normal.y * curve,
            },
            end,
          ];
    // Stagger labels along grouped edges, measured in the pair's canonical
    // direction, so opposing labels do not collide.
    const stagger = (index + 1) / (group.length + 1);
    const labelPosition = pointAlongPolyline(points, forward ? stagger : 1 - stagger);
    return [
      {
        ...base,
        points,
        shape: curve === 0 ? "Polyline" : "Curve",
        ...(labelPosition === undefined ? {} : { labelPosition }),
      },
    ];
  });
};

/** Builds a scene for a compound graph. Containers are measured bottom-up
 *  from their children, then placed top-down so child positions stay
 *  relative to each container's content origin. */
export const createSceneLayout = <NodeData, EdgeData, AnnotationData>(
  config: SceneLayoutConfig<NodeData, AnnotationData>,
  placeChildren: ChildPlacer<NodeData, AnnotationData>,
) => {
  const padding = insets(config.containerPadding ?? DEFAULT_PADDING);
  const annotationSize =
    config.annotationSize ??
    ((annotation: Annotation<AnnotationData>) => annotation.size ?? { width: 180, height: 96 });
  const fallbackSide = config.defaultPortSide ?? "Right";

  return (document: DiagramDocument<NodeData, EdgeData, AnnotationData>): DiagramScene => {
    const byId = new Map(document.nodes.map((node) => [node.id, node]));
    const hasChildren = new Set(
      document.nodes.flatMap((node) => (node.parentId === undefined ? [] : [node.parentId])),
    );
    const isContainer = (node: DiagramNode<NodeData>) =>
      config.isContainer?.(node, hasChildren.has(node.id)) ?? hasChildren.has(node.id);
    const measured = new Map<string, Measured>();
    const visiting = new Set<string>();

    const measure = (parentId: string | undefined): Rect | undefined => {
      const children = childrenOf(document.nodes, parentId).filter(
        (node) => !visiting.has(node.id),
      );
      const nested = document.annotations.filter((annotation) => annotation.parentId === parentId);
      const sized = children.map((node) => {
        const intrinsic = node.size ?? config.nodeSize(node);
        if (!isContainer(node)) return { node, size: intrinsic };
        visiting.add(node.id);
        const content = measure(node.id);
        visiting.delete(node.id);
        const right = Math.max(0, content === undefined ? 0 : content.x + content.width);
        const bottom = Math.max(0, content === undefined ? 0 : content.y + content.height);
        return {
          node,
          size: {
            width: Math.max(intrinsic.width, padding.left + right + padding.right),
            height: Math.max(intrinsic.height, padding.top + bottom + padding.bottom),
          },
        };
      });
      const annotations = nested.map((annotation) => ({
        annotation,
        size: annotationSize(annotation),
      }));
      const siblings = new Set(children.map((node) => node.id));
      const edges = document.edges.flatMap((edge) => {
        const source = liftToChild(byId, edge.source.nodeId, parentId);
        const target = liftToChild(byId, edge.target.nodeId, parentId);
        return source === undefined ||
          target === undefined ||
          source === target ||
          !siblings.has(source) ||
          !siblings.has(target)
          ? []
          : [{ id: edge.id, source, target }];
      });
      const placed = placeChildren({ parentId, nodes: sized, annotations, edges });
      const rects: Rect[] = [];
      for (const { node, size } of sized) {
        const position = node.position ?? placed.get(node.id) ?? { x: 0, y: 0 };
        measured.set(node.id, { size, position });
        rects.push({ ...position, ...size });
      }
      for (const { annotation, size } of annotations) {
        const position = annotation.position ?? placed.get(annotation.id) ?? { x: 0, y: 0 };
        measured.set(annotation.id, { size, position });
        rects.push({ ...position, ...size });
      }
      return unionRects(rects);
    };

    measure(undefined);

    const nodes = new Map<string, SceneNode>();
    const annotations: SceneAnnotation[] = [];
    const place = (parentId: string | undefined, origin: Point, depth: number) => {
      for (const node of childrenOf(document.nodes, parentId)) {
        const layout = measured.get(node.id);
        if (layout === undefined || nodes.has(node.id)) continue;
        const absolute = addPoints(origin, layout.position);
        const rect = { ...absolute, ...layout.size };
        const inner = { x: absolute.x + padding.left, y: absolute.y + padding.top };
        const container = isContainer(node);
        nodes.set(node.id, {
          id: node.id,
          ...rect,
          depth,
          ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
          isContainer: container,
          contentOrigin: container ? inner : absolute,
          ports: scenePorts(node, rect, fallbackSide),
        });
        if (container) place(node.id, inner, depth + 1);
      }
      for (const annotation of document.annotations) {
        if (annotation.parentId !== parentId) continue;
        const layout = measured.get(annotation.id);
        if (layout === undefined) continue;
        annotations.push({
          id: annotation.id,
          ...addPoints(origin, layout.position),
          ...layout.size,
          depth,
          ...(annotation.parentId === undefined ? {} : { parentId: annotation.parentId }),
          attachedTo: annotation.attachedTo ?? [],
        });
      }
    };
    place(undefined, { x: 0, y: 0 }, 0);

    const edges = routeEdges(nodes, document.edges, {
      ...(config.edgeRouting === undefined ? {} : { routing: config.edgeRouting }),
      ...(config.edgeSpacing === undefined ? {} : { spacing: config.edgeSpacing }),
    });
    const bounds = unionRects([
      ...nodes.values(),
      ...annotations,
      ...edges.flatMap((edge) => edge.points.map((point) => ({ ...point, width: 0, height: 0 }))),
    ]) ?? { x: 0, y: 0, width: 0, height: 0 };
    return { bounds, nodes, edges, annotations };
  };
};

export type FreeformLayoutConfig<NodeData, AnnotationData> = SceneLayoutConfig<
  NodeData,
  AnnotationData
> &
  Readonly<{ gap?: number }>;

/** Places every element at its pinned position. Unpinned elements fill a
 *  grid inside their container. */
export const createFreeformLayout = <NodeData, EdgeData, AnnotationData>(
  config: FreeformLayoutConfig<NodeData, AnnotationData>,
) => {
  const gap = config.gap ?? 48;
  return createSceneLayout<NodeData, EdgeData, AnnotationData>(config, ({ nodes, annotations }) => {
    const unpinned = [
      ...nodes
        .filter(({ node }) => node.position === undefined)
        .map(({ node, size }) => ({ id: node.id, size })),
      ...annotations
        .filter(({ annotation }) => annotation.position === undefined)
        .map(({ annotation, size }) => ({ id: annotation.id, size })),
    ];
    const columns = Math.max(1, Math.ceil(Math.sqrt(unpinned.length)));
    const cellWidth = Math.max(0, ...unpinned.map(({ size }) => size.width)) + gap;
    const cellHeight = Math.max(0, ...unpinned.map(({ size }) => size.height)) + gap;
    return new Map(
      unpinned.map(({ id }, index) => [
        id,
        {
          x: (index % columns) * cellWidth,
          y: Math.floor(index / columns) * cellHeight,
        },
      ]),
    );
  });
};

export type LayeredLayoutConfig<NodeData, AnnotationData> = SceneLayoutConfig<
  NodeData,
  AnnotationData
> &
  Readonly<{
    direction?: LayeredDirection;
    rankGap?: number;
    nodeGap?: number;
    orderingPasses?: number;
  }>;

/** Reverses the minimum set of DFS back edges needed to make the sibling
 *  graph acyclic. Returns the ids of reversed edges. */
export const feedbackEdges = (
  nodeIds: ReadonlyArray<string>,
  edges: ReadonlyArray<Readonly<{ id: string; source: string; target: string }>>,
): ReadonlySet<string> => {
  const outgoing = new Map<string, Array<Readonly<{ id: string; target: string }>>>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  const state = new Map<string, "Visiting" | "Done">();
  const reversed = new Set<string>();
  const visit = (id: string) => {
    state.set(id, "Visiting");
    for (const edge of outgoing.get(id) ?? []) {
      const next = state.get(edge.target);
      if (next === "Visiting") reversed.add(edge.id);
      else if (next === undefined) visit(edge.target);
    }
    state.set(id, "Done");
  };
  for (const id of nodeIds) if (!state.has(id)) visit(id);
  return reversed;
};

/** A Sugiyama-style layered layout for compound graphs with cycles. Each
 *  container is ranked independently after back edges are reversed, ordered
 *  with barycenter sweeps, and aligned toward connected nodes. */
export const createLayeredLayout = <NodeData, EdgeData, AnnotationData>(
  config: LayeredLayoutConfig<NodeData, AnnotationData>,
) => {
  const direction = config.direction ?? "Down";
  const rankGap = config.rankGap ?? 72;
  const nodeGap = config.nodeGap ?? 40;
  const passes = config.orderingPasses ?? 4;
  const main = (size: Dimensions) => (direction === "Down" ? size.height : size.width);
  const cross = (size: Dimensions) => (direction === "Down" ? size.width : size.height);
  const toPoint = (mainValue: number, crossValue: number): Point =>
    direction === "Down" ? { x: crossValue, y: mainValue } : { x: mainValue, y: crossValue };

  return createSceneLayout<NodeData, EdgeData, AnnotationData>(
    {
      ...config,
      defaultPortSide: config.defaultPortSide ?? (direction === "Down" ? "Bottom" : "Right"),
    },
    ({ nodes, annotations, edges }) => {
      const ids = nodes.map(({ node }) => node.id);
      const sizes = new Map(nodes.map(({ node, size }) => [node.id, size]));
      const reversed = feedbackEdges(ids, edges);
      const dag = edges
        .map((edge) =>
          reversed.has(edge.id)
            ? { source: edge.target, target: edge.source }
            : { source: edge.source, target: edge.target },
        )
        .filter((edge) => edge.source !== edge.target);
      const predecessors = new Map<string, string[]>();
      const successors = new Map<string, string[]>();
      for (const edge of dag) {
        predecessors.set(edge.target, [...(predecessors.get(edge.target) ?? []), edge.source]);
        successors.set(edge.source, [...(successors.get(edge.source) ?? []), edge.target]);
      }

      const rank = new Map<string, number>();
      const rankOf = (id: string, trail: ReadonlySet<string> = new Set()): number => {
        const known = rank.get(id);
        if (known !== undefined) return known;
        const parents = (predecessors.get(id) ?? []).filter((parent) => !trail.has(parent));
        const nextTrail = new Set([...trail, id]);
        const value =
          parents.length === 0
            ? 0
            : Math.max(...parents.map((parent) => rankOf(parent, nextTrail) + 1));
        rank.set(id, value);
        return value;
      };
      for (const id of ids) rankOf(id);

      const rankCount = Math.max(0, ...rank.values()) + (ids.length === 0 ? 0 : 1);
      const ranks: string[][] = Array.from({ length: rankCount }, () => []);
      for (const id of ids) ranks[rank.get(id) ?? 0]?.push(id);

      const orderIndex = () => {
        const index = new Map<string, number>();
        for (const layer of ranks) layer.forEach((id, position) => index.set(id, position));
        return index;
      };
      const sortByBarycenter = (layer: string[], neighbours: Map<string, string[]>) => {
        const index = orderIndex();
        const weight = new Map(
          layer.map((id, position) => {
            const linked = (neighbours.get(id) ?? [])
              .map((other) => index.get(other))
              .filter((value): value is number => value !== undefined);
            return [
              id,
              linked.length === 0
                ? position
                : linked.reduce((sum, value) => sum + value, 0) / linked.length,
            ];
          }),
        );
        layer.sort((a, b) => (weight.get(a) ?? 0) - (weight.get(b) ?? 0));
      };
      for (let pass = 0; pass < passes; pass += 1) {
        for (const layer of ranks.slice(1)) sortByBarycenter(layer, predecessors);
        for (const layer of ranks.slice(0, -1).reverse()) sortByBarycenter(layer, successors);
      }

      const positions = new Map<string, Point>();
      const crossCenter = new Map<string, number>();
      let mainCursor = 0;
      for (const layer of ranks) {
        const desired = layer.map((id) => {
          const linked = [...(predecessors.get(id) ?? []), ...(successors.get(id) ?? [])]
            .map((other) => crossCenter.get(other))
            .filter((value): value is number => value !== undefined);
          return linked.length === 0
            ? undefined
            : linked.reduce((sum, value) => sum + value, 0) / linked.length;
        });
        let cursor = Number.NEGATIVE_INFINITY;
        const starts = layer.map((id, index) => {
          const size = cross(sizes.get(id) ?? { width: 0, height: 0 });
          const target = desired[index] === undefined ? cursor : (desired[index] ?? 0) - size / 2;
          const start = Math.max(Number.isFinite(cursor) ? cursor : target, target);
          const resolved = Number.isFinite(start) ? start : 0;
          cursor = resolved + size + nodeGap;
          return resolved;
        });
        const layerMain = Math.max(
          0,
          ...layer.map((id) => main(sizes.get(id) ?? { width: 0, height: 0 })),
        );
        layer.forEach((id, index) => {
          const size = sizes.get(id) ?? { width: 0, height: 0 };
          const start = starts[index] ?? 0;
          crossCenter.set(id, start + cross(size) / 2);
          positions.set(id, toPoint(mainCursor + (layerMain - main(size)) / 2, start));
        });
        mainCursor += layerMain + rankGap;
      }

      // Normalise so content starts at the container's origin.
      const minimumCross = Math.min(
        0,
        ...[...positions.values()].map((point) => (direction === "Down" ? point.x : point.y)),
      );
      const normalised = new Map(
        [...positions].map(([id, point]) => [
          id,
          direction === "Down"
            ? { x: point.x - minimumCross, y: point.y }
            : { x: point.x, y: point.y - minimumCross },
        ]),
      );

      // Notes without a position sit beside the ranked content.
      const extent = Math.max(
        0,
        ...nodes.map(({ node, size }) => {
          const point = node.position ?? normalised.get(node.id) ?? { x: 0, y: 0 };
          return direction === "Down" ? point.x + size.width : point.y + size.height;
        }),
      );
      let noteCursor = 0;
      for (const { annotation, size } of annotations) {
        if (annotation.position !== undefined) continue;
        normalised.set(annotation.id, toPoint(noteCursor, extent + (extent === 0 ? 0 : nodeGap)));
        noteCursor += main(size) + nodeGap / 2;
      }
      return normalised;
    },
  );
};
