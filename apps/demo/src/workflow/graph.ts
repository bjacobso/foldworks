import {
  createStructuredWorkflowOperations,
  flowLocationFromId,
  flowLocationId,
  paletteTypeFromId,
  type FlowLocation,
} from "@foldworks/workflow";

import type {
  NodeKind,
  WorkflowDocument,
  WorkflowNode,
} from "./model";
import { nodeTypes } from "./node-types";

export const PALETTE_CONTAINER_ID = "node-palette";

export const operations = createStructuredWorkflowOperations<WorkflowNode>(nodeTypes);

export const findNode = operations.findElement;
export const findFlow = operations.findFlow;
export const moveNode = operations.moveElement;
export const updateNode = operations.updateElement;
export const deleteNode = operations.deleteElement;
export const allNodes = operations.elements;

export const canMoveNode = (document: WorkflowDocument, nodeId: string) => {
  const node = findNode(document, nodeId);
  return node !== undefined && nodeTypes[node.type].movable;
};

export type NodeSubtree = Readonly<{
  rootId: string;
  nodeIds: ReadonlySet<string>;
  flowIds: ReadonlySet<string>;
}>;

export const nodeSubtree = (
  document: WorkflowDocument,
  nodeId: string,
): NodeSubtree | undefined => {
  const root = findNode(document, nodeId);
  if (root === undefined) return undefined;
  const nodeIds = new Set<string>();
  const flowIds = new Set<string>();
  const visitNode = (node: WorkflowNode) => {
    nodeIds.add(node.id);
    for (const flow of node.branches) {
      flowIds.add(flow.id);
      for (const child of flow.elements) visitNode(child);
    }
  };
  visitNode(root);
  return { rootId: root.id, nodeIds, flowIds };
};

export const insertNewNode = (
  document: WorkflowDocument,
  location: FlowLocation,
  kind: NodeKind,
  nextId: number,
): Readonly<{ document: WorkflowDocument; node: WorkflowNode }> | undefined => {
  const node = nodeTypes[kind].create(`node-${nextId}`);
  const nextDocument = operations.insertElement(document, location, node);
  return nextDocument === undefined ? undefined : { document: nextDocument, node };
};

export const isNodeKind = (value: string): value is NodeKind => value in nodeTypes;

export const isNodeSize = (value: string) =>
  value === "compact" || value === "default" || value === "wide";

export const previewDocumentForDrop = (
  document: WorkflowDocument,
  itemId: string,
  containerId: string,
): WorkflowDocument | undefined => {
  const location = flowLocationFromId(containerId);
  if (location === undefined) return undefined;
  const paletteType = paletteTypeFromId(itemId);
  const paletteKind = paletteType !== undefined && isNodeKind(paletteType)
    ? paletteType
    : undefined;
  if (paletteKind !== undefined) {
    return insertNewNode(document, location, paletteKind, 0)?.document;
  }
  return moveNode(document, itemId, location);
};

export const dropLocationFromTarget = flowLocationFromId;
export const dropTargetId = flowLocationId;
