import {
  ancestorIds,
  descendantIds,
  findAnnotation,
  findEdge,
  findNode,
  wouldCreateCycle,
  type Annotation,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  type Endpoint,
} from "./document";
import { addPoints, type Point } from "./geometry";

/** Adapter rules for a diagram. Every rule is optional; the defaults accept
 *  any structurally valid change, including cycles and self-loops. */
export type DiagramPolicy<NodeData, EdgeData, AnnotationData> = Readonly<{
  canConnect?: (
    document: DiagramDocument<NodeData, EdgeData, AnnotationData>,
    source: DiagramNode<NodeData>,
    target: DiagramNode<NodeData>,
  ) => boolean;
  canNest?: (
    document: DiagramDocument<NodeData, EdgeData, AnnotationData>,
    child: DiagramNode<NodeData>,
    parent: DiagramNode<NodeData> | undefined,
  ) => boolean;
  canMove?: (node: DiagramNode<NodeData>) => boolean;
  canDelete?: (node: DiagramNode<NodeData>) => boolean;
  allowSelfLoops?: boolean;
  allowCycles?: boolean;
  allowParallelEdges?: boolean;
}>;

export type ConnectionRejection =
  | "MissingEndpoint"
  | "MissingPort"
  | "SelfLoop"
  | "Cycle"
  | "Parallel"
  | "Policy";

const hasPort = (node: DiagramNode<unknown>, portId: string | undefined) =>
  portId === undefined || (node.ports ?? []).some((port) => port.id === portId);

