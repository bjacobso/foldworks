import { Schema as S } from "effect";

import type { Dimensions, Point, Side } from "./geometry";

export type Port = Readonly<{
  id: string;
  side?: Side;
  label?: string;
}>;

/** One end of an edge. Omit `portId` to attach to the node itself. */
export type Endpoint = Readonly<{
  nodeId: string;
  portId?: string;
}>;

/** A node in a compound graph. `parentId` nests the node inside another node;
 *  `position` is relative to the parent's content origin and pins the node
 *  when present. Layout strategies place unpinned nodes. */
export type DiagramNode<NodeData> = Readonly<{
  id: string;
  parentId?: string;
  data: NodeData;
  position?: Point;
  size?: Dimensions;
  ports?: ReadonlyArray<Port>;
}>;

/** A directed connection. Cycles and self-loops are valid; adapters that need
 *  acyclic graphs enforce that through their policy. */
export type DiagramEdge<EdgeData> = Readonly<{
  id: string;
  source: Endpoint;
  target: Endpoint;
  data: EdgeData;
}>;

/** A free-positioned element that is not part of the graph, such as a note or
 *  region. `attachedTo` links it to nodes or edges without changing topology. */
export type Annotation<AnnotationData> = Readonly<{
  id: string;
  parentId?: string;
  position?: Point;
  size?: Dimensions;
  attachedTo?: ReadonlyArray<string>;
  data: AnnotationData;
}>;

export type NoteData = Readonly<{ text: string }>;

export type DiagramDocument<NodeData, EdgeData, AnnotationData = NoteData> = Readonly<{
  nodes: ReadonlyArray<DiagramNode<NodeData>>;
  edges: ReadonlyArray<DiagramEdge<EdgeData>>;
  annotations: ReadonlyArray<Annotation<AnnotationData>>;
}>;

export const emptyDocument = <NodeData, EdgeData, AnnotationData = NoteData>(): DiagramDocument<
  NodeData,
  EdgeData,
  AnnotationData
> => ({ nodes: [], edges: [], annotations: [] });

export const PointSchema = S.Struct({ x: S.Number, y: S.Number });
export const DimensionsSchema = S.Struct({ width: S.Number, height: S.Number });
export const SideSchema = S.Literals(["Top", "Right", "Bottom", "Left"]);
export const PortSchema = S.Struct({
  id: S.String,
  side: S.optionalKey(SideSchema),
  label: S.optionalKey(S.String),
});
export const EndpointSchema = S.Struct({
  nodeId: S.String,
  portId: S.optionalKey(S.String),
});
export const NoteDataSchema = S.Struct({ text: S.String });

/** Builds an Effect Schema for a diagram document from its payload schemas so
 *  applications can persist, import, and store documents in Foldkit models. */
export const DocumentSchema = <NodeData, EdgeData, AnnotationData>(
  schemas: Readonly<{
    node: S.Codec<NodeData>;
    edge: S.Codec<EdgeData>;
    annotation: S.Codec<AnnotationData>;
  }>,
) =>
  S.Struct({
    nodes: S.Array(
      S.Struct({
        id: S.String,
        parentId: S.optionalKey(S.String),
        data: schemas.node,
        position: S.optionalKey(PointSchema),
        size: S.optionalKey(DimensionsSchema),
        ports: S.optionalKey(S.Array(PortSchema)),
      }),
    ),
    edges: S.Array(
      S.Struct({
        id: S.String,
        source: EndpointSchema,
        target: EndpointSchema,
        data: schemas.edge,
      }),
    ),
    annotations: S.Array(
      S.Struct({
        id: S.String,
        parentId: S.optionalKey(S.String),
        position: S.optionalKey(PointSchema),
        size: S.optionalKey(DimensionsSchema),
        attachedTo: S.optionalKey(S.Array(S.String)),
        data: schemas.annotation,
      }),
    ),
  });

type Nodes = ReadonlyArray<Readonly<{ id: string; parentId?: string }>>;

export const findNode = <NodeData, EdgeData, AnnotationData>(
  document: DiagramDocument<NodeData, EdgeData, AnnotationData>,
  nodeId: string,
): DiagramNode<NodeData> | undefined => document.nodes.find((node) => node.id === nodeId);

export const findEdge = <NodeData, EdgeData, AnnotationData>(
  document: DiagramDocument<NodeData, EdgeData, AnnotationData>,
  edgeId: string,
): DiagramEdge<EdgeData> | undefined => document.edges.find((edge) => edge.id === edgeId);

export const findAnnotation = <NodeData, EdgeData, AnnotationData>(
  document: DiagramDocument<NodeData, EdgeData, AnnotationData>,
  annotationId: string,
): Annotation<AnnotationData> | undefined =>
  document.annotations.find((annotation) => annotation.id === annotationId);

/** Returns direct children of `parentId`, or root nodes when it is undefined. */
export const childrenOf = <Node extends Nodes[number]>(
  nodes: ReadonlyArray<Node>,
  parentId: string | undefined,
): ReadonlyArray<Node> => nodes.filter((node) => node.parentId === parentId);

/** Returns ancestors from nearest parent to the root. Stops on cycles. */
export const ancestorIds = (nodes: Nodes, nodeId: string): ReadonlyArray<string> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result: string[] = [];
  const seen = new Set<string>([nodeId]);
  let parentId = byId.get(nodeId)?.parentId;
  while (parentId !== undefined && !seen.has(parentId) && byId.has(parentId)) {
    result.push(parentId);
    seen.add(parentId);
    parentId = byId.get(parentId)?.parentId;
  }
  return result;
};

/** Returns every node nested below `nodeId`, depth first. */
export const descendantIds = (nodes: Nodes, nodeId: string): ReadonlyArray<string> => {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId === undefined) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  }
  const result: string[] = [];
  const seen = new Set<string>([nodeId]);
  const visit = (id: string) => {
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      result.push(child);
      visit(child);
    }
  };
  visit(nodeId);
  return result;
};

export const isAncestor = (nodes: Nodes, ancestorId: string, nodeId: string): boolean =>
  ancestorIds(nodes, nodeId).includes(ancestorId);

export const depthOf = (nodes: Nodes, nodeId: string): number => ancestorIds(nodes, nodeId).length;

/** Returns the nearest node that contains both nodes, or undefined when they
 *  only share the document root. */
export const lowestCommonAncestor = (
  nodes: Nodes,
  firstId: string,
  secondId: string,
): string | undefined => {
  const first = new Set([firstId, ...ancestorIds(nodes, firstId)]);
  return [secondId, ...ancestorIds(nodes, secondId)].find((id) => first.has(id));
};

export const edgesOfNode = <EdgeData>(
  edges: ReadonlyArray<DiagramEdge<EdgeData>>,
  nodeId: string,
): ReadonlyArray<DiagramEdge<EdgeData>> =>
  edges.filter((edge) => edge.source.nodeId === nodeId || edge.target.nodeId === nodeId);

export const outgoingEdges = <EdgeData>(
  edges: ReadonlyArray<DiagramEdge<EdgeData>>,
  nodeId: string,
): ReadonlyArray<DiagramEdge<EdgeData>> => edges.filter((edge) => edge.source.nodeId === nodeId);

export const incomingEdges = <EdgeData>(
  edges: ReadonlyArray<DiagramEdge<EdgeData>>,
  nodeId: string,
): ReadonlyArray<DiagramEdge<EdgeData>> => edges.filter((edge) => edge.target.nodeId === nodeId);

type EdgeLike = Readonly<{ source: Endpoint; target: Endpoint }>;

/** Returns whether `targetId` can already reach `sourceId`, meaning a new edge
 *  from source to target would close a cycle. */
export const wouldCreateCycle = (
  edges: ReadonlyArray<EdgeLike>,
  sourceId: string,
  targetId: string,
): boolean => {
  if (sourceId === targetId) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source.nodeId, [
      ...(outgoing.get(edge.source.nodeId) ?? []),
      edge.target.nodeId,
    ]);
  }
  const seen = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    if (current === sourceId) return true;
    seen.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
};

/** Returns node ids in dependency order, or undefined when the edges form a
 *  cycle. */
export const topologicalOrder = (
  nodeIds: ReadonlyArray<string>,
  edges: ReadonlyArray<EdgeLike>,
): ReadonlyArray<string> | undefined => {
  const known = new Set(nodeIds);
  const incoming = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!known.has(edge.source.nodeId) || !known.has(edge.target.nodeId)) continue;
    incoming.set(edge.target.nodeId, (incoming.get(edge.target.nodeId) ?? 0) + 1);
    outgoing.set(edge.source.nodeId, [
      ...(outgoing.get(edge.source.nodeId) ?? []),
      edge.target.nodeId,
    ]);
  }
  const queue = nodeIds.filter((id) => incoming.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) continue;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  return order.length === nodeIds.length ? order : undefined;
};

export type ValidationIssue = Readonly<{
  code: "DuplicateId" | "MissingParent" | "ParentCycle" | "MissingEndpoint" | "MissingPort";
  elementId: string;
  message: string;
}>;

/** Checks structural integrity. Adapters layer their own semantic rules on
 *  top of these issues. */
export const validateDocument = <NodeData, EdgeData, AnnotationData>(
  document: DiagramDocument<NodeData, EdgeData, AnnotationData>,
): ReadonlyArray<ValidationIssue> => {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const element of [...document.nodes, ...document.edges, ...document.annotations]) {
    if (seen.has(element.id)) {
      issues.push({
        code: "DuplicateId",
        elementId: element.id,
        message: `Duplicate id ${element.id}.`,
      });
    }
    seen.add(element.id);
  }
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  for (const node of document.nodes) {
    if (node.parentId === undefined) continue;
    if (!nodes.has(node.parentId)) {
      issues.push({
        code: "MissingParent",
        elementId: node.id,
        message: `${node.id} is nested in missing node ${node.parentId}.`,
      });
      continue;
    }
    let current: string | undefined = node.parentId;
    const visited = new Set<string>([node.id]);
    while (current !== undefined) {
      if (visited.has(current)) {
        issues.push({
          code: "ParentCycle",
          elementId: node.id,
          message: `${node.id} is nested in itself.`,
        });
        break;
      }
      visited.add(current);
      current = nodes.get(current)?.parentId;
    }
  }
  for (const annotation of document.annotations) {
    if (annotation.parentId !== undefined && !nodes.has(annotation.parentId)) {
      issues.push({
        code: "MissingParent",
        elementId: annotation.id,
        message: `${annotation.id} is nested in missing node ${annotation.parentId}.`,
      });
    }
  }
  for (const edge of document.edges) {
    for (const endpoint of [edge.source, edge.target]) {
      const node = nodes.get(endpoint.nodeId);
      if (node === undefined) {
        issues.push({
          code: "MissingEndpoint",
          elementId: edge.id,
          message: `${edge.id} connects missing node ${endpoint.nodeId}.`,
        });
      } else if (
        endpoint.portId !== undefined &&
        !(node.ports ?? []).some((port) => port.id === endpoint.portId)
      ) {
        issues.push({
          code: "MissingPort",
          elementId: edge.id,
          message: `${edge.id} connects missing port ${endpoint.portId} on ${node.id}.`,
        });
      }
    }
  }
  return issues;
};