export const createDiagramOperations = <NodeData, EdgeData, AnnotationData>(
  policy: DiagramPolicy<NodeData, EdgeData, AnnotationData> = {},
) => {
  type Document = DiagramDocument<NodeData, EdgeData, AnnotationData>;
  type Node = DiagramNode<NodeData>;
  type Edge = DiagramEdge<EdgeData>;

  const canMove = (node: Node) => policy.canMove?.(node) ?? true;
  const canDelete = (node: Node) => policy.canDelete?.(node) ?? true;

  const hasId = (document: Document, id: string) =>
    document.nodes.some((node) => node.id === id) ||
    document.edges.some((edge) => edge.id === id) ||
    document.annotations.some((annotation) => annotation.id === id);

  /** Explains why a connection is rejected, or returns undefined when valid. */
  const connectionRejection = (
    document: Document,
    source: Endpoint,
    target: Endpoint,
    ignoreEdgeId?: string,
  ): ConnectionRejection | undefined => {
    const sourceNode = findNode(document, source.nodeId);
    const targetNode = findNode(document, target.nodeId);
    if (sourceNode === undefined || targetNode === undefined) return "MissingEndpoint";
    if (!hasPort(sourceNode, source.portId) || !hasPort(targetNode, target.portId))
      return "MissingPort";
    if (source.nodeId === target.nodeId && policy.allowSelfLoops === false) return "SelfLoop";
    const otherEdges = document.edges.filter((edge) => edge.id !== ignoreEdgeId);
    if (
      policy.allowCycles === false &&
      source.nodeId !== target.nodeId &&
      wouldCreateCycle(otherEdges, source.nodeId, target.nodeId)
    ) {
      return "Cycle";
    }
    if (
      policy.allowParallelEdges === false &&
      otherEdges.some(
        (edge) =>
          edge.source.nodeId === source.nodeId &&
          edge.target.nodeId === target.nodeId &&
          edge.source.portId === source.portId &&
          edge.target.portId === target.portId,
      )
    ) {
      return "Parallel";
    }
    if (policy.canConnect !== undefined && !policy.canConnect(document, sourceNode, targetNode)) {
      return "Policy";
    }
    return undefined;
  };

  const canConnect = (document: Document, source: Endpoint, target: Endpoint) =>
    connectionRejection(document, source, target) === undefined;

  /** Returns whether `nodeId` may be nested under `parentId`. Undefined parent
   *  means the document root. */
  const canNest = (document: Document, nodeId: string, parentId: string | undefined) => {
    const node = findNode(document, nodeId);
    if (node === undefined) return false;
    if (parentId === undefined) return policy.canNest?.(document, node, undefined) ?? true;
    const parent = findNode(document, parentId);
    if (parent === undefined || parentId === nodeId) return false;
    if (ancestorIds(document.nodes, parentId).includes(nodeId)) return false;
    return policy.canNest?.(document, node, parent) ?? true;
  };

  const addNode = (document: Document, node: Node): Document | undefined => {
    if (hasId(document, node.id)) return undefined;
    if (node.parentId !== undefined && findNode(document, node.parentId) === undefined)
      return undefined;
    const next = { ...document, nodes: [...document.nodes, node] };
    return canNest(next, node.id, node.parentId) ? next : undefined;
  };

  const updateNode = (
    document: Document,
    nodeId: string,
    update: (node: Node) => Node,
  ): Document | undefined => {
    if (findNode(document, nodeId) === undefined) return undefined;
    return {
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === nodeId ? { ...update(node), id: node.id } : node,
      ),
    };
  };

  /** Removes nodes with their descendants, their edges, and annotations
   *  nested inside them. Rejects the change if any requested node is
   *  protected by the policy. */
  const removeNodes = (
    document: Document,
    nodeIds: ReadonlyArray<string>,
  ): Document | undefined => {
    const requested = nodeIds.map((id) => findNode(document, id));
    if (requested.some((node) => node === undefined || !canDelete(node))) return undefined;
    const removed = new Set(nodeIds.flatMap((id) => [id, ...descendantIds(document.nodes, id)]));
    return {
      nodes: document.nodes.filter((node) => !removed.has(node.id)),
      edges: document.edges.filter(
        (edge) => !removed.has(edge.source.nodeId) && !removed.has(edge.target.nodeId),
      ),
      annotations: document.annotations
        .filter(
          (annotation) => annotation.parentId === undefined || !removed.has(annotation.parentId),
        )
        .map((annotation) =>
          annotation.attachedTo === undefined
            ? annotation
            : { ...annotation, attachedTo: annotation.attachedTo.filter((id) => !removed.has(id)) },
        ),
    };
  };

  const removeNode = (document: Document, nodeId: string) => removeNodes(document, [nodeId]);

  /** Pins nodes at explicit positions relative to their parents. */
  const setPositions = (
    document: Document,
    positions: ReadonlyMap<string, Point>,
  ): Document | undefined => {
    for (const id of positions.keys()) {
      const node = findNode(document, id);
      const annotation = findAnnotation(document, id);
      if (annotation === undefined && (node === undefined || !canMove(node))) return undefined;
    }
    return {
      ...document,
      nodes: document.nodes.map((node) => {
        const position = positions.get(node.id);
        return position === undefined ? node : { ...node, position };
      }),
      annotations: document.annotations.map((annotation) => {
        const position = positions.get(annotation.id);
        return position === undefined ? annotation : { ...annotation, position };
      }),
    };
  };

  /** Removes pinned positions so the layout strategy places the nodes again.
   *  Omitting ids unpins every node. */
  const clearPositions = (document: Document, nodeIds?: ReadonlyArray<string>): Document => {
    const ids = nodeIds === undefined ? undefined : new Set(nodeIds);
    return {
      ...document,
      nodes: document.nodes.map((node) => {
        if (node.position === undefined || (ids !== undefined && !ids.has(node.id))) return node;
        const { position: _position, ...rest } = node;
        return rest;
      }),
    };
  };

  /** Nests a node under a new parent (or the root) at a position relative to
   *  that parent. Rejects moves into itself or a descendant. */
  const reparentNode = (
    document: Document,
    nodeId: string,
    parentId: string | undefined,
    position?: Point,
  ): Document | undefined => {
    const node = findNode(document, nodeId);
    if (node === undefined || !canMove(node) || !canNest(document, nodeId, parentId))
      return undefined;
    return {
      ...document,
      nodes: document.nodes.map((candidate) => {
        if (candidate.id !== nodeId) return candidate;
        const { parentId: _parentId, position: _position, ...rest } = candidate;
        return {
          ...rest,
          ...(parentId === undefined ? {} : { parentId }),
          ...(position === undefined ? {} : { position }),
        };
      }),
    };
  };

  const addEdge = (document: Document, edge: Edge): Document | undefined => {
    if (hasId(document, edge.id)) return undefined;
    if (connectionRejection(document, edge.source, edge.target) !== undefined) return undefined;
    return { ...document, edges: [...document.edges, edge] };
  };

  const updateEdge = (
    document: Document,
    edgeId: string,
    update: (edge: Edge) => Edge,
  ): Document | undefined => {
    const existing = findEdge(document, edgeId);
    if (existing === undefined) return undefined;
    const updated = { ...update(existing), id: existing.id };
    if (connectionRejection(document, updated.source, updated.target, edgeId) !== undefined) {
      return undefined;
    }
    return {
      ...document,
      edges: document.edges.map((edge) => (edge.id === edgeId ? updated : edge)),
    };
  };

  const reconnectEdge = (
    document: Document,
    edgeId: string,
    endpoints: Readonly<{ source?: Endpoint; target?: Endpoint }>,
  ) =>
    updateEdge(document, edgeId, (edge) => ({
      ...edge,
      source: endpoints.source ?? edge.source,
      target: endpoints.target ?? edge.target,
    }));

  const removeEdges = (
    document: Document,
    edgeIds: ReadonlyArray<string>,
  ): Document | undefined => {
    const ids = new Set(edgeIds);
    if (edgeIds.some((id) => findEdge(document, id) === undefined)) return undefined;
    return { ...document, edges: document.edges.filter((edge) => !ids.has(edge.id)) };
  };

  const addAnnotation = (
    document: Document,
    annotation: Annotation<AnnotationData>,
  ): Document | undefined => {
    if (hasId(document, annotation.id)) return undefined;
    if (
      annotation.parentId !== undefined &&
      findNode(document, annotation.parentId) === undefined
    ) {
      return undefined;
    }
    return { ...document, annotations: [...document.annotations, annotation] };
  };

  const updateAnnotation = (
    document: Document,
    annotationId: string,
    update: (annotation: Annotation<AnnotationData>) => Annotation<AnnotationData>,
  ): Document | undefined => {
    if (findAnnotation(document, annotationId) === undefined) return undefined;
    return {
      ...document,
      annotations: document.annotations.map((annotation) =>
        annotation.id === annotationId ? { ...update(annotation), id: annotation.id } : annotation,
      ),
    };
  };

  const reparentAnnotation = (
    document: Document,
    annotationId: string,
    parentId: string | undefined,
    position?: Point,
  ): Document | undefined => {
    if (parentId !== undefined && findNode(document, parentId) === undefined) return undefined;
    return updateAnnotation(document, annotationId, (annotation) => {
      const { parentId: _parentId, position: _position, ...rest } = annotation;
      return {
        ...rest,
        ...(parentId === undefined ? {} : { parentId }),
        ...(position === undefined ? {} : { position }),
      };
    });
  };

  /** Removes any mix of node, edge, and annotation ids. Node removal cascades
   *  to descendants and connected edges. */
  const removeElements = (document: Document, ids: ReadonlyArray<string>): Document | undefined => {
    const nodeIds = ids.filter((id) => findNode(document, id) !== undefined);
    const withoutNodes = nodeIds.length === 0 ? document : removeNodes(document, nodeIds);
    if (withoutNodes === undefined) return undefined;
    const removed = new Set(ids);
    return {
      ...withoutNodes,
      edges: withoutNodes.edges.filter((edge) => !removed.has(edge.id)),
      annotations: withoutNodes.annotations.filter((annotation) => !removed.has(annotation.id)),
    };
  };

  /** Offsets pinned positions. Nodes without a position start from
   *  `fallback`, typically the position the current layout assigned. */
  const translateElements = (
    document: Document,
    ids: ReadonlyArray<string>,
    delta: Point,
    fallback: (id: string) => Point | undefined = () => undefined,
  ): Document | undefined => {
    const positions = new Map<string, Point>();
    for (const id of ids) {
      const current =
        findNode(document, id)?.position ?? findAnnotation(document, id)?.position ?? fallback(id);
      if (current === undefined) return undefined;
      positions.set(id, addPoints(current, delta));
    }
    return setPositions(document, positions);
  };

  return {
    addAnnotation,
    addEdge,
    addNode,
    canConnect,
    canDelete,
    canMove,
    canNest,
    clearPositions,
    connectionRejection,
    reconnectEdge,
    removeEdges,
    removeElements,
    removeNode,
    removeNodes,
    reparentAnnotation,
    reparentNode,
    setPositions,
    translateElements,
    updateAnnotation,
    updateEdge,
    updateNode,
  } as const;
};

export type DiagramOperations<NodeData, EdgeData, AnnotationData> = ReturnType<
  typeof createDiagramOperations<NodeData, EdgeData, AnnotationData>
>;
